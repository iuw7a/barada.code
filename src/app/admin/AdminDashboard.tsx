"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, FolderKanban, MessageSquare, Zap, DollarSign, Radio,
  ShieldBan, Crown, ShieldCheck, Search, RefreshCw, ArrowLeft, KeyRound,
} from "lucide-react";

type Stats = {
  users: number;
  usersToday: number;
  onlineNow: number;
  projects: number;
  chats: number;
  messages: number;
  aiJobs: number;
  proSubscribers: number;
  estimatedMrrUsd: number;
  aiCalls: number;
  aiTokens: number;
  apiKeys: Record<string, boolean>;
  recentUsers: Array<{ id: string; email: string; name: string; createdAt: string; banned: boolean; isAdmin: boolean }>;
  topUsers: Array<{ id: string; name: string; email: string; _count: { projects: number; chats: number } }>;
};

type AdminUser = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  banned: boolean;
  createdAt: string;
  projects: number;
  chats: number;
  messages: number;
  plan: string;
  lastSeenAt: string | null;
};

export default function AdminDashboard({ adminName }: { adminName: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (search = "") => {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([
        fetch("/api/admin/stats").then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/admin/users${search ? `?q=${encodeURIComponent(search)}` : ""}`).then((r) => (r.ok ? r.json() : { users: [] })),
      ]);
      setStats(s);
      setUsers(u.users ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) await load(q);
    } finally {
      setBusyId(null);
    }
  }

  const cards = stats ? [
    { icon: Users, label: "Users", value: stats.users, sub: `+${stats.usersToday} today · ${stats.onlineNow} online now`, color: "#10a35f" },
    { icon: FolderKanban, label: "Projects", value: stats.projects, sub: `${stats.chats} chats · ${stats.messages} messages`, color: "#3b82f6" },
    { icon: Zap, label: "AI jobs", value: stats.aiJobs, sub: `${stats.aiCalls} calls · ${fmtNum(stats.aiTokens)} tokens`, color: "#f59e0b" },
    { icon: DollarSign, label: "Estimated MRR", value: `$${stats.estimatedMrrUsd}`, sub: `${stats.proSubscribers} PRO subscribers`, color: "#8b5cf6" },
  ] : [];

  return (
    <div style={{ minHeight: "100vh", background: "#0b0f0e", color: "#e7ece9", fontFamily: "system-ui, sans-serif" }}>
      {/* top bar */}
      <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 24px", borderBottom: "1px solid #1e2a25", position: "sticky", top: 0, background: "#0b0f0ecc", backdropFilter: "blur(8px)", zIndex: 10 }}>
        <Link href="/chat" style={{ display: "flex", alignItems: "center", gap: 6, color: "#8a968f", textDecoration: "none", fontSize: 14 }}>
          <ArrowLeft size={16} /> Back to app
        </Link>
        <div style={{ flex: 1 }} />
        <Crown size={16} color="#10a35f" />
        <span style={{ fontWeight: 600 }}>Barada Admin</span>
        <span style={{ color: "#8a968f", fontSize: 13 }}>· {adminName}</span>
        <button onClick={() => load(q)} style={btnGhost}>
          <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
        </button>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 80px" }}>
        {/* stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
          {cards.map((c) => (
            <div key={c.label} style={{ ...card, borderTop: `2px solid ${c.color}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8a968f", fontSize: 13 }}>
                <c.icon size={15} color={c.color} /> {c.label}
              </div>
              <div style={{ fontSize: 30, fontWeight: 700, margin: "6px 0 2px" }}>{c.value}</div>
              <div style={{ fontSize: 12, color: "#8a968f" }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* API keys status */}
        {stats && (
          <div style={{ ...card, marginTop: 14 }}>
            <div style={{ ...sectionTitle }}><KeyRound size={14} /> API keys & services</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
              {Object.entries(stats.apiKeys).map(([k, ok]) => (
                <span key={k} style={pill(ok ? "#10a35f" : "#ef4444")}>
                  <Radio size={11} /> {k}: {ok ? "configured" : "MISSING"}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14, marginTop: 14, alignItems: "start" }}>
          {/* users table */}
          <div style={{ ...card, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", display: "flex", gap: 10, alignItems: "center", borderBottom: "1px solid #1e2a25" }}>
              <div style={searchWrap}>
                <Search size={14} color="#8a968f" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && load(q)}
                  placeholder="Search email or name…"
                  style={searchInput}
                />
              </div>
              <button onClick={() => load(q)} style={btnGhost}>Search</button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ color: "#8a968f", textAlign: "left" }}>
                    {["User", "Plan", "Projects", "Chats", "Msgs", "Joined", "Last seen", "Actions"].map((h) => (
                      <th key={h} style={{ padding: "10px 12px", fontWeight: 500, borderBottom: "1px solid #1e2a25" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} style={{ borderBottom: "1px solid #16201c" }}>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 600 }}>{u.name}</span>
                          {u.isAdmin && <ShieldCheck size={13} color="#10a35f" />}
                          {u.banned && <ShieldBan size={13} color="#ef4444" />}
                        </div>
                        <div style={{ color: "#8a968f", fontSize: 12 }}>{u.email}</div>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={pill(u.plan === "FREE" ? "#8a968f" : "#8b5cf6")}>{u.plan}</span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>{u.projects}</td>
                      <td style={{ padding: "10px 12px" }}>{u.chats}</td>
                      <td style={{ padding: "10px 12px" }}>{u.messages}</td>
                      <td style={{ padding: "10px 12px", color: "#8a968f" }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: "10px 12px", color: "#8a968f" }}>{u.lastSeenAt ? ago(u.lastSeenAt) : "never"}</td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                        <button
                          disabled={busyId === u.id}
                          onClick={() => patch(u.id, { plan: u.plan === "FREE" ? "PRO" : "FREE" })}
                          style={{ ...actionBtn, color: u.plan === "FREE" ? "#8b5cf6" : "#8a968f" }}
                          title={u.plan === "FREE" ? "Grant PRO" : "Revoke PRO"}
                        >
                          <Crown size={12} /> {u.plan === "FREE" ? "Grant PRO" : "Revoke"}
                        </button>
                        <button
                          disabled={busyId === u.id}
                          onClick={() => patch(u.id, { banned: !u.banned, resetSessions: !u.banned })}
                          style={{ ...actionBtn, color: u.banned ? "#10a35f" : "#ef4444" }}
                        >
                          <ShieldBan size={12} /> {u.banned ? "Unban" : "Ban"}
                        </button>
                        <button
                          disabled={busyId === u.id}
                          onClick={() => patch(u.id, { isAdmin: !u.isAdmin })}
                          style={{ ...actionBtn, color: u.isAdmin ? "#8a968f" : "#10a35f" }}
                          title={u.isAdmin ? "Remove admin" : "Make admin"}
                        >
                          <ShieldCheck size={12} /> {u.isAdmin ? "Demote" : "Make admin"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!users.length && !loading && <div style={{ padding: 24, color: "#8a968f", textAlign: "center" }}>No users found</div>}
            </div>
          </div>

          {/* side: recent + top */}
          <div style={{ display: "grid", gap: 14 }}>
            {stats?.topUsers?.length ? (
              <div style={card}>
                <div style={sectionTitle}><FolderKanban size={14} /> Most active builders</div>
                {stats.topUsers.map((u) => (
                  <div key={u.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #16201c", fontSize: 13 }}>
                    <span>{u.name}</span>
                    <span style={{ color: "#8a968f" }}>{u._count.projects} projects · {u._count.chats} chats</span>
                  </div>
                ))}
              </div>
            ) : null}
            {stats && (
              <div style={card}>
                <div style={sectionTitle}><Users size={14} /> Newest signups</div>
                {stats.recentUsers.map((u) => (
                  <div key={u.id} style={{ padding: "8px 0", borderBottom: "1px solid #16201c", fontSize: 13 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</span>
                      <span style={{ color: "#8a968f", whiteSpace: "nowrap" }}>{new Date(u.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div style={{ color: "#8a968f", fontSize: 12 }}>{u.email}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <style>{`button { cursor: pointer; font-family: inherit; }
               input { font-family: inherit; }
               @keyframes spin { to { transform: rotate(360deg); } }
               .spin { animation: spin 1s linear infinite; }`}</style>
    </div>
  );
}

const card = { background: "#141a18", border: "1px solid #1e2a25", borderRadius: 14, padding: 16 };
const sectionTitle = { display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#c5cbd6" } as const;
const btnGhost = { background: "transparent", border: "1px solid #22302b", color: "#c5cbd6", borderRadius: 8, padding: "6px 10px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 };
const actionBtn = { background: "transparent", border: "1px solid #22302b", borderRadius: 7, padding: "4px 8px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 4 };
const searchWrap = { flex: 1, display: "flex", alignItems: "center", gap: 8, background: "#0e1512", border: "1px solid #22302b", borderRadius: 8, padding: "6px 10px" };
const searchInput = { flex: 1, background: "transparent", border: "none", outline: "none", color: "#e7ece9", fontSize: 13 };
const pill = (color: string) => ({ display: "inline-flex", alignItems: "center", gap: 4, border: `1px solid ${color}55`, color, borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 });

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
