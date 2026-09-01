/** Barada mobile — secondary screens reachable from the drawer. */

import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { api } from "./api";

export function Screen({ title, t, children, footer }) {
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[s.header, { borderBottomColor: t.border, backgroundColor: t.bg }]}>
        <Text style={{ color: t.text, fontSize: 18, fontWeight: "800" }}>{title}</Text>
      </View>
      <ScrollView bounces={false} contentContainerStyle={{ padding: 16, paddingBottom: 50 }}>
        {children}
      </ScrollView>
      {footer}
    </View>
  );
}

export function Card({ t, children, style }) {
  return <View style={[s.card, { backgroundColor: t.surface, borderColor: t.border }, style]}>{children}</View>;
}

// ── History (chats) ──────────────────────────────────────────────────────────

export function ChatsScreen({ t, onOpen, onClosed }) {
  const [chats, setChats] = useState(null);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState("");

  const load = useCallback(() => { api.chats().then((d) => setChats(d.chats ?? [])).catch(() => setChats([])); }, []);
  useEffect(load, [load]);

  async function rename(id) {
    try { await api.renameChat(id, draft); setEditing(null); load(); } catch (e) { Alert.alert("Rename failed", e.message); }
  }
  async function remove(id) {
    Alert.alert("Delete chat?", "This removes the conversation and its messages.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { try { await api.deleteChat(id); load(); onClosed?.(); } catch (e) { Alert.alert("Delete failed", e.message); } } },
    ]);
  }

  if (!chats) return <View style={{ flex: 1, justifyContent: "center", backgroundColor: t.bg }}><ActivityIndicator color={t.accent} /></View>;

  return (
    <Screen title="History" t={t}>
      {chats.length === 0 && <Text style={{ color: t.textDim, textAlign: "center", marginTop: 30 }}>No conversations yet.</Text>}
      {chats.map((c) => (
        <Card key={c.id} t={t} style={{ marginBottom: 10 }}>
          {editing === c.id ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput value={draft} onChangeText={setDraft} autoFocus style={[s.input, { backgroundColor: t.surfaceAlt, borderColor: t.border, color: t.text, flex: 1, marginTop: 0 }]} />
              <Pressable onPress={() => rename(c.id)} style={[s.smallBtn, { backgroundColor: t.accent }]}><Text style={{ color: "#fff", fontWeight: "700" }}>Save</Text></Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable style={{ flex: 1 }} onPress={() => onOpen(c.id)}>
                <Text style={{ color: t.text, fontWeight: "600" }} numberOfLines={1}>{c.title}</Text>
                <Text style={{ color: t.textDim, fontSize: 12, marginTop: 2 }}>
                  {c.status === "GENERATING" ? "● building…" : new Date(c.updatedAt || c.createdAt).toLocaleString()}
                </Text>
              </Pressable>
              <Pressable onPress={() => { setEditing(c.id); setDraft(c.title); }}><Text style={{ fontSize: 15 }}>✏️</Text></Pressable>
              <Pressable onPress={() => remove(c.id)}><Text style={{ fontSize: 15 }}>🗑️</Text></Pressable>
            </View>
          )}
        </Card>
      ))}
    </Screen>
  );
}

// ── Projects ─────────────────────────────────────────────────────────────────

