import { prisma } from "@/lib/prisma";
import { getAdminOrRedirect } from "@/lib/admin";
import { Head } from "../components";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await getAdminOrRedirect();
  const { page = "1" } = await searchParams;
  const p = Math.max(1, parseInt(page, 10) || 1);

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (p - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.count(),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <Head title="Audit Logs" sub={`${total} recorded admin actions — every sensitive operation lands here.`} />
      <div className="overflow-x-auto rounded-xl border border-white/5 bg-white/[0.02]">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-zinc-600">
              {["Admin", "Action", "Target", "Details", "Time"].map((h) => <th key={h} className="p-3.5 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b border-white/[0.04] last:border-0">
                <td className="p-3.5">
                  <p className="font-medium text-zinc-200">{a.user?.name ?? "system"}</p>
                  <p className="text-[11px] text-zinc-600">{a.user?.email}</p>
                </td>
                <td className="p-3.5"><span className="font-mono text-[12px] text-emerald-300/90">{a.action}</span></td>
                <td className="p-3.5 text-zinc-400">{a.target ?? "—"}</td>
                <td className="max-w-[280px] truncate p-3.5 text-zinc-600">{a.meta && Object.keys(a.meta as object).length ? JSON.stringify(a.meta) : "—"}</td>
                <td className="p-3.5 text-zinc-500">{new Date(a.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="p-8 text-center text-xs text-zinc-600">No audit entries yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Page {p} of {pages}</span>
          <div className="flex gap-2">
            {p > 1 && <a href={`/admin/audit-logs?page=${p - 1}`} className="rounded-lg border border-white/10 px-3 py-1.5 hover:text-zinc-200">Prev</a>}
            {p < pages && <a href={`/admin/audit-logs?page=${p + 1}`} className="rounded-lg border border-white/10 px-3 py-1.5 hover:text-zinc-200">Next</a>}
          </div>
        </div>
      )}
    </div>
  );
}
