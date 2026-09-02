import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizePath, isInsideDir } from "@/lib/projects/pathSafe";
import { getSandbox, } from "@/lib/sandbox/local";
import {
  syncedWrite, syncedRead, syncedDelete, syncedRename, syncedMkdir,
  listFilesMeta, searchInProject,
} from "@/lib/sandbox/sync";
import { createCheckpoint, listCheckpoints, restoreCheckpoint } from "@/lib/sandbox/checkpoints";
import { pickPort } from "@/lib/sandbox/verify";
import { verifyProjectFiles } from "@/lib/sandbox/qa";
import { webSearch, imageSearch, docsSearch, webSearchConfigured, imageSearchConfigured } from "@/lib/research/search";
import type { ToolSpec } from "./provider";

/**
 * Agent tools — real execution edition.
 * FS tools write through the sync layer (DB ⇄ sandbox disk); run_* tools
 * execute inside the project sandbox with timeouts and a command guard.
 */

export type ToolContext = { projectId: string; agentRun?: string };

export type ToolResult = { ok: true; output: string } | { ok: false; error: string };

type ToolDef = {
  spec: ToolSpec;
  execute: (args: unknown, ctx: ToolContext) => Promise<ToolResult>;
};

// ── filesystem tools (sync layer) ──────────────────────────────────────────

const listFiles: ToolDef = {
  spec: {
    type: "function",
    function: {
      name: "list_files",
      description: "List all files and folders in the project (excluding node_modules etc).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  execute: async (_args, ctx) => {
    const files = await listFilesMeta(ctx.projectId);
    if (files.length === 0) return { ok: true, output: "(project is empty)" };
    return {
      ok: true,
      output: files
        .map((f) => `${f.isDir ? "[dir] " : ""}${f.path}${f.isDir ? "" : ` (${f.size}B)`}`)
        .join("\n"),
    };
  },
};

const readFile: ToolDef = {
  spec: {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of one project file.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Relative file path" } },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  execute: async (args, ctx) => {
    const parsed = z.object({ path: z.string() }).safeParse(args);
    if (!parsed.success) return { ok: false, error: "path required" };
    try {
      const content = await syncedRead(ctx.projectId, parsed.data.path);
      if (content === null) return { ok: false, error: `file not found: ${parsed.data.path}` };
      return { ok: true, output: content.slice(0, 60_000) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "read failed" };
    }
  },
};

const writeFile: ToolDef = {
  spec: {
    type: "function",
    function: {
      name: "write_file",
      description: "Create or overwrite a project file with full content (writes to disk AND durable storage).",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative file path" },
          content: { type: "string", description: "Full file content" },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
  },
  execute: async (args, ctx) => {
    const parsed = z.object({ path: z.string(), content: z.string().max(2_000_000) }).safeParse(args);
    if (!parsed.success) return { ok: false, error: "path and content required (content ≤ 2MB)" };
    try {
      const r = await syncedWrite(ctx.projectId, parsed.data.path, parsed.data.content, ctx.agentRun);
      await prisma.project.update({ where: { id: ctx.projectId }, data: { updatedAt: new Date() } });
      return { ok: true, output: `written: ${r.path} (${r.size}B)` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "write failed" };
    }
  },
};

const editFile: ToolDef = {
  spec: {
    type: "function",
    function: {
      name: "edit_file",
      description: "Replace an exact substring in an existing file (old must match exactly and be unique).",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          old: { type: "string", description: "Exact text to replace" },
          new: { type: "string", description: "Replacement text" },
        },
        required: ["path", "old", "new"],
        additionalProperties: false,
      },
    },
  },
  execute: async (args, ctx) => {
    const parsed = z.object({ path: z.string(), old: z.string(), new: z.string() }).safeParse(args);
    if (!parsed.success) return { ok: false, error: "path, old, new required" };
    const content = await syncedRead(ctx.projectId, parsed.data.path);
    if (content === null) return { ok: false, error: `file not found: ${parsed.data.path}` };
    const count = content.split(parsed.data.old).length - 1;
    if (count === 0) {
      return {
        ok: false,
        error: `old text not found in ${parsed.data.path}. Current file starts with: ${content.slice(0, 2000)}`,
      };
    }
    if (count > 1) return { ok: false, error: `old text matches ${count} times — must be unique` };
    const updated = content.replace(parsed.data.old, parsed.data.new);
    await syncedWrite(ctx.projectId, parsed.data.path, updated, ctx.agentRun);
    await prisma.project.update({ where: { id: ctx.projectId }, data: { updatedAt: new Date() } });
    return { ok: true, output: `edited: ${parsed.data.path}` };
  },
};

