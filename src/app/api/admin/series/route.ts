import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, apiErrorResponse } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/series?days=14 — daily series for the mobile admin charts.
 * Returns per-day counts of new users, messages, AI jobs and store clicks.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const days = Math.min(90, Math.max(7, parseInt(req.nextUrl.searchParams.get("days") ?? "14", 10) || 14));
    const since = new Date(Date.now() - days * 86_400_000);

    const [users, messages, jobs, clicks] = await Promise.all([
      prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      prisma.message.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      prisma.aIJob.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      prisma.appClick.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    ]);

    const bucket = new Map<string, { users: number; messages: number; ai: number; clicks: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      bucket.set(d.toISOString().slice(0, 10), { users: 0, messages: 0, ai: 0, clicks: 0 });
    }
    const add = (rows: { createdAt: Date }[], key: "users" | "messages" | "ai" | "clicks") => {
      for (const r of rows) {
        const k = r.createdAt.toISOString().slice(0, 10);
        const b = bucket.get(k);
        if (b) b[key]++;
      }
    };
    add(users, "users");
    add(messages, "messages");
    add(jobs, "ai");
    add(clicks, "clicks");

    const series = [...bucket.entries()].map(([date, v]) => ({ date, ...v }));
    return NextResponse.json({ days, series });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
