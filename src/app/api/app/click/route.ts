import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Public store URLs for the Barada mobile app. */
export const STORE_URLS: Record<string, string> = {
  google: "https://play.google.com/store/apps/details?id=ai.barada.app&hl=de",
  apple: "https://apps.apple.com/de/app/barada-ai/id6759335541",
};

/**
 * GET /api/app/click?store=google|apple
 * Records the click server-side (no client JS, no ad blockers interfere),
 * then 302-redirects the user to the real store listing.
 */
export async function GET(req: NextRequest) {
  const store = req.nextUrl.searchParams.get("store") ?? "google";
  const target = STORE_URLS[store];
  if (!target) return NextResponse.redirect(new URL("/app", req.url), 302);

  try {
    await prisma.appClick.create({
      data: {
        store,
        referrer: req.headers.get("referer")?.slice(0, 500) ?? null,
        userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
      },
    });
  } catch {
    // Never block the user on a logging failure — still send them to the store.
  }

  return NextResponse.redirect(target, 302);
}
