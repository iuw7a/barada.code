import { prisma } from "@/lib/prisma";
import { getAdminOrRedirect, getSetting } from "@/lib/admin";
import { checkHealth } from "@/lib/adminHealth";
import { Head, Note } from "../components";
import { SystemControls } from "./SystemControls";

export const dynamic = "force-dynamic";

export default async function SystemPage() {
  const admin = await getAdminOrRedirect();
  const health = await checkHealth();
  const maintenance = await getSetting<{ enabled: boolean; message?: string }>("maintenance", { enabled: false });

  const [failedJobs, recentErrors] = await Promise.all([
    prisma.aIJob.count({ where: { status: "FAILED" } }),
    prisma.aIJob.findMany({ where: { status: "FAILED" }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, error: true, createdAt: true } }),
  ]);

  const isSuper = admin.role === "SUPER_ADMIN";

  const Row = ({ k, v, ok }: { k: string; v: string; ok?: boolean }) => (
    <div className="flex items-center justify-between border-b border-white/[0.04] py-2 last:border-0">
      <span className="text-xs text-zinc-500">{k}</span>
      <span className={`flex items-center gap-1.5 text-xs font-medium ${ok === undefined ? "text-zinc-300" : ok ? "text-emerald-300" : "text-red-300"}`}>
        {ok !== undefined && <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />}{v}
      </span>
    </div>
  );

  return (
    <div className="space-y-5">
      <Head title="System Health" sub="Live status of every layer — checked on page load." />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <h2 className="mb-2 text-sm font-semibold text-zinc-200">Server</h2>
          <Row k="Status" v="Operational" ok={health.server.ok} />
          <Row k="Uptime" v={`${Math.floor(health.server.uptimeSec / 3600)}h ${Math.floor((health.server.uptimeSec % 3600) / 60)}m`} />
          <Row k="Environment" v={health.server.env} />
          <Row k="Heap / RSS" v={`${health.server.heapMb} MB / ${health.server.rssMb} MB`} />
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <h2 className="mb-2 text-sm font-semibold text-zinc-200">Database</h2>
          <Row k="Status" v={health.db.ok ? `Operational · ${health.db.latencyMs}ms` : "Connection failed"} ok={health.db.ok} />
          <Row k="Engine" v="PostgreSQL" />
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <h2 className="mb-2 text-sm font-semibold text-zinc-200">AI Provider</h2>
          <Row k="Status" v={health.ai.configured ? (health.ai.ok ? `Operational · ${health.ai.latencyMs}ms` : "Degraded / unreachable") : "Not configured"} ok={health.ai.configured ? health.ai.ok : false} />
          <Row k="Failed jobs" v={String(failedJobs)} ok={failedJobs === 0} />
        </div>
      </div>

      {recentErrors.length > 0 && (
        <div className="rounded-xl border border-red-500/15 bg-red-500/[0.04] p-5">
          <h2 className="mb-2 text-sm font-semibold text-red-300">Recent AI job errors</h2>
          {recentErrors.map((e) => (
            <p key={e.id} className="border-b border-white/5 py-1.5 text-[11px] text-zinc-500 last:border-0">
              <span className="text-zinc-400">{new Date(e.createdAt).toLocaleString()}</span> — {e.error?.slice(0, 140) ?? "unknown"}
            </p>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
        <h2 className="mb-1 text-sm font-semibold text-zinc-200">Maintenance mode</h2>
        <p className="mb-3 text-xs text-zinc-500">When enabled, regular users see a maintenance screen. Admins keep full access.</p>
        {isSuper
          ? <SystemControls enabled={maintenance.enabled} />
          : <Note>Only <b>SUPER_ADMIN</b> can change system controls. You are signed in as <b>{admin.role}</b>.</Note>}
      </div>

      <Note>
        Process restart / stop controls: this deployment runs the app directly (npm/next dev), which does not expose a secure
        server-control API to the application itself. The button would be fake — so it is not shown. Wire a process manager
        (PM2, Docker, or your host&apos;s API) and this control can be enabled safely.
      </Note>
    </div>
  );
}
