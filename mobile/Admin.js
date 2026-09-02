/**
 * BARADA CODE — ADMIN CONSOLE (Expo Go).
 *
 * This is a pure admin application: Login → server-verified Control Center.
 * Every screen is powered by the real backend (/api/admin/*) — no mock data.
 * Enforcement is server-side; this UI only hides what the caller lacks.
 */

import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, StatusBar, Text, TextInput, View } from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import LOGO from "./assets/barada-logo.png";

// ── palette — premium dark + emerald ───────────────────────────────────────
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
  violet: "#a78bfa",
};

const money = (n) => "$" + (n ?? 0).toLocaleString("en-US");
const num = (n) => (n ?? 0).toLocaleString("en-US");
const shortDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—");
const timeAgo = (d) => {
  if (!d) return "—";
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

function Card({ children, style }) {
  return <View style={[{ backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16 }, style]}>{children}</View>;
}

function SectionLabel({ children }) {
  return <Text style={{ color: C.dim, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 }}>{children}</Text>;
}

function Stat({ label, value, sub, color }) {
  return (
    <Card style={{ flex: 1, margin: 4 }}>
      <Text style={{ color: C.dim, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase" }} numberOfLines={1}>{label}</Text>
      <Text style={{ color: color || C.text, fontSize: 25, fontWeight: "900", marginTop: 4 }}>{value}</Text>
      {sub ? <Text style={{ color: C.dim, fontSize: 11, marginTop: 2 }}>{sub}</Text> : null}
    </Card>
  );
}

function Dot({ ok, label, note }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7 }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: ok ? C.green : C.red, shadowColor: ok ? C.green : C.red, shadowOpacity: 0.9, shadowRadius: 4 }} />
      <Text style={{ color: C.text, fontSize: 13, flexShrink: 1 }}>{label}</Text>
      <Text style={{ color: C.dim, fontSize: 11, marginLeft: "auto" }}>{note ?? (ok ? "Operational" : "Down")}</Text>
    </View>
  );
}

function MiniBars({ data, color }) {
  const max = Math.max(1, ...data);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: 80, marginTop: 10 }}>
      {data.map((d, i) => (
        <View key={i} style={{ flex: 1, maxWidth: 18, height: Math.max(3, (d / max) * 74), backgroundColor: color, borderRadius: 3, opacity: 0.5 + 0.5 * (d / max) }} />
      ))}
    </View>
  );
}

