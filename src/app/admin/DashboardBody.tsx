"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Data = {
  adminGreetingHour: number;
  metrics: {
    users: number; usersToday: number; usersWeek: number; usersMonth: number; onlineNow: number;
    projects: number; chats: number; messages: number; aiJobs: number;
    pro: number; free: number; banned: number; aiErrors: number; mrr: number;
  };
  series: Array<{ day: string; count: number }>;
  recentUsers: Array<{ id: string; name: string; email: string; banned: boolean; messages: number; plan: string; joined: string }>;
};

const RANGES = [
  { key: "7d", days: 7, label: "7D" },
  { key: "14d", days: 14, label: "14D" },
  { key: "30d", days: 30, label: "30D" },
] as const;

export function DashboardBody({ data }: { data: Data }) {
  const { metrics: m } = data;
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("30d");
  const [watchTab, setWatchTab] = useState<"all" | "pro" | "new">("all");
  const [statPeriod, setStatPeriod] = useState("today");
  const [hover, setHover] = useState<number | null>(null);

  const greeting = data.adminGreetingHour < 12 ? "Good morning" : data.adminGreetingHour < 18 ? "Good afternoon" : "Good evening";

  const series = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)?.days ?? 30;
    return data.series.slice(-days);
  }, [range, data.series]);

  const watchRows = useMemo(() => {
    let rows = data.recentUsers;
    if (watchTab === "pro") rows = rows.filter((u) => u.plan !== "FREE");
    if (watchTab === "new") rows = rows.slice(0, 3);
    return rows;
  }, [watchTab, data.recentUsers]);

  const statValue = statPeriod === "today" ? m.usersToday : statPeriod === "week" ? m.usersWeek : m.usersMonth;

  // chart geometry
  const W = 900, H = 260, PAD_X = 46, PAD_Y = 24;
  const max = Math.max(1, ...series.map((s) => s.count));
  const pts = series.map((s, i) => ({
    x: PAD_X + (i / Math.max(1, series.length - 1)) * (W - PAD_X - 20),
    y: H - PAD_Y - (s.count / max) * (H - PAD_Y - 30),
    ...s,
  }));
  const linePath = useMemo(() => {
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i], p1 = pts[i + 1];
      const cx = (p0.x + p1.x) / 2;
      d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return d;
  }, [pts]);
  const areaPath = linePath ? `${linePath} L ${pts[pts.length - 1].x} ${H - PAD_Y} L ${pts[0].x} ${H - PAD_Y} Z` : "";

  return (
    <div className="relative space-y-6">
      {/* ── header greeting ── */}
      <div className="flex flex-wrap items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
            {greeting}, <span className="text-emerald-400">Admin</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {m.onlineNow} online right now · {m.usersToday} new today · everything is real data
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/admin/system" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-zinc-400 transition-colors hover:border-emerald-500/30 hover:text-emerald-300" title="System health">🔔</Link>
          <Link href="/admin/settings/profile" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-zinc-400 transition-colors hover:border-emerald-500/30 hover:text-emerald-300" title="Settings">⚙️</Link>
          <Link href="/admin/settings/profile" className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] py-1.5 pl-1.5 pr-4 transition-colors hover:border-emerald-500/30">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300 ring-1 ring-emerald-500/30">BA</span>
            <span>
              <span className="block text-xs font-semibold text-zinc-200">Barada Admin</span>
              <span className="block text-[10px] text-zinc-500">admin@iuw7a.com</span>
            </span>
          </Link>
        </div>
      </div>

      {/* ── tab pills ── */}
      <div className="flex gap-2">
        {[
          { label: "Overview", href: "/admin", active: true },
          { label: "Analytics", href: "/admin/analytics" },
          { label: "System", href: "/admin/system" },
        ].map((t) => (
          <Link key={t.label} href={t.href}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
              t.active
                ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.12)]"
                : "border border-white/10 text-zinc-400 hover:border-emerald-500/20 hover:text-zinc-200"
            }`}>{t.label}</Link>
        ))}
      </div>

      {/* ── top grid: stat + CTA | watchlist | portfolio ── */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* stat card + CTA */}
        <div className="space-y-4 lg:col-span-3">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">New users</p>
              <select value={statPeriod} onChange={(e) => setStatPeriod(e.target.value)}
                className="rounded-lg border border-white/10 bg-[#0d1412] px-2 py-1 text-[11px] text-zinc-300 outline-none">
                <option value="today">Today</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
              </select>
            </div>
            <p className="mt-2 text-4xl font-bold text-zinc-50">{statValue}</p>
            <p className="mt-1 text-[11px] text-zinc-600">{m.users} total accounts</p>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.08] to-transparent p-5">
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-500/15 blur-3xl" />
            <p className="text-sm font-bold text-zinc-100">Grow to PRO</p>
            <p className="mt-1 text-[11px] leading-4 text-zinc-500">{m.free} free users · {m.pro} already PRO. Grant plans in one click.</p>
            <Link href="/admin/users" className="mt-3 inline-block rounded-full bg-emerald-500 px-4 py-2 text-[11px] font-bold text-white transition-colors hover:bg-emerald-400">
              Manage plans
            </Link>
          </div>
        </div>

        {/* watchlist */}
        <div className="glass-card p-5 lg:col-span-5">
          <div className="mb-4 flex gap-2">
            {(["all", "pro", "new"] as const).map((t) => (
              <button key={t} onClick={() => setWatchTab(t)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition-all ${
                  watchTab === t ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25" : "text-zinc-500 hover:text-zinc-300"
                }`}>{t === "all" ? "Recent" : t === "pro" ? "PRO" : "Newest"}</button>
            ))}
          </div>
          <div className="space-y-1">
            {watchRows.map((u) => (
              <Link key={u.id} href={`/admin/users/${u.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.04]">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-500/20">
                  {u.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-zinc-200">{u.name}</span>
                  <span className="block truncate text-[11px] text-zinc-600">{u.email}</span>
                </span>
                <span className="text-right">
                  <span className={`block rounded-full px-2 py-0.5 text-[10px] font-bold ${u.plan === "FREE" ? "bg-white/5 text-zinc-500" : "bg-emerald-500/15 text-emerald-300"}`}>{u.plan}</span>
                  <span className="mt-0.5 block text-[10px] text-zinc-600">{u.messages} msgs</span>
                </span>
              </Link>
            ))}
            {!watchRows.length && <p className="py-6 text-center text-xs text-zinc-600">No users in this filter.</p>}
          </div>
        </div>

        {/* portfolio grid */}
        <div className="glass-card p-5 lg:col-span-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-zinc-200">Platform</p>
            <Link href="/admin/analytics" className="text-[11px] text-emerald-400 hover:text-emerald-300">View analytics →</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: "◉", label: "Projects", value: m.projects, tag: `+${m.usersWeek} users/wk`, href: "/admin/projects" },
              { icon: "✉", label: "Messages", value: m.messages, tag: `${m.chats} chats`, href: "/admin/analytics" },
              { icon: "✦", label: "AI jobs", value: m.aiJobs, tag: m.aiErrors ? `${m.aiErrors} errors` : "0 errors", danger: m.aiErrors > 0, href: "/admin/ai" },
              { icon: "$", label: "MRR (est.)", value: `$${m.mrr}`, tag: `${m.pro} PRO`, accent: true, href: "/admin/revenue" },
            ].map((c) => (
              <Link key={c.label} href={c.href} className="rounded-xl border border-white/5 bg-white/[0.03] p-3.5 transition-all hover:border-emerald-500/25 hover:bg-emerald-500/[0.04]">
                <div className="flex items-start justify-between">
                  <span className="text-[13px] text-emerald-400/80">{c.icon}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${c.danger ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"}`}>{c.tag}</span>
                </div>
                <p className="mt-2 text-xl font-bold text-zinc-50">{c.value}</p>
                <p className="text-[10px] uppercase tracking-wider text-zinc-600">{c.label}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── big chart ── */}
      <div className="glass-card relative p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-200">User activity</p>
            <p className="text-[11px] text-zinc-600">Messages per day — live from the database</p>
          </div>
          <div className="ml-auto flex gap-1.5">
            {RANGES.map((r) => (
              <button key={r.key} onClick={() => setRange(r.key)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
                  range === r.key ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25" : "border border-white/10 text-zinc-500 hover:text-zinc-300"
                }`}>{r.label}</button>
            ))}
          </div>
        </div>

        <div className="relative mt-4">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 260 }} preserveAspectRatio="none"
            onMouseLeave={() => setHover(null)}
            onMouseMove={(e) => {
              const rect = (e.target as SVGElement).closest("svg")!.getBoundingClientRect();
              const relX = ((e.clientX - rect.left) / rect.width) * W;
              let best = 0, bestD = Infinity;
              pts.forEach((p, i) => { const d = Math.abs(p.x - relX); if (d < bestD) { bestD = d; best = i; } });
              setHover(best);
            }}>
            <defs>
              <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* grid lines + y labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((f) => {
              const y = H - PAD_Y - f * (H - PAD_Y - 30);
              return (
                <g key={f}>
                  <line x1={PAD_X} y1={y} x2={W - 20} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                  <text x={8} y={y + 3} fill="#52525b" fontSize="9">{Math.round(max * f)}</text>
                </g>
              );
            })}
            {/* x labels */}
            {series.map((s, i) =>
              i % Math.ceil(series.length / 8) === 0 ? (
                <text key={s.day} x={pts[i].x} y={H - 6} fill="#52525b" fontSize="9" textAnchor="middle">{s.day.slice(5)}</text>
              ) : null
            )}
            {areaPath && <path d={areaPath} fill="url(#areaFill)" />}
            {linePath && <path d={linePath} fill="none" stroke="#10b981" strokeWidth="2" />}
            {hover !== null && pts[hover] && (
              <g>
                <line x1={pts[hover].x} y1={PAD_Y} x2={pts[hover].x} y2={H - PAD_Y} stroke="rgba(16,185,129,0.3)" strokeDasharray="3 3" />
                <circle cx={pts[hover].x} cy={pts[hover].y} r="4" fill="#10b981" stroke="#022c22" strokeWidth="2" />
              </g>
            )}
          </svg>
          {hover !== null && pts[hover] && (
            <div className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-emerald-500/20 bg-[#0d1412] px-3 py-1.5 shadow-lg"
              style={{ left: `${(pts[hover].x / W) * 100}%`, top: `${(pts[hover].y / H) * 100 - 22}%` }}>
              <p className="text-[10px] text-zinc-500">{pts[hover].day.slice(5)}</p>
              <p className="text-xs font-bold text-emerald-300">{pts[hover].count} messages</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
