export function StatGrid({ stats }: { stats: Array<{ label: string; value: string; accent?: boolean }> }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{s.label}</p>
          <p className={`mt-1 text-xl font-bold ${s.accent ? "text-emerald-300" : "text-zinc-100"}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

export function RangeChart({ series }: { series: Array<{ day: string; count: number }> }) {
  const max = Math.max(1, ...series.map((s) => s.count));
  return (
    <div className="mt-4 flex h-36 items-end gap-[2px]">
      {series.map((s) => (
        <div key={s.day} className="group relative flex-1" title={`${s.day}: ${s.count}`}>
          <div className="w-full rounded-t bg-emerald-500/30 transition-all hover:bg-emerald-400/70"
            style={{ height: `${Math.max(3, (s.count / max) * 130)}px` }} />
        </div>
      ))}
    </div>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs leading-5 text-amber-200/80">{children}</p>;
}

export function Head({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">{title}</h1>
        {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
      </div>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}
