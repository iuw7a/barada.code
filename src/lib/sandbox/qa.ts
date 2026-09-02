/**
 * Static QA for project files — entry point, link/asset resolution, JS syntax
 * and fake-functionality markers. Used by the verify_site tool and as step 1
 * of the verification pipeline.
 */

import { prisma } from "@/lib/prisma";

export type SiteIssue = { severity: "error" | "warning"; message: string };

export async function verifyProjectFiles(projectId: string): Promise<{ ok: boolean; issues: SiteIssue[] }> {
  const issues: SiteIssue[] = [];
  const files = await prisma.projectFile.findMany({
    where: { projectId, isDir: false },
    select: { path: true, content: true },
  });
  const byPath = new Map(files.map((f) => [f.path, f.content ?? ""]));

  // Entry point: index.html OR a real framework entry (package.json with src/).
  const hasStaticEntry = byPath.has("index.html") || byPath.has("public/index.html");
  const hasAppEntry = byPath.has("package.json") && [...byPath.keys()].some((p) => /^src\/(main|index|App)\.(tsx?|jsx?)$/.test(p));
  const hasServerEntry = byPath.has("server.js") || byPath.has("main.py") || byPath.has("app.py");
  if (!hasStaticEntry && !hasAppEntry && !hasServerEntry) {
    issues.push({ severity: "error", message: "no entry point — need index.html, src/main.tsx (with package.json), or server.js/main.py" });
  }

  // Resolve every href/src/target reference in HTML files.
  const refRe = /(?:href|src)\s*=\s*["']([^"'#]+)["']/gi;
  for (const [path, html] of byPath) {
    if (!path.endsWith(".html")) continue;
    for (const match of html.matchAll(refRe)) {
      const raw = match[1].trim();
      if (!raw || /^(https?:|mailto:|tel:|data:|javascript:)/i.test(raw)) continue;
      const clean = raw.split("?")[0].split("#")[0];
      if (!clean) continue;
      const candidates = [
        clean.replace(/^\.\//, ""),
        clean.replace(/^\.?\//, "").replace(/\/$/, "/index.html"),
        path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) + clean.replace(/^\.\//, "") : clean,
      ];
      if (!candidates.some((c) => byPath.has(c))) {
        issues.push({ severity: "error", message: `${path}: broken reference "${raw}" — file not written` });
      }
    }
  }

  // JS syntax check (classic scripts — new Function parse).
  for (const [path, code] of byPath) {
    if (!/\.js$/.test(path) || path.startsWith("node_modules/")) continue;
    try {
      // eslint-disable-next-line no-new-func
      new Function(code);
    } catch (e) {
      issues.push({ severity: "error", message: `${path}: JavaScript syntax error — ${e instanceof Error ? e.message.slice(0, 120) : "parse failed"}` });
    }
  }

  // Fake-functionality markers in deliverable UI.
  const FAKE = /lorem ipsum|coming soon|placeholder text|TODO: implement|feature not available/i;
  for (const [path, content] of byPath) {
    if (path.endsWith(".html") && FAKE.test(content)) {
      issues.push({ severity: "warning", message: `${path}: contains placeholder/unfinished markers — replace with real content or working behavior` });
    }
  }

  return { ok: !issues.some((i) => i.severity === "error"), issues };
}
