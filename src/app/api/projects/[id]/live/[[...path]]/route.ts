import { NextRequest, NextResponse } from "next/server";
import { requireUser, apiErrorResponse } from "@/lib/auth/guard";
import { requireProjectAccess } from "@/lib/permissions";
import { getSandbox } from "@/lib/sandbox/local";

export const dynamic = "force-dynamic";

/**
 * GET /api/projects/[id]/live/[[...path]] — proxy to the project's RUNNING
 * dev server inside the sandbox. This is the live preview: the actual
 * application, served through an authenticated route (iframe-friendly).
 *
 * When no server is running (or it's still booting) we return a styled
 * auto-retrying HTML page instead of a raw error — the iframe refreshes
 * itself until the app is up. API clients (Accept: application/json)
 * still get proper JSON status responses.
 */

function retryPage(title: string, detail: string): NextResponse {
  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="refresh" content="3">
<style>body{font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#0b0d12;color:#eef0f4;margin:0}
div{text-align:center;max-width:420px;padding:24px}
.dot{width:10px;height:10px;border-radius:50%;background:#10a35f;display:inline-block;margin-bottom:14px;animation:p 1.2s ease-in-out infinite}
@keyframes p{0%,100%{opacity:.3}50%{opacity:1}}
h1{font-size:17px;margin:0 0 6px}p{color:#8f97a5;font-size:13px;line-height:1.5}</style></head>
<body><div><span class="dot"></span><h1>${title}</h1><p>${detail}</p></div></body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function proxy(req: NextRequest, ctx: { params: Promise<{ id: string; path?: string[] }> }) {
  try {
    const user = await requireUser();
    const { id, path: segments } = await ctx.params;
    await requireProjectAccess(user.id, id);

    const wantsHtml = (req.headers.get("accept") ?? "").includes("text/html");

    const procs = getSandbox().listProcesses(id).filter((p) => p.status === "RUNNING" && p.port);
    if (procs.length === 0) {
      const msg = "No dev server running for this project.";
      if (wantsHtml) return retryPage("Server not running", "Start the dev server (▶ button) or ask Barada to run the app. This page retries automatically.");
      return NextResponse.json({ status: "STOPPED", message: msg }, { status: 503 });
    }

    const target = procs[0];
    const port = target.port!;
    const subPath = (segments ?? []).join("/");
    const url = `http://127.0.0.1:${port}/${subPath}${req.nextUrl.search}`;

    // Pick only safe headers to forward.
    const headers: Record<string, string> = { Accept: req.headers.get("accept") ?? "*/*" };
    const contentType = req.headers.get("content-type");
    if (contentType) headers["Content-Type"] = contentType;

    let upstream: Response;
    try {
      upstream = await fetch(url, {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.text(),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (e) {
      // Server process exists but isn't accepting connections yet (booting).
      const msg = e instanceof Error ? e.message : "upstream not reachable";
      if (wantsHtml) return retryPage("Starting your app…", "The dev server is booting. This preview retries every 3 seconds.");
      return NextResponse.json({ status: "BOOTING", message: msg }, { status: 503 });
    }

    const resHeaders = new Headers();
    for (const h of ["content-type", "cache-control", "location"]) {
      const v = upstream.headers.get(h);
      if (v) resHeaders.set(h, v);
    }
    resHeaders.set("X-Barada-Live", `port:${port}`);
    const body = await upstream.arrayBuffer();
    return new NextResponse(body, { status: upstream.status, headers: resHeaders });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
