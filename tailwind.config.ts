import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Barada Code identity: deep ink neutrals + a single restrained accent
        ink: {
          50: "#f7f8fa",
          100: "#eef0f4",
          200: "#dfe3ea",
          300: "#c5cbd6",
          400: "#8f97a5",
          500: "#5c6470",
          600: "#3d434d",
          700: "#2b303a",
          800: "#1c2029",
          900: "#12151c",
          950: "#0b0d12",
        },
        accent: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
