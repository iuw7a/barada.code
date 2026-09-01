"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AISettings({ initial }: { initial: { perHourPerIp: number } }) {
  const router = useRouter();
  const [perHour, setPerHour] = useState(String(initial?.perHourPerIp ?? 3));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await fetch("/api/admin/ai-settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perHourPerIp: Math.max(0, parseInt(perHour, 10) || 0) }),
      });
      setSaved(true); setTimeout(() => setSaved(false), 1500);
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-zinc-500">Guest messages / hour / IP</label>
        <input value={perHour} onChange={(e) => setPerHour(e.target.value)} inputMode="numeric"
          className="mt-1 w-32 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500/40" />
      </div>
      <button onClick={save} disabled={busy}
        className="rounded-lg bg-emerald-500/90 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
        {saved ? "Saved ✓" : busy ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
