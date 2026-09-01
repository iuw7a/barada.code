import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, audit, getSetting, setSetting } from "@/lib/admin";
import { renderTemplate, sendEmail } from "@/lib/email";
import { apiErrorResponse, ApiError } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

const CAMPAIGN_KEY = "campaign:release-2026-09";

type CampaignState = {
  sentAt?: string;
  total?: number;
  succeeded?: number;
  failed?: number;
  inProgress?: boolean;
};

/** GET — campaign status for the Email Center. */
export async function GET() {
  try {
    await requireAdmin();
    const state = await getSetting<CampaignState>(CAMPAIGN_KEY, {});
    return NextResponse.json({ campaign: state });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/**
 * POST — send the release announcement to every user ONCE.
 * Duplicate-send protection: a SystemSetting record marks the campaign done;
 * it can never be re-sent unless explicitly reset (SUPER_ADMIN).
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const state = await getSetting<CampaignState>(CAMPAIGN_KEY, {});
    if (state.sentAt) {
      throw new ApiError(409, `Campaign already sent at ${state.sentAt} (${state.succeeded}/${state.total} delivered). It cannot be sent twice.`);
    }
    if (state.inProgress) throw new ApiError(409, "Campaign is already running.");
    await setSetting(CAMPAIGN_KEY, { ...state, inProgress: true });

    const users = await prisma.user.findMany({ select: { email: true, name: true }, orderBy: { createdAt: "asc" } });
    let succeeded = 0;
    let failed = 0;

    for (const u of users) {
      const tpl = renderTemplate("announcement", {
        name: u.name,
        extra: `<p style="margin:0 0 10px;">We just shipped a major update to Barada Code:</p>
          <ul style="margin:0;padding-left:18px;">
            <li><b>Enterprise Admin Control Center</b> — complete visibility over users, AI, revenue and system health</li>
            <li><b>Chat-first mobile app</b> — open, type, build (iOS &amp; Android)</li>
            <li><b>Guest mode</b> — try Barada before signing up</li>
            <li><b>Real publishing</b> — your projects live on their own address</li>
            <li><b>Better builds</b> — real multi-file websites with working navigation</li>
            <li><b>Reliability</b> — faster AI responses and clearer progress in chat</li>
          </ul>
          <p style="margin:12px 0 0;">Thank you for being part of Barada.</p>`,
      });
      const ok = await sendEmail({
        template: "announcement",
        to: u.email,
        subject: "What's New — Major Updates to Barada Code",
        html: tpl.html,
      });
      ok ? succeeded++ : failed++;
      await new Promise((r) => setTimeout(r, 400)); // respect provider rate limits
    }

    const finalState: CampaignState = { sentAt: new Date().toISOString(), total: users.length, succeeded, failed };
    await setSetting(CAMPAIGN_KEY, finalState);
    await audit(admin.id, "email.campaign_sent", "release-2026-09", { total: users.length, succeeded, failed });
    return NextResponse.json({ ok: true, ...finalState });
  } catch (err) {
    const state = await getSetting<CampaignState>(CAMPAIGN_KEY, {});
    if (state.inProgress) await setSetting(CAMPAIGN_KEY, { ...state, inProgress: false });
    return apiErrorResponse(err);
  }
}
