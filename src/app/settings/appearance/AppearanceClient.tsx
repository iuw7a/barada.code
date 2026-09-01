"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

type Theme = "light" | "dark" | "system";

const OPTIONS: Array<{ value: Theme; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export default function AppearanceClient({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    applyTheme(theme);
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const fn = () => applyTheme("system");
      mq.addEventListener("change", fn);
      return () => mq.removeEventListener("change", fn);
    }
  }, [theme]);

  async function pick(t: Theme) {
    setTheme(t);
    setSaved(false);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: t }),
    });
    setSaved(true);
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Appearance</h2>
      <div className="flex gap-3">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => pick(value)}
            className={`flex flex-col items-center gap-2 rounded-xl border px-6 py-4 text-sm transition-colors ${
              theme === value
                ? "border-accent-500 bg-accent-50 font-medium text-accent-700 dark:bg-accent-900/30 dark:text-accent-300"
                : "border-ink-200 hover:border-ink-300 dark:border-ink-700"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </div>
      {saved && <p className="mt-2 text-xs text-accent-600">Saved</p>}
    </div>
  );
}
