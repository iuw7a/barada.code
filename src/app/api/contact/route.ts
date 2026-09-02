import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { apiErrorResponse, ApiError } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/rateLimit";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(200),
  subject: z.string().min(1).max(150),
  message: z.string().min(10).max(5000),
});

/** POST /api/contact — real contact form: validate → store → notify support. */
export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    const rl = rateLimit(`contact:${ip}`, 5, 60 * 60_000);
    if (!rl.ok) throw new ApiError(429, "Too many messages — try again later.");

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Please fill all fields (message ≥ 10 chars).");

    const user = await getSessionUser();
    const { name, email, subject, message } = parsed.data;

    await prisma.contactMessage.create({
      data: { userId: user?.id ?? null, name, email, subject, message },
    });

    // Notify support (best-effort — the submission is stored regardless).
    void sendEmail({
      template: "support",
      to: process.env.CONTACT_EMAIL ?? "support@iuw7a.com",
      subject: `[Contact] ${subject}`,
      html: `<p><b>${name}</b> (${email}) wrote:</p><p>${message.replace(/</g, "&lt;")}</p>`,
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
