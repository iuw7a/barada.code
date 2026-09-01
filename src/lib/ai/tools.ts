import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizePath, parentDir, isInsideDir } from "@/lib/projects/pathSafe";
import type { ToolSpec } from "./provider";

/**
 * Agent tools operate ONLY on ProjectFile rows (DB-backed file system).
 * Every path passes normalizePath (anti-traversal). Project access was
 * already authorized before the agent runs.
 */

export type ToolContext = { projectId: string };

export type ToolResult = { ok: true; output: string } | { ok: false; error: string };

type ToolDef = {
  spec: ToolSpec;
  execute: (args: unknown, ctx: ToolContext) => Promise<ToolResult>;
};

// ── helpers ────────────────────────────────────────────────────────────────

async function getProject(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, framework: true, language: true, description: true },
  });
}

async function writeFileRow(projectId: string, path: string, content: string) {
  await prisma.projectFile.upsert({
    where: { projectId_path: { projectId, path } },
    create: { projectId, path, isDir: false, content, size: Buffer.byteLength(content) },
    update: { content, size: Buffer.byteLength(content) },
  });
  // Ensure parent dirs exist.
  const parent = parentDir(path);
  if (parent) {
    const segments = parent.split("/");
    let acc = "";
    for (const seg of segments) {
      acc = acc ? `${acc}/${seg}` : seg;
      await prisma.projectFile.upsert({
        where: { projectId_path: { projectId, path: acc } },
        create: { projectId, path: acc, isDir: true },
        update: {},
      });
    }
  }
}

// ── tool definitions ───────────────────────────────────────────────────────

const listFiles: ToolDef = {
  spec: {
    type: "function",
    function: {
      name: "list_files",
      description: "List all files and folders in the project.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  execute: async (_args, ctx) => {
    const files = await prisma.projectFile.findMany({
      where: { projectId: ctx.projectId },
      select: { path: true, isDir: true, size: true },
      orderBy: { path: "asc" },
    });
    if (files.length === 0) return { ok: true, output: "(project is empty)" };
    return {
      ok: true,
      output: files.map((f) => `${f.isDir ? "[dir] " : ""}${f.path}${f.isDir ? "" : ` (${f.size}B)`}`).join("\n"),
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
        properties: { path: { type: "string", description: "Relative file path, e.g. src/App.tsx" } },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  execute: async (args, ctx) => {
    const parsed = z.object({ path: z.string() }).safeParse(args);
    if (!parsed.success) return { ok: false, error: "path required" };
    let path: string;
    try {
      path = normalizePath(parsed.data.path);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "invalid path" };
    }
    const file = await prisma.projectFile.findUnique({
      where: { projectId_path: { projectId: ctx.projectId, path } },
    });
    if (!file || file.isDir) return { ok: false, error: `file not found: ${path}` };
    return { ok: true, output: file.content ?? "" };
  },
};

const writeFile: ToolDef = {
  spec: {
    type: "function",
    function: {
      name: "write_file",
      description: "Create or overwrite a project file with full content.",
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
    let path: string;
    try {
      path = normalizePath(parsed.data.path);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "invalid path" };
    }
    if (path.endsWith("/")) return { ok: false, error: "path must be a file, not a directory" };
    await writeFileRow(ctx.projectId, path, parsed.data.content);
    await prisma.project.update({ where: { id: ctx.projectId }, data: { updatedAt: new Date() } });
    return { ok: true, output: `written: ${path} (${Buffer.byteLength(parsed.data.content)}B)` };
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
    let path: string;
    try {
      path = normalizePath(parsed.data.path);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "invalid path" };
    }
    const file = await prisma.projectFile.findUnique({
      where: { projectId_path: { projectId: ctx.projectId, path } },
    });
    if (!file || file.isDir) return { ok: false, error: `file not found: ${path}` };
    const content = file.content ?? "";
    const count = content.split(parsed.data.old).length - 1;
    if (count === 0) {
      // Give the model enough context to recover in one step.
      const head = content.slice(0, 2000);
      return {
        ok: false,
        error: `old text not found in ${path} (it may have changed). Current file starts with: ${head}`,
      };
    }
    if (count > 1) return { ok: false, error: `old text matches ${count} times — must be unique` };
    const updated = content.replace(parsed.data.old, parsed.data.new);
    await writeFileRow(ctx.projectId, path, updated);
    await prisma.project.update({ where: { id: ctx.projectId }, data: { updatedAt: new Date() } });
    return { ok: true, output: `edited: ${path}` };
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
    let path: string;
    try {
      path = normalizePath(parsed.data.path);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "invalid path" };
    }
    const deleted = await prisma.projectFile.deleteMany({
      where: { projectId: ctx.projectId, OR: [{ path }, { path: { startsWith: path + "/" } }] },
    });
    if (deleted.count === 0) return { ok: false, error: `not found: ${path}` };
    return { ok: true, output: `deleted ${deleted.count} entr${deleted.count === 1 ? "y" : "ies"}: ${path}` };
  },
};

