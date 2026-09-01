"use client";

import { useCallback, useEffect, useState } from "react";
import { Head } from "../components";

type Log = {
  id: string; template: string; sender: string; recipient: string; subject: string;
  status: string; error: string | null; createdAt: string;
};

const SENDERS = [
  { email: "ai@iuw7a.com", label: "Security / Authentication", use: "OTP, verification, password reset & change, security alerts" },
  { email: "hello@iuw7a.com", label: "Welcome / Product", use: "Welcome emails, product announcements" },
  { email: "barada.ai@iuw7a.com", label: "Billing / Subscriptions", use: "PRO upgrade, payment & billing notices" },
  { email: "support@iuw7a.com", label: "Support", use: "Support replies & account assistance" },
  { email: "info@iuw7a.com", label: "General", use: "General inquiries & information" },
];

export function EmailCenter() {
  const [stats, setStats] = useState<{ total: number; sent: number; failed: number } | null>(null);
  const [recent, setRecent] = useState<Log[]>([]);
  const [campaign, setCampaign] = useState<{ sentAt?: string; total?: number; succeeded?: number; failed?: number } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/email").then((r) => r.json()).then((d) => { setStats(d.stats); setRecent(d.recent ?? []); }).catch(() => {});
    fetch("/api/admin/email/campaign").then((r) => r.json()).then((d) => setCampaign(d.campaign)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function sendCampaign() {
    setBusy(true); setResult(null);
    try {
      const res = await fetch("/api/admin/email/campaign", { method: "POST" });
      const d = await res.json();
      setResult(res.ok ? `✓ Sent to ${d.succeeded}/${d.total} users (${d.failed} failed)` : d.error);
      if (res.ok) setConfirm(false);
      load();
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <Head title="Email Center" sub="Transactional email via Nora Play (UseINBOX) — all five sender identities verified on iuw7a.com." />

      {/* senders */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SENDERS.map((s) => (
          <div key={s.email} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
              <p className="text-[13px] font-semibold text-zinc-200">{s.email}</p>
            </div>
            <p className="mt-1 text-[11px] uppercase tracking-wider text-emerald-400/70">{s.label}</p>
            <p className="mt-1.5 text-[11px] leading-4 text-zinc-500">{s.use}</p>
          </div>
        ))}
      </div>

      {/* stats + campaign */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid grid-cols-3 gap-3 lg:col-span-2">
          {[
            { label: "Emails sent", value: stats?.sent ?? "—", accent: true },
            { label: "Failed", value: stats?.failed ?? "—" },
            { label: "Total attempts", value: stats?.total ?? "—" },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">{c.label}</p>
              <p className={`mt-1 text-2xl font-bold ${c.accent ? "text-emerald-300" : "text-zinc-100"}`}>{c.value}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5">
          <h2 className="text-sm font-semibold text-zinc-100">Release announcement</h2>
          {campaign?.sentAt ? (
            <>
              <p className="mt-2 text-xs text-emerald-300">✓ Sent {new Date(campaign.sentAt).toLocaleString()}</p>
              <p className="mt-1 text-[11px] text-zinc-500">{campaign.succeeded}/{campaign.total} delivered · {campaign.failed} failed · protected against duplicate sends</p>
            </>
          ) : (
            <>
              <p className="mt-2 text-[11px] leading-4 text-zinc-500">One product-update email to every user from hello@iuw7a.com. Sends once — duplicate protection is on.</p>
              <button onClick={() => setConfirm(true)} className="mt-3 w-full rounded-lg bg-emerald-500/90 py-2 text-xs font-semibold text-white hover:bg-emerald-500">Send announcement</button>
            </>
          )}
          {result && <p className={`mt-2 text-[11px] ${result.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>{result}</p>}
        </div>
      </div>

      {/* delivery log */}
      <div className="overflow-x-auto rounded-xl border border-white/5 bg-white/[0.02]">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-zinc-600">
              {["Template", "From", "To", "Subject", "Status", "Time"].map((h) => <th key={h} className="p-3.5 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {recent.map((l) => (
              <tr key={l.id} className="border-b border-white/[0.04] last:border-0">
                <td className="p-3.5 font-mono text-[12px] text-zinc-400">{l.template}</td>
                <td className="p-3.5 text-zinc-400">{l.sender}</td>
                <td className="p-3.5 text-zinc-300">{l.recipient}</td>
                <td className="max-w-[220px] truncate p-3.5 text-zinc-500">{l.subject}</td>
                <td className="p-3.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${l.status === "SENT" ? "bg-emerald-500/15 text-emerald-300" : l.status === "FAILED" ? "bg-red-500/15 text-red-300" : "bg-white/5 text-zinc-400"}`}>{l.status}</span>
                  {l.error && <p className="mt-0.5 max-w-[220px] truncate text-[10px] text-red-400/70">{l.error}</p>}
                </td>
                <td className="p-3.5 text-zinc-600">{new Date(l.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {!recent.length && <tr><td colSpan={6} className="p-8 text-center text-xs text-zinc-600">No emails sent yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !busy && setConfirm(false)} />
          <div className="relative mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1412] p-6">
            <h3 className="text-sm font-bold text-emerald-300">Send to all users?</h3>
            <p className="mt-2 text-xs leading-5 text-zinc-400">
              The product-update announcement goes to every registered user from <b>hello@iuw7a.com</b>.
              This campaign can only ever be sent once.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button disabled={busy} onClick={() => setConfirm(false)} className="rounded-lg border border-white/10 px-4 py-2 text-xs text-zinc-300">Cancel</button>
              <button disabled={busy} onClick={sendCampaign} className="rounded-lg bg-emerald-500/90 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500">
                {busy ? "Sending…" : "Confirm & send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
