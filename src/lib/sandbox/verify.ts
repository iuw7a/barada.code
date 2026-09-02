/**
 * Verify pipeline — the enforced Definition of Done for generated projects.
 *
 * Sequence: install → (typecheck) → build → start server → HTTP health probe.
 * Each step returns structured, actionable output that the agent loop feeds
 * back to the model for self-repair. A project is "verified" only when the
 * server boots AND responds on its port (or, for static projects, the entry
 * file exists and passes static QA).
 */

import { getSandbox } from "./local";
import { verifyProjectFiles } from "./qa";
import { prisma } from "@/lib/prisma";

export type VerifyStep = {
  name: string;
  ok: boolean;
  skipped?: boolean;
  detail: string;
  durationMs: number;
};

export type VerifyReport = {
  ok: boolean;
  mode: "static" | "server";
  steps: VerifyStep[];
  url?: string;
  summary: string;
};

const INSTALL_TIMEOUT = 8 * 60_000;
const BUILD_TIMEOUT = 5 * 60_000;
const BOOT_TIMEOUT = 45_000;

function hasPkg(projectId: string): Promise<boolean> {
  return getSandbox()
    .exec(projectId, "node -e \"require('fs').accessSync('package.json'); console.log('y')\"", { timeoutMs: 10_000 })
    .then((r) => r.stdout.trim() === "y")
    .catch(() => false);
}

function isPythonProject(projectId: string): Promise<boolean> {
  return getSandbox()
    .exec(projectId, "node -e \"require('fs').accessSync('requirements.txt'); console.log('y')\"", { timeoutMs: 10_000 })
    .then((r) => r.stdout.trim() === "y")
    .catch(() => false);
}

async function waitUntilResponsive(port: number, timeoutMs = BOOT_TIMEOUT): Promise<{ ok: boolean; status?: number; body?: string }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(2500) });
      const body = (await res.text().catch(() => "")).slice(0, 400);
      return { ok: res.ok, status: res.status, body };
    } catch {
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
  return { ok: false };
}

/** Find a free port in a project-safe range. */
export function pickPort(): number {
  return 3100 + Math.floor(Math.random() * 400);
}