const deleteFile: ToolDef = {
  spec: {
    type: "function",
    function: {
      name: "delete_file",
      description: "Delete a file, or a folder and everything inside it.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  execute: async (args, ctx) => {
    const parsed = z.object({ path: z.string() }).safeParse(args);
    if (!parsed.success) return { ok: false, error: "path required" };
    try {
      const n = await syncedDelete(ctx.projectId, parsed.data.path, ctx.agentRun);
      if (n === 0) return { ok: false, error: `not found: ${parsed.data.path}` };
      return { ok: true, output: `deleted ${n} entr${n === 1 ? "y" : "ies"}: ${parsed.data.path}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "delete failed" };
    }
  },
};

const renameFile: ToolDef = {
  spec: {
    type: "function",
    function: {
      name: "rename_file",
      description: "Rename/move a file or folder.",
      parameters: {
        type: "object",
        properties: { from: { type: "string" }, to: { type: "string" } },
        required: ["from", "to"],
        additionalProperties: false,
      },
    },
  },
  execute: async (args, ctx) => {
    const parsed = z.object({ from: z.string(), to: z.string() }).safeParse(args);
    if (!parsed.success) return { ok: false, error: "from and to required" };
    try {
      const n = await syncedRename(ctx.projectId, parsed.data.from, parsed.data.to, ctx.agentRun);
      return { ok: true, output: `renamed ${n} entries: ${parsed.data.from} → ${parsed.data.to}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "rename failed" };
    }
  },
};

const createDir: ToolDef = {
  spec: {
    type: "function",
    function: {
      name: "create_dir",
      description: "Create a directory in the project.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  execute: async (args, ctx) => {
    const parsed = z.object({ path: z.string() }).safeParse(args);
    if (!parsed.success) return { ok: false, error: "path required" };
    try {
      const p = await syncedMkdir(ctx.projectId, parsed.data.path);
      return { ok: true, output: `directory created: ${p}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "mkdir failed" };
    }
  },
};

const searchCode: ToolDef = {
  spec: {
    type: "function",
    function: {
      name: "search_code",
      description: "Search file contents for a substring (case-insensitive); returns matching files with line numbers.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Text to search for" } },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  execute: async (args, ctx) => {
    const parsed = z.object({ query: z.string().min(1).max(200) }).safeParse(args);
    if (!parsed.success) return { ok: false, error: "query required" };
    const hits = await searchInProject(ctx.projectId, parsed.data.query);
    return { ok: true, output: hits.length ? hits.join("\n") : "(no matches)" };
  },
};

// ── terminal / process tools (sandbox execution) ───────────────────────────

const runCommand: ToolDef = {
  spec: {
    type: "function",
    function: {
      name: "run_command",
      description:
        "Execute a shell command inside the project sandbox (npm install, npm run build, npx tsc --noEmit, git status, node script.js…). Returns exit code, stdout and stderr. Blocked: sudo, rm -rf /, fork bombs, curl|sh.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to run" },
          timeoutSec: { type: "number", description: "Optional timeout in seconds (default 120, max 600)" },
        },
        required: ["command"],
        additionalProperties: false,
      },
    },
  },
  execute: async (args, ctx) => {
    const parsed = z.object({ command: z.string().min(1).max(4000), timeoutSec: z.number().optional() }).safeParse(args);
    if (!parsed.success) return { ok: false, error: "command required" };
    const sandbox = getSandbox();
    try {
      const r = await sandbox.exec(ctx.projectId, parsed.data.command, {
        timeoutMs: Math.min((parsed.data.timeoutSec ?? 120) * 1000, 600_000),
      });
      const header = `exit ${r.exitCode}${r.timedOut ? " (TIMEOUT)" : ""} · ${r.durationMs}ms`;
      const body = [r.stdout && `stdout:\n${r.stdout.slice(0, 6000)}`, r.stderr && `stderr:\n${r.stderr.slice(0, 6000)}`]
        .filter(Boolean)
        .join("\n");
      // Persist for the terminal panel + audit.
      await prisma.terminalLog
        .create({
          data: {
            projectId: ctx.projectId,
            command: parsed.data.command,
            output: `${header}\n${body}`.slice(0, 100_000),
            exitCode: r.exitCode,
            kind: "exec",
          },
        })
        .catch(() => {});
      if (r.exitCode === 0) return { ok: true, output: `${header}\n${body || "(no output)"}`.slice(0, 12_000) };
      return { ok: false, error: `${header}\n${body || "(no output)"}`.slice(0, 12_000) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "exec failed" };
    }
  },
};

const startProcess: ToolDef = {
  spec: {
    type: "function",
    function: {
      name: "start_process",
      description:
        "Start a long-running process in the sandbox (e.g. dev server: 'npm run dev -- --port 3123' or 'node server.js'). Returns a processId you can pass to read_terminal_output / stop_process. Use get_process_status to check readiness.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Command to start" },
          name: { type: "string", description: "Short name, e.g. dev, api" },
          port: { type: "number", description: "Port the server will listen on (enables live preview)" },
        },
        required: ["command"],
        additionalProperties: false,
      },
    },
  },
  execute: async (args, ctx) => {
    const parsed = z
      .object({ command: z.string().min(1).max(2000), name: z.string().max(40).optional(), port: z.number().optional() })
      .safeParse(args);
    if (!parsed.success) return { ok: false, error: "command required" };
    try {
      const sandbox = getSandbox();
      const port = parsed.data.port ?? pickPort();
      const info = await sandbox.startProcess(ctx.projectId, parsed.data.command, {
        name: parsed.data.name ?? "dev",
        onPort: port,
        env: { PORT: String(port) },
      });
      await prisma.projectProcess
        .create({
          data: {
            projectId: ctx.projectId,
            name: info.command.slice(0, 120),
            command: info.command,
            status: "RUNNING",
            port,
            pid: info.pid,
            startedBy: "agent",
          },
        })
        .catch(() => {});
      return {
        ok: true,
        output: `process started: ${info.id} (port ${port}). Wait a few seconds, then run get_process_status or probe http://127.0.0.1:${port}/ via run_command "curl -s http://127.0.0.1:${port}/ | head -20"`,
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "start failed" };
    }
  },
};

const stopProcessTool: ToolDef = {
  spec: {
    type: "function",
    function: {
      name: "stop_process",
      description: "Stop a running sandbox process by id (kills the whole process tree).",
      parameters: {
        type: "object",
        properties: { processId: { type: "string" } },
        required: ["processId"],
        additionalProperties: false,
      },
    },
  },
  execute: async (args, ctx) => {
    const parsed = z.object({ processId: z.string() }).safeParse(args);
    if (!parsed.success) return { ok: false, error: "processId required" };
    const stopped = await getSandbox().stopProcess(ctx.projectId, parsed.data.processId);
    return stopped
      ? { ok: true, output: `stopped ${parsed.data.processId}` }
      : { ok: false, error: `process not found: ${parsed.data.processId}` };
  },
};

const processStatus: ToolDef = {
  spec: {
    type: "function",
    function: {
      name: "get_process_status",
      description: "List sandbox processes with status (RUNNING/EXITED/FAILED) and recent output tail.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  execute: async (_args, ctx) => {
    const procs = getSandbox().listProcesses(ctx.projectId);
    if (!procs.length) return { ok: true, output: "(no processes)" };
    return {
      ok: true,
      output: procs
        .map(
          (p) =>
            `${p.id.slice(0, 8)} ${p.status}${p.port ? ` :${p.port}` : ""} — ${p.command.slice(0, 80)}\n  tail: ${p.tail.split("\n").slice(-6).join(" | ").slice(0, 400)}`
        )
        .join("\n"),
    };
  },
};

const readTerminalOutput: ToolDef = {
  spec: {
    type: "function",
    function: {
      name: "read_terminal_output",
      description: "Read the recent combined stdout/stderr of a running process (dev server logs etc.).",
      parameters: {
        type: "object",
        properties: { processId: { type: "string" } },
        required: ["processId"],
        additionalProperties: false,
      },
    },
  },
  execute: async (args, ctx) => {
    const parsed = z.object({ processId: z.string() }).safeParse(args);
    if (!parsed.success) return { ok: false, error: "processId required" };
    const out = await getSandbox().readProcessOutput(ctx.projectId, parsed.data.processId, 8000);
    return { ok: true, output: out || "(no output yet)" };
  },
};

const installPackages: ToolDef = {
  spec: {
    type: "function",
    function: {
      name: "install_packages",
      description:
        "Install npm packages in the project sandbox. Equivalent to run_command('npm install <pkgs>') but with an 8-minute timeout tuned for installs.",
      parameters: {
        type: "object",
        properties: {
          packages: { type: "string", description: "Space-separated npm package names, optionally with versions" },
        },
        required: ["packages"],
        additionalProperties: false,
      },
    },
  },
  execute: async (args, ctx) => {
    const parsed = z.object({ packages: z.string().min(1).max(1000) }).safeParse(args);
    if (!parsed.success) return { ok: false, error: "packages required" };
    const pkgs = parsed.data.packages.split(/\s+/).filter((p) => /^[@a-zA-Z0-9._/@-]+$/.test(p));
    if (!pkgs.length) return { ok: false, error: "no valid package names" };
    const sandbox = getSandbox();
    const r = await sandbox.exec(ctx.projectId, `npm install ${pkgs.join(" ")} --no-audit --no-fund`, {
      timeoutMs: 8 * 60_000,
    });
    await prisma.terminalLog
      .create({
        data: {
          projectId: ctx.projectId,
          command: `npm install ${pkgs.join(" ")}`,
          output: `exit ${r.exitCode}\n${(r.stdout + r.stderr).slice(0, 50_000)}`,
          exitCode: r.exitCode,
          kind: "exec",
        },
      })
      .catch(() => {});
    return r.exitCode === 0
      ? { ok: true, output: `installed: ${pkgs.join(", ")}` }
      : { ok: false, error: `npm install failed (exit ${r.exitCode}):\n${(r.stderr || r.stdout).slice(-1500)}` };
  },
};

// ── QA / verification tools ────────────────────────────────────────────────

const verifySite: ToolDef = {
  spec: {
    type: "function",
    function: {
      name: "verify_site",
      description:
        "Run full QA on the project: entry point, link/asset resolution, JS syntax, fake-content markers. ALWAYS run before claiming done — fix every error it reports.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  execute: async (_args, ctx) => {
    const { ok, issues } = await verifyProjectFiles(ctx.projectId);
    if (!issues.length) return { ok: true, output: "QA PASSED: entry point OK, all references resolve, JS syntax valid, no fake-content markers." };
    const report = issues.map((i) => `[${i.severity.toUpperCase()}] ${i.message}`).join("\n");
    return ok ? { ok: true, output: `QA PASSED with warnings:\n${report}` } : { ok: false, error: `QA FAILED:\n${report}` };
  },
};

// ── checkpoint tools ───────────────────────────────────────────────────────

const checkpointSave: ToolDef = {
  spec: {
    type: "function",
    function: {
      name: "create_checkpoint",
      description: "Save a snapshot of the project files. Create one before risky/restructuring operations so you can roll back.",
      parameters: {
        type: "object",
        properties: { label: { type: "string", description: "Short label, e.g. 'before auth refactor'" } },
        required: ["label"],
        additionalProperties: false,
      },
    },
  },
  execute: async (args, ctx) => {
    const parsed = z.object({ label: z.string().min(1).max(120) }).safeParse(args);
    if (!parsed.success) return { ok: false, error: "label required" };
    const cp = await createCheckpoint(ctx.projectId, parsed.data.label);
    return { ok: true, output: `checkpoint saved: ${cp.id} (${cp.fileCount} files)` };
  },
};

const checkpointRestore: ToolDef = {
  spec: {
    type: "function",
    function: {
      name: "restore_checkpoint",
      description: "Restore the project to a saved checkpoint (replaces current files with the snapshot).",
      parameters: {
        type: "object",
        properties: { checkpointId: { type: "string" } },
        required: ["checkpointId"],
        additionalProperties: false,
      },
    },
  },
  execute: async (args, ctx) => {
    const parsed = z.object({ checkpointId: z.string() }).safeParse(args);
    if (!parsed.success) return { ok: false, error: "checkpointId required" };
    try {
      const r = await restoreCheckpoint(ctx.projectId, parsed.data.checkpointId);
      return { ok: true, output: `restored ${r.restored} files from checkpoint` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "restore failed" };
    }
  },
};

const checkpointList: ToolDef = {
  spec: {
    type: "function",
    function: {
      name: "list_checkpoints",
      description: "List saved checkpoints (newest first).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  execute: async (_args, ctx) => {
    const cps = await listCheckpoints(ctx.projectId);
    if (!cps.length) return { ok: true, output: "(no checkpoints yet)" };
    return {
      ok: true,
      output: cps.map((c) => `${c.id}  ${new Date(c.createdAt).toISOString()}  ${c.fileCount} files  "${c.label}"`).join("\n"),
    };
  },
};

// ── research tools (web / images / docs) ───────────────────────────────────

const webSearchTool: ToolDef = {
  spec: {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for current information: design research, library versions, API usage, competitor/product references. Use when it materially improves the result — not for every prompt.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          num: { type: "number", description: "Results to return (default 6, max 10)" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  execute: async (args) => {
    const parsed = z.object({ query: z.string().min(1).max(300), num: z.number().optional() }).safeParse(args);
    if (!parsed.success) return { ok: false, error: "query required" };
    if (!webSearchConfigured()) return { ok: false, error: "web search not configured (WEB_SEARCH_API_KEY missing)" };
    try {
      const results = await webSearch(parsed.data.query, parsed.data.num ?? 6);
      if (!results.length) return { ok: true, output: "(no results)" };
      return {
        ok: true,
        output: results.map((r) => `${r.title}\n${r.url}\n${r.snippet}`).join("\n---\n").slice(0, 8000),
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "search failed" };
    }
  },
};

const imageSearchTool: ToolDef = {
  spec: {
    type: "function",
    function: {
      name: "image_search",
      description:
        "Search the web for images (hero imagery, product photos, design references). Returns direct image URLs, page source and titles for attribution. Hotlink responsibly; prefer your own assets when possible.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Image search query" },
          num: { type: "number", description: "Results (default 6, max 10)" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  execute: async (args) => {
    const parsed = z.object({ query: z.string().min(1).max(300), num: z.number().optional() }).safeParse(args);
    if (!parsed.success) return { ok: false, error: "query required" };
    if (!imageSearchConfigured()) return { ok: false, error: "image search not configured (IMAGE_SEARCH_API_KEY missing)" };
    try {
      const results = await imageSearch(parsed.data.query, parsed.data.num ?? 6);
      if (!results.length) return { ok: true, output: "(no images found)" };
      return {
        ok: true,
        output: results
          .map((i) => `${i.title}\nimg: ${i.imageUrl}\nsource page: ${i.pageUrl} (${i.source})`)
          .join("\n---\n")
          .slice(0, 8000),
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "image search failed" };
    }
  },
};

const docsSearchTool: ToolDef = {
  spec: {
    type: "function",
    function: {
      name: "docs_search",
      description:
        "Search official documentation first (Next.js, React, Node, Prisma, Postgres, Vite, MDN). Use before guessing APIs or when the user wants current best practices.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Documentation topic, e.g. 'next.js app router route handlers'" } },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  execute: async (args) => {
    const parsed = z.object({ query: z.string().min(1).max(300) }).safeParse(args);
    if (!parsed.success) return { ok: false, error: "query required" };
    if (!webSearchConfigured()) return { ok: false, error: "docs search not configured (WEB_SEARCH_API_KEY missing)" };
    try {
      const results = await docsSearch(parsed.data.query);
      if (!results.length) return { ok: true, output: "(no results)" };
      return {
        ok: true,
        output: results.map((r) => `${r.title}\n${r.url}\n${r.snippet}`).join("\n---\n").slice(0, 8000),
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "docs search failed" };
    }
  },
};

// ── inspect ────────────────────────────────────────────────────────────────

const inspectProject: ToolDef = {
  spec: {
    type: "function",
    function: {
      name: "inspect_project",
      description: "Get project metadata: name, framework, language, description, file count, running processes.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  execute: async (_args, ctx) => {
    const p = await prisma.project.findUnique({
      where: { id: ctx.projectId },
      select: { name: true, framework: true, language: true, description: true },
    });
    if (!p) return { ok: false, error: "project not found" };
    const count = await prisma.projectFile.count({ where: { projectId: ctx.projectId } });
    const procs = getSandbox().listProcesses(ctx.projectId);
    return {
      ok: true,
      output: JSON.stringify(
        { ...p, fileCount: count, runningProcesses: procs.filter((x) => x.status === "RUNNING").length },
        null,
        1
      ),
    };
  },
};

// ── registry ───────────────────────────────────────────────────────────────

export const AGENT_TOOLS: ToolDef[] = [
  inspectProject,
  listFiles,
  readFile,
  writeFile,
  editFile,
  deleteFile,
  renameFile,
  createDir,
  searchCode,
  runCommand,
  startProcess,
  stopProcessTool,
  processStatus,
  readTerminalOutput,
  installPackages,
  verifySite,
  checkpointSave,
  checkpointRestore,
  checkpointList,
  webSearchTool,
  imageSearchTool,
  docsSearchTool,
];

export function toolSpecs(): ToolSpec[] {
  return AGENT_TOOLS.map((t) => t.spec);
}

/**
 * create_project is advertised to the model but executed by the agent loop
 * itself: it scaffolds the project, links the chat, and updates the tool
 * context mid-run.
 */
export const CREATE_PROJECT_SPEC: ToolSpec = {
  type: "function",
  function: {
    name: "create_project",
    description:
      "Create a new project for this conversation. Picks a professional scaffold based on the request (React+Vite SPA, Express API, fullstack Node, FastAPI, or static site) and builds on top of it. Required before any file operations when the chat has no project yet.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short project name, e.g. Moon Coffee" },
        description: { type: "string", description: "One-line description" },
        framework: { type: "string", description: "Hint: react/vite, express, node, python, static, next" },
        language: { type: "string", description: "Hint: typescript, javascript, python" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
};

export function allToolSpecs(): ToolSpec[] {
  return [...AGENT_TOOLS.map((t) => t.spec), CREATE_PROJECT_SPEC];
}

export async function executeTool(name: string, args: unknown, ctx: ToolContext): Promise<ToolResult> {
  const tool = AGENT_TOOLS.find((t) => t.spec.function.name === name);
  if (!tool) return { ok: false, error: `unknown tool: ${name}` };
  try {
    return await tool.execute(args, ctx);
  } catch (err) {
    console.error(`[agent-tool] ${name} failed:`, err);
    return { ok: false, error: "tool execution failed" };
  }
}

export { isInsideDir };
