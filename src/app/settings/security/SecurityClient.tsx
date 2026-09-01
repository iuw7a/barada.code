"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, LogOut } from "lucide-react";

type Session = { id: string; createdAt: string | Date; expiresAt: string | Date };

export default function SecurityClient({ sessions }: { sessions: Session[] }) {
  const router = useRouter();
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setPwMsg(null);
    setPwErr(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Password change failed");
      }
      setPwMsg("Password changed. Other sessions stay active — revoke them below if needed.");
      setCurPw("");
      setNewPw("");
      router.refresh();
    } catch (err) {
      setPwErr(err instanceof Error ? err.message : "Password change failed");
    } finally {
      setBusy(false);
    }
  }

  async function revokeAll() {
    if (!window.confirm("Sign out of all sessions on all devices?")) return;
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/signin");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="mb-4 text-lg font-semibold">Password</h2>
        <form onSubmit={changePassword} className="flex max-w-md flex-col gap-3">
          <input
            className="input"
            type="password"
            placeholder="Current password"
            value={curPw}
            onChange={(e) => setCurPw(e.target.value)}
            autoComplete="current-password"
          />
          <input
            className="input"
            type="password"
            placeholder="New password (8+ characters)"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            autoComplete="new-password"
            minLength={8}
          />
          {pwErr && <p className="text-sm text-red-600 dark:text-red-400">{pwErr}</p>}
          {pwMsg && <p className="text-sm text-accent-600">{pwMsg}</p>}
          <button type="submit" disabled={busy} className="btn-primary">Update password</button>
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Sessions</h2>
        <div className="card mb-3 divide-y divide-ink-200 dark:divide-ink-800">
          {sessions.length === 0 && <p className="p-4 text-sm text-ink-500">No active sessions.</p>}
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-3 text-sm">
              <ShieldCheck className="h-4 w-4 text-accent-600" />
              <span>Active session</span>
              <span className="ms-auto text-xs text-ink-400">
                since {new Date(s.createdAt).toLocaleDateString()} · expires {new Date(s.expiresAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
        <button onClick={revokeAll} className="btn-ghost text-sm">
          <LogOut className="h-4 w-4" /> Sign out everywhere
        </button>
      </section>
    </div>
  );
}
