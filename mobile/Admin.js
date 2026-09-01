/**
 * BARADA CODE ADMIN — mobile admin console (Expo Go).
 * Real data, real actions — every request is role-checked server-side.
 * Tabs: Dashboard · Users · Charts · More
 */

import { ActivityIndicator, Alert, FlatList, Image, Modal, Pressable, RefreshControl, ScrollView, StatusBar, Text, TextInput, View } from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import LOGO from "./assets/barada-logo.png";

// ── palette (premium dark + emerald) ───────────────────────────────────────
const C = {
  bg: "#070b0a",
  surface: "#0e1512",
  surface2: "#121b17",
  border: "rgba(255,255,255,0.07)",
  text: "#e9efec",
  dim: "#8a968f",
  accent: "#10a35f",
  accentSoft: "rgba(16,163,95,0.14)",
  green: "#10b981",
  red: "#ef4444",
  amber: "#f59e0b",
  cyan: "#22d3ee",
};

const money = (n) => "$" + (n ?? 0).toLocaleString("en-US");
const num = (n) => (n ?? 0).toLocaleString("en-US");
const shortDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—");

function Card({ children, style }) {
  return <View style={[{ backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16 }, style]}>{children}</View>;
}

function Stat({ label, value, sub, color }) {
  return (
    <Card style={{ flex: 1, margin: 4 }}>
      <Text style={{ color: C.dim, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase" }}>{label}</Text>
      <Text style={{ color: color || C.text, fontSize: 26, fontWeight: "900", marginTop: 4 }}>{value}</Text>
      {sub ? <Text style={{ color: C.dim, fontSize: 11, marginTop: 2 }}>{sub}</Text> : null}
    </Card>
  );
}

function Dot({ ok, label }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 7 }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: ok ? C.green : C.red, shadowColor: ok ? C.green : C.red, shadowOpacity: 0.9, shadowRadius: 4 }} />
      <Text style={{ color: C.text, fontSize: 13, flex: 1 }}>{label}</Text>
      <Text style={{ color: ok ? C.green : C.red, fontSize: 11, fontWeight: "700" }}>{ok ? "Operational" : "Down"}</Text>
    </View>
  );
}

function MiniBars({ data, max, color }) {
  const W = 10;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: 90, marginTop: 10 }}>
      {data.map((d, i) => (
        <View
          key={i}
          style={{
            width: W, flex: 1, maxWidth: 18,
            height: Math.max(3, (d / (max || 1)) * 84),
            backgroundColor: color, borderRadius: 3, opacity: 0.55 + 0.45 * (d / (max || 1)),
          }}
        />
      ))}
    </View>
  );
}

