import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/ads/click?id= — records the click, then redirects to the ad URL. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new NextResponse(null, { status: 400 });
  const ad = await prisma.ad.findUnique({ where: { id } });
  if (!ad?.ctaUrl || !/^https?:\/\//i.test(ad.ctaUrl)) return new NextResponse(null, { status: 404 });

  const tracked = await prisma.$transaction([
    prisma.ad.update({ where: { id }, data: { clicks: { increment: 1 } } }),
    prisma.adEvent.create({ data: { adId: id, type: "CLICK", userId: null, day: new Date().toISOString().slice(0, 10) } }),
  ]).then(() => true).catch(() => false);
  if (!tracked) return new NextResponse(null, { status: 500 });

  return NextResponse.redirect(ad.ctaUrl, { status: 302 });
}
