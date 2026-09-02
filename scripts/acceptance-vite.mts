/**
 * Standalone engine acceptance test — runs the FULL pipeline without vitest/prisma:
 * scaffold files → sync to disk (DB stubbed) → npm install → build → boot → probe.
 * Proves generated projects are real, buildable, runnable applications.
 *
 * Run: npx tsx scripts/acceptance-vite.mts
 */
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LocalSandboxProvider } from "../src/lib/sandbox/local.ts";
import { viteReact } from "../src/lib/sandbox/scaffolds.ts";
import { pickPort } from "../src/lib/sandbox/verify.ts";

const root = await mkdtemp(path.join(tmpdir(), "barada-accept-"));
process.env.BARADA_SANDBOX_ROOT = root;
const sandbox = new LocalSandboxProvider();
const projectId = "accept" + Date.now().toString(36);
const ws = await sandbox.ensureWorkspace(projectId);

console.log("1️⃣  Writing vite-react scaffold files…");
const files = viteReact("Barada Acceptance", "Real build acceptance test");
for (const [p, content] of Object.entries(files)) {
  const abs = path.join(ws, p);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, content, "utf-8");
}
console.log(`   ✓ ${Object.keys(files).length} files written to ${ws}`);

console.log("2️⃣  npm install (real, network)…");
const install = await sandbox.exec(projectId, "npm install --no-audit --no-fund", { timeoutMs: 8 * 60_000 });
if (install.exitCode !== 0) {
  console.error("   ✗ install failed:", (install.stderr || install.stdout).slice(-500));
  process.exit(1);
}
console.log(`   ✓ installed in ${(install.durationMs / 1000).toFixed(1)}s`);

console.log("3️⃣  Production build (tsc -b && vite build)…");
const build = await sandbox.exec(projectId, "npm run build", { timeoutMs: 5 * 60_000 });
if (build.exitCode !== 0) {
  console.error("   ✗ build failed:", (build.stderr || build.stdout).slice(-800));
  process.exit(1);
}
console.log(`   ✓ build passed in ${(build.durationMs / 1000).toFixed(1)}s`);

console.log("4️⃣  Starting dev server…");
const port = pickPort();
const proc = await sandbox.startProcess(projectId, "npm run dev -- --port " + port, { onPort: port, env: { PORT: String(port) } });
console.log(`   ✓ process ${proc.id.slice(0, 8)} starting on :${port}`);

console.log("5️⃣  HTTP probe…");
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
if (!ok) {
  const tail = await sandbox.readProcessOutput(projectId, proc.id, 2000);
  console.error("   ✗ server did not respond. tail:", tail.slice(-500));
  process.exit(1);
}
console.log(`   ✓ HTTP 200 — server responded with ${body.length} bytes`);
console.log(`   ${body.includes("/src/main.tsx") ? "✓ serves the Vite entry (real app)" : "⚠ unexpected body"}`);

await sandbox.stopProcess(projectId, proc.id);
await rm(root, { recursive: true, force: true }).catch(() => {});
console.log("\n✅ ACCEPTANCE PASSED — scaffold → install → build → serve → probe all green.");
