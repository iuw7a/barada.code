/** Barada mobile — polished auth: sign-in wall for guests + full form. */

import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "./api";

/** Soft wall shown when a guest hits the free limit — a modal, not a redirect. */
export function AuthPrompt({ visible, t, onClose, onSignedIn }) {
  const [form, setForm] = useState(false);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={{ flex: 1, backgroundColor: t.overlay }} onPress={onClose} />
        <View style={[a.sheet, { backgroundColor: t.surface, borderColor: t.border }]}>
          {!form ? (
            <>
              <View style={[a.logo, { backgroundColor: t.accentSoft, borderColor: t.accentDim }]}><Text style={{ color: t.accent, fontSize: 30 }}>◆</Text></View>
              <Text style={{ color: t.text, fontSize: 20, fontWeight: "800", textAlign: "center" }}>Create an account to continue</Text>
              <Text style={{ color: t.textDim, fontSize: 13.5, textAlign: "center", marginTop: 8, lineHeight: 19 }}>
                Keep this conversation, build real projects, publish them and sync everything with the web app.
              </Text>
              <Pressable style={[a.btn, { backgroundColor: t.accent, marginTop: 18 }]} onPress={() => setForm(true)}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Create account</Text>
              </Pressable>
              <Pressable style={[a.btn, { backgroundColor: "transparent", borderWidth: 1, borderColor: t.border }]} onPress={() => setForm(true)}>
                <Text style={{ color: t.text, fontWeight: "600" }}>Sign in</Text>
              </Pressable>
              <Pressable onPress={onClose} style={{ padding: 12 }}>
                <Text style={{ color: t.textDim, fontSize: 13 }}>Maybe later</Text>
              </Pressable>
            </>
          ) : (
            <AuthForm t={t} onSignedIn={onSignedIn} />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Full auth form used by the prompt and the drawer. */
export function AuthForm({ t, onSignedIn }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    if (!email.trim() || !password || busy) return;
    setBusy(true); setError(null);
    try {
      const data = mode === "signin"
        ? await api.signin(email.trim(), password)
        : await api.signup(email.trim(), password, name || email.split("@")[0]);
      onSignedIn(data.user);
    } catch (e) {
      setError(e.name === "AbortError" ? "Cannot reach the server." : e.message);
    } finally { setBusy(false); }
  }

  return (
    <>
      <View style={[a.logo, { backgroundColor: t.accentSoft, borderColor: t.accentDim, alignSelf: "center" }]}>
        <Text style={{ color: t.accent, fontSize: 26 }}>◆</Text>
      </View>
      <Text style={{ color: t.text, fontSize: 19, fontWeight: "800", textAlign: "center", marginBottom: 14 }}>
        {mode === "signin" ? "Welcome back" : "Create your account"}
      </Text>
      {mode === "signup" && (
        <TextInput style={a.input(t)} placeholder="Name" placeholderTextColor={t.textDim} value={name} onChangeText={setName} autoCapitalize="none" />
      )}
      <TextInput style={a.input(t)} placeholder="Email" placeholderTextColor={t.textDim} value={email} onChangeText={setEmail}
        autoCapitalize="none" keyboardType="email-address" autoCorrect={false} />
      <TextInput style={a.input(t)} placeholder="Password" placeholderTextColor={t.textDim} value={password} onChangeText={setPassword} secureTextEntry />
      {error && <Text style={{ color: t.danger, fontSize: 13, textAlign: "center", marginTop: 8 }}>{error}</Text>}
      <Pressable onPress={submit} disabled={busy} style={[a.btn, { backgroundColor: t.accent, marginTop: 14, opacity: busy ? 0.6 : 1 }]}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>{mode === "signin" ? "Sign in" : "Create account"}</Text>}
      </Pressable>
      <Pressable onPress={() => setMode(mode === "signin" ? "signup" : "signin")} style={{ padding: 12 }}>
        <Text style={{ color: t.accent, fontSize: 13.5 }}>
          {mode === "signin" ? "No account? Sign up" : "Have an account? Sign in"}
        </Text>
      </Pressable>
    </>
  );
}

const a = StyleSheet.create({
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 24, paddingBottom: 40, alignItems: "center" },
  logo: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", borderWidth: 1, marginBottom: 12 },
  btn: { width: "100%", borderRadius: 13, paddingVertical: 14, alignItems: "center", marginTop: 10 },
  input: (t) => ({
    width: "100%", backgroundColor: t.surfaceAlt, borderWidth: 1, borderColor: t.border, borderRadius: 12,
    color: t.text, paddingHorizontal: 15, paddingVertical: 12, fontSize: 15, marginTop: 10,
  }),
});
