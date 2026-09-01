import { prisma } from "@/lib/prisma";
import { getAdminOrRedirect } from "@/lib/admin";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function AdminProfilePage() {
  const admin = await getAdminOrRedirect();
  const row = await prisma.user.findUnique({ where: { id: admin.id }, select: { name: true, email: true, role: true, createdAt: true, sessions: { orderBy: { createdAt: "desc" }, take: 5, select: { createdAt: true } } } });
  if (!row) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-200">Identity</h2>
        <Row k="Name" v={row.name} /><Row k="Email" v={row.email} />
        <Row k="Role" v={row.role} accent /><Row k="Admin since" v={new Date(row.createdAt).toLocaleDateString()} />
        <h2 className="mb-3 mt-5 text-sm font-semibold text-zinc-200">Recent sessions</h2>
        {row.sessions.map((s, i) => <Row key={i} k={`Login ${i + 1}`} v={new Date(s.createdAt).toLocaleString()} />)}
      </div>
      <ProfileForm initialName={row.name} />
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex justify-between border-b border-white/[0.04] py-1.5 text-xs last:border-0">
      <span className="text-zinc-500">{k}</span>
      <span className={`font-medium ${accent ? "text-emerald-300" : "text-zinc-300"}`}>{v}</span>
    </div>
  );
}
