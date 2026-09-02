/**
 * Local sandbox provider — real child processes under a per-project workspace.
 *
 * Workspaces live under BARADA_SANDBOX_ROOT (default <repo>/.sandboxes/<projectId>).
 * Every exec/start runs with cwd locked inside that directory, a timeout,
 * an output cap, and a blocklist guard (see provider.ts). Nothing user-generated
 * ever executes inside the Next.js server process.
 *
 * Production hardening path: set SANDBOX_PROVIDER=e2b (or docker) and add an
 * adapter implementing SandboxProvider — the control plane only sees this file's
 * interface, so the swap is one file.
 */

import { spawn, exec as nodeExec } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  assertCommandAllowed,
  capOutput,
  type ExecResult,
  type ProcessInfo,
  type SandboxProvider,
} from "./provider";

const ROOT = process.env.BARADA_SANDBOX_ROOT ?? path.join(process.cwd(), ".sandboxes");
const DEFAULT_TIMEOUT_MS = Number(process.env.SANDBOX_TIMEOUT_MS ?? 120_000);
const MAX_OUTPUT = Number(process.env.SANDBOX_MAX_OUTPUT ?? 64_000);

type Live = {
  info: ProcessInfo;
  child: ReturnType<typeof spawn>;
  chunks: string[];
  bytes: number;
  onExit?: Array<(info: ProcessInfo) => void>;
};

export class LocalSandboxProvider implements SandboxProvider {
  readonly name = "local";

  /** projectId → live processes (module-scope: survives across requests in dev). */
  private live = new Map<string, Map<string, Live>>();

  workspacePath(projectId: string): string {
    if (!/^[a-z0-9]+$/i.test(projectId)) throw new Error("invalid project id");
    return path.join(ROOT, projectId);
  }

  async ensureWorkspace(projectId: string): Promise<string> {
    const ws = this.workspacePath(projectId);
    await mkdir(ws, { recursive: true });
    return ws;
  }

