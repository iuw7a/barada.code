/**
 * Sandbox provider interface — the data plane for project execution.
 *
 * The control plane (Next.js + PostgreSQL) talks ONLY to this interface.
 * Implementations:
 *  - local.ts  → real child processes under a per-project workspace directory
 *                (development / single-node production)
 *  - (future)  → E2B / Firecracker / Fly Machines adapters implementing the
 *                same interface, selected by SANDBOX_PROVIDER env var.
 *
 * SECURITY CONTRACT: generated project code must NEVER execute inside the
 * Next.js server process. Every command runs as a separate OS process with a
 * cwd locked to the project workspace, timeouts, output caps, and a
 * blocklisted command guard. Container-level CPU/memory/egress isolation is
 * delegated to the provider (cgroups in the E2B/Firecracker path).
 */

export type ExecResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
};

export type ProcessInfo = {
  id: string; // provider-local process id
  command: string;
  status: "RUNNING" | "EXITED" | "FAILED" | "STOPPED";
  pid?: number;
  port?: number;
  startedAt: number;
  exitCode?: number;
  tail: string; // last N bytes of combined output
};

export interface SandboxProvider {
  readonly name: string;

  /** Ensure the workspace dir exists and is hydrated for this project. */
  ensureWorkspace(projectId: string): Promise<string>;

  /** Absolute path of the project workspace (control-plane use only). */
  workspacePath(projectId: string): string;

  /** Run a command to completion. Throws on guard violation. */
  exec(
    projectId: string,
    command: string,
    opts?: { cwd?: string; env?: Record<string, string>; timeoutMs?: number; maxOutput?: number }
  ): Promise<ExecResult>;

  /** Start a long-running process (dev server etc.). Returns immediately. */
  startProcess(
    projectId: string,
    command: string,
    opts?: { name?: string; cwd?: string; env?: Record<string, string>; onPort?: number }
  ): Promise<ProcessInfo>;

  /** Stop a running process (kills the whole process tree). */
  stopProcess(projectId: string, processId: string): Promise<boolean>;

  /** List live processes for a project. */
  listProcesses(projectId: string): ProcessInfo[];

  /** Read recent combined output of a process. */
  readProcessOutput(projectId: string, processId: string, maxBytes?: number): Promise<string>;

  /** Check whether the sandbox backend is available (deps installed etc.). */
  healthCheck(): Promise<{ ok: boolean; detail: string }>;
}

/** Commands that must never run inside a project sandbox. */
const BLOCKED = [
  /rm\s+-rf\s+\/(?!tmp|home)/i, // rm -rf on absolute root paths
  /sudo|su\s+/i,
  /mkfs|fdisk|dd\s+if=/i,
  /shutdown|reboot|halt|poweroff/i,
  /:\(\)\s*\{.*\};\s*:/, // fork bomb
  /curl[^|]*\|\s*(ba)?sh/i, // curl | sh
  /wget[^|]*\|\s*(ba)?sh/i,
  /chmod\s+777\s+\//i,
  /chown\s+-R\s+[^ ]*\s+\//i,
  />\/dev\/sd[a-z]/i,
  /\bkillall\b/i,
  /taskkill\s+\/IM\s+node\.exe/i, // would kill the host server on Windows
];

export function assertCommandAllowed(command: string): void {
  const cmd = command.trim();
  if (!cmd) throw new Error("empty command");
  if (cmd.length > 4000) throw new Error("command too long");
  for (const re of BLOCKED) {
    if (re.test(cmd)) throw new Error(`command blocked by sandbox guard: ${cmd.slice(0, 80)}`);
  }
}

/** Truncate output to a cap, keeping the tail (errors live at the end). */
export function capOutput(s: string, max: number): string {
  if (s.length <= max) return s;
  return `[…output truncated…]\n${s.slice(-max)}`;
}