export async function verifyProject(projectId: string): Promise<VerifyReport> {
  const sandbox = getSandbox();
  const steps: VerifyStep[] = [];
  const step = async (name: string, fn: () => Promise<{ ok: boolean; detail: string; skipped?: boolean }>) => {
    const t0 = Date.now();
    try {
      const r = await fn();
      steps.push({ name, ok: r.ok, skipped: r.skipped, detail: r.detail, durationMs: Date.now() - t0 });
    } catch (e) {
      steps.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e), durationMs: Date.now() - t0 });
    }
  };

  const node = await hasPkg(projectId);
  const python = node ? false : await isPythonProject(projectId);
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { framework: true } });
  const staticFramework = !node && !python;

  // 1. Static QA always runs (entry points, link resolution, fake markers).
  await step("static-qa", async () => {
    const { ok, issues } = await verifyProjectFiles(projectId);
    return {
      ok,
      detail: issues.length
        ? issues.map((i: { severity: string; message: string }) => `[${i.severity}] ${i.message}`).join("; ").slice(0, 800)
        : "entry + references + syntax OK",
    };
  });

  // 2. Dependency install.
  let depsInstalled = false;
  await step("install", async () => {
    if (!node) return { ok: true, skipped: true, detail: "no package.json" };
    // Skip if node_modules already present (repeat verification).
    const nm = await sandbox.exec(projectId, "node -e \"require('fs').accessSync('node_modules'); console.log('y')\"", { timeoutMs: 10_000 });
    if (nm.stdout.trim() === "y") {
      depsInstalled = true;
      return { ok: true, detail: "node_modules present" };
    }
    const r = await sandbox.exec(projectId, "npm install --no-audit --no-fund", { timeoutMs: INSTALL_TIMEOUT });
    depsInstalled = r.exitCode === 0;
    return {
      ok: r.exitCode === 0,
      detail: r.exitCode === 0 ? `installed in ${(r.durationMs / 1000).toFixed(1)}s` : `exit ${r.exitCode}: ${(r.stderr || r.stdout).slice(-600)}`,
    };
  });

  // 3. Typecheck (only when tsconfig exists — tsc must be local).
  await step("typecheck", async () => {
    if (!node || !depsInstalled) return { ok: true, skipped: true, detail: "skipped" };
    const ts = await sandbox.exec(projectId, "node -e \"require('fs').accessSync('tsconfig.json'); console.log('y')\"", { timeoutMs: 10_000 });
    if (ts.stdout.trim() !== "y") return { ok: true, skipped: true, detail: "no tsconfig.json" };
    const r = await sandbox.exec(projectId, "npx tsc --noEmit", { timeoutMs: BUILD_TIMEOUT });
    return {
      ok: r.exitCode === 0,
      detail: r.exitCode === 0 ? "types OK" : (r.stdout || r.stderr).slice(-900),
    };
  });

  // 4. Production build (skipped for pure static + dev-server frameworks).
  let buildCommand: string | null = null;
  await step("build", async () => {
    if (!node || !depsInstalled) return { ok: true, skipped: true, detail: "skipped" };
    const scripts = await sandbox.exec(projectId, "node -p \"Object.keys(require('./package.json').scripts||{}).join(' ')\"", { timeoutMs: 10_000 });
    const available = scripts.stdout.trim().split(/\s+/);
    if (available.includes("build")) buildCommand = "npm run build";
    else return { ok: true, skipped: true, detail: "no build script" };
    const r = await sandbox.exec(projectId, buildCommand, { timeoutMs: BUILD_TIMEOUT });
    return {
      ok: r.exitCode === 0,
      detail: r.exitCode === 0 ? "build OK" : `exit ${r.exitCode}: ${(r.stderr || r.stdout).slice(-900)}`,
    };
  });

  // 5. Boot + HTTP probe (server projects only).
  let liveUrl: string | undefined;
  await step("boot", async () => {
    if (staticFramework) {
      return { ok: true, skipped: true, detail: "static project — preview serves files directly" };
    }
    const scripts = await sandbox.exec(projectId, "node -p \"Object.keys(require('./package.json').scripts||{}).join(' ')\"", { timeoutMs: 10_000 });
    const available = scripts.stdout.trim().split(/\s+/);
    const devScript = available.includes("dev") ? "npm run dev" : available.includes("start") ? "npm start" : null;
    if (!devScript) return { ok: true, skipped: true, detail: "no dev/start script" };

    // Python projects: uvicorn
    const command = python ? "python -m uvicorn main:app --host 0.0.0.0 --port $PORT" : devScript;
    const port = pickPort();
    const proc = await sandbox.startProcess(projectId, command.replace(/\$PORT/g, String(port)), {
      name: "dev",
      onPort: port,
      env: { PORT: String(port), NODE_ENV: "development" },
    });

    const probe = await waitUntilResponsive(port);
    if (probe.ok) {
      liveUrl = `http://127.0.0.1:${port}`;
      return { ok: true, detail: `server up on :${port} (HTTP ${probe.status})` };
    }
    // Boot failed — capture the process tail as the error detail.
    const tail = await sandbox.readProcessOutput(projectId, proc.id, 4000);
    await sandbox.stopProcess(projectId, proc.id);
    return { ok: false, detail: `no response on :${port} within ${BOOT_TIMEOUT / 1000}s. Output: ${tail.slice(-900)}` };
  });

  const ok = steps.every((s) => s.ok);
  const failed = steps.filter((s) => !s.ok).map((s) => `${s.name}: ${s.detail.slice(0, 200)}`);
  return {
    ok,
    mode: staticFramework ? "static" : "server",
    steps,
    url: liveUrl,
    summary: ok
      ? `All checks passed (${steps.filter((s) => !s.skipped).length} active steps).${liveUrl ? ` Serving at ${liveUrl}.` : ""}`
      : `FAILED — ${failed.join(" | ")}`,
  };
}
