"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Row = {
  id: string; email: string; name: string; role: string; banned: boolean; createdAt: string;
  projects: number; chats: number; messages: number; plan: string; lastSeenAt: string | null;
};

export function UsersTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("createdAt");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/admin/users?q=${encodeURIComponent(q)}&filter=${filter}&sort=${sort}&dir=${dir}&page=${page}&pageSize=${pageSize}`;
      const res = await fetch(url);
      if (res.ok) {
        const d = await res.json();
        setRows(d.users ?? []);
        setTotal(d.total ?? 0);
        setSelected(new Set());
      }
    } finally { setLoading(false); }
  }, [q, filter, sort, dir, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  async function bulk(action: string) {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], action }),
      });
      await load();
    } finally { setBusy(false); }
  }

  function toggleSort(s: string) {
    if (sort === s) setDir(dir === "asc" ? "desc" : "asc");
    else { setSort(s); setDir("desc"); }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Users</h1>
        <p className="mt-0.5 text-xs text-zinc-500">{total} accounts · server-side search, filter & sort</p>
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search name or email…"
          className="w-64 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-emerald-500/40" />
        {["all", "pro", "banned", "admins"].map((f) => (
          <button key={f} onClick={() => { setFilter(f); setPage(1); }}
            className={`rounded-lg px-3 py-1.5 text-xs capitalize transition-colors ${
              filter === f ? "bg-emerald-500/15 font-semibold text-emerald-300 ring-1 ring-emerald-500/25" : "border border-white/10 text-zinc-400 hover:text-zinc-200"
            }`}>{f === "all" ? "All" : f === "pro" ? "PRO" : f === "banned" ? "Suspended" : "Admins"}</button>
        ))}
      </div>

      {/* bulk bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5">
          <span className="text-xs font-medium text-emerald-300">{selected.size} selected</span>
          <span className="text-zinc-600">·</span>
          {[["grantPro", "Grant PRO"], ["removePro", "Remove PRO"], ["unban", "Unsuspend"], ["ban", "Suspend"], ["revokeSessions", "Revoke sessions"], ["resetUsage", "Reset usage"]].map(([a, label]) => (
            <button key={a} disabled={busy} onClick={() => bulk(a)}
              className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-emerald-500/30 hover:text-emerald-300 disabled:opacity-40">{label}</button>
          ))}
        </div>
      )}

      {/* table */}
      <div className="overflow-x-auto rounded-xl border border-white/5 bg-white/[0.02]">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-zinc-600">
              <th className="p-3">
                <input type="checkbox" checked={allSelected} onChange={(e) =>
                  setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                  className="accent-emerald-500" />
              </th>
              {[
                ["name", "User"], ["plan", "Plan"], ["role", "Role"], ["projects", "Projects"],
                ["messages", "Messages"], ["createdAt", "Created"], ["lastSeenAt", "Last active"],
              ].map(([key, label]) => (
                <th key={key} className="cursor-pointer p-3 hover:text-zinc-400" onClick={() => (key === "name" || key === "createdAt") && toggleSort(key)}>
                  {label}{sort === key ? (dir === "asc" ? " ↑" : " ↓") : ""}
                </th>
              ))}
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]">
                <td className="p-3">
                  <input type="checkbox" checked={selected.has(u.id)} onChange={(e) => {
                    const n = new Set(selected); e.target.checked ? n.add(u.id) : n.delete(u.id); setSelected(n);
                  }} className="accent-emerald-500" />
                </td>
                <td className="p-3">
                  <Link href={`/admin/users/${u.id}`} className="font-medium text-zinc-200 hover:text-emerald-300">{u.name}</Link>
                  <p className="text-[11px] text-zinc-600">{u.email}</p>
                </td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    u.plan === "FREE" ? "bg-white/5 text-zinc-400" : "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25"
                  }`}>{u.plan}</span>
                </td>
                <td className="p-3 text-zinc-500">{u.role}</td>
                <td className="p-3 text-zinc-400">{u.projects}</td>
                <td className="p-3 text-zinc-400">{u.messages}</td>
                <td className="p-3 text-zinc-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="p-3 text-zinc-500">{u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString() : "never"}</td>
                <td className="p-3">
                  {u.banned
                    ? <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-300">Suspended</span>
                    : <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">Active</span>}
                </td>
                <td className="p-3">
                  <Link href={`/admin/users/${u.id}`} className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-zinc-400 hover:border-emerald-500/30 hover:text-emerald-300">Manage</Link>
                </td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr><td colSpan={10} className="p-8 text-center text-xs text-zinc-600">No users match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>Page {page} of {pages}</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-white/10 px-3 py-1.5 disabled:opacity-30 hover:text-zinc-200">Prev</button>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-white/10 px-3 py-1.5 disabled:opacity-30 hover:text-zinc-200">Next</button>
        </div>
      </div>
    </div>
  );
}
