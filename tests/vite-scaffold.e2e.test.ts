/**
 * Acceptance test — the real Barada pipeline against a Vite scaffold.
 * Runs purely against the sandbox (no DB): scaffold files → install →
 * build → boot → HTTP probe. Gated behind SANDBOX_E2E=1 (network + npm).
 * (The DB-sync path is covered by the standalone scripts/acceptance-vite.mts.)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LocalSandboxProvider } from "../src/lib/sandbox/local";
import { viteReact } from "../src/lib/sandbox/scaffolds";

const RUN_E2E = process.env.SANDBOX_E2E === "1";

describe.skipIf(!RUN_E2E)("vite scaffold end-to-end (real build)", () => {
  let root: string;
  let sandbox: LocalSandboxProvider;
  const projectId = "vitee2e" + Date.now().toString(36);

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), "barada-vite-"));
    process.env.BARADA_SANDBOX_ROOT = root;
    sandbox = new LocalSandboxProvider();
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  });

  it("scaffolds a complete vite-react project to disk", async () => {
    const files = viteReact("Test App", "SaaS dashboard");
    expect(Object.keys(files).length).toBeGreaterThan(5);
    const ws = await sandbox.ensureWorkspace(projectId);
    for (const [p, content] of Object.entries(files)) {
      const abs = path.join(ws, p);
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, content, "utf-8");
    }
    // Real files exist on disk:
    await expect(stat(path.join(ws, "package.json"))).resolves.toBeTruthy();
    await expect(stat(path.join(ws, "src", "App.tsx"))).resolves.toBeTruthy();
  });

  it("installs, builds, boots and serves the real application", async () => {
    const install = await sandbox.exec(projectId, "npm install --no-audit --no-fund", { timeoutMs: 480_000 });
    expect(install.exitCode, `install: ${(install.stderr || install.stdout).slice(-300)}`).toBe(0);

    const build = await sandbox.exec(projectId, "npm run build", { timeoutMs: 300_000 });
    expect(build.exitCode, `build: ${(build.stderr || build.stdout).slice(-500)}`).toBe(0);

    const port = 3300 + Math.floor(Math.random() * 200);
    const proc = await sandbox.startProcess(projectId, `npm run dev -- --port ${port}`, {
      onPort: port,
      env: { PORT: String(port) },
    });
    let ok = false;
    let body = "";
    for (let i = 0; i < 30 && !ok; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const res = await fetch(`http://127.0.0.1:${port}/`);
        if (res.ok) {
          body = await res.text();
          ok = true;
        }
      } catch { /* retry */ }
    }
    expect(ok, "dev server responds").toBe(true);
    expect(body).toContain("/src/main.tsx");
    await sandbox.stopProcess(projectId, proc.id);
  }, 600_000);
});
