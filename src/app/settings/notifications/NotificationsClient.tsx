"use client";

import { useState } from "react";

type Prefs = { email: boolean; project: boolean; ai: boolean; workspace: boolean };

const LABELS: Record<keyof Prefs, string> = {
  email: "Email notifications",
  project: "Project notifications",
  ai: "AI notifications",
  workspace: "Workspace notifications",
};

export default function NotificationsClient({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [saved, setSaved] = useState(false);

  async function toggle(key: keyof Prefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaved(false);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notifications: next }),
    });
    setSaved(true);
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Notifications</h2>
      <div className="flex flex-col gap-3">
        {(Object.keys(LABELS) as Array<keyof Prefs>).map((key) => (
          <label key={key} className="card flex items-center justify-between p-4">
            <span className="text-sm">{LABELS[key]}</span>
            <button
              role="switch"
              aria-checked={prefs[key]}
              onClick={() => toggle(key)}
              className={`relative h-6 w-11 rounded-full transition-colors ${prefs[key] ? "bg-accent-600" : "bg-ink-300 dark:bg-ink-700"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  prefs[key] ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </label>
        ))}
      </div>
      {saved && <p className="mt-2 text-xs text-accent-600">Saved</p>}
    </div>
  );
}
