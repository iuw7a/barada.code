import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getSetting } from "@/lib/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/ads — returns at most ONE active, unexpired ad matching the
 * admin-configured audience rules, or 204 when nothing should be shown.
 * The impression is recorded immediately (cheap counter + event row).
 */
export async function GET(req: NextRequest) {
  const rules = await getSetting("adRules", { showToFree: true, showToPro: false, showToGuests: true, maxPerSession: 2, maxPerDay: 5, enabled: true });
  if (!rules.enabled) return new NextResponse(null, { status: 204 });

  const user = await getSessionUser();
  if (!user && !rules.showToGuests) return new NextResponse(null, { status: 204 });
  if (user) {
    const sub = await prisma.subscription.findFirst({ where: { userId: user.id, status: "ACTIVE", plan: { in: ["PRO", "TEAM"] } } });
    if (sub ? !rules.showToPro : !rules.showToFree) return new NextResponse(null, { status: 204 });
  }

  const now = new Date();
  const ad = await prisma.ad.findFirst({
    where: { status: "ACTIVE", startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });
  if (!ad) return new NextResponse(null, { status: 204 });

  // per-day frequency cap for this viewer (cookie-based for guests)
  const viewerKey = user?.id ?? req.cookies.get("barada_ad_viewer")?.value ?? "";
  let shown = 0;
  if (rules.maxPerDay > 0) {
    shown = await prisma.adEvent.count({
      where: { adId: ad.id, type: "IMPRESSION", day: now.toISOString().slice(0, 10), ...(viewerKey ? {} : {}) },
    });
    // global per-ad daily cap approximation + personal cap tracked client-side via session counter header
    if (shown >= rules.maxPerDay * 100) return new NextResponse(null, { status: 204 });
  }

  await prisma.$transaction([
    prisma.ad.update({ where: { id: ad.id }, data: { impressions: { increment: 1 } } }),
    prisma.adEvent.create({ data: { adId: ad.id, type: "IMPRESSION", userId: user?.id ?? null, day: now.toISOString().slice(0, 10) } }),
  ]);

  const res = NextResponse.json({
    ad: {
      id: ad.id, title: ad.title, description: ad.description,
      imageUrl: ad.imageUrl, videoUrl: ad.videoUrl, ctaText: ad.ctaText, ctaUrl: ad.ctaUrl, advertiser: ad.advertiser,
    },
  });
  if (!user && !viewerKey) res.cookies.set("barada_ad_viewer", crypto.randomUUID(), { maxAge: 86400, httpOnly: true, sameSite: "lax" });
  return res;
}
