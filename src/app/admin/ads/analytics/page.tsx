import { prisma } from "@/lib/prisma";
import { getAdminOrRedirect } from "@/lib/admin";
import { Head, StatGrid, RangeChart } from "../../components";

export const dynamic = "force-dynamic";

export default async function AdAnalyticsPage() {
  await getAdminOrRedirect();
  const since = new Date(Date.now() - 30 * 864e5);

  const [ads, events] = await Promise.all([
    prisma.ad.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.adEvent.findMany({ where: { createdAt: { gte: since } }, select: { type: true, day: true } }),
  ]);

  const impressions = events.filter((e) => e.type === "IMPRESSION").length;
  const clicks = events.filter((e) => e.type === "CLICK").length;
  const ctr = impressions ? ((clicks / impressions) * 100).toFixed(2) : "0.00";
  const revenue = ads.reduce((a, ad) => a + ad.amountPaid, 0) / 100;
  const active = ads.filter((a) => a.status === "ACTIVE" && a.endsAt > new Date()).length;

  const byDay = new Map<string, { i: number; c: number }>();
  for (let i = 29; i >= 0; i--) byDay.set(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10), { i: 0, c: 0 });
  for (const e of events) {
    const d = byDay.get(e.day);
    if (d) e.type === "IMPRESSION" ? d.i++ : d.c++;
  }
  const impSeries = [...byDay.entries()].map(([d, v]) => ({ day: d.slice(5), count: v.i }));
  const clickSeries = [...byDay.entries()].map(([d, v]) => ({ day: d.slice(5), count: v.c }));

  return (
    <div className="space-y-5">
      <Head title="Ad Performance" sub="Tracked impressions and clicks from real deliveries." />
      <StatGrid stats={[
        { label: "Impressions (30d)", value: String(impressions), accent: true },
        { label: "Clicks (30d)", value: String(clicks) },
        { label: "CTR", value: `${ctr}%` },
        { label: "Active campaigns", value: String(active) },
        { label: "Advertiser revenue", value: `$${revenue.toFixed(2)}` },
      ]} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-zinc-200">Impressions per day</h2>
          <RangeChart series={impSeries} />
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-zinc-200">Clicks per day</h2>
          <RangeChart series={clickSeries} />
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/5 bg-white/[0.02]">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-zinc-600">
              {["Campaign", "Impr.", "Clicks", "CTR", "Revenue"].map((h) => <th key={h} className="p-3.5 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {ads.map((a) => (
              <tr key={a.id} className="border-b border-white/[0.04] last:border-0">
                <td className="p-3.5 font-medium text-zinc-200">{a.title}<span className="ml-2 text-[11px] text-zinc-600">{a.advertiser}</span></td>
                <td className="p-3.5 text-zinc-400">{a.impressions}</td>
                <td className="p-3.5 text-zinc-400">{a.clicks}</td>
                <td className="p-3.5 text-emerald-300">{a.impressions ? ((a.clicks / a.impressions) * 100).toFixed(1) : "0.0"}%</td>
                <td className="p-3.5 text-zinc-400">${(a.amountPaid / 100).toFixed(2)}</td>
              </tr>
            ))}
            {!ads.length && <tr><td colSpan={5} className="p-8 text-center text-xs text-zinc-600">No campaigns yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
