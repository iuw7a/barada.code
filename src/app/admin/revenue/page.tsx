import { prisma } from "@/lib/prisma";
import { getAdminOrRedirect } from "@/lib/admin";
import { Head, StatGrid, RangeChart, Note } from "../components";

export const dynamic = "force-dynamic";

const PRO_PRICE = 19; // USD per month — used for estimates until a payment provider is connected

export default async function RevenuePage() {
  await getAdminOrRedirect();
  const now = Date.now();

  const [subs, allUsers, aiTokens] = await Promise.all([
    prisma.subscription.findMany({ orderBy: { createdAt: "desc" }, include: { user: { select: { email: true, name: true } } } }),
    prisma.user.count(),
    prisma.usage.aggregate({ _sum: { aiTokens: true } }),
  ]);

  const active = subs.filter((s) => s.status === "ACTIVE" && s.plan !== "FREE");
  const mrr = active.length * PRO_PRICE;
  const byPlan = ["PRO", "TEAM"].map((p) => ({ plan: p, count: active.filter((s) => s.plan === p).length }));
  const monthStart = new Date(new Date().toISOString().slice(0, 7) + "-01");
  const newThisMonth = active.filter((s) => s.createdAt >= monthStart).length;

  // subscriber growth over the last 30 days (by subscription creation)
  const growth = new Map<string, number>();
  for (let i = 29; i >= 0; i--) growth.set(new Date(now - i * 864e5).toISOString().slice(0, 10), 0);
  for (const s of subs) {
    const k = s.createdAt.toISOString().slice(0, 10);
    if (growth.has(k)) growth.set(k, (growth.get(k) ?? 0) + 1);
  }
  const series = [...growth.entries()].map(([d, v]) => ({ day: d.slice(5), count: v }));

  // rough AI cost estimate (provider-dependent; conservative $0.20 / 1M tokens blended)
  const aiCost = ((aiTokens._sum.aiTokens ?? 0) / 1_000_000) * 0.2;

  return (
    <div className="space-y-5">
      <Head title="Revenue" sub="Computed from real subscription records. No payment provider is connected yet." />
      <StatGrid stats={[
        { label: "MRR (est.)", value: `$${mrr}`, accent: true },
        { label: "ARR (est.)", value: `$${mrr * 12}` },
        { label: "Active PRO subs", value: String(active.length) },
        { label: "New this month", value: String(newThisMonth) },
        { label: "Conversion", value: allUsers ? `${((active.length / allUsers) * 100).toFixed(1)}%` : "—" },
        { label: "ARPU (est.)", value: allUsers ? `$${(mrr / allUsers).toFixed(2)}` : "—" },
        { label: "AI costs (est.)", value: `$${aiCost.toFixed(2)}` },
        { label: "Net (est.)", value: `$${(mrr - aiCost).toFixed(2)}` },
      ]} />

      <Note>
        <b>Why &quot;est.&quot;:</b> no payment provider (Stripe/Paddle/…) is wired yet, so revenue is derived from active
        subscriptions at ${PRO_PRICE}/mo and AI costs from token usage at a blended rate. Connect a payment provider and these
        become real transactions — the subscription model already stores plan, status and renewal dates.
      </Note>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-zinc-200">Subscriber growth — new subscriptions per day (30d)</h2>
          <RangeChart series={series} />
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-200">Revenue by plan</h2>
          {byPlan.map((p) => (
            <div key={p.plan} className="mb-2">
              <div className="flex justify-between text-xs text-zinc-400"><span>{p.plan}</span><span>{p.count} × ${PRO_PRICE} = ${p.count * PRO_PRICE}/mo</span></div>
              <div className="mt-1 h-2 rounded-full bg-white/5">
                <div className="h-2 rounded-full bg-emerald-500/60" style={{ width: `${Math.min(100, p.count * 10)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/5 bg-white/[0.02]">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-zinc-600">
              {["Subscriber", "Plan", "Status", "Started", "Renews"].map((h) => <th key={h} className="p-3.5 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {subs.slice(0, 20).map((s) => (
              <tr key={s.id} className="border-b border-white/[0.04] last:border-0">
                <td className="p-3.5 text-zinc-200">{s.user?.name}<span className="ml-2 text-[11px] text-zinc-600">{s.user?.email}</span></td>
                <td className="p-3.5 text-emerald-300">{s.plan}</td>
                <td className="p-3.5 text-zinc-400">{s.status}</td>
                <td className="p-3.5 text-zinc-500">{new Date(s.createdAt).toLocaleDateString()}</td>
                <td className="p-3.5 text-zinc-500">{s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
            {!subs.length && <tr><td colSpan={5} className="p-8 text-center text-xs text-zinc-600">No subscriptions yet — grant PRO from the Users page to test.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
