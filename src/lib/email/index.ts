/**
 * Barada transactional email — Nora Play / UseINBOX adapter.
 *
 * POST {NORA_PLAY_API_URL}/api/v1/emails/send  (Bearer NORA_PLAY_API_KEY)
 * Each sender identity maps to a pre-verified alias on iuw7a.com.
 * Every attempt is logged to EmailLog for the admin Email Center.
 */

import { prisma } from "@/lib/prisma";

const API_BASE = process.env.NORA_PLAY_API_URL ?? "https://api.useinbox.email";

/** The five verified sender identities and their responsibilities. */
export const SENDERS = {
  security: { email: "ai@iuw7a.com", aliasId: process.env.NORA_ALIAS_SECURITY ?? "e6c07f86-3f61-46f1-98b6-783d2703953c", label: "Security / Authentication" },
  welcome: { email: "hello@iuw7a.com", aliasId: process.env.NORA_ALIAS_WELCOME ?? "9bb30e87-2474-44ae-b0aa-80455b669536", label: "Welcome / Product" },
  billing: { email: "barada.ai@iuw7a.com", aliasId: process.env.NORA_ALIAS_BILLING ?? "20864653-ced8-4adc-930d-3907d0642b9f", label: "Billing / Subscriptions" },
  support: { email: "support@iuw7a.com", aliasId: process.env.NORA_ALIAS_SUPPORT ?? "ad146c8e-9c13-4dfe-a896-e1e598ff4230", label: "Support" },
  info: { email: "info@iuw7a.com", aliasId: process.env.NORA_ALIAS_INFO ?? "90572f51-ae70-4860-9967-6c6532aca28e", label: "General information" },
} as const;

export type SenderKey = keyof typeof SENDERS;
export type TemplateKey =
  | "otp" | "email_verification" | "welcome" | "password_reset" | "password_changed"
  | "email_changed" | "security_alert" | "subscription" | "payment" | "billing" | "support" | "announcement";

