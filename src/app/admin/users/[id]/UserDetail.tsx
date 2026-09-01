"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Detail = {
  id: string; email: string; name: string; avatarUrl: string | null; role: string; banned: boolean; createdAt: string;
  counts: { projects: number; chats: number; messages: number; sessions: number };
  plan: string;
  subscriptions: Array<{ id: string; plan: string; status: string; createdAt: string; currentPeriodEnd: string | null }>;
  recentSessions: Array<{ createdAt: string; expiresAt: string }>;
  recentChats: Array<{ id: string; title: string; updatedAt: string }>;
  monthUsage: { aiCalls: number; aiTokens: number };
  storageBytes: number;
};

export function UserDetail({ id }: { id: string }) {
  const router = useRouter();
  const [u, setU] = useState<Detail | null>(null);
  const [confirm, setConfirm] = useState<{ action: string; label: string; danger?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/admin/users/${id}`).then((r) => (r.ok ? r.json() : null)).then((d) => setU(d?.user ?? null)).catch(() => {});
  }, [id]);
  useEffect(load, [load]);

  async function act(action: string) {
    setBusy(true);
    try {
      const body: Record<string, unknown> = {};
      if (action === "grantPro") body.plan = "PRO";
      if (action === "removePro") body.plan = "FREE";
      if (action === "suspend") body.banned = true;
      if (action === "unsuspend") body.banned = false;
      if (action === "resetUsage") body.resetUsage = true;
      if (action === "revokeSessions") body.revokeSessions = true;
      if (action === "delete") {
        const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
        if (res.ok) { router.push("/admin/users"); return; }
      } else {
        await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      setConfirm(null);
      load();
    } finally { setBusy(false); }
  }

  if (!u) return <p className="py-20 text-center text-xs text-zinc-600">Loading…</p>;

  const Card = ({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) => (
    <div className={`rounded-xl border border-white/5 bg-white/[0.02] p-5 ${className}`}>
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">{title}</h2>
      {children}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/15 text-lg font-bold text-emerald-300 ring-1 ring-emerald-500/30">
          {u.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-lg font-bold text-zinc-100">
            {u.name}
            {u.banned && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-300">Suspended</span>}
            {u.role !== "USER" && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">{u.role}</span>}
          </h1>
          <p className="text-xs text-zinc-500">{u.email} · id <span className="font-mono">{u.id}</span></p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {u.plan === "FREE"
            ? <Btn onClick={() => setConfirm({ action: "grantPro", label: `Grant PRO to ${u.email}?` })} emerald>Grant PRO</Btn>
            : <Btn onClick={() => setConfirm({ action: "removePro", label: `Remove PRO from ${u.email}?` })}>Remove PRO</Btn>}
          {u.banned
            ? <Btn onClick={() => setConfirm({ action: "unsuspend", label: `Unsuspend ${u.email}?` })}>Unsuspend</Btn>
            : <Btn onClick={() => setConfirm({ action: "suspend", label: `Suspend ${u.email}? They will be logged out immediately.`, danger: true })} danger>Suspend</Btn>}
          <Btn onClick={() => setConfirm({ action: "revokeSessions", label: "Revoke all sessions? The user will be logged out everywhere." })}>Revoke sessions</Btn>
          <Btn onClick={() => setConfirm({ action: "resetUsage", label: "Reset this month's usage counters?" })}>Reset usage</Btn>
          <Btn onClick={() => setConfirm({ action: "delete", label: `PERMANENTLY delete ${u.email} and all their data? This cannot be undone.`, danger: true })} danger>Delete</Btn>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Profile">
          <Row k="Name" v={u.name} /><Row k="Email" v={u.email} />
          <Row k="User ID" v={u.id} mono /><Row k="Created" v={new Date(u.createdAt).toLocaleString()} />
          <Row k="Role" v={u.role} /><Row k="Status" v={u.banned ? "Suspended" : "Active"} />
        </Card>
        <Card title="Subscription">
          <Row k="Current plan" v={u.plan} accent={u.plan !== "FREE"} />
          {u.subscriptions.slice(0, 4).map((s) => (
            <Row key={s.id} k={`${s.plan} · ${s.status}`} v={new Date(s.createdAt).toLocaleDateString()} />
          ))}
          {u.subscriptions.length === 0 && <p className="text-xs text-zinc-600">No payment history — free account.</p>}
        </Card>
        <Card title="Usage (this month)">
          <Row k="Messages" v={String(u.counts.messages)} />
          <Row k="AI requests" v={String(u.monthUsage.aiCalls)} />
          <Row k="AI tokens" v={String(u.monthUsage.aiTokens)} />
          <Row k="Storage" v={`${(u.storageBytes / 1024).toFixed(1)} KB`} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Product activity">
          <Row k="Projects" v={String(u.counts.projects)} /><Row k="Conversations" v={String(u.counts.chats)} />
          <Row k="Total sessions" v={String(u.counts.sessions)} />
        </Card>
        <Card title="Recent sessions">
          {u.recentSessions.map((s, i) => (
            <Row key={i} k={new Date(s.createdAt).toLocaleString()} v={`exp ${new Date(s.expiresAt).toLocaleDateString()}`} />
          ))}
          {!u.recentSessions.length && <p className="text-xs text-zinc-600">No active sessions.</p>}
        </Card>
        <Card title="Recent conversations">
          {u.recentChats.map((ch) => (
            <Row key={ch.id} k={ch.title} v={new Date(ch.updatedAt).toLocaleDateString()} />
          ))}
          {!u.recentChats.length && <p className="text-xs text-zinc-600">No conversations yet.</p>}
        </Card>
      </div>

      {/* confirmation modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !busy && setConfirm(null)} />
          <div className="relative mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1412] p-6">
            <h3 className={`text-sm font-bold ${confirm.danger ? "text-red-300" : "text-emerald-300"}`}>Confirm action</h3>
            <p className="mt-2 text-xs leading-5 text-zinc-400">{confirm.label}</p>
            <p className="mt-2 text-[11px] text-zinc-600">This action is written to the audit log.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button disabled={busy} onClick={() => setConfirm(null)} className="rounded-lg border border-white/10 px-4 py-2 text-xs text-zinc-300 hover:text-zinc-100">Cancel</button>
              <button disabled={busy} onClick={() => act(confirm.action)}
                className={`rounded-lg px-4 py-2 text-xs font-semibold text-white ${confirm.danger ? "bg-red-500/80 hover:bg-red-500" : "bg-emerald-500/90 hover:bg-emerald-500"}`}>
                {busy ? "Working…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Btn({ children, onClick, emerald, danger }: { children: React.ReactNode; onClick: () => void; emerald?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
        danger ? "border border-red-500/30 text-red-300 hover:bg-red-500/10"
        : emerald ? "bg-emerald-500/90 text-white hover:bg-emerald-500"
        : "border border-white/10 text-zinc-300 hover:border-emerald-500/30 hover:text-emerald-300"
      }`}>{children}</button>
  );
}

function Row({ k, v, mono, accent }: { k: string; v: string; mono?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.04] py-1.5 last:border-0">
      <span className="text-xs text-zinc-500">{k}</span>
      <span className={`max-w-[60%] truncate text-xs font-medium ${accent ? "text-emerald-300" : "text-zinc-300"} ${mono ? "font-mono text-[11px]" : ""}`}>{v}</span>
    </div>
  );
}