const renameFile: ToolDef = {
  spec: {
    type: "function",
    function: {
      name: "rename_file",
      description: "Rename/move a file or folder (updates all paths inside a moved folder).",
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
    let from: string, to: string;
    try {
      from = normalizePath(parsed.data.from);
      to = normalizePath(parsed.data.to);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "invalid path" };
    }
    if (to.startsWith(from + "/")) return { ok: false, error: "cannot move a folder into itself" };

    const entries = await prisma.projectFile.findMany({
      where: { projectId: ctx.projectId, OR: [{ path: from }, { path: { startsWith: from + "/" } }] },
    });
    if (entries.length === 0) return { ok: false, error: `not found: ${from}` };

    for (const entry of entries) {
      const newPath = entry.path === from ? to : to + entry.path.slice(from.length);
      try {
        await prisma.projectFile.update({
          where: { projectId_path: { projectId: ctx.projectId, path: entry.path } },
          data: { path: newPath },
        });
      } catch {
        return { ok: false, error: `target exists: ${newPath}` };
      }
    }
    return { ok: true, output: `renamed ${entries.length} entries: ${from} → ${to}` };
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
    const files = await prisma.projectFile.findMany({
      where: { projectId: ctx.projectId, isDir: false },
      select: { path: true, content: true },
    });
    const needle = parsed.data.query.toLowerCase();
    const hits: string[] = [];
    for (const f of files) {
      const lines = (f.content ?? "").split("\n");
      lines.forEach((line, i) => {
        if (line.toLowerCase().includes(needle) && hits.length < 40) {
          hits.push(`${f.path}:${i + 1}: ${line.trim().slice(0, 160)}`);
        }
      });
      if (hits.length >= 40) break;
    }
    return { ok: true, output: hits.length ? hits.join("\n") : "(no matches)" };
  },
};

const inspectProject: ToolDef = {
  spec: {
    type: "function",
    function: {
      name: "inspect_project",
      description: "Get project metadata: name, framework, language, description, file count.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  execute: async (_args, ctx) => {
    const p = await getProject(ctx.projectId);
    if (!p) return { ok: false, error: "project not found" };
    const count = await prisma.projectFile.count({ where: { projectId: ctx.projectId } });
    return {
      ok: true,
      output: JSON.stringify({
        name: p.name,
        framework: p.framework,
        language: p.language,
        description: p.description,
        fileCount: count,
      }),
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
  searchCode,
];

export function toolSpecs(): ToolSpec[] {
  return AGENT_TOOLS.map((t) => t.spec);
}

/**
 * create_project is advertised to the model but executed by the agent loop
 * itself: it creates the project, links the chat, and updates the tool
 * context mid-run.
 */
export const CREATE_PROJECT_SPEC: ToolSpec = {
  type: "function",
  function: {
    name: "create_project",
    description:
      "Create a new project for this conversation. Required before any file operations when the chat has no project yet.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short project name, e.g. Moon Coffee" },
        description: { type: "string", description: "One-line description" },
        framework: { type: "string", description: "e.g. html, next, react" },
        language: { type: "string", description: "e.g. html, typescript" },
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
