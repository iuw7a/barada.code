import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, apiErrorResponse } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/** GET /api/me/stats — the signed-in user's own usage numbers. */
export async function GET() {
  try {
    const user = await requireUser();
    const month = new Date().toISOString().slice(0, 7);

    const [chats, messages, projects, deployments, subscription, usage] = await Promise.all([
      prisma.chat.count({ where: { userId: user.id } }),
      prisma.message.count({ where: { chat: { userId: user.id } } }),
      prisma.project.count({ where: { ownerId: user.id } }),
      prisma.deployment.count({ where: { project: { ownerId: user.id } } }),
      prisma.subscription.findFirst({
        where: { userId: user.id, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        select: { plan: true, currentPeriodEnd: true },
      }),
      prisma.usage.findUnique({ where: { userId_month: { userId: user.id, month } } }),
    ]);

    return NextResponse.json({
      chats,
      messages,
      projects,
      deployments,
      plan: subscription?.plan ?? "FREE",
      planRenewsAt: subscription?.currentPeriodEnd ?? null,
      month: { aiCalls: usage?.aiCalls ?? 0, aiTokens: usage?.aiTokens ?? 0 },
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
