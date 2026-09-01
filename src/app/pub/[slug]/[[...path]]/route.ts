import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Public renderer for published projects (no auth — this IS the public site).
 * Middleware rewrites {subdomain}.{ROOT_DOMAIN}/* → /pub/{subdomain}/*.
 *
 * HTML files get their relative asset references (href/src) rewritten to
 * absolute /pub/{slug}/... paths so CSS/JS/images resolve correctly.
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

function contentType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "application/octet-stream";
}

/** Rewrite relative src/href references in HTML to /pub/{slug}-absolute ones. */
function rewriteHtml(html: string, slug: string): string {
  const base = `/pub/${slug}`;
  return html.replace(
    /\s(src|href)(\s*=\s*)(["'])(?!(?:https?:|\/\/|\/|#|data:|mailto:|tel:))([^"']+)\3/gi,
    (_m, attr, eq, quote, value) => ` ${attr}${eq}${quote}${base}/${value}${quote}`
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; path?: string[] }> }
) {
  const { slug, path: segments } = await params;

  const deployment = await prisma.deployment.findUnique({
    where: { subdomain: slug.toLowerCase() },
    select: { status: true, projectId: true },
  });
  if (!deployment || deployment.status !== "LIVE") {
    return new NextResponse(notFoundPage("Site not found"), {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  let filePath = (segments ?? []).join("/");
  if (!filePath || filePath.endsWith("/")) filePath += "index.html";

  const lookup = (p: string) =>
    prisma.projectFile.findUnique({
      where: { projectId_path: { projectId: deployment.projectId, path: p } },
    });

  let file = await lookup(filePath);
  // Site root fallbacks: index.html, then public/index.html (some builds put
  // the frontend under public/ next to their backend code).
  if ((!file || file.isDir) && filePath === "index.html") {
    file = (await lookup("public/index.html")) ?? null;
  }

  if (!file || file.isDir) {
    // Directory-style request fallback: /about → /about.html? or index.html
    if (!filePath.endsWith(".html")) {
      const alt = await prisma.projectFile.findUnique({
        where: { projectId_path: { projectId: deployment.projectId, path: `${filePath}.html` } },
      });
      if (alt && !alt.isDir) {
        return htmlResponse(rewriteHtml(alt.content ?? "", slug));
      }
    }
    return new NextResponse(notFoundPage("Page not found"), {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const isHtml = contentType(file.path).startsWith("text/html");
  const body = isHtml ? rewriteHtml(file.content ?? "", slug) : file.content ?? "";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType(file.path),
      "Cache-Control": "public, max-age=60",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}

function htmlResponse(html: string): NextResponse {
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" },
  });
}

function notFoundPage(message: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Barada Code</title>
<style>body{font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#0b0d12;color:#eef0f4;margin:0}
div{text-align:center}h1{font-size:22px;margin-bottom:8px}p{color:#8f97a5;font-size:14px}</style></head>
<body><div><h1>${message}</h1><p>Published with Barada Code</p></div></body></html>`;
}