// ── Dashboard tab ──────────────────────────────────────────────────────────
function Dashboard({ stats, health, series, refreshing, onRefresh }) {
  const last = (k) => (series?.series ?? []).map((d) => d[k]).slice(-14);
  const maxOf = (a) => Math.max(1, ...a);
  return (
    <ScrollView
      contentContainerStyle={{ padding: 12, paddingBottom: 110 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
    >
      <Text style={{ color: C.text, fontSize: 22, fontWeight: "900", marginTop: 4 }}>Control Center</Text>
      <Text style={{ color: C.dim, fontSize: 12, marginBottom: 12 }}>
        {num(stats?.onlineNow)} online now · {num(stats?.usersToday)} new today
      </Text>

      <View style={{ flexDirection: "row" }}>
        <Stat label="Users" value={num(stats?.users)} sub={`+${num(stats?.usersToday)} today`} color={C.green} />
        <Stat label="Projects" value={num(stats?.projects)} />
      </View>
      <View style={{ flexDirection: "row" }}>
        <Stat label="Messages" value={num(stats?.messages)} />
        <Stat label="AI Jobs" value={num(stats?.aiJobs)} sub={`${num(stats?.aiTokens)} tokens`} />
      </View>
      <View style={{ flexDirection: "row" }}>
        <Stat label="Pro Subs" value={num(stats?.proSubscribers)} color={C.green} />
        <Stat label="MRR" value={money(stats?.estimatedMrrUsd)} color={C.green} />
      </View>

      <Card style={{ marginTop: 8 }}>
        <Text style={{ color: C.dim, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase" }}>System Status</Text>
        <View style={{ marginTop: 6 }}>
          <Dot ok={health?.database?.ok} label="Database" />
          <Dot ok={health?.ai?.ok} label={`AI Provider${health?.ai?.latencyMs ? ` · ${health.ai.latencyMs}ms` : ""}`} />
        </View>
      </Card>

      <Card style={{ marginTop: 10 }}>
        <Text style={{ color: C.dim, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase" }}>New users — 14 days</Text>
        <MiniBars data={last("users")} max={maxOf(last("users"))} color={C.green} />
      </Card>
      <Card style={{ marginTop: 10 }}>
        <Text style={{ color: C.dim, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase" }}>AI jobs — 14 days</Text>
        <MiniBars data={last("ai")} max={maxOf(last("ai"))} color={C.cyan} />
      </Card>

      <Card style={{ marginTop: 10 }}>
        <Text style={{ color: C.dim, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase" }}>Latest users</Text>
        {(stats?.recentUsers ?? []).slice(0, 5).map((u) => (
          <View key={u.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border, gap: 10, marginTop: u.id === stats.recentUsers[0].id ? 6 : 0 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.accentSoft, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: C.green, fontSize: 12, fontWeight: "800" }}>{(u.name || u.email || "?").slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>{u.name || "—"}</Text>
              <Text style={{ color: C.dim, fontSize: 11 }} numberOfLines={1}>{u.email}</Text>
            </View>
            {u.banned ? <Text style={{ color: C.red, fontSize: 10, fontWeight: "800" }}>BANNED</Text> : null}
            <Text style={{ color: C.dim, fontSize: 11 }}>{shortDate(u.createdAt)}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

// ── Users tab ──────────────────────────────────────────────────────────────
const FILTERS = [
  ["all", "All"], ["pro", "PRO"], ["banned", "Banned"], ["admins", "Admins"],
];

function UsersTab({ refreshing, onRefresh }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async (query = q, f = filter) => {
    setLoading(true);
    setError(null);
    try {
      const d = await api.adminUsers(query, f, 1);
      setUsers(d.users ?? []);
      setTotal(d.total ?? 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [q, filter]);

  useEffect(() => {
    const t = setTimeout(() => load(q, filter), 350);
    return () => clearTimeout(t);
  }, [q, filter]);

  const act = (user, body, confirmText) => {
    Alert.alert("Confirm", confirmText, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm", style: "destructive",
        onPress: async () => {
          try {
            await api.adminPatchUser(user.id, body);
            setSelected(null);
            await load(q, filter);
          } catch (e) {
            Alert.alert("Failed", e.message);
          }
        },
      },
    ]);
  };

  const planOf = (u) => u.subscriptions?.[0]?.plan ?? "FREE";

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 12, paddingBottom: 4 }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search name or email…"
          placeholderTextColor={C.dim}
          style={{ backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 12, color: C.text, paddingHorizontal: 14, height: 44, fontSize: 15 }}
        />
        <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
          {FILTERS.map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setFilter(key)}
              style={{ flex: 1, minHeight: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: filter === key ? C.accent : C.surface, borderWidth: 1, borderColor: filter === key ? C.accent : C.border }}
            >
              <Text style={{ color: filter === key ? "#fff" : C.dim, fontSize: 12, fontWeight: "700" }}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ color: C.dim, fontSize: 11, marginTop: 8 }}>{num(total)} users</Text>
      </View>

      {error ? (
        <View style={{ padding: 20, alignItems: "center" }}>
          <Text style={{ color: C.red, marginBottom: 12 }}>{error}</Text>
          <Pressable onPress={() => load()} style={{ backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 20, minHeight: 40, justifyContent: "center" }}><Text style={{ color: "#fff", fontWeight: "700" }}>Retry</Text></Pressable>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
          ListEmptyComponent={!loading ? <Text style={{ color: C.dim, textAlign: "center", marginTop: 40 }}>No users found.</Text> : null}
          renderItem={({ item: u }) => (
            <Pressable onPress={() => setSelected(u)} style={{ backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.accentSoft, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: C.green, fontSize: 13, fontWeight: "800" }}>{(u.name || u.email || "?").slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: "700" }} numberOfLines={1}>{u.name || "—"}</Text>
                <Text style={{ color: C.dim, fontSize: 12 }} numberOfLines={1}>{u.email}</Text>
                <Text style={{ color: C.dim, fontSize: 11, marginTop: 2 }}>
                  {u._count?.projects ?? 0} projects · {u._count?.messages ?? 0} msgs · {shortDate(u.sessions?.[0]?.createdAt)}
                </Text>
              </View>
              <View style={{ gap: 4, alignItems: "flex-end" }}>
                <Text style={{ color: planOf(u) === "FREE" ? C.dim : C.green, fontSize: 10, fontWeight: "800", backgroundColor: planOf(u) === "FREE" ? "transparent" : C.accentSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>{planOf(u)}</Text>
                {u.banned ? <Text style={{ color: C.red, fontSize: 10, fontWeight: "800" }}>BANNED</Text> : null}
                {u.role !== "USER" ? <Text style={{ color: C.cyan, fontSize: 10, fontWeight: "800" }}>{u.role}</Text> : null}
              </View>
            </Pressable>
          )}
        />
      )}

      {/* user action sheet */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }} onPress={() => setSelected(null)}>
          <Pressable onPress={() => {}} style={{ backgroundColor: C.surface2, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, borderWidth: 1, borderColor: C.border }}>
            {selected ? (
              <>
                <Text style={{ color: C.text, fontSize: 17, fontWeight: "800" }}>{selected.name || "—"}</Text>
                <Text style={{ color: C.dim, fontSize: 13, marginBottom: 4 }}>{selected.email}</Text>
                <Text style={{ color: C.dim, fontSize: 12, marginBottom: 14 }}>
                  Plan {planOf(selected)} · Role {selected.role} · Created {shortDate(selected.createdAt)}
                </Text>
                {[
                  planOf(selected) === "FREE"
                    ? ["Grant PRO", () => act(selected, { plan: "PRO" }, `Grant PRO to ${selected.email}?`), C.green]
                    : ["Remove PRO", () => act(selected, { plan: "FREE" }, `Remove PRO from ${selected.email}?`), C.amber],
                  selected.banned
                    ? ["Unsuspend user", () => act(selected, { banned: false }, `Unsuspend ${selected.email}?`), C.green]
                    : ["Suspend user", () => act(selected, { banned: true }, `Suspend ${selected.email}? Their sessions will be revoked.`), C.red],
                  ["Revoke sessions", () => act(selected, { revokeSessions: true }, `Revoke all sessions of ${selected.email}?`), C.cyan],
                  ["Reset usage", () => act(selected, { resetUsage: true }, `Reset monthly AI usage for ${selected.email}?`), C.cyan],
                ].map(([label, onPress, color]) => (
                  <Pressable key={label} onPress={onPress} style={{ minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: color + "22", borderWidth: 1, borderColor: color + "55", marginBottom: 8 }}>
                    <Text style={{ color, fontWeight: "800", fontSize: 14 }}>{label}</Text>
                  </Pressable>
                ))}
                <Pressable onPress={() => setSelected(null)} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: C.dim, fontWeight: "700" }}>Close</Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── Charts tab ─────────────────────────────────────────────────────────────
function ChartsTab({ series, days, setDays, loading }) {
  const blocks = [
    ["users", "New users", C.green],
    ["messages", "Messages", C.cyan],
    ["ai", "AI jobs", C.amber],
    ["clicks", "Store clicks", "#a78bfa"],
  ];
  const n = series?.days ?? days;
  return (
    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 110 }}>
      <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
        {[7, 14, 30, 90].map((d) => (
          <Pressable key={d} onPress={() => setDays(d)} style={{ flex: 1, minHeight: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: days === d ? C.accent : C.surface, borderWidth: 1, borderColor: days === d ? C.accent : C.border }}>
            <Text style={{ color: days === d ? "#fff" : C.dim, fontWeight: "800", fontSize: 12 }}>{d}D</Text>
          </Pressable>
        ))}
      </View>
      {loading && !series ? (
        <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
      ) : (
        blocks.map(([key, label, color]) => {
          const arr = (series?.series ?? []).map((d) => d[key]);
          const sum = arr.reduce((a, b) => a + b, 0);
          return (
            <Card key={key} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: C.dim, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase" }}>{label} · {n}d</Text>
                <Text style={{ color, fontWeight: "900", fontSize: 14 }}>{num(sum)}</Text>
              </View>
              <MiniBars data={arr.slice(-Math.min(n, 30))} max={Math.max(1, ...arr)} color={color} />
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

// ── More tab ───────────────────────────────────────────────────────────────
function MoreTab({ stats, health, onLogout, clicks }) {
  const rows = [
    ["Chats", num(stats?.chats)],
    ["AI calls", num(stats?.aiCalls)],
    ["AI tokens", num(stats?.aiTokens)],
    ["Online now", num(stats?.onlineNow)],
    ["Store clicks", num(clicks)],
  ];
  return (
    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 110 }}>
      <Card>
        <Text style={{ color: C.dim, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>Platform numbers</Text>
        {rows.map(([k, v]) => (
          <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 9, borderTopWidth: 1, borderTopColor: C.border }}>
            <Text style={{ color: C.text, fontSize: 14 }}>{k}</Text>
            <Text style={{ color: C.green, fontWeight: "800", fontSize: 14 }}>{v}</Text>
          </View>
        ))}
      </Card>

      <Card style={{ marginTop: 10 }}>
        <Text style={{ color: C.dim, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>Health</Text>
        <Dot ok={health?.database?.ok} label="Database" />
        <Dot ok={health?.ai?.ok} label="AI Provider" />
      </Card>

      <Pressable onPress={onLogout} style={{ marginTop: 16, minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(239,68,68,0.12)", borderWidth: 1, borderColor: "rgba(239,68,68,0.4)" }}>
        <Text style={{ color: C.red, fontWeight: "800", fontSize: 15 }}>Sign out of Barada Code</Text>
      </Pressable>
    </ScrollView>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────
export default function AdminApp({ onExit, onLogout }) {
  const [tab, setTab] = useState("dash");
  const [checking, setChecking] = useState(true);
  const [denied, setDenied] = useState(false);
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [series, setSeries] = useState(null);
  const [days, setDays] = useState(14);
  const [clicks, setClicks] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);

  const load = useCallback(async (d = days) => {
    setErr(null);
    try {
      const [s, h, ser] = await Promise.all([
        api.adminStats().catch((e) => { if (e.status === 401 || e.status === 403) { setDenied(true); throw e; } throw e; }),
        api.adminHealth().catch(() => null),
        api.adminSeries(d).catch(() => null),
      ]);
      setStats(s);
      setHealth(h);
      setSeries(ser);
      setClicks((ser?.series ?? []).reduce((a, b) => a + (b.clicks || 0), 0));
      setDenied(false);
    } catch (e) {
      if (e.status !== 401 && e.status !== 403) setErr(e.message);
    }
  }, [days]);

  useEffect(() => {
    (async () => {
      try {
        await api.adminStats();
      } catch {
        setDenied(true);
      }
      setChecking(false);
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!checking && !denied) load(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (checking) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <StatusBar barStyle="light-content" />
        <Image source={LOGO} style={{ width: 84, height: 84, borderRadius: 20 }} resizeMode="contain" />
        <ActivityIndicator color={C.accent} style={{ marginTop: 16 }} />
        <Text style={{ color: C.dim, marginTop: 8, fontSize: 13 }}>Verifying admin access…</Text>
      </View>
    );
  }

  if (denied) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 32 }}>
        <StatusBar barStyle="light-content" />
        <Image source={LOGO} style={{ width: 72, height: 72, borderRadius: 16, opacity: 0.5 }} resizeMode="contain" />
        <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", marginTop: 16, textAlign: "center" }}>Access denied</Text>
        <Text style={{ color: C.dim, fontSize: 13, marginTop: 6, textAlign: "center" }}>
          This console is restricted to Barada administrators. Sign in with an admin account.
        </Text>
        <Pressable onPress={onExit} style={{ marginTop: 20, minHeight: 46, paddingHorizontal: 28, borderRadius: 12, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "800" }}>Back to app</Text>
        </Pressable>
      </View>
    );
  }

  const TABS = [
    ["dash", "Dashboard", "◆"],
    ["users", "Users", "◉"],
    ["charts", "Charts", "▁▃▅"],
    ["more", "More", "≡"],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" />
      {/* header */}
      <View style={{ paddingTop: 52, paddingHorizontal: 16, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bg }}>
        <Image source={LOGO} style={{ width: 34, height: 34, borderRadius: 8 }} resizeMode="contain" />
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontWeight: "900", fontSize: 16 }}>BARADA CODE <Text style={{ color: C.green }}>ADMIN</Text></Text>
          <Text style={{ color: C.dim, fontSize: 10, letterSpacing: 1 }}>ENTERPRISE CONTROL CENTER</Text>
        </View>
        <Pressable onPress={refresh} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: C.green, fontSize: 16 }}>⟳</Text>
        </Pressable>
        <Pressable onPress={onExit} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: C.dim, fontSize: 16 }}>✕</Text>
        </Pressable>
      </View>

      {err ? (
        <View style={{ backgroundColor: "rgba(239,68,68,0.12)", padding: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: C.red, fontSize: 12, flex: 1 }}>{err}</Text>
          <Pressable onPress={() => load()}><Text style={{ color: C.red, fontWeight: "800", fontSize: 12 }}>Retry</Text></Pressable>
        </View>
      ) : null}

      <View style={{ flex: 1 }}>
        {tab === "dash" && <Dashboard stats={stats} health={health} series={series} refreshing={refreshing} onRefresh={refresh} />}
        {tab === "users" && <UsersTab refreshing={refreshing} onRefresh={refresh} />}
        {tab === "charts" && <ChartsTab series={series} days={days} setDays={setDays} loading={!series} />}
        {tab === "more" && <MoreTab stats={stats} health={health} clicks={clicks} onLogout={onLogout} />}
      </View>

      {/* bottom tabs */}
      <View style={{ flexDirection: "row", paddingBottom: 24, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface2 }}>
        {TABS.map(([key, label, icon]) => (
          <Pressable key={key} onPress={() => setTab(key)} style={{ flex: 1, alignItems: "center", minHeight: 48, justifyContent: "center" }}>
            <Text style={{ fontSize: 15, color: tab === key ? C.green : C.dim }}>{icon}</Text>
            <Text style={{ fontSize: 10, marginTop: 2, color: tab === key ? C.green : C.dim, fontWeight: tab === key ? "800" : "500" }}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
