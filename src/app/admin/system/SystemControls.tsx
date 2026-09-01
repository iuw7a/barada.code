"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SystemControls({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await fetch("/api/admin/system/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      setConfirm(false);
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
          enabled ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30" : "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/25"
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${enabled ? "bg-amber-400" : "bg-emerald-400"}`} />
          {enabled ? "Maintenance ON" : "Maintenance OFF"}
        </span>
        <button onClick={() => setConfirm(true)}
          className={`rounded-lg px-3 py-2 text-xs font-medium ${enabled ? "border border-white/10 text-zinc-300 hover:text-zinc-100" : "bg-amber-500/80 text-white hover:bg-amber-500"}`}>
          {enabled ? "Disable maintenance mode" : "Enable maintenance mode"}
        </button>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !busy && setConfirm(false)} />
          <div className="relative mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1412] p-6">
            <h3 className="text-sm font-bold text-amber-300">Are you sure?</h3>
            <p className="mt-2 text-xs leading-5 text-zinc-400">
              {enabled ? "This will make the application available to all users again." :
                "This may make the application unavailable for regular users while maintenance mode is active. Admins keep access."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button disabled={busy} onClick={() => setConfirm(false)} className="rounded-lg border border-white/10 px-4 py-2 text-xs text-zinc-300">Cancel</button>
              <button disabled={busy} onClick={toggle} className="rounded-lg bg-amber-500/90 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500">
                {busy ? "Applying…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
