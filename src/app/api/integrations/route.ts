import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, apiErrorResponse, ApiError } from "@/lib/auth/guard";
import { encryptSecret } from "@/lib/crypto/secretBox";

const PROVIDERS = ["GITHUB", "GITLAB", "VERCEL", "DATABASE", "CUSTOM_API"] as const;

export async function GET() {
  try {
    const user = await requireUser();
    const integrations = await prisma.integration.findMany({
      where: { userId: user.id },
      select: { id: true, provider: true, status: true, meta: true, updatedAt: true },
    });
    // Advertise all known providers, connected or not.
    const all = PROVIDERS.map((provider) => {
      const existing = integrations.find((i) => i.provider === provider);
      return existing ?? { id: null, provider, status: "DISCONNECTED", meta: {}, updatedAt: null };
    });
    return NextResponse.json({ integrations: all });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const ConnectBody = z.object({
  provider: z.enum(PROVIDERS),
  credential: z.string().min(1).max(10_000), // token / API key / DSN
  meta: z.record(z.string()).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const parsed = ConnectBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "输入无效");

    const { provider, credential, meta } = parsed.data;

    // v1 validation: non-empty credential is stored encrypted; live verification
    // per provider (GitHub PAT check etc.) lands with each provider module.
    await prisma.integration.upsert({
      where: { userId_provider: { userId: user.id, provider } },
      create: {
        userId: user.id,
        provider,
        credential: encryptSecret(credential),
        status: "CONNECTED",
        meta: meta ?? {},
      },
      update: {
        credential: encryptSecret(credential),
        status: "CONNECTED",
        ...(meta ? { meta } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const DeleteBody = z.object({ provider: z.enum(PROVIDERS) });

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    const parsed = DeleteBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "输入无效");
    await prisma.integration.updateMany({
      where: { userId: user.id, provider: parsed.data.provider },
      data: { credential: null, status: "DISCONNECTED" },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
