import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, apiErrorResponse } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/** GET /api/admin/stats — platform-wide dashboard numbers. Admin only. */
export async function GET() {
  try {
    await requireAdmin();

    const [
      users,
      usersToday,
      projects,
      projectsToday,
      chats,
      messages,
      messagesToday,
      aiJobs,
      aiJobsRunning,
      aiJobsFailed,
      suspended,
      admins,
      activeSessions,
      proSubs,
      recentUsers,
      topUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } }),
      prisma.project.count(),
      prisma.project.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } }),
      prisma.chat.count(),
      prisma.message.count(),
      prisma.message.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } }),
      prisma.aIJob.count(),
      prisma.aIJob.count({ where: { status: { in: ["PENDING", "RUNNING"] } } }),
      prisma.aIJob.count({ where: { status: "FAILED" } }),
      prisma.user.count({ where: { banned: true } }),
      prisma.user.count({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } } }),
      // "online now" = a session created in the last 30 minutes
      prisma.session.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } } }),
      prisma.subscription.count({ where: { plan: { in: ["PRO", "TEAM"] }, status: "ACTIVE" } }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, email: true, name: true, createdAt: true, banned: true, isAdmin: true, role: true },
      }),
      prisma.user.findMany({
        orderBy: { projects: { _count: "desc" } },
        take: 5,
        select: { id: true, name: true, email: true, _count: { select: { projects: true, chats: true } } },
      }),
    ]);

    const PRO_PRICE_USD = 19; // estimated MRR — no payment provider wired yet
    const usage = await prisma.usage.aggregate({ _sum: { aiCalls: true, aiTokens: true } });

    return NextResponse.json({
      users,
      usersToday,
      suspended,
      admins,
      onlineNow: activeSessions,
      projects,
      projectsToday,
      chats,
      messages,
      messagesToday,
      aiJobs,
      aiJobsRunning,
      aiJobsFailed,
      proSubscribers: proSubs,
      estimatedMrrUsd: proSubs * PRO_PRICE_USD,
      aiCalls: usage._sum.aiCalls ?? 0,
      aiTokens: usage._sum.aiTokens ?? 0,
      apiKeys: {
        aiProvider: Boolean(process.env.AI_API_KEY),
        assemblyai: Boolean(process.env.ASSEMBLYAI_API_KEY),
        supabase: Boolean(process.env.SUPABASE_SECRET_KEY),
        database: Boolean(process.env.DATABASE_URL),
      },
      recentUsers,
      topUsers,
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
