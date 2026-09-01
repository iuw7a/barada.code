import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, apiErrorResponse, ApiError } from "@/lib/auth/guard";

// Whitelisted setting keys — everything else is rejected.
const Allowed = z.object({
  language: z.enum(["en", "ar", "de", "es", "fr"]).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  sidebarCollapsed: z.boolean().optional(),
  notifications: z
    .object({
      email: z.boolean().optional(),
      project: z.boolean().optional(),
      ai: z.boolean().optional(),
      workspace: z.boolean().optional(),
    })
    .optional(),
  ai: z
    .object({
      model: z.string().max(60).optional(),
      autoRun: z.boolean().optional(),
    })
    .optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const settings = await prisma.userSettings.findUnique({ where: { userId: user.id } });
    return NextResponse.json({ settings: settings?.json ?? {} });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const raw = await req.json().catch(() => null);
    const parsed = Allowed.safeParse(raw);
    if (!parsed.success) throw new ApiError(400, "不支持的设置项");

    const existing = await prisma.userSettings.findUnique({ where: { userId: user.id } });
    const merged = { ...((existing?.json as Record<string, unknown>) ?? {}), ...parsed.data };

    await prisma.userSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, json: merged },
      update: { json: merged },
    });

    // Language change also flips the locale cookie for server rendering.
    if (parsed.data.language) {
      const { LOCALE_COOKIE } = await import("@/lib/i18n");
      const { cookies } = await import("next/headers");
      const store = await cookies();
      store.set(LOCALE_COOKIE, parsed.data.language, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }
    return NextResponse.json({ settings: merged });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
