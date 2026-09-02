import { NextRequest, NextResponse } from "next/server";
import { requireUser, apiErrorResponse } from "@/lib/auth/guard";
import { requireProjectAccess } from "@/lib/permissions";
import { getSandbox } from "@/lib/sandbox/local";

export const dynamic = "force-dynamic";

/**
 * GET /api/projects/[id]/live/[[...path]] — proxy to the project's RUNNING
 * dev server inside the sandbox. This is the live preview: the actual
 * application, served through an authenticated route (iframe-friendly).
 * When no server is running, returns a clear status page the UI interprets.
 */
async function proxy(req: NextRequest, ctx: { params: Promise<{ id: string; path?: string[] }> }) {
  try {
    const user = await requireUser();
    const { id, path: segments } = await ctx.params;
    await requireProjectAccess(user.id, id);

    const procs = getSandbox().listProcesses(id).filter((p) => p.status === "RUNNING" && p.port);
    if (procs.length === 0) {
      return NextResponse.json(
        { status: "STOPPED", message: "No dev server running for this project." },
        { status: 503 }
      );
    }

    const target = procs[0];
    const port = target.port!;
    const subPath = (segments ?? []).join("/");
    const url = `http://127.0.0.1:${port}/${subPath}${req.nextUrl.search}`;

    // Pick only safe headers to forward.
    const headers: Record<string, string> = { Accept: req.headers.get("accept") ?? "*/*" };
    const contentType = req.headers.get("content-type");
    if (contentType) headers["Content-Type"] = contentType;

    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.text(),
      signal: AbortSignal.timeout(30_000),
    });

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