  private env(projectId: string, extra?: Record<string, string>): NodeJS.ProcessEnv {
    // NODE_ENV is required by the Next.js-authored ProcessEnv type in this
    // repo's tsconfig context; sandboxes get their own explicit value.
    // Isolation: sandbox gets a minimal, deterministic environment — never the
    // full server env (platform secrets can't leak into generated projects).
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "development",
      PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
      HOME: this.workspacePath(projectId),
      CI: "1",
      NO_COLOR: "1",
      npm_config_yes: "true",
      npm_config_fund: "false",
      npm_config_audit: "false",
      ...extra,
    };
    return env;
  }

  async exec(
    projectId: string,
    command: string,
    opts?: { cwd?: string; env?: Record<string, string>; timeoutMs?: number; maxOutput?: number }
  ): Promise<ExecResult> {
    assertCommandAllowed(command);
    const ws = await this.ensureWorkspace(projectId);
    const cwd = opts?.cwd ? path.resolve(ws, opts.cwd) : ws;
    if (!cwd.startsWith(ws)) throw new Error("cwd escapes workspace");
    const timeoutMs = Math.min(opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS, 10 * 60_000);
    const maxOut = opts?.maxOutput ?? MAX_OUTPUT;
    const started = Date.now();

    return new Promise<ExecResult>((resolve) => {
      const isWin = process.platform === "win32";
      const child = spawn(isWin ? "cmd" : "sh", isWin ? ["/d", "/s", "/c", command] : ["-c", command], {
        cwd,
        env: this.env(projectId, opts?.env),
        windowsHide: true,
        // cmd strips quotes from the /c string during arg-mangling unless
        // verbatim is set — without it `node -e "..."` loses its quotes.
        windowsVerbatimArguments: isWin,
      });

      let out = "";
      let err = "";
      let timedOut = false;
      const cap = maxOut + 4096;

      const timer = setTimeout(() => {
        timedOut = true;
        killTree(child);
      }, timeoutMs);

      child.stdout?.on("data", (d: Buffer) => { if (out.length < cap) out += d.toString(); });
      child.stderr?.on("data", (d: Buffer) => { if (err.length < cap) err += d.toString(); });
      child.on("error", (e) => {
        clearTimeout(timer);
        err += `\n${e.message}`;
        resolve({ exitCode: -1, stdout: capOutput(out, maxOut), stderr: capOutput(err, maxOut), timedOut, durationMs: Date.now() - started });
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({
          exitCode: code ?? (timedOut ? 124 : -1),
          stdout: capOutput(out, maxOut),
          stderr: capOutput(err, maxOut),
          timedOut,
          durationMs: Date.now() - started,
        });
      });
    });
  }

  async startProcess(
    projectId: string,
    command: string,
    opts?: { name?: string; cwd?: string; env?: Record<string, string>; onPort?: number }
  ): Promise<ProcessInfo> {
    assertCommandAllowed(command);
    const ws = await this.ensureWorkspace(projectId);
    const cwd = opts?.cwd ? path.resolve(ws, opts.cwd) : ws;
    if (!cwd.startsWith(ws)) throw new Error("cwd escapes workspace");

    const isWin = process.platform === "win32";
    const child = spawn(isWin ? "cmd" : "sh", isWin ? ["/d", "/s", "/c", command] : ["-c", command], {
      cwd,
      env: this.env(projectId, opts?.env),
      windowsHide: true,
      windowsVerbatimArguments: isWin,
      detached: !isWin, // posix: own process group so stop can kill the tree
    });

    const id = randomUUID();
    const info: ProcessInfo = {
      id,
      command,
      status: "RUNNING",
      pid: child.pid,
      port: opts?.onPort,
      startedAt: Date.now(),
      tail: "",
    };
    const live: Live = { info, child, chunks: [], bytes: 0 };
    this.mapFor(projectId).set(id, live);

    const push = (s: string) => {
      live.chunks.push(s);
      live.bytes += s.length;
      // keep ~128KB rolling buffer
      while (live.bytes > 131_072 && live.chunks.length > 1) {
        const first = live.chunks[0];
        live.bytes -= first.length;
        live.chunks.shift();
      }
      info.tail = live.chunks.join("").slice(-4000);
    };
    child.stdout?.on("data", (d: Buffer) => push(d.toString()));
    child.stderr?.on("data", (d: Buffer) => push(d.toString()));
    child.on("close", (code) => {
      info.status = info.status === "STOPPED" ? "STOPPED" : code === 0 ? "EXITED" : "FAILED";
      info.exitCode = code ?? -1;
    });
    child.on("error", (e) => {
      info.status = "FAILED";
      info.tail += `\n${e.message}`;
    });

    return info;
  }

  async stopProcess(projectId: string, processId: string): Promise<boolean> {
    const live = this.mapFor(projectId).get(processId);
    if (!live) return false;
    live.info.status = "STOPPED";
    killTree(live.child);
    return true;
  }

  listProcesses(projectId: string): ProcessInfo[] {
    const m = this.mapFor(projectId);
    // reap finished entries older than 1h to avoid unbounded growth
    for (const [id, l] of m) {
      if (l.info.status !== "RUNNING" && Date.now() - l.info.startedAt > 3_600_000) m.delete(id);
    }
    return [...m.values()].map((l) => l.info);
  }

  async readProcessOutput(projectId: string, processId: string, maxBytes = 16_000): Promise<string> {
    const live = this.mapFor(projectId).get(processId);
    if (!live) return "(process not found)";
    return capOutput(live.chunks.join(""), maxBytes);
  }

  async healthCheck(): Promise<{ ok: boolean; detail: string }> {
    return new Promise((resolve) => {
      const isWin = process.platform === "win32";
      const child = nodeExec(isWin ? "echo ok" : "echo ok", { timeout: 5000 }, (err) => {
        resolve({ ok: !err, detail: err ? String(err) : "shell available" });
      });
      child.on("error", (e) => resolve({ ok: false, detail: e.message }));
    });
  }

  private mapFor(projectId: string): Map<string, Live> {
    let m = this.live.get(projectId);
    if (!m) {
      m = new Map();
      this.live.set(projectId, m);
    }
    return m;
  }
}

/** Kill a child and its whole process tree, cross-platform. */
function killTree(child: ReturnType<typeof spawn>): void {
  if (!child.pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
  } else {
    try {
      process.kill(-child.pid, "SIGKILL"); // negative pid = process group
    } catch {
      child.kill("SIGKILL");
    }
  }
}

let instance: LocalSandboxProvider | null = null;

/** Configured provider singleton. SANDBOX_PROVIDER selects the backend. */
export function getSandbox(): SandboxProvider {
  const kind = process.env.SANDBOX_PROVIDER ?? "local";
  if (kind === "local") {
    instance ??= new LocalSandboxProvider();
    return instance;
  }
  // Future: e2b / docker adapters registered here.
  throw new Error(`Unknown SANDBOX_PROVIDER "${kind}" — supported: local`);
}