function Pill({ label, active, onPress, color }) {
  const c = active ? (color || C.accent) : "transparent";
  return (
    <Pressable onPress={onPress} style={{ minHeight: 36, paddingHorizontal: 14, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: active ? c : C.surface, borderWidth: 1, borderColor: active ? c : C.border }}>
      <Text style={{ color: active ? "#fff" : C.dim, fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

function Avatar({ name, email, size = 38 }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.accentSoft, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: C.green, fontSize: size * 0.34, fontWeight: "800" }}>{(name || email || "?").slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

function ErrorBox({ msg, onRetry }) {
  return (
    <View style={{ padding: 24, alignItems: "center" }}>
      <Text style={{ color: C.red, textAlign: "center", marginBottom: 12 }}>{msg}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={{ backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 22, minHeight: 42, justifyContent: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ── LOGIN ──────────────────────────────────────────────────────────────────
function LoginScreen({ note, onSignedIn }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(note || null);

  const submit = async () => {
    if (!email.trim() || !pw || busy) return;
    setBusy(true); setErr(null);
    try {
      const d = await api.signin(email.trim(), pw);
      const role = d?.user?.role;
      if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
        await api.signout().catch(() => {});
        setErr("This account is not an administrator.");
        return;
      }
      onSignedIn(d.user);
    } catch (e) {
      setErr(e.message || "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 28 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", marginBottom: 30 }}>
          <Image source={LOGO} style={{ width: 96, height: 96, borderRadius: 24, marginBottom: 16 }} resizeMode="contain" />
          <Text style={{ color: C.text, fontSize: 23, fontWeight: "900", textAlign: "center" }}>Welcome to Admin Dashboard</Text>
          <Text style={{ color: C.dim, fontSize: 13, marginTop: 8, textAlign: "center" }}>Sign in with your administrator account to continue.</Text>
        </View>

        <SectionLabel>Admin Email</SectionLabel>
        <TextInput
          value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address"
          placeholder="admin@iuw7a.com" placeholderTextColor={C.dim}
          style={{ backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 14, color: C.text, paddingHorizontal: 16, minHeight: 50, fontSize: 16, marginBottom: 14 }}
        />
        <SectionLabel>Password</SectionLabel>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 14, marginBottom: 6 }}>
          <TextInput
            value={pw} onChangeText={setPw} secureTextEntry={!show} autoComplete="password"
            placeholder="••••••••" placeholderTextColor={C.dim}
            style={{ flex: 1, color: C.text, paddingHorizontal: 16, minHeight: 50, fontSize: 16 }}
          />
          <Pressable onPress={() => setShow(!show)} style={{ paddingHorizontal: 16, minHeight: 50, justifyContent: "center" }}>
            <Text style={{ color: C.green, fontWeight: "700", fontSize: 13 }}>{show ? "Hide" : "Show"}</Text>
          </Pressable>
        </View>

        {err ? (
          <View style={{ backgroundColor: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.4)", borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 10 }}>
            <Text style={{ color: C.red, fontSize: 13 }}>{err}</Text>
          </View>
        ) : null}

        <Pressable onPress={submit} disabled={busy} style={{ marginTop: 18, minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: busy ? C.accentSoft : C.accent }}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16, letterSpacing: 0.3 }}>Sign In</Text>}
        </Pressable>

        <Text style={{ color: C.dim, fontSize: 11, textAlign: "center", marginTop: 22 }}>
          Access is verified server-side. Only ADMIN and SUPER_ADMIN roles can enter.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── HOME / DASHBOARD ───────────────────────────────────────────────────────
function HomeTab({ stats, health, series, loading, refreshing, onRefresh }) {
  const last = (k, n = 14) => (series?.series ?? []).map((d) => d[k]).slice(-n);
  return (
    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 110 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}>
      <Text style={{ color: C.text, fontSize: 22, fontWeight: "900", marginTop: 4 }}>Control Center</Text>
      <Text style={{ color: C.dim, fontSize: 12, marginBottom: 12 }}>
        {num(stats?.onlineNow)} online now · {num(stats?.usersToday)} new users today
      </Text>

      <SectionLabel>Users</SectionLabel>
      <View style={{ flexDirection: "row" }}>
        <Stat label="Total" value={num(stats?.users)} sub={`+${num(stats?.usersToday)} today`} color={C.green} />
        <Stat label="Online now" value={num(stats?.onlineNow)} />
      </View>
      <View style={{ flexDirection: "row" }}>
        <Stat label="Suspended" value={num(stats?.suspended)} color={stats?.suspended ? C.red : C.text} />
        <Stat label="Admins" value={num(stats?.admins)} color={C.cyan} />
      </View>

      <SectionLabel>Projects & Messages</SectionLabel>
      <View style={{ flexDirection: "row" }}>
        <Stat label="Projects" value={num(stats?.projects)} sub={`+${num(stats?.projectsToday)} today`} />
        <Stat label="Messages" value={num(stats?.messages)} sub={`+${num(stats?.messagesToday)} today`} />
      </View>
      <View style={{ flexDirection: "row" }}>
        <Stat label="Conversations" value={num(stats?.chats)} />
        <Stat label="PRO subs" value={num(stats?.proSubscribers)} sub={`MRR ${money(stats?.estimatedMrrUsd)}`} color={C.green} />
      </View>

      <SectionLabel>AI</SectionLabel>
      <View style={{ flexDirection: "row" }}>
        <Stat label="AI jobs" value={num(stats?.aiJobs)} sub={`${num(stats?.aiJobsRunning)} running`} />
        <Stat label="Failed jobs" value={num(stats?.aiJobsFailed)} color={stats?.aiJobsFailed ? C.amber : C.text} />
      </View>
      <View style={{ flexDirection: "row" }}>
        <Stat label="AI calls" value={num(stats?.aiCalls)} />
        <Stat label="Tokens" value={num(stats?.aiTokens)} color={C.cyan} />
      </View>

      <Card style={{ marginTop: 10 }}>
        <SectionLabel>System status</SectionLabel>
        <Dot ok={health?.database?.ok} label="Database" />
        <Dot ok={health?.ai?.ok} label="AI Provider" note={health?.ai?.latencyMs ? `${health.ai.latencyMs}ms` : undefined} />
        <Dot ok={health?.database?.ok} label="Backend API" note="Vercel" />
      </Card>

      <Card style={{ marginTop: 10 }}>
        <SectionLabel>New users — 14 days</SectionLabel>
        <MiniBars data={last("users")} color={C.green} />
      </Card>
      <Card style={{ marginTop: 10 }}>
        <SectionLabel>Messages — 14 days</SectionLabel>
        <MiniBars data={last("messages")} color={C.cyan} />
      </Card>
      <Card style={{ marginTop: 10 }}>
        <SectionLabel>AI jobs — 14 days</SectionLabel>
        <MiniBars data={last("ai")} color={C.amber} />
      </Card>

      <Card style={{ marginTop: 10 }}>
        <SectionLabel>Latest users</SectionLabel>
        {(stats?.recentUsers ?? []).slice(0, 6).map((u, i) => (
          <View key={u.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: C.border }}>
            <Avatar name={u.name} email={u.email} size={32} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: C.text, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>{u.name || "—"}</Text>
              <Text style={{ color: C.dim, fontSize: 11 }} numberOfLines={1}>{u.email}</Text>
            </View>
            {u.role !== "USER" ? <Text style={{ color: C.cyan, fontSize: 10, fontWeight: "800" }}>{u.role}</Text> : null}
            {u.banned ? <Text style={{ color: C.red, fontSize: 10, fontWeight: "800" }}>BANNED</Text> : null}
            <Text style={{ color: C.dim, fontSize: 11 }}>{shortDate(u.createdAt)}</Text>
          </View>
        ))}
      </Card>
      {loading && !stats ? <ActivityIndicator color={C.accent} style={{ marginTop: 20 }} /> : null}
    </ScrollView>
  );
}

// ── USERS ──────────────────────────────────────────────────────────────────
const FILTERS = [["all", "All"], ["pro", "PRO"], ["banned", "Banned"], ["admins", "Admins"]];
const planOf = (u) => u?.subscriptions?.[0]?.plan ?? "FREE";

function UsersTab({ isSuper, refreshing, onRefresh }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [roles, setRoles] = useState([]);
  const [rolePick, setRolePick] = useState(false);

  const load = useCallback(async (query = q, f = filter) => {
    setLoading(true); setError(null);
    try {
      const d = await api.adminUsers(query, f, 1);
      setUsers(d.users ?? []); setTotal(d.total ?? 0);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [q, filter]);

  useEffect(() => { const t = setTimeout(() => load(q, filter), 350); return () => clearTimeout(t); }, [q, filter]);

  const act = (user, body, confirmText, destructive) => {
    Alert.alert("Confirm", confirmText, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", style: destructive ? "destructive" : "default", onPress: async () => {
        try { await api.adminPatchUser(user.id, body); setSelected(null); await load(q, filter); }
        catch (e) { Alert.alert("Failed", e.message); }
      } },
    ]);
  };

  const openSheet = async (u) => {
    setSelected(u);
    if (isSuper && roles.length === 0) {
      try { const d = await api.adminRoles(); setRoles(d.roles ?? []); } catch {}
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 12, paddingBottom: 4 }}>
        <TextInput value={q} onChangeText={setQ} placeholder="Search name or email…" placeholderTextColor={C.dim}
          style={{ backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 12, color: C.text, paddingHorizontal: 14, minHeight: 44, fontSize: 15 }} />
        <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
          {FILTERS.map(([key, label]) => (
            <View key={key} style={{ flex: 1 }}><Pill label={label} active={filter === key} onPress={() => setFilter(key)} /></View>
          ))}
        </View>
        <Text style={{ color: C.dim, fontSize: 11, marginTop: 8 }}>{num(total)} users</Text>
      </View>

      {error ? <ErrorBox msg={error} onRetry={() => load()} /> : (
        <FlatList
          data={users} keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
          ListEmptyComponent={!loading ? <Text style={{ color: C.dim, textAlign: "center", marginTop: 40 }}>No users found.</Text> : null}
          renderItem={({ item: u }) => (
            <Pressable onPress={() => openSheet(u)} style={{ backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Avatar name={u.name} email={u.email} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: "700" }} numberOfLines={1}>{u.name || "—"}</Text>
                <Text style={{ color: C.dim, fontSize: 12 }} numberOfLines={1}>{u.email}</Text>
                <Text style={{ color: C.dim, fontSize: 11, marginTop: 2 }}>
                  {u._count?.projects ?? 0} projects · {u._count?.messages ?? 0} msgs · last {timeAgo(u.sessions?.[0]?.createdAt)}
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
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <Avatar name={selected.name} email={selected.email} size={46} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: C.text, fontSize: 17, fontWeight: "800" }} numberOfLines={1}>{selected.name || "—"}</Text>
                    <Text style={{ color: C.dim, fontSize: 13 }} numberOfLines={1}>{selected.email}</Text>
                  </View>
                </View>
                <Text style={{ color: C.dim, fontSize: 12, marginBottom: 14 }}>
                  Plan {planOf(selected)} · Role {selected.customRole || selected.role} · Created {shortDate(selected.createdAt)}
                </Text>
                {[
                  planOf(selected) === "FREE"
                    ? ["Grant PRO", () => act(selected, { plan: "PRO" }, `Grant PRO to ${selected.email}?`), C.green, false]
                    : ["Remove PRO", () => act(selected, { plan: "FREE" }, `Remove PRO from ${selected.email}?`), C.amber, false],
                  selected.banned
                    ? ["Unsuspend user", () => act(selected, { banned: false }, `Unsuspend ${selected.email}?`), C.green, false]
                    : ["Suspend user", () => act(selected, { banned: true }, `Suspend ${selected.email}? Their sessions will be revoked.`), C.red, true],
                  ["Revoke sessions (force logout)", () => act(selected, { revokeSessions: true }, `Revoke all sessions of ${selected.email}?`), C.cyan, false],
                  ["Reset monthly AI usage", () => act(selected, { resetUsage: true }, `Reset monthly AI usage for ${selected.email}?`), C.cyan, false],
                  ...(isSuper ? [["Change role", () => setRolePick(true), C.violet, false]] : []),
                ].map(([label, onPress, color]) => (
                  <Pressable key={label} onPress={onPress} style={{ minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: color + "22", borderWidth: 1, borderColor: color + "55", marginBottom: 8 }}>
                    <Text style={{ color, fontWeight: "800", fontSize: 14 }}>{label}</Text>
                  </Pressable>
                ))}
                {isSuper ? (
                  <Pressable onPress={() => {
                    Alert.alert("Delete account", `Permanently delete ${selected.email}? This cannot be undone.`, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete forever", style: "destructive", onPress: async () => {
                        try {
                          await api.adminDeleteUser(selected.id);
                          setSelected(null); await load(q, filter);
                        } catch (e) { Alert.alert("Failed", e.message); }
                      } },
                    ]);
                  }} style={{ minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(239,68,68,0.12)", borderWidth: 1, borderColor: "rgba(239,68,68,0.5)", marginBottom: 8 }}>
                    <Text style={{ color: C.red, fontWeight: "800", fontSize: 14 }}>Delete account permanently</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => setSelected(null)} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: C.dim, fontWeight: "700" }}>Close</Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* role picker (SUPER_ADMIN) */}
      <Modal visible={rolePick} transparent animationType="slide" onRequestClose={() => setRolePick(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }} onPress={() => setRolePick(false)}>
          <Pressable onPress={() => {}} style={{ backgroundColor: C.surface2, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, borderWidth: 1, borderColor: C.border, maxHeight: "80%" }}>
            <Text style={{ color: C.text, fontSize: 17, fontWeight: "800", marginBottom: 12 }}>Change role</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {[["USER", "Regular user"], ["ADMIN", "Administrator (built-in)"], ["SUPER_ADMIN", "Super Admin (full control)"]].map(([r, desc]) => (
                <Pressable key={r} onPress={() => { setRolePick(false); act(selected, { role: r }, `Set ${selected.email} role to ${r}?`); }}
                  style={{ minHeight: 54, borderRadius: 12, borderWidth: 1, borderColor: selected?.role === r ? C.accent : C.border, backgroundColor: C.surface, justifyContent: "center", paddingHorizontal: 14, marginBottom: 8 }}>
                  <Text style={{ color: selected?.role === r ? C.green : C.text, fontWeight: "800", fontSize: 14 }}>{r}</Text>
                  <Text style={{ color: C.dim, fontSize: 11 }}>{desc}</Text>
                </Pressable>
              ))}
              {roles.filter((r) => !r.isSystem).map((r) => (
                <Pressable key={r.id} onPress={() => { setRolePick(false); act(selected, { roleId: r.id }, `Assign custom role "${r.name}" to ${selected.email}?`); }}
                  style={{ minHeight: 54, borderRadius: 12, borderWidth: 1, borderColor: selected?.customRole === r.name ? C.accent : C.border, backgroundColor: C.surface, justifyContent: "center", paddingHorizontal: 14, marginBottom: 8 }}>
                  <Text style={{ color: selected?.customRole === r.name ? C.green : C.text, fontWeight: "800", fontSize: 14 }}>★ {r.name}</Text>
                  <Text style={{ color: C.dim, fontSize: 11 }} numberOfLines={1}>{r.description || `${(r.permissions ?? []).length} permissions`}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => setRolePick(false)} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: C.dim, fontWeight: "700" }}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── ANALYTICS ──────────────────────────────────────────────────────────────
function AnalyticsTab({ series, days, setDays }) {
  const blocks = [["users", "New users", C.green], ["messages", "Messages", C.cyan], ["ai", "AI jobs", C.amber], ["clicks", "Store clicks", C.violet]];
  return (
    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 110 }}>
      <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
        {[7, 14, 30, 90].map((d) => (
          <View key={d} style={{ flex: 1 }}><Pill label={`${d}D`} active={days === d} onPress={() => setDays(d)} /></View>
        ))}
      </View>
      {!series ? <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} /> : blocks.map(([key, label, color]) => {
        const arr = (series.series ?? []).map((d) => d[key]);
        return (
          <Card key={key} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: C.dim, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase" }}>{label} · {days}d</Text>
              <Text style={{ color, fontWeight: "900", fontSize: 14 }}>{num(arr.reduce((a, b) => a + b, 0))}</Text>
            </View>
            <MiniBars data={arr.slice(-Math.min(days, 30))} color={color} />
          </Card>
        );
      })}
    </ScrollView>
  );
}

