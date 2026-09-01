import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, apiErrorResponse, ApiError } from "@/lib/auth/guard";
import { requireProjectAccess } from "@/lib/permissions";
import { normalizePath } from "@/lib/projects/pathSafe";

/**
 * GET /api/projects/[id]/preview/[[...path]]
 * Serves project files for the sandboxed preview iframe. Real URLs (not
 * srcdoc) so relative <link>/<script>/<a> references inside the site resolve
 * naturally: /api/projects/{id}/preview/ + "styles.css", "menu.html", …
 * Isolation comes from the iframe sandbox + auth — nothing executes on the host.
 */

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "application/javascript; charset=utf-8",
  mjs: "application/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  txt: "text/plain; charset=utf-8",
  md: "text/plain; charset=utf-8",
  woff: "font/woff",
  woff2: "font/woff2",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; path?: string[] }> }
) {
  try {
    const user = await requireUser();
    const { id, path: segments } = await params;
    await requireProjectAccess(user.id, id);

    // Default entry: index.html (preview.html kept as an explicit override
    // only when requested directly).
    const raw = segments?.length ? segments.join("/") : "index.html";
    let norm: string;
    try {
      norm = normalizePath(raw);
    } catch (e) {
      throw new ApiError(400, e instanceof Error ? e.message : "Invalid path");
    }

    const file = await prisma.projectFile.findUnique({
      where: { projectId_path: { projectId: id, path: norm } },
    });
    if (!file || file.isDir) {
      return new NextResponse("Not found in preview", { status: 404 });
    }

    const ext = file.path.split(".").pop()?.toLowerCase() ?? "";
    return new NextResponse(file.content, {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "no-store",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
