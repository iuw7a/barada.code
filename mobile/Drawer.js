/** Barada mobile — slide-in navigation drawer (the ☰ menu). */

import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEffect, useRef } from "react";

const W = 310;

export default function Drawer({ visible, onClose, t, user, onNavigate, onAuthAction, themeMode, setThemeMode, onAdmin }) {
  const slide = useRef(new Animated.Value(-W)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, { toValue: visible ? 0 : -W, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fade, { toValue: visible ? 1 : 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  if (!visible) return null;

  const Item = ({ icon, label, onPress, tint }) => (
    <Pressable onPress={onPress} style={dStyles.item} android_ripple={{ color: t.border }}>
      <Text style={[dStyles.itemIcon, tint ? { color: tint } : null]}>{icon}</Text>
      <Text style={[dStyles.itemLabel, tint ? { color: tint } : null]}>{label}</Text>
    </Pressable>
  );

  const Section = ({ title, children }) => (
    <View style={dStyles.section}>
      <Text style={[dStyles.sectionTitle, { color: t.textDim }]}>{title}</Text>
      {children}
    </View>
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.overlay, opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[dStyles.panel, { backgroundColor: t.surface, borderColor: t.border, transform: [{ translateX: slide }] }]}>
        <ScrollView bounces={false} contentContainerStyle={{ paddingBottom: 30 }}>
          {/* brand */}
          <View style={[dStyles.brand, { borderBottomColor: t.border }]}>
            <View style={[dStyles.logo, { backgroundColor: t.accentSoft, borderColor: t.accentDim }]}>
              <Text style={{ color: t.accent, fontSize: 24 }}>◆</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>Barada Code</Text>
              <Text style={{ color: t.textDim, fontSize: 12 }}>{user ? user.email : "Guest mode"}</Text>
            </View>
          </View>

          <Section title="MAIN">
            <Item icon="✚" label="New chat" onPress={() => onNavigate("newchat")} />
            <Item icon="🕘" label="History" onPress={() => onNavigate("chats")} />
            <Item icon="📦" label="Projects" onPress={() => onNavigate("projects")} />
            <Item icon="🛡️" label="Admin Console" tint={t.accent} onPress={() => onAdmin?.()} />
          </Section>

          <Section title="ACCOUNT">
            {user ? (
              <>
                <Item icon="👤" label="Profile" onPress={() => onNavigate("settings")} />
                <Item icon="⭐" label="Subscription" onPress={() => onNavigate("usage")} />
                <Item icon="📊" label="Usage & Statistics" onPress={() => onNavigate("usage")} />
                <Item icon="⚙️" label="Settings" onPress={() => onNavigate("settings")} />
              </>
            ) : (
              <>
                <Item icon="✨" label="Sign in / Sign up" tint={t.accent} onPress={() => onAuthAction("signin")} />
              </>
            )}
          </Section>

          <Section title="APPEARANCE">
            <View style={dStyles.themeRow}>
              {["light", "dark", "system"].map((m) => (
                <Pressable key={m} onPress={() => setThemeMode(m)}
                  style={[dStyles.themeChip, { borderColor: themeMode === m ? t.accent : t.border, backgroundColor: themeMode === m ? t.accentSoft : "transparent" }]}>
                  <Text style={{ color: themeMode === m ? t.accent : t.textDim, fontSize: 12, fontWeight: "600", textTransform: "capitalize" }}>
                    {m === "light" ? "☀️ Light" : m === "dark" ? "🌙 Dark" : "⚙️ System"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Section>

          <Section title="INFORMATION">
            <Item icon="🟢" label="About Us" onPress={() => onNavigate("about")} />
            <Item icon="❓" label="Help Center" onPress={() => onNavigate("help")} />
            <Item icon="✉️" label="Contact" onPress={() => onNavigate("help")} />
            <Item icon="📄" label="Terms of Service" onPress={() => onNavigate("terms")} />
            <Item icon="🔒" label="Privacy Policy" onPress={() => onNavigate("privacy")} />
          </Section>

          {user && (
            <Section title="">
              <Item icon="🚪" label="Sign out" tint={t.danger} onPress={() => onAuthAction("signout")} />
            </Section>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const dStyles = StyleSheet.create({
  panel: { position: "absolute", top: 0, bottom: 0, left: 0, width: W, borderRightWidth: 1, paddingTop: 50, elevation: 12 },
  brand: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingBottom: 18, borderBottomWidth: 1, marginBottom: 8 },
  logo: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  section: { paddingHorizontal: 10, marginTop: 10 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, paddingHorizontal: 10, marginBottom: 4 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10 },
  itemIcon: { fontSize: 16, width: 24, textAlign: "center", color: "#8a968f" },
  itemLabel: { fontSize: 15, color: "#e9efec", flex: 1 },
  themeRow: { flexDirection: "row", gap: 8, paddingHorizontal: 8, paddingVertical: 6 },
  themeChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
});