export const TEMPLATE_SENDER: Record<TemplateKey, SenderKey> = {
  otp: "security", email_verification: "security", password_reset: "security",
  password_changed: "security", email_changed: "security", security_alert: "security",
  welcome: "welcome", announcement: "welcome",
  subscription: "billing", payment: "billing", billing: "billing",
  support: "support",
};

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function brand(sender: SenderKey, heading: string, bodyHtml: string, cta?: { text: string; url: string }) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0e0d;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0e0d;padding:32px 12px;"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#131a17;border:1px solid #1f2b26;border-radius:18px;overflow:hidden;">
      <tr><td style="padding:28px 32px 0;">
        <span style="display:inline-grid;width:44px;height:44px;line-height:44px;text-align:center;background:#0f2419;border:1px solid #0b6b45;border-radius:12px;color:#10a35f;font-size:20px;font-weight:bold;">&#9670;</span>
        <p style="margin:14px 0 0;color:#e9efec;font-size:20px;font-weight:700;">${heading}</p>
      </td></tr>
      <tr><td style="padding:12px 32px 8px;color:#8a968f;font-size:14px;line-height:22px;">${bodyHtml}</td></tr>
      ${cta ? `<tr><td style="padding:10px 32px 6px;"><a href="${cta.url}" style="display:inline-block;background:#10a35f;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 28px;border-radius:12px;">${cta.text}</a></td></tr>` : ""}
      <tr><td style="padding:24px 32px 28px;">
        <p style="margin:0;color:#5c675f;font-size:12px;line-height:20px;">
          Barada Code — build real software by describing it.<br>
          <a href="${APP_URL}/help" style="color:#8a968f;">Support</a> &nbsp;·&nbsp;
          <a href="${APP_URL}/story" style="color:#8a968f;">Privacy</a> &nbsp;·&nbsp;
          <a href="${APP_URL}/about" style="color:#8a968f;">Terms</a>
        </p>
        <p style="margin:10px 0 0;color:#3d4540;font-size:11px;">Sent by Barada Code (${SENDERS[sender].email}). You receive this because you have a Barada account.</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export function renderTemplate(
  template: TemplateKey,
  vars: { name?: string; code?: string; minutes?: number; url?: string; extra?: string }
): { subject: string; html: string } {
  const name = vars.name?.split(" ")[0] ?? "there";
  switch (template) {
    case "otp":
    case "email_verification":
      return {
        subject: `Your Barada verification code: ${vars.code}`,
        html: brand("security", `Welcome to Barada Code, ${name}`,
          `<p style="margin:0 0 14px;">Your verification code is:</p>
           <p style="margin:0 0 14px;"><span style="display:inline-block;background:#0d1310;border:1px solid #1f2b26;border-radius:12px;padding:14px 26px;color:#10a35f;font-size:28px;font-weight:800;letter-spacing:8px;font-family:Menlo,Consolas,monospace;">${vars.code}</span></p>
           <p style="margin:0;">This code expires in <b>${vars.minutes ?? 10} minutes</b>. Never share this code with anyone — the Barada team will never ask for it.</p>`),
      };
    case "password_reset":
      return {
        subject: "Reset your Barada password",
        html: brand("security", `Hi ${name}, reset your password`,
          `<p style="margin:0 0 12px;">We received a request to reset your Barada password. Click the button below — the link expires in <b>1 hour</b>.</p>
           <p style="margin:0;color:#5c675f;">If you didn't request this, you can safely ignore this email.</p>`,
          { text: "Reset password", url: vars.url ?? APP_URL }),
      };
    case "password_changed":
      return {
        subject: "Your Barada password was changed",
        html: brand("security", `Password changed, ${name}`,
          `<p style="margin:0;">Your Barada account password was just changed. If this wasn't you, reset your password immediately and contact support.</p>`,
          { text: "Open Barada", url: APP_URL }),
      };
    case "email_changed":
      return {
        subject: "Your Barada email was changed",
        html: brand("security", `Email updated, ${name}`,
          `<p style="margin:0;">The email address on your Barada account was just changed. If this wasn't you, contact support immediately.</p>`,
          { text: "Open Barada", url: APP_URL }),
      };
    case "security_alert":
      return {
        subject: "Security alert for your Barada account",
        html: brand("security", `Security alert, ${name}`,
          `<p style="margin:0;">${vars.extra ?? "There was unusual activity on your account."} If this wasn't you, reset your password now.</p>`,
          { text: "Secure my account", url: `${APP_URL}/reset` }),
      };
    case "welcome":
      return {
        subject: `Welcome to Barada Code, ${name} 👋`,
        html: brand("welcome", `Welcome, ${name}!`,
          `<p style="margin:0 0 10px;">Welcome to Barada Code — the AI engineer that turns plain language into real, working projects.</p>
           <p style="margin:0;">Describe your idea, answer a couple of questions, and Barada writes the code, builds the files and publishes your site.</p>`,
          { text: "Open Barada", url: APP_URL }),
      };
    case "subscription":
      return {
        subject: "Your Barada PRO subscription",
        html: brand("billing", `You're on PRO, ${name} 🎉`,
          `<p style="margin:0;">${vars.extra ?? "Your PRO subscription is active. Enjoy unlimited builds and publishing."}</p>`,
          { text: "Open Barada", url: APP_URL }),
      };
    case "payment":
    case "billing":
      return {
        subject: "Your Barada billing update",
        html: brand("billing", `Billing update, ${name}`,
          `<p style="margin:0;">${vars.extra ?? "There is an update to your Barada billing."}</p>`,
          { text: "View billing", url: `${APP_URL}/settings` }),
      };
    case "support":
      return {
        subject: "Barada Support — we're on it",
        html: brand("support", `We received your request, ${name}`,
          `<p style="margin:0;">${vars.extra ?? "Thanks for reaching out — our team will reply shortly."}</p>`,
          { text: "Open Barada", url: APP_URL }),
      };
    case "announcement":
      return {
        subject: vars.extra?.slice(0, 80) ?? "What's new at Barada Code",
        html: brand("welcome", `Hi ${name}, what's new at Barada`,
          vars.extra ?? "<p>We've shipped a major update.</p>",
          { text: "Open Barada", url: APP_URL }),
      };
  }
}

/** Low-level send. Returns true when the provider accepted the message. */
export async function sendEmail(opts: {
  template: TemplateKey;
  to: string;
  subject?: string;
  html?: string;
}) {
  const sender = SENDERS[TEMPLATE_SENDER[opts.template]];
  const html = opts.html ?? renderTemplate(opts.template, { name: opts.to.split("@")[0] }).html;
  const subject = opts.subject ?? renderTemplate(opts.template, {}).subject;

  const log = await prisma.emailLog.create({
    data: { template: opts.template, sender: sender.email, recipient: opts.to, subject, status: "PENDING" },
  });

  try {
    const key = process.env.NORA_PLAY_API_KEY;
    if (!key) throw new Error("NORA_PLAY_API_KEY is not configured");

    // Provider schema (verified live): to = array of plain addresses,
    // content goes in text_body / html_body.
    const res = await fetch(`${API_BASE}/api/v1/emails/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from_alias_id: sender.aliasId,
        to: [opts.to],
        subject,
        html_body: html,
        text_body: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
    const ok = res.ok && data.success === true;

    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: ok ? "SENT" : "FAILED", error: ok ? null : (data.error?.message ?? `provider returned ${res.status}`) },
    });
    return ok;
  } catch (e) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "FAILED", error: e instanceof Error ? e.message.slice(0, 300) : "unknown error" },
    });
    return false;
  }
}

/** OTP generator — numeric, crypto-random. */
export function generateOtp(digits = 6): string {
  const buf = require("crypto").randomBytes(digits);
  let out = "";
  for (let i = 0; i < digits; i++) out += buf[i] % 10;
  return out;
}
