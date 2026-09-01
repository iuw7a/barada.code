/**
 * Barada mobile theme system — dark / light / system.
 * Two carefully designed palettes sharing one green identity.
 */

export const dark = {
  mode: "dark",
  bg: "#0a0e0d",
  surface: "#131a17",
  surfaceAlt: "#18221d",
  border: "#1f2b26",
  text: "#e9efec",
  textDim: "#8a968f",
  accent: "#10a35f",
  accentDim: "#0b6b45",
  accentSoft: "#0f2419",
  onAccent: "#ffffff",
  bubbleUser: "#0e7a48",
  bubbleAi: "#131a17",
  danger: "#ef4444",
  overlay: "rgba(0,0,0,0.55)",
  codeBg: "#0d1310",
  statusBar: "light-content",
};

export const light = {
  mode: "light",
  bg: "#f6f8f7",
  surface: "#ffffff",
  surfaceAlt: "#eef3f0",
  border: "#dfe7e2",
  text: "#13201a",
  textDim: "#5f6b64",
  accent: "#0c8a4f",
  accentDim: "#0a6b3f",
  accentSoft: "#e2f3ea",
  onAccent: "#ffffff",
  bubbleUser: "#0c8a4f",
  bubbleAi: "#ffffff",
  danger: "#dc2626",
  overlay: "rgba(15,25,20,0.45)",
  codeBg: "#f0f4f2",
  statusBar: "dark-content",
};

export function palette(themeMode, systemDark) {
  const resolved = themeMode === "system" ? (systemDark ? "dark" : "light") : themeMode;
  return resolved === "dark" ? dark : light;
}
