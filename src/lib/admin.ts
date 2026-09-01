import { prisma } from "@/lib/prisma";
import { getSessionUser, type AuthUser } from "@/lib/auth/session";
import { ApiError } from "@/lib/auth/guard";
import type { Prisma } from "@prisma/client";

export type Role = "USER" | "ADMIN" | "SUPER_ADMIN";
const RANK: Record<string, number> = { USER: 0, ADMIN: 1, SUPER_ADMIN: 2 };

/** Admin session = signed-in user whose DB role is ADMIN or SUPER_ADMIN. */
export type AdminSession = AuthUser & { role: Role };

async function loadRole(id: string): Promise<Role> {
  const row = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  return (row?.role as Role) ?? "USER";
}

export async function getAdmin(): Promise<AdminSession | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const role = await loadRole(user.id);
  return RANK[role] >= RANK.ADMIN ? { ...user, role } : null;
}

/** Throws 404 (not 403 — don't reveal the admin area) for non-admins. */
export async function requireAdmin(): Promise<AdminSession> {
  const admin = await getAdmin();
  if (!admin) throw new ApiError(404, "Not found");
  return admin;
}

export async function requireSuperAdmin(): Promise<AdminSession> {
  const admin = await requireAdmin();
  if (admin.role !== "SUPER_ADMIN") throw new ApiError(404, "Not found");
  return admin;
}

/** Server-side helper for admin server components (redirect instead of throw). */
export async function getAdminOrRedirect(): Promise<AdminSession> {
  const admin = await getAdmin();
  if (!admin) {
    const { redirect } = await import("next/navigation");
    redirect("/signin?next=/admin");
  }
  return admin!;
}

// ── Audit log ────────────────────────────────────────────────────────────────

export async function audit(
  adminId: string,
  action: string,
  target?: string,
  meta: Record<string, unknown> = {}
) {
  await prisma.auditLog.create({ data: { userId: adminId, action, target, meta: meta as unknown as Prisma.InputJsonValue } });
}

// ── System settings ──────────────────────────────────────────────────────────

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  return row ? (row.json as T) : fallback;
}

export async function setSetting(key: string, json: unknown) {
  await prisma.systemSetting.upsert({ where: { key }, update: { json: json as object }, create: { key, json: json as object } });
}

// ── API key status (masked — secrets never leave the server) ────────────────

function mask(v: string | undefined) {
  if (!v) return null;
  return `${v.slice(0, 5)}••••••••${v.slice(-4)}`;
}

export function apiKeysStatus() {
  return [
    { provider: "AI Provider (OpenAI-compatible)", key: mask(process.env.AI_API_KEY), env: "AI_API_KEY", ok: Boolean(process.env.AI_API_KEY), lastUsed: "in use", usage: "chat + builds" },
    { provider: "AssemblyAI Voice", key: mask(process.env.ASSEMBLYAI_API_KEY), env: "ASSEMBLYAI_API_KEY", ok: Boolean(process.env.ASSEMBLYAI_API_KEY), lastUsed: "on voice sessions", usage: "voice agent" },
    { provider: "Supabase", key: mask(process.env.SUPABASE_SECRET_KEY), env: "SUPABASE_SECRET_KEY", ok: Boolean(process.env.SUPABASE_SECRET_KEY), lastUsed: "on demand", usage: "storage / auth" },
    { provider: "PostgreSQL", key: mask(process.env.DATABASE_URL?.split("@")[0]?.split("=")[1]), env: "DATABASE_URL", ok: Boolean(process.env.DATABASE_URL), lastUsed: "always", usage: "primary datastore" },
  ];
}
