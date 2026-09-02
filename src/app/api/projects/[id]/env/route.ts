import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, apiErrorResponse, ApiError } from "@/lib/auth/guard";
import { requireProjectAccess } from "@/lib/permissions";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secretBox";

/**
 * Project environment variables. Secret values are stored encrypted and are
 * NEVER returned to any client — only masked presence + metadata.
 */

function maskValue(v: string): string {
  if (v.length <= 8) return "••••••••";
  return `${v.slice(0, 3)}••••••••${v.slice(-3)}`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireProjectAccess(user.id, id, "MEMBER");

    const vars = await prisma.projectEnvVar.findMany({
      where: { projectId: id },
      orderBy: { key: "asc" },
    });
    return NextResponse.json({
      vars: vars.map((v) => ({
        key: v.key,
        isSecret: v.isSecret,
        target: v.target,
        value: v.isSecret ? maskValue(decryptSecret(v.valueEnc ?? "")) : v.valuePlain ?? "",
        updatedAt: v.updatedAt,
      })),
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const SetBody = z.object({
  key: z.string().regex(/^[A-Z_][A-Z0-9_]*$/, "UPPER_SNAKE_CASE required").max(120),
  value: z.string().max(4000),
  isSecret: z.boolean().default(false),
  target: z.enum(["all", "development", "production"]).default("all"),
});

/** POST — set (create or update) a variable. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireProjectAccess(user.id, id, "ADMIN");

    const parsed = SetBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, parsed.data ? "Invalid value" : "Invalid input");

    const { key, value, isSecret, target } = parsed.data;
    await prisma.projectEnvVar.upsert({
      where: { projectId_key: { projectId: id, key } },
      create: {
        projectId: id,
        key,
        isSecret,
        target,
        ...(isSecret ? { valueEnc: encryptSecret(value) } : { valuePlain: value }),
      },
      update: {
        isSecret,
        target,
        valueEnc: isSecret ? encryptSecret(value) : null,
        valuePlain: isSecret ? null : value,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const DeleteBody = z.object({ key: z.string().min(1) });

/** DELETE — remove a variable. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireProjectAccess(user.id, id, "ADMIN");
    const parsed = DeleteBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "key required");
    await prisma.projectEnvVar.deleteMany({ where: { projectId: id, key: parsed.data.key } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
