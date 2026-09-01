import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, audit, getSetting, setSetting } from "@/lib/admin";
import { apiErrorResponse, ApiError } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

const URL_FIELD = z.string().url().refine((u) => /^https?:\/\//i.test(u), "Only http(s) URLs are allowed").optional().or(z.literal(""));

const AdBody = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional().or(z.literal("")),
  imageUrl: URL_FIELD,
  videoUrl: URL_FIELD,
  ctaText: z.string().max(40).optional().or(z.literal("")),
  ctaUrl: URL_FIELD,
  advertiser: z.string().min(1).max(80),
  campaign: z.string().max(80).optional().or(z.literal("")),
  amountPaid: z.number().int().min(0).max(100_000_00), // cents
  days: z.number().int().min(1).max(365), // duration in days → endsAt = now + days
  status: z.enum(["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "EXPIRED"]).optional(),
});

/** GET — list all ads. */
export async function GET() {
  try {
    await requireAdmin();
    const ads = await prisma.ad.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ ads });
  } catch (err) { return apiErrorResponse(err); }
}

/** POST — create an ad. Duration is derived from the configured price rules + days. */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const b = AdBody.parse(await req.json().catch(() => null));
    const ad = await prisma.ad.create({
      data: {
        title: b.title,
        description: b.description || null,
        imageUrl: b.imageUrl || null,
        videoUrl: b.videoUrl || null,
        ctaText: b.ctaText || null,
        ctaUrl: b.ctaUrl || null,
        advertiser: b.advertiser,
        campaign: b.campaign || null,
        amountPaid: b.amountPaid,
        startsAt: b.status === "SCHEDULED" ? new Date(Date.now() + 864e5) : new Date(),
        endsAt: new Date(Date.now() + b.days * 864e5),
        status: b.status ?? "ACTIVE",
      },
    });
    await audit(admin.id, "ad.created", ad.title, { advertiser: ad.advertiser, amountPaid: ad.amountPaid, days: b.days });
    return NextResponse.json({ ad });
  } catch (err) { return apiErrorResponse(err); }
}

const PatchBody = z.object({
  id: z.string(),
  status: z.enum(["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "EXPIRED"]).optional(),
  extendDays: z.number().int().min(1).max(365).optional(),
});

/** PATCH — pause/resume/extend/delete-flag; DELETE via body.action = delete. */
export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin();
    const b = PatchBody.parse(await req.json().catch(() => null));
    const ad = await prisma.ad.findUnique({ where: { id: b.id } });
    if (!ad) throw new ApiError(404, "Ad not found");

    const data: Record<string, unknown> = {};
    if (b.status) data.status = b.status;
    if (b.extendDays) data.endsAt = new Date(Math.max(Date.now(), ad.endsAt.getTime()) + b.extendDays * 864e5);
    const updated = await prisma.ad.update({ where: { id: b.id }, data });
    await audit(admin.id, "ad.updated", ad.title, { status: b.status, extendDays: b.extendDays });
    return NextResponse.json({ ad: updated });
  } catch (err) { return apiErrorResponse(err); }
}

/** DELETE — ?id= */
export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) throw new ApiError(400, "id required");
    const ad = await prisma.ad.findUnique({ where: { id } });
    if (!ad) throw new ApiError(404, "Ad not found");
    await prisma.ad.delete({ where: { id } });
    await audit(admin.id, "ad.deleted", ad.title);
    return NextResponse.json({ ok: true });
  } catch (err) { return apiErrorResponse(err); }
}

const RulesBody = z.object({
  showToFree: z.boolean(),
  showToPro: z.boolean(),
  showToGuests: z.boolean(),
  maxPerSession: z.number().int().min(0).max(50),
  maxPerDay: z.number().int().min(0).max(500),
  enabled: z.boolean(),
});

/** PUT — ad display rules. */
export async function PUT(req: Request) {
  try {
    const admin = await requireAdmin();
    const rules = RulesBody.parse(await req.json().catch(() => null));
    await setSetting("adRules", rules);
    await audit(admin.id, "ads.rules_changed", undefined, rules);
    return NextResponse.json({ ok: true });
  } catch (err) { return apiErrorResponse(err); }
}

export async function OPTIONS() {
  return NextResponse.json({ rules: await getSetting("adRules", { showToFree: true, showToPro: false, showToGuests: true, maxPerSession: 2, maxPerDay: 5, enabled: true }) });
}
