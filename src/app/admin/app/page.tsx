import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STORES = [
  { key: "google", label: "Google Play" },
  { key: "apple", label: "App Store" },
];

function Card({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="glass-card p-5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 text-3xl font-black ${accent ? "text-emerald-400" : "text-zinc-100"}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

export default async function AdminAppPage() {
  const since = (days: number) => new Date(Date.now() - days * 86_400_000);

  const [total, google, apple, today, last7, last30, recent, byDay] = await Promise.all([
    prisma.appClick.count(),
    prisma.appClick.count({ where: { store: "google" } }),
    prisma.appClick.count({ where: { store: "apple" } }),
    prisma.appClick.count({ where: { createdAt: { gte: since(1) } } }),
    prisma.appClick.count({ where: { createdAt: { gte: since(7) } } }),
    prisma.appClick.count({ where: { createdAt: { gte: since(30) } } }),
    prisma.appClick.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.appClick.groupBy({
      by: ["store"],
      _count: { _all: true },
      where: { createdAt: { gte: since(30) } },
    }),
  ]);

  const g30 = byDay.find((d) => d.store === "google")?._count._all ?? 0;
  const a30 = byDay.find((d) => d.store === "apple")?._count._all ?? 0;
  const conversion = total > 0 ? ((google / total) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-zinc-100">Mobile App — Store Clicks</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Wie viele Menschen die Download-Seite <code className="rounded bg-white/5 px-1">/app</code> besucht und auf
          die Store-Links geklickt haben. Jeder Klick wird serverseitig aufgezeichnet.
        </p>
      </header>

      {/* metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card label="Total Clicks" value={total} sub="all time" accent />
        <Card label="Google Play" value={google} sub={`${conversion}% of clicks`} />
        <Card label="App Store" value={apple} sub={total > 0 ? `${(100 - Number(conversion)).toFixed(1)}% of clicks` : "—"} />
        <Card label="Today" value={today} sub={`7d: ${last7} · 30d: ${last30}`} />
      </div>

      {/* 30-day split bars */}
      <div className="glass-card p-5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Last 30 days by store</p>
        {g30 + a30 === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">No clicks in the last 30 days yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {[
              { label: "Google Play", count: g30, total: g30 + a30, color: "bg-emerald-500" },
              { label: "App Store", count: a30, total: g30 + a30, color: "bg-zinc-500" },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>{row.label}</span>
                  <span className="font-mono text-zinc-300">
                    {row.count} ({((row.count / row.total) * 100).toFixed(0)}%)
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/5">
                  <div className={`h-full rounded-full ${row.color}`} style={{ width: `${(row.count / row.total) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* recent clicks */}
      <div className="glass-card overflow-hidden">
        <div className="border-b border-white/5 px-5 py-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Recent clicks ({recent.length})</p>
        </div>
        {recent.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-zinc-600">
            No clicks recorded yet — share <code className="rounded bg-white/5 px-1 text-zinc-400">/app</code> and they will appear here live.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-zinc-600">
                  <th className="px-5 py-3 font-medium">Store</th>
                  <th className="px-5 py-3 font-medium">Time</th>
                  <th className="px-5 py-3 font-medium">Referrer</th>
                  <th className="px-5 py-3 font-medium">Device</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((c) => {
                  const ua = c.userAgent ?? "";
                  const device = /iphone|ipad|ios/i.test(ua) ? "iOS" : /android/i.test(ua) ? "Android" : /windows/i.test(ua) ? "Windows" : /mac/i.test(ua) ? "Mac" : /linux/i.test(ua) ? "Linux" : "Unknown";
                  return (
                    <tr key={c.id} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]">
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.store === "google" ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25" : "bg-white/5 text-zinc-300"}`}>
                          {c.store === "google" ? "Google Play" : "App Store"}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-zinc-400">
                        {c.createdAt.toLocaleString("de-DE")}
                      </td>
                      <td className="max-w-[220px] truncate px-5 py-3 text-xs text-zinc-500">{c.referrer ?? "—"}</td>
                      <td className="px-5 py-3 text-xs text-zinc-500">{device}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* the tracked links, for reference */}
      <div className="glass-card p-5 text-sm text-zinc-400">
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Live store links (tracked)</p>
        <ul className="mt-3 space-y-1 font-mono text-xs">
          <li>→ /api/app/click?store=google → play.google.com/store/apps/details?id=ai.barada.app</li>
          <li>→ /api/app/click?store=apple → apps.apple.com/de/app/barada-ai/id6759335541</li>
        </ul>
      </div>
    </div>
  );
}
