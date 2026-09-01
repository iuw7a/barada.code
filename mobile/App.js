/**
 * Barada Code — mobile (chat-first).
 *
 * Open → Chat → Type → Send. Everything else lives behind the ☰ menu.
 * Guests chat immediately; after the free exchange a polished auth modal appears.
 * Signed-in users get the exact same chat home + history, projects, settings…
 */

import { AppState, Alert, Clipboard, FlatList, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, View, useColorScheme } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { api, apiFetch } from "./api";
import { palette } from "./theme";
import Drawer from "./Drawer";
import { AuthPrompt, AuthForm } from "./Auth";
import { ChatsScreen, ProjectsScreen, UsageScreen, SettingsScreen, AboutScreen, HelpScreen, LegalScreen } from "./screens";

const GUEST_LIMIT = 1; // free AI exchanges before the auth wall
const SUGGESTIONS = ["Build me a website", "Create a landing page for my shop", "Make a personal portfolio", "Help me plan an app"];

export default function App() {
  const sys = useColorScheme();
  const [themeMode, setThemeModeState] = useState("system");
  const t = palette(themeMode, sys === "dark");

  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [drawerAuth, setDrawerAuth] = useState(false);
  const [screen, setScreen] = useState(null); // null = chat home; 'chats'|'projects'|'usage'|'settings'|'about'|'help'|'terms'|'privacy'
  const [openChatId, setOpenChatId] = useState(null);

  useEffect(() => {
    (async () => {
      try { const m = await AsyncStorage.getItem("theme"); if (m) setThemeModeState(m); } catch {}
      try { const d = await api.me(); if (d.user) setUser(d.user); } catch {}
      setBooting(false);
    })();
  }, []);

  const setThemeMode = useCallback((m) => { setThemeModeState(m); AsyncStorage.setItem("theme", m).catch(() => {}); }, []);

  if (booting) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}>
        <StatusBar barStyle={t.statusBar} />
        <Text style={{ fontSize: 44, color: t.accent }}>◆</Text>
        <Text style={{ color: t.text, fontSize: 19, fontWeight: "700", marginTop: 8 }}>Barada Code</Text>
      </View>
    );
  }

  const home = !screen || screen === "chat";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar barStyle={t.statusBar} />

      {/* ── CHAT = HOME ── */}
      {home && (
        <ChatHome t={t} user={user} openChatId={openChatId} onChatOpened={() => setOpenChatId(null)}
          onOpenDrawer={() => setDrawer(true)}
          onSignedIn={(u) => { setUser(u); setDrawerAuth(false); }} />
      )}

      {/* ── secondary screens ── */}
      {!home && (
        <ScreenShell t={t} onClose={() => setScreen(null)}>
          {screen === "chats" && (
            <ChatsScreen t={t} onOpen={(c) => { setOpenChatId(c.id); setScreen(null); }} />
          )}
          {screen === "projects" && <ProjectsScreen t={t} />}
          {screen === "usage" && <UsageScreen t={t} />}
          {screen === "settings" && (
            <SettingsScreen t={t} user={user} themeMode={themeMode} setThemeMode={setThemeMode}
              onSignOut={() => { setUser(null); setScreen(null); }} />
          )}
          {screen === "about" && <AboutScreen t={t} />}
          {screen === "help" && <HelpScreen t={t} />}
          {(screen === "terms" || screen === "privacy") && <LegalScreen t={t} kind={screen} />}
        </ScreenShell>
      )}

      {/* ── navigation drawer ── */}
      <Drawer visible={drawer} onClose={() => setDrawer(false)} t={t} user={user} themeMode={themeMode} setThemeMode={setThemeMode}
        onNavigate={(dest) => {
          setDrawer(false);
          if (dest === "newchat") { setOpenChatId(null); setScreen(null); }
          else if (dest === "chats") { if (user) setScreen("chats"); else setDrawerAuth(true); }
          else setScreen(dest);
        }}
        onAuthAction={(a) => { setDrawer(false); if (a === "signin") setDrawerAuth(true); }} />

      {/* auth from the drawer */}
      <AuthPrompt visible={drawerAuth} t={t} onClose={() => setDrawerAuth(false)}
        onSignedIn={(u) => { setUser(u); setDrawerAuth(false); }} />
    </SafeAreaView>
  );
}

