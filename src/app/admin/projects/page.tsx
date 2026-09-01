import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getAdminOrRedirect } from "@/lib/admin";
import { Head } from "../components";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function AdminProjectsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await getAdminOrRedirect();
  const { q = "", page = "1" } = await searchParams;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const where: Prisma.ProjectWhereInput | undefined = q
    ? { name: { contains: q, mode: "insensitive" } }
    : undefined;

  const [rows, total] = await Promise.all([
    prisma.project.findMany({
      ...(where ? { where } : {}),
      orderBy: { updatedAt: "desc" },
      skip: (p - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, name: true, status: true, createdAt: true, updatedAt: true,
        owner: { select: { name: true, email: true } },
        _count: { select: { files: true, chats: true } },
      },
    }),
    prisma.project.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <Head title="Projects" sub={`${total} projects across the platform.`} />
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search project name…"
          className="w-64 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-emerald-500/40" />
        <button className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:border-emerald-500/30">Search</button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-white/5 bg-white/[0.02]">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-zinc-600">
              {["Project", "Owner", "Files", "Messages", "Status", "Last activity"].map((h) => <th key={h} className="p-3.5 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((pr) => (
              <tr key={pr.id} className="border-b border-white/[0.04] last:border-0">
                <td className="p-3.5 font-medium text-zinc-200">{pr.name}</td>
                <td className="p-3.5 text-zinc-400">{pr.owner.name}<span className="ml-2 text-[11px] text-zinc-600">{pr.owner.email}</span></td>
                <td className="p-3.5 text-zinc-400">{pr._count.files}</td>
                <td className="p-3.5 text-zinc-400">{pr._count.chats}</td>
                <td className="p-3.5 text-zinc-400">{pr.status}</td>
                <td className="p-3.5 text-zinc-500">{new Date(pr.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="p-8 text-center text-xs text-zinc-600">No projects match.</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Page {p} of {pages}</span>
          <div className="flex gap-2">
            {p > 1 && <a href={`/admin/projects?q=${encodeURIComponent(q)}&page=${p - 1}`} className="rounded-lg border border-white/10 px-3 py-1.5 hover:text-zinc-200">Prev</a>}
            {p < pages && <a href={`/admin/projects?q=${encodeURIComponent(q)}&page=${p + 1}`} className="rounded-lg border border-white/10 px-3 py-1.5 hover:text-zinc-200">Next</a>}
          </div>
        </div>
      )}
    </div>
  );
}
