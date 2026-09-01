"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProfileForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const body: Record<string, unknown> = { name };
      if (password) body.newPassword = password;
      const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Failed");
      setMsg("✓ Saved"); setPassword("");
      router.refresh();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
      <h2 className="mb-3 text-sm font-semibold text-zinc-200">Edit profile</h2>
      <label className="text-[11px] uppercase tracking-wider text-zinc-500">Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)}
        className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500/40" />
      <label className="mt-4 block text-[11px] uppercase tracking-wider text-zinc-500">New password (leave empty to keep)</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
        className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500/40" />
      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} disabled={busy} className="rounded-lg bg-emerald-500/90 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
          {busy ? "Saving…" : "Save changes"}
        </button>
        {msg && <span className={`text-xs ${msg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>{msg}</span>}
      </div>
    </div>
  );
}