/** wraps secondary screens with a back button */
function ScreenShell({ t, onClose, children }) {
  return (
    <View style={{ flex: 1 }}>
      <Pressable onPress={onClose} style={{ paddingHorizontal: 18, paddingTop: 52, paddingBottom: 6, alignSelf: "flex-start" }}>
        <Text style={{ color: t.textDim, fontSize: 16 }}>‹  Back</Text>
      </Pressable>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

// ── Chat home ────────────────────────────────────────────────────────────────

function ChatHome({ t, user, openChatId, onChatOpened, onOpenDrawer, onSignedIn }) {
  const isGuest = !user;
  const [chatId, setChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState(null);
  const [wall, setWall] = useState(false); // guest auth modal
  const listRef = useRef(null);
  const pollRef = useRef(null);
  const guestTurns = useRef(0);

  // open a chat picked from History
  useEffect(() => {
    if (!openChatId || isGuest) return;
    setChatId(openChatId);
    api.messages(openChatId)
      .then((d) => setMessages((d.messages ?? []).map((m) => ({ id: m.id, role: m.role === "USER" ? "user" : "assistant", text: m.content }))))
      .catch(() => {});
    onChatOpened?.();
  }, [openChatId]);

  useEffect(() => () => clearInterval(pollRef.current), []);

  const scrollDown = () => setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 120);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    if (isGuest && (guestTurns.current >= GUEST_LIMIT || wall)) { setWall(true); return; }
    setInput(""); setError(null); setSending(true);
    setMessages((m) => [...m, { id: `u${Date.now()}`, role: "user", text }]);
    scrollDown();

    try {
      if (isGuest) {
        const history = messages.slice(-4).map((m) => ({ role: m.role, content: m.text }));
        const d = await api.guestChat(text, history);
        guestTurns.current += 1;
        setMessages((m) => [...m, { id: `a${Date.now()}`, role: "assistant", text: d.reply }]);
        scrollDown();
        if (guestTurns.current >= GUEST_LIMIT) setTimeout(() => setWall(true), 600);
      } else {
        let id = chatId;
        if (!id) {
          const d = await api.createChat();
          id = d.chat.id;
          setChatId(id);
        }
        await api.sendMessage(id, text);
        api.triggerStream(id);
        setBuilding(true);
        clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          try {
            const d = await api.messages(id);
            setMessages((d.messages ?? []).map((m) => ({ id: m.id, role: m.role === "USER" ? "user" : "assistant", text: m.content })));
            scrollDown();
            const c = await api.chat(id);
            if (c.chat.status !== "GENERATING") { setBuilding(false); clearInterval(pollRef.current); }
          } catch {}
        }, 2500);
      }
    } catch (e) {
      setError(e.name === "AbortError" ? "Cannot reach the server — check your connection." : e.message);
    } finally {
      setSending(false);
    }
  }

  // carry the guest conversation into the fresh account after sign-up
  function handleSignedIn(u) {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    setWall(false);
    onSignedIn(u);
    if (!lastUser) return;
    (async () => {
      try {
        const d = await api.createChat();
        setChatId(d.chat.id);
        await api.sendMessage(d.chat.id, lastUser.text);
        api.triggerStream(d.chat.id);
        setBuilding(true);
      } catch {}
    })();
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      {/* header — extremely clean */}
      <View style={[c.header, { borderBottomColor: t.border }]}>
        <Pressable onPress={onOpenDrawer} hitSlop={10} style={c.headerBtn}>
          <View style={[c.line, { backgroundColor: t.text }]} />
          <View style={[c.line, { backgroundColor: t.text }]} />
          <View style={[c.line, { backgroundColor: t.text }]} />
        </Pressable>
        <Text style={{ color: t.textDim, fontWeight: "600", fontSize: 13, flex: 1, textAlign: "center" }} numberOfLines={1}>
          {building ? "Barada is working…" : isGuest ? "Guest mode · free preview" : chatId ? "Chat" : "Barada Code"}
        </Text>
        {!isGuest && (
          <Pressable onPress={() => { setChatId(null); setMessages([]); setBuilding(false); }} hitSlop={10}>
            <Text style={{ color: t.accent, fontSize: 20 }}>✚</Text>
          </Pressable>
        )}
        {isGuest && <View style={{ width: 22 }} />}
      </View>

      {/* conversation / centered empty state */}
      {messages.length === 0 ? (
        <View style={c.empty}>
          <View style={[c.logo, { backgroundColor: t.accentSoft, borderColor: t.accentDim }]}>
            <Text style={{ color: t.accent, fontSize: 46 }}>◆</Text>
          </View>
          <Text style={{ color: t.text, fontSize: 22, fontWeight: "800", textAlign: "center" }}>
            {isGuest ? "How can I help you today?" : `Hey ${user.name.split(" ")[0]} — what are we building?`}
          </Text>
          <Text style={{ color: t.textDim, fontSize: 13.5, textAlign: "center", marginTop: 8, lineHeight: 19 }}>
            Describe your idea. Barada writes the code, builds the project, and publishes it.
          </Text>
          <View style={{ alignSelf: "stretch", marginTop: 22, gap: 9 }}>
            {SUGGESTIONS.map((sg) => (
              <Pressable key={sg} onPress={() => setInput(sg)}
                style={[c.suggestion, { backgroundColor: t.surface, borderColor: t.border }]}>
                <Text style={{ color: t.text, fontSize: 14 }}>{sg}</Text>
                <Text style={{ color: t.accent }}>↗</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd?.({ animated: false })}
          renderItem={({ item }) => <Bubble role={item.role} text={item.text} t={t} />}
        />
      )}

      {error ? <Text style={{ color: t.danger, fontSize: 13, textAlign: "center", marginBottom: 6 }}>{error}</Text> : null}

      {/* chat bar */}
      <View style={[c.barWrap, { borderTopColor: t.border, backgroundColor: t.bg }]}>
        <View style={[c.bar, { backgroundColor: t.surface, borderColor: t.border }]}>
          <TextInput
            style={{ flex: 1, color: t.text, fontSize: 15.5, paddingTop: Platform.OS === "ios" ? 9 : 11, paddingBottom: 9, maxHeight: 120 }}
            placeholder={wall ? "Sign in to continue…" : "Write a message…"}
            placeholderTextColor={t.textDim}
            value={input}
            onChangeText={setInput}
            multiline
            editable={!sending}
          />
          <Pressable
            onPress={send}
            disabled={!input.trim() || sending}
            style={[c.send, { backgroundColor: t.accent, opacity: !input.trim() || sending ? 0.4 : 1 }]}>
            {sending ? <Text style={{ color: "#fff", fontSize: 13 }}>•••</Text> : <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>↑</Text>}
          </Pressable>
        </View>
      </View>

      {/* guest auth wall — polished modal, conversation preserved */}
      <AuthPrompt visible={wall} t={t} onClose={() => setWall(false)} onSignedIn={handleSignedIn} />
    </KeyboardAvoidingView>
  );
}

// ── Bubbles with markdown-lite (code blocks + copy) ──────────────────────────

function Bubble({ role, text, t }) {
  const isUser = role === "user";
  const parts = text.split(/```(\w*)\n?/); // [text, lang, code, text, ...]
  return (
    <View style={{ flexDirection: "row", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 10 }}>
      <View style={[c.bubble, { backgroundColor: isUser ? t.bubbleUser : t.bubbleAi, borderColor: isUser ? "transparent" : t.border }]}>
        {isUser ? (
          <Text style={{ color: "#fff", fontSize: 14.5, lineHeight: 20 }}>{text}</Text>
        ) : (
          parts.map((p, i) => {
            if (i % 2 === 1) return null; // language tag slot
            const code = parts[i + 1];
            return (
              <View key={i}>
                {p.trim() ? <Text style={{ color: t.text, fontSize: 14.5, lineHeight: 20 }}>{p.replace(/\*\*/g, "").trim()}</Text> : null}
                {code ? (
                  <View style={[c.code, { backgroundColor: t.codeBg }]}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                      <Text style={{ color: t.textDim, fontSize: 11 }}>{parts[i] || "code"}</Text>
                      <Pressable onPress={() => { Clipboard.setString(code); Alert.alert("", "Copied to clipboard"); }}>
                        <Text style={{ color: t.accent, fontSize: 11, fontWeight: "700" }}>Copy</Text>
                      </Pressable>
                    </View>
                    <Text style={{ color: t.text, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 12.5 }}>{code.replace(/\n$/, "")}</Text>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

const c = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1 },
  headerBtn: { gap: 4, padding: 4 },
  line: { width: 20, height: 2, borderRadius: 2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  logo: { width: 92, height: 92, borderRadius: 46, alignItems: "center", justifyContent: "center", borderWidth: 1, marginBottom: 16 },
  suggestion: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderRadius: 13, paddingHorizontal: 16, paddingVertical: 13 },
  barWrap: { borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 },
  bar: { flexDirection: "row", alignItems: "flex-end", borderWidth: 1, borderRadius: 26, paddingLeft: 16, paddingRight: 6, paddingVertical: 5 },
  send: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  bubble: { maxWidth: "87%", borderRadius: 17, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1 },
  code: { borderRadius: 10, padding: 10, marginTop: 8 },
});