// ── SECURITY / AUDIT LOG ───────────────────────────────────────────────────
function actionColor(a) {
  if (a.includes("deleted") || a.includes("suspended")) return C.red;
  if (a.includes("created") || a.includes("granted")) return C.green;
  if (a.includes("role") || a.includes("updated")) return C.violet;
  return C.cyan;
}
function AuditTab() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (p = 1) => {
    p === 1 ? setLoading(true) : setMore(true);
    setError(null);
    try {
      const d = await api.adminAudit(p);
      setLogs((prev) => (p === 1 ? d.logs : [...prev, ...d.logs]));
      setPages(d.pages); setTotal(d.total); setPage(p);
    } catch (e) { setError(e.message); } finally { setLoading(false); setMore(false); }
  }, []);

  useEffect(() => { load(1); }, [load]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 12, paddingBottom: 4 }}>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: "900" }}>Security & Audit Log</Text>
        <Text style={{ color: C.dim, fontSize: 12, marginTop: 2 }}>{num(total)} recorded admin actions</Text>
      </View>
      {error ? <ErrorBox msg={error} onRetry={() => load(1)} /> : (
        <FlatList
          data={logs} keyExtractor={(l) => l.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={loading && page === 1} onRefresh={() => load(1)} tintColor={C.accent} />}
          onEndReached={() => { if (page < pages && !more) load(page + 1); }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={!loading ? <Text style={{ color: C.dim, textAlign: "center", marginTop: 40 }}>No audit entries yet.</Text> : null}
          ListFooterComponent={more ? <ActivityIndicator color={C.accent} style={{ marginVertical: 14 }} /> : null}
          renderItem={({ item: l }) => (
            <View style={{ backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 8, flexDirection: "row", gap: 10 }}>
              <View style={{ width: 8, alignSelf: "stretch", borderRadius: 4, backgroundColor: actionColor(l.action) }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: C.text, fontSize: 13, fontWeight: "800" }}>{l.action}</Text>
                {l.target ? <Text style={{ color: C.dim, fontSize: 12 }} numberOfLines={1}>→ {l.target}</Text> : null}
                <Text style={{ color: C.dim, fontSize: 11, marginTop: 2 }}>
                  {l.admin?.name || l.admin?.email || "system"} · {timeAgo(l.createdAt)}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

// ── PROJECTS ───────────────────────────────────────────────────────────────
function ProjectsSection() {
  const [q, setQ] = useState("");
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (query = q) => {
    setLoading(true); setError(null);
    try { const d = await api.adminProjects(query, 1); setProjects(d.projects ?? []); }
    catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [q]);
  useEffect(() => { const t = setTimeout(() => load(q), 350); return () => clearTimeout(t); }, [q]);

  return (
    <View>
      <TextInput value={q} onChangeText={setQ} placeholder="Search projects or owners…" placeholderTextColor={C.dim}
        style={{ backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 12, color: C.text, paddingHorizontal: 14, minHeight: 44, fontSize: 15, marginBottom: 10 }} />
      {error ? <Text style={{ color: C.red, fontSize: 13 }}>{error}</Text> : loading ? <ActivityIndicator color={C.accent} style={{ marginVertical: 16 }} /> : projects.length === 0 ? (
        <Text style={{ color: C.dim, fontSize: 13 }}>No projects found.</Text>
      ) : projects.map((p) => (
        <View key={p.id} style={{ backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: C.text, fontSize: 14, fontWeight: "800", flex: 1 }} numberOfLines={1}>{p.name}</Text>
            <Text style={{ color: p.status === "ACTIVE" ? C.green : C.dim, fontSize: 10, fontWeight: "800" }}>{p.status}</Text>
          </View>
          <Text style={{ color: C.dim, fontSize: 12, marginTop: 3 }} numberOfLines={1}>owner: {p.owner?.name || p.owner?.email || "—"}</Text>
          <Text style={{ color: C.dim, fontSize: 11, marginTop: 2 }}>
            {p._count?.files ?? 0} files · {p._count?.chats ?? 0} chats · {p._count?.aiJobs ?? 0} AI jobs · updated {timeAgo(p.updatedAt)}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── ROLES & PERMISSIONS (SUPER_ADMIN) ──────────────────────────────────────
const PERM_LABELS = {
  "users.view": "View Users", "users.suspend": "Suspend Users", "users.pro": "Grant / Remove PRO",
  "users.sessions": "Revoke Sessions", "users.resetUsage": "Reset Usage",
  "projects.view": "View Projects", "projects.delete": "Delete Projects",
  "ai.view": "View AI", "ai.manage": "Manage AI",
  "messages.view": "View Messages", "api.view": "View API Usage",
  "analytics.view": "View Analytics", "system.view": "View System Status",
  "security.view": "Security Center", "security.logs": "Security Logs",
  "settings.manage": "Manage Settings", "roles.view": "View Roles", "audit.view": "View Audit Log",
  "*": "Full control (wildcard)",
};

function RolesSection({ onRolesChanged }) {
  const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const d = await api.adminRoles(); setRoles(d.roles ?? []); setCatalog(d.catalog ?? {}); }
    catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = (p) => setPicked((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await api.adminCreateRole(name.trim(), desc.trim(), picked);
      setCreating(false); setName(""); setDesc(""); setPicked([]);
      await load(); onRolesChanged?.();
    } catch (e) { Alert.alert("Failed", e.message); } finally { setBusy(false); }
  };

  const removeRole = (r) => {
    Alert.alert("Delete role", `Delete custom role "${r.name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try { await api.adminDeleteRole(r.id); await load(); onRolesChanged?.(); }
        catch (e) { Alert.alert("Failed", e.message); }
      } },
    ]);
  };

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
        <Text style={{ color: C.text, fontSize: 16, fontWeight: "900", flex: 1 }}>Roles & Permissions</Text>
        <Pressable onPress={() => setCreating(true)} style={{ minHeight: 38, paddingHorizontal: 14, borderRadius: 10, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>+ New Role</Text>
        </Pressable>
      </View>

      {error ? <Text style={{ color: C.red, fontSize: 13 }}>{error}</Text> : loading ? <ActivityIndicator color={C.accent} /> : roles.map((r) => {
        const perms = r.permissions ?? [];
        return (
          <Card key={r.id} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: C.text, fontSize: 15, fontWeight: "800", flex: 1 }}>{r.isSystem ? "★ " : ""}{r.name}</Text>
              <Text style={{ color: C.dim, fontSize: 11 }}>{r._count?.users ?? 0} users</Text>
              {!r.isSystem ? (
                <Pressable onPress={() => removeRole(r)} style={{ width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(239,68,68,0.12)", borderWidth: 1, borderColor: "rgba(239,68,68,0.4)" }}>
                  <Text style={{ color: C.red, fontWeight: "900" }}>✕</Text>
                </Pressable>
              ) : null}
            </View>
            {r.description ? <Text style={{ color: C.dim, fontSize: 12, marginTop: 2 }}>{r.description}</Text> : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {perms.map((p) => (
                <View key={p} style={{ backgroundColor: C.accentSoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ color: C.green, fontSize: 10, fontWeight: "700" }}>{PERM_LABELS[p] || p}</Text>
                </View>
              ))}
            </View>
          </Card>
        );
      })}

      <Modal visible={creating} transparent animationType="slide" onRequestClose={() => setCreating(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }}>
          <Pressable style={{ flex: 1 }} onPress={() => setCreating(false)} />
          <View style={{ backgroundColor: C.surface2, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, borderWidth: 1, borderColor: C.border, maxHeight: "88%" }}>
            <Text style={{ color: C.text, fontSize: 17, fontWeight: "800", marginBottom: 12 }}>Create custom role</Text>
            <SectionLabel>Name</SectionLabel>
            <TextInput value={name} onChangeText={setName} placeholder="e.g. Developer" placeholderTextColor={C.dim}
              style={{ backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 12, color: C.text, paddingHorizontal: 14, minHeight: 46, fontSize: 15, marginBottom: 10 }} />
            <SectionLabel>Description</SectionLabel>
            <TextInput value={desc} onChangeText={setDesc} placeholder="What can this role do?" placeholderTextColor={C.dim}
              style={{ backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 12, color: C.text, paddingHorizontal: 14, minHeight: 46, fontSize: 15, marginBottom: 12 }} />
            <SectionLabel>Permissions ({picked.length} selected)</SectionLabel>
            <ScrollView style={{ maxHeight: 320 }}>
              {Object.entries(catalog).map(([group, perms]) => (
                <View key={group} style={{ marginBottom: 10 }}>
                  <Text style={{ color: C.cyan, fontSize: 12, fontWeight: "800", marginBottom: 6 }}>{group}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {perms.map((p) => (
                      <Pressable key={p} onPress={() => toggle(p)}
                        style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: picked.includes(p) ? C.accent : C.surface, borderWidth: 1, borderColor: picked.includes(p) ? C.accent : C.border }}>
                        <Text style={{ color: picked.includes(p) ? "#fff" : C.dim, fontSize: 12, fontWeight: "700" }}>{picked.includes(p) ? "✓ " : ""}{PERM_LABELS[p] || p}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
            <Pressable onPress={create} disabled={busy} style={{ marginTop: 12, minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: busy ? C.accentSoft : C.accent }}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900" }}>Create Role</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── MORE ───────────────────────────────────────────────────────────────────
function MoreTab({ me, health, stats, onSignOut, isSuper }) {
  const rows = [
    ["Conversations", num(stats?.chats)],
    ["AI calls", num(stats?.aiCalls)],
    ["AI tokens", num(stats?.aiTokens)],
    ["Online now", num(stats?.onlineNow)],
    ["Store clicks", num(stats?.storeClicks)],
  ];
  return (
    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 110 }}>
      {/* profile */}
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Avatar name={me?.name} email={me?.email} size={52} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: "900" }} numberOfLines={1}>{me?.name || "Admin"}</Text>
          <Text style={{ color: C.dim, fontSize: 12 }} numberOfLines={1}>{me?.email}</Text>
          <Text style={{ color: me?.role === "SUPER_ADMIN" ? C.violet : C.cyan, fontSize: 11, fontWeight: "800", marginTop: 2 }}>{me?.role}</Text>
        </View>
      </Card>

      <Card style={{ marginTop: 10 }}>
        <SectionLabel>System health</SectionLabel>
        <Dot ok={health?.database?.ok} label="Database" />
        <Dot ok={health?.ai?.ok} label="AI Provider" note={health?.ai?.latencyMs ? `${health.ai.latencyMs}ms` : undefined} />
      </Card>

      <Card style={{ marginTop: 10 }}>
        <SectionLabel>Platform numbers</SectionLabel>
        {rows.map(([k, v], i) => (
          <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: C.border }}>
            <Text style={{ color: C.text, fontSize: 14 }}>{k}</Text>
            <Text style={{ color: C.green, fontWeight: "800", fontSize: 14 }}>{v}</Text>
          </View>
        ))}
      </Card>

      <Card style={{ marginTop: 10 }}>
        <SectionLabel>Projects</SectionLabel>
        <ProjectsSection />
      </Card>

      {isSuper ? (
        <Card style={{ marginTop: 10 }}>
          <RolesSection />
        </Card>
      ) : null}

      <Pressable onPress={onSignOut} style={{ marginTop: 16, minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(239,68,68,0.12)", borderWidth: 1, borderColor: "rgba(239,68,68,0.4)" }}>
        <Text style={{ color: C.red, fontWeight: "800", fontSize: 15 }}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

// ── ROOT ───────────────────────────────────────────────────────────────────
const TABS = [
  ["home", "Home", "◆"],
  ["users", "Users", "◉"],
  ["analytics", "Charts", "▁▃▅"],
  ["security", "Security", "⛨"],
  ["more", "More", "≡"],
];

export default function AdminApp() {
  const [booting, setBooting] = useState(true);
  const [me, setMe] = useState(null); // { id, email, name, role }
  const [tab, setTab] = useState("home");
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [series, setSeries] = useState(null);
  const [days, setDays] = useState(14);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);

  const isSuper = me?.role === "SUPER_ADMIN";

  const load = useCallback(async (d = days) => {
    setErr(null);
    try {
      const [s, h, ser] = await Promise.all([
        api.adminStats(),
        api.adminHealth().catch(() => null),
        api.adminSeries(d).catch(() => null),
      ]);
      setStats({ ...s, storeClicks: (ser?.series ?? []).reduce((a, b) => a + (b.clicks || 0), 0) });
      setHealth(h); setSeries(ser);
    } catch (e) {
      if (e.status === 401) { setMe(null); } else { setErr(e.message); }
    }
  }, [days]);

  // boot: reuse an existing admin session if there is one
  useEffect(() => {
    (async () => {
      try {
        const d = await api.me();
        if (d?.user && (d.user.role === "ADMIN" || d.user.role === "SUPER_ADMIN")) setMe(d.user);
      } catch {}
      setBooting(false);
    })();
  }, []);

  useEffect(() => { if (me) load(days); }, [me, days]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const signOut = async () => {
    await api.signout().catch(() => {});
    setMe(null); setStats(null); setSeries(null); setTab("home");
  };

  if (booting) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <Image source={LOGO} style={{ width: 84, height: 84, borderRadius: 20 }} resizeMode="contain" />
        <ActivityIndicator color={C.accent} style={{ marginTop: 16 }} />
        <Text style={{ color: C.dim, marginTop: 8, fontSize: 13 }}>Checking admin session…</Text>
      </View>
    );
  }

  if (!me) return <LoginScreen onSignedIn={(u) => setMe(u)} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* header */}
      <View style={{ paddingTop: 14, paddingHorizontal: 16, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <Image source={LOGO} style={{ width: 34, height: 34, borderRadius: 8 }} resizeMode="contain" />
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontWeight: "900", fontSize: 16 }}>BARADA CODE <Text style={{ color: C.green }}>ADMIN</Text></Text>
          <Text style={{ color: C.dim, fontSize: 10, letterSpacing: 1 }}>ENTERPRISE CONTROL CENTER</Text>
        </View>
        <Pressable onPress={refresh} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: C.green, fontSize: 16 }}>⟳</Text>
        </Pressable>
      </View>

      {err ? <ErrorBox msg={err} onRetry={() => load()} /> : null}

      <View style={{ flex: 1 }}>
        {tab === "home" && <HomeTab stats={stats} health={health} series={series} loading={!stats} refreshing={refreshing} onRefresh={refresh} />}
        {tab === "users" && <UsersTab isSuper={isSuper} refreshing={refreshing} onRefresh={refresh} />}
        {tab === "analytics" && <AnalyticsTab series={series} days={days} setDays={setDays} />}
        {tab === "security" && <AuditTab />}
        {tab === "more" && <MoreTab me={me} health={health} stats={stats} onSignOut={signOut} isSuper={isSuper} />}
      </View>

      {/* bottom nav */}
      <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg, paddingBottom: 8 }}>
        {TABS.map(([key, label, icon]) => {
          const active = tab === key;
          return (
            <Pressable key={key} onPress={() => setTab(key)} style={{ flex: 1, minHeight: 54, alignItems: "center", justifyContent: "center", gap: 2 }}>
              <Text style={{ color: active ? C.green : C.dim, fontSize: 17 }}>{icon}</Text>
              <Text style={{ color: active ? C.green : C.dim, fontSize: 10, fontWeight: active ? "800" : "600" }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
