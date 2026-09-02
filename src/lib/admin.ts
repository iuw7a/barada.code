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

// ── Permission system (enforced server-side — the UI only hides, never protects) ─

/** The built-in ADMIN fallback permission set (used when no custom role is attached). */
export const DEFAULT_ADMIN_PERMS = [
  "users.view", "users.suspend", "users.pro", "users.sessions", "users.resetUsage",
  "projects.view", "projects.delete", "ai.view", "ai.manage", "analytics.view",
  "messages.view", "system.view", "security.view", "security.logs", "settings.manage",
  "roles.view", "audit.view", "api.view",
];

export type AdminPerms = { role: Role; roleName: string; perms: string[]; isSuper: boolean };

/** Resolves the signed-in admin's effective permissions from their custom role. */
export async function getPerms(): Promise<AdminPerms | null> {
  const admin = await getAdmin();
  if (!admin) return null;
  if (admin.role === "SUPER_ADMIN") {
    return { role: "SUPER_ADMIN", roleName: "Super Admin", perms: ["*"], isSuper: true };
  }
  const row = await prisma.user.findUnique({
    where: { id: admin.id },
    select: { customRole: { select: { name: true, permissions: true } } },
  });
  const perms = (row?.customRole?.permissions as string[] | undefined) ?? DEFAULT_ADMIN_PERMS;
  return { role: "ADMIN", roleName: row?.customRole?.name ?? "Admin", perms, isSuper: false };
}

function has(perms: string[], perm: string) {
  return perms.includes("*") || perms.includes(perm);
}

/** Throws 404 unless the signed-in admin holds `perm` — real server-side RBAC. */
export async function requirePerm(perm: string): Promise<AdminSession> {
  const admin = await requireAdmin();
  const p = await getPerms();
  if (!p || !has(p.perms, perm)) throw new ApiError(404, "Not found");
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
