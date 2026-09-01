import { prisma } from "@/lib/prisma";
import { getAdminOrRedirect, getSetting } from "@/lib/admin";
import { Head, Note } from "../components";
import { AISettings } from "./AISettings";

export const dynamic = "force-dynamic";

export default async function AIPage() {
  const admin = await getAdminOrRedirect();
  const since = new Date(Date.now() - 30 * 864e5);

  const [jobs, byModel, tokens, guestLimits] = await Promise.all([
    prisma.aIJob.count({ where: { createdAt: { gte: since } } }),
    prisma.aIJob.groupBy({ by: ["model"], _count: { _all: true } }).catch(() => [] as Array<{ model: string | null; _count: { _all: number } }>),
    prisma.usage.aggregate({ _sum: { aiTokens: true, aiCalls: true } }),
    getSetting("guestLimits", { perHourPerIp: 3 }),
  ]);

  const errors = await prisma.aIJob.count({ where: { status: "FAILED", createdAt: { gte: since } } });
  const activeModel = process.env.AI_MODEL ?? "provider default";
  const isSuper = admin.role === "SUPER_ADMIN";

  return (
    <div className="space-y-5">
      <Head title="AI Control" sub="Providers, usage and limits — the live configuration of the AI layer." />
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Active model", value: activeModel },
          { label: "Requests (30d)", value: String(jobs) },
          { label: "Errors (30d)", value: String(errors) },
          { label: "Tokens (all time)", value: String(tokens._sum.aiTokens ?? 0) },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">{c.label}</p>
            <p className="mt-1 truncate text-lg font-bold text-zinc-100">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
        <h2 className="mb-2 text-sm font-semibold text-zinc-200">Requests by model</h2>
        {byModel.length ? byModel.map((m) => (
          <div key={m.model ?? "default"} className="flex justify-between border-b border-white/[0.04] py-1.5 text-xs last:border-0">
            <span className="font-mono text-zinc-400">{m.model ?? "(provider default)"}</span>
            <span className="text-zinc-500">{m._count._all}</span>
          </div>
        )) : <p className="text-xs text-zinc-600">No AI jobs recorded yet.</p>}
      </div>

      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
        <h2 className="mb-1 text-sm font-semibold text-zinc-200">Limits</h2>
        <p className="mb-3 text-xs text-zinc-500">Guest free messages per hour per IP — enforced server-side in the guest chat endpoint.</p>
        {isSuper ? <AISettings initial={guestLimits} /> : <Note>Only <b>SUPER_ADMIN</b> can change AI settings. You are {admin.role}.</Note>}
      </div>

      <Note>
        The active model and provider priority are configured through server-side environment variables
        (<span className="font-mono">AI_MODEL</span>, <span className="font-mono">AI_BASE_URL</span>, <span className="font-mono">AI_API_KEY</span>) —
        never through the browser, so admin sessions cannot alter provider credentials.
      </Note>
    </div>
  );
}