export function ProjectsScreen({ t }) {
  const [projects, setProjects] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => { api.projects().then((d) => setProjects(d.projects ?? d ?? [])).catch(() => setProjects([])); }, []);
  useEffect(load, [load]);

  if (!projects) return <View style={{ flex: 1, justifyContent: "center", backgroundColor: t.bg }}><ActivityIndicator color={t.accent} /></View>;

  return (
    <Screen title="Projects" t={t}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); setRefreshing(false); }} tintColor={t.accent} />}>
        {projects.length === 0 && <Text style={{ color: t.textDim, textAlign: "center", marginTop: 30 }}>No projects yet — ask Barada to build one.</Text>}
        {projects.map((p) => (
          <Card key={p.id} t={t} style={{ marginBottom: 10 }}>
            <Text style={{ color: t.text, fontWeight: "700" }}>{p.name}</Text>
            {p.description ? <Text style={{ color: t.textDim, fontSize: 12, marginTop: 3 }} numberOfLines={2}>{p.description}</Text> : null}
            <Text style={{ color: t.textDim, fontSize: 11, marginTop: 6 }}>
              {p._count?.files ?? 0} files · {p._count?.chats ?? 0} chats · {p.status}
            </Text>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

// ── Usage & subscription ─────────────────────────────────────────────────────

export function UsageScreen({ t }) {
  const [st, setSt] = useState(null);
  useEffect(() => { api.stats().then(setSt).catch(() => setSt({})); }, []);

  const rows = st ? [
    ["Plan", st.plan ?? "FREE"],
    ["Projects", st.projects ?? 0],
    ["Chats", st.chats ?? 0],
    ["Messages", st.messages ?? 0],
    ["Published sites", st.deployments ?? 0],
    ["AI calls this month", st.month?.aiCalls ?? 0],
    ["Tokens this month", st.month?.aiTokens ?? 0],
  ] : [];

  return (
    <Screen title="Usage & Subscription" t={t}>
      <Card t={t} style={{ alignItems: "center", paddingVertical: 22 }}>
        <View style={[s.logo, { backgroundColor: t.accentSoft, borderColor: t.accentDim }]}><Text style={{ color: t.accent, fontSize: 26 }}>◆</Text></View>
        <Text style={{ color: t.text, fontWeight: "800", fontSize: 17, marginTop: 10 }}>{st?.plan ?? "FREE"} plan</Text>
        <Text style={{ color: t.textDim, fontSize: 12, marginTop: 4 }}>PRO unlocks unlimited builds & publishing</Text>
        <Pressable style={[s.bigBtn, { backgroundColor: t.accent }]}><Text style={{ color: "#fff", fontWeight: "700" }}>Upgrade to PRO</Text></Pressable>
      </Card>
      <Card t={t}>
        {rows.map(([k, v]) => (
          <View key={k} style={s.row}>
            <Text style={{ color: t.textDim, fontSize: 14 }}>{k}</Text>
            <Text style={{ color: t.text, fontSize: 14, fontWeight: "700" }}>{v}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────────

export function SettingsScreen({ t, user, themeMode, setThemeMode, onSignOut }) {
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pushNotif, setPushNotif] = useState(true);
  const [emailNotif, setEmailNotif] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await apiFetchPatch(name);
      setSaved(true); setTimeout(() => setSaved(false), 1500);
    } catch (e) { Alert.alert("Save failed", e.message); } finally { setSaving(false); }
  }

  async function apiFetchPatch(newName) {
    const { apiFetch } = await import("./api");
    await apiFetch(`/api/profile`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName }) });
  }

  return (
    <Screen title="Settings" t={t}>
      <Card t={t}>
        <Text style={s.section(t.textDim)}>ACCOUNT</Text>
        <Text style={{ color: t.textDim, fontSize: 12 }}>Name</Text>
        <TextInput value={name} onChangeText={setName} style={[s.input, { backgroundColor: t.surfaceAlt, borderColor: t.border, color: t.text }]} />
        <Text style={{ color: t.textDim, fontSize: 12, marginTop: 10 }}>Email</Text>
        <Text style={{ color: t.text, fontSize: 14, paddingVertical: 6 }}>{user.email}</Text>
        <Pressable onPress={save} disabled={saving} style={[s.bigBtn, { backgroundColor: t.accent, marginTop: 12 }]}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>{saved ? "Saved ✓" : "Save changes"}</Text>}
        </Pressable>
      </Card>

      <Card t={t}>
        <Text style={s.section(t.textDim)}>APPEARANCE</Text>
        <View style={s.themeRow}>
          {["light", "dark", "system"].map((m) => (
            <Pressable key={m} onPress={() => setThemeMode(m)}
              style={[s.themeChip, { borderColor: themeMode === m ? t.accent : t.border, backgroundColor: themeMode === m ? t.accentSoft : "transparent" }]}>
              <Text style={{ color: themeMode === m ? t.accent : t.textDim, fontSize: 12, fontWeight: "600", textTransform: "capitalize" }}>{m}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card t={t}>
        <Text style={s.section(t.textDim)}>NOTIFICATIONS</Text>
        <View style={s.row}>
          <Text style={{ color: t.text, fontSize: 14 }}>Push notifications</Text>
          <Switch value={pushNotif} onValueChange={setPushNotif} trackColor={{ true: t.accent }} />
        </View>
        <View style={s.row}>
          <Text style={{ color: t.text, fontSize: 14 }}>Email notifications</Text>
          <Switch value={emailNotif} onValueChange={setEmailNotif} trackColor={{ true: t.accent }} />
        </View>
      </Card>

      <Card t={t}>
        <Text style={s.section(t.textDim)}>AI</Text>
        <Text style={{ color: t.textDim, fontSize: 13, lineHeight: 19 }}>
          Barada uses the same powerful model on web and mobile. Response language follows the language you write in.
        </Text>
      </Card>

      <Card t={t}>
        <Text style={s.section(t.textDim)}>PRIVACY & SECURITY</Text>
        <Text style={{ color: t.textDim, fontSize: 13, lineHeight: 19 }}>
          Your conversations are stored on your own Barada server. Sign out below to end this session on this device.
        </Text>
        <Pressable onPress={onSignOut} style={[s.bigBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: t.danger, marginTop: 12 }]}>
          <Text style={{ color: t.danger, fontWeight: "700" }}>Sign out</Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

// ── About / Help / Legal ─────────────────────────────────────────────────────

export function AboutScreen({ t }) {
  return (
    <Screen title="About Us" t={t}>
      <Card t={t} style={{ alignItems: "center", paddingVertical: 24 }}>
        <View style={[s.logo, { backgroundColor: t.accentSoft, borderColor: t.accentDim }]}><Text style={{ color: t.accent, fontSize: 30 }}>◆</Text></View>
        <Text style={{ color: t.text, fontSize: 20, fontWeight: "800", marginTop: 10 }}>Barada Code</Text>
        <Text style={{ color: t.textDim, fontSize: 13, textAlign: "center", marginTop: 4 }}>Build real software by describing it.</Text>
      </Card>
      <Card t={t}>
        <Text style={{ color: t.text, fontSize: 14, lineHeight: 21 }}>
          Barada Code turns plain-language ideas into working projects — real files, real code, live preview and one-click publishing.
        </Text>
      </Card>
      <Card t={t}>
        <Text style={s.section(t.textDim)}>MISSION</Text>
        <Text style={{ color: t.textDim, fontSize: 13, lineHeight: 20 }}>
          Software creation should be as easy as explaining an idea to a friend. Barada is an AI software engineer that listens,
          asks the right questions, and builds — so anyone can ship a real product, not a mockup.
        </Text>
      </Card>
      <Card t={t}>
        <Text style={s.section(t.textDim)}>WHAT WE DO</Text>
        <Text style={{ color: t.textDim, fontSize: 13, lineHeight: 20 }}>
          • Chat-first AI building — describe, refine, launch.{"\n"}
          • A full workspace: files, code editor, live preview.{"\n"}
          • Real publishing to your own subdomain.{"\n"}
          • Web and mobile, one account, one history.
        </Text>
      </Card>
      <Card t={t}>
        <Text style={s.section(t.textDim)}>CONTACT</Text>
        <Text style={{ color: t.textDim, fontSize: 13, lineHeight: 20 }}>
          Web: barada code — localhost / iuw7a.com{"\n"}
          Support: from the Help Center in this app.
        </Text>
      </Card>
    </Screen>
  );
}

export function HelpScreen({ t }) {
  const qa = [
    ["How do I start?", "Just type your idea in the chat — “Build a coffee shop website called Moon Coffee”. Barada asks short questions, then builds."],
    ["Where do my projects go?", "Every build creates a real project with files and a live preview. Open Projects in the ☰ menu."],
    ["Do chats sync with the web app?", "Yes — the same account shows the same chats, projects and published sites on web and mobile."],
    ["How do I publish a site?", "Ask Barada to publish your project, or open the project on the web app and press Publish."],
    ["Contact", "Reach us from the web app's Help Center or write to the owner directly — support is handled personally during early access."],
  ];
  return (
    <Screen title="Help Center" t={t}>
      {qa.map(([q, a], i) => (
        <Card key={i} t={t} style={{ marginBottom: 10 }}>
          <Text style={{ color: t.text, fontWeight: "700", fontSize: 14 }}>{q}</Text>
          <Text style={{ color: t.textDim, fontSize: 13, lineHeight: 19, marginTop: 6 }}>{a}</Text>
        </Card>
      ))}
    </Screen>
  );
}

export function LegalScreen({ t, kind }) {
  const isTerms = kind === "terms";
  return (
    <Screen title={isTerms ? "Terms of Service" : "Privacy Policy"} t={t}>
      <Card t={t}>
        <Text style={{ color: t.textDim, fontSize: 13, lineHeight: 20 }}>
          {isTerms
            ? "Barada Code is provided as-is during early access. You are responsible for the content you build and publish; illegal content and abuse are not permitted. Your account and projects may be suspended for misuse. Features and plans may change as the product evolves."
            : "Your conversations, projects and account data are stored on the Barada server you connect to. We do not sell your data. API keys are kept server-side and never embedded in the app. Voice features run through the voice provider only while a session is active and audio is not persistently stored. You can request deletion of your account and data at any time."}
        </Text>
      </Card>
      <Text style={{ color: t.textDim, fontSize: 11, marginTop: 12, textAlign: "center" }}>Last updated: September 2026</Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingTop: 54, paddingBottom: 14, borderBottomWidth: 1 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "rgba(128,128,128,0.15)" },
  section: () => ({ fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 10 }),
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginTop: 4 },
  bigBtn: { borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  smallBtn: { borderRadius: 9, paddingHorizontal: 14, justifyContent: "center" },
  logo: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  themeRow: { flexDirection: "row", gap: 8 },
  themeChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
});
