"use client";

import { useCallback, useEffect, useState } from "react";

type Ad = {
  id: string; title: string; description: string | null; imageUrl: string | null; videoUrl: string | null;
  ctaText: string | null; ctaUrl: string | null; advertiser: string; campaign: string | null;
  amountPaid: number; startsAt: string; endsAt: string; status: string; impressions: number; clicks: number;
};
type Rules = { showToFree: boolean; showToPro: boolean; showToGuests: boolean; maxPerSession: number; maxPerDay: number; enabled: boolean };

const EMPTY = { title: "", description: "", imageUrl: "", videoUrl: "", ctaText: "Learn more", ctaUrl: "", advertiser: "", campaign: "", amountPaidDollars: "5", days: "3", status: "ACTIVE" };

export function AdsManager({ initialRules }: { initialRules: Rules }) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rules, setRules] = useState(initialRules);
  const [rulesSaved, setRulesSaved] = useState(false);

  const load = useCallback(() => { fetch("/api/admin/ads").then((r) => r.json()).then((d) => setAds(d.ads ?? [])).catch(() => {}); }, []);
  useEffect(load, [load]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function create() {
    setCreating(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/ads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title, description: form.description, imageUrl: form.imageUrl || undefined, videoUrl: form.videoUrl || undefined,
          ctaText: form.ctaText, ctaUrl: form.ctaUrl || undefined, advertiser: form.advertiser, campaign: form.campaign || undefined,
          amountPaid: Math.round(parseFloat(form.amountPaidDollars || "0") * 100), days: parseInt(form.days, 10) || 1,
          status: form.status,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setForm({ ...EMPTY }); setMsg("✓ Ad created"); load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); }
    finally { setCreating(false); }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch("/api/admin/ads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) });
    load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this advertisement?")) return;
    await fetch(`/api/admin/ads?id=${id}`, { method: "DELETE" });
    load();
  }
  async function saveRules() {
    await fetch("/api/admin/ads", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rules) });
    setRulesSaved(true); setTimeout(() => setRulesSaved(false), 1500);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Advertising</h1>
        <p className="mt-0.5 text-xs text-zinc-500">Create campaigns, control placement and track real performance.</p>
      </div>

      {/* rules */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-200">Display rules</h2>
        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-300">
          <label className="flex items-center gap-2"><input type="checkbox" checked={rules.enabled} onChange={(e) => setRules({ ...rules, enabled: e.target.checked })} className="accent-emerald-500" /> Ads enabled</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={rules.showToFree} onChange={(e) => setRules({ ...rules, showToFree: e.target.checked })} className="accent-emerald-500" /> Show to FREE</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={rules.showToPro} onChange={(e) => setRules({ ...rules, showToPro: e.target.checked })} className="accent-emerald-500" /> Show to PRO</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={rules.showToGuests} onChange={(e) => setRules({ ...rules, showToGuests: e.target.checked })} className="accent-emerald-500" /> Show to guests</label>
          <label className="flex items-center gap-2">Max/session
            <input type="number" min={0} max={50} value={rules.maxPerSession} onChange={(e) => setRules({ ...rules, maxPerSession: +e.target.value })}
              className="w-16 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-center outline-none focus:border-emerald-500/40" /></label>
          <label className="flex items-center gap-2">Max/day
            <input type="number" min={0} max={500} value={rules.maxPerDay} onChange={(e) => setRules({ ...rules, maxPerDay: +e.target.value })}
              className="w-16 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-center outline-none focus:border-emerald-500/40" /></label>
          <button onClick={saveRules} className="rounded-lg bg-emerald-500/90 px-4 py-2 font-semibold text-white hover:bg-emerald-500">{rulesSaved ? "Saved ✓" : "Save rules"}</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* create form */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-200">New advertisement</h2>
          <div className="space-y-2.5">
            {[["title", "Ad title *"], ["advertiser", "Advertiser *"], ["campaign", "Campaign name"], ["description", "Description"], ["imageUrl", "Image URL (https://…)"], ["videoUrl", "Video URL (https://…)"], ["ctaText", "CTA text"], ["ctaUrl", "Destination URL (https://…)"]].map(([k, ph]) => (
              <input key={k} value={(form as Record<string, string>)[k]} onChange={(e) => set(k, e.target.value)} placeholder={ph}
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-emerald-500/40" />
            ))}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] uppercase tracking-wider text-zinc-600">Amount paid (USD)</label>
                <input value={form.amountPaidDollars} onChange={(e) => set("amountPaidDollars", e.target.value)} inputMode="decimal"
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/40" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] uppercase tracking-wider text-zinc-600">Duration (days)</label>
                <input value={form.days} onChange={(e) => set("days", e.target.value)} inputMode="numeric"
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/40" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] uppercase tracking-wider text-zinc-600">Status</label>
                <select value={form.status} onChange={(e) => set("status", e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/40">
                  {["ACTIVE", "DRAFT", "SCHEDULED", "PAUSED"].map((s) => <option key={s} value={s} className="bg-zinc-900">{s}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={create} disabled={creating || !form.title || !form.advertiser}
                className="rounded-lg bg-emerald-500/90 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40">
                {creating ? "Creating…" : "Create ad"}
              </button>
              {msg && <span className={`text-xs ${msg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>{msg}</span>}
            </div>
          </div>
        </div>

        {/* live preview */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-200">Live preview — how it appears under the chat</h2>
          <div className="rounded-xl border border-white/10 bg-[#0d1412] p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-600">Sponsored</p>
            {form.imageUrl && <img src={form.imageUrl} alt="" className="mb-2 max-h-32 w-full rounded-lg object-cover" />}
            <p className="text-sm font-semibold text-zinc-100">{form.title || "Your ad title"}</p>
            <p className="mt-1 text-xs text-zinc-400">{form.description || "Your ad description appears here."}</p>
            {form.ctaText && (
              <span className="mt-3 inline-block rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/25">
                {form.ctaText} ↗
              </span>
            )}
            <p className="mt-2 text-[10px] text-zinc-600">by {form.advertiser || "Advertiser"}</p>
          </div>
        </div>
      </div>

      {/* campaigns table */}
      <div className="overflow-x-auto rounded-xl border border-white/5 bg-white/[0.02]">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-zinc-600">
              {["Ad", "Advertiser", "Paid", "Window", "Impr.", "Clicks", "CTR", "Status", "Actions"].map((h) => <th key={h} className="p-3.5 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {ads.map((a) => {
              const ctr = a.impressions ? ((a.clicks / a.impressions) * 100).toFixed(1) : "0.0";
              const expired = new Date(a.endsAt) <= new Date();
              return (
                <tr key={a.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="p-3.5">
                    <p className="font-medium text-zinc-200">{a.title}</p>
                    {a.campaign && <p className="text-[11px] text-zinc-600">{a.campaign}</p>}
                  </td>
                  <td className="p-3.5 text-zinc-400">{a.advertiser}</td>
                  <td className="p-3.5 text-emerald-300">${(a.amountPaid / 100).toFixed(2)}</td>
                  <td className="p-3.5 text-[11px] text-zinc-500">{new Date(a.startsAt).toLocaleDateString()} → {new Date(a.endsAt).toLocaleDateString()}{expired && <span className="ml-1 text-amber-400">(expired)</span>}</td>
                  <td className="p-3.5 text-zinc-400">{a.impressions}</td>
                  <td className="p-3.5 text-zinc-400">{a.clicks}</td>
                  <td className="p-3.5 text-zinc-400">{ctr}%</td>
                  <td className="p-3.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      a.status === "ACTIVE" && !expired ? "bg-emerald-500/15 text-emerald-300"
                      : a.status === "PAUSED" ? "bg-amber-500/15 text-amber-300"
                      : "bg-white/5 text-zinc-500"
                    }`}>{expired ? "EXPIRED" : a.status}</span>
                  </td>
                  <td className="p-3.5">
                    <div className="flex gap-1.5">
                      <button onClick={() => patch(a.id, { status: a.status === "PAUSED" ? "ACTIVE" : "PAUSED" })}
                        className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-zinc-400 hover:text-emerald-300">
                        {a.status === "PAUSED" ? "Resume" : "Pause"}
                      </button>
                      <button onClick={() => patch(a.id, { extendDays: 7 })}
                        className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-zinc-400 hover:text-emerald-300">+7d</button>
                      <button onClick={() => remove(a.id)}
                        className="rounded-lg border border-red-500/20 px-2 py-1 text-[11px] text-red-300 hover:bg-red-500/10">Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!ads.length && <tr><td colSpan={9} className="p-8 text-center text-xs text-zinc-600">No advertisements yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
