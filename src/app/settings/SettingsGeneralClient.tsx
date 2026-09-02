"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ChatPrefs = {
  autoRun?: boolean;
  defaultModel?: string;
  editorFontSize?: number;
  previewDevice?: "desktop" | "tablet" | "mobile";
  notifications?: { email?: boolean; build?: boolean };
};

export default function SettingsGeneralClient({
  languages,
  currentLanguage,
  email,
  preferences,
}: {
  languages: Array<{ code: string; name: string }>;
  currentLanguage: string;
  email: string;
  preferences: ChatPrefs;
}) {
  const router = useRouter();
  const [language, setLanguage] = useState(currentLanguage);
  const [prefs, setPrefs] = useState<ChatPrefs>(preferences);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function changeLanguage(code: string) {
    setLanguage(code);
    setSaved(false);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: code }),
    });
    setSaved(true);
    router.refresh(); // re-renders server layout with new dir/lang
  }

  /** Persist a preference patch to UserSettings.json. */
  async function savePrefs(patch: Partial<ChatPrefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ai: {
            autoRun: next.autoRun ?? true,
            model: next.defaultModel,
          },
          editor: { fontSize: next.editorFontSize ?? 14 },
          preview: { device: next.previewDevice ?? "desktop" },
          notifications: next.notifications ?? {},
        }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  function Toggle({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
    return (
      <button
        onClick={() => onChange(!value)}
        className="flex w-full items-center justify-between rounded-xl border border-ink-200 px-4 py-3 text-start dark:border-ink-700"
      >
        <span>
          <span className="block text-sm font-medium">{label}</span>
          <span className="block text-xs text-ink-500 dark:text-ink-400">{hint}</span>
        </span>
        <span
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${value ? "bg-accent-600" : "bg-ink-300 dark:bg-ink-700"}`}
          role="switch"
          aria-checked={value}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? "left-[22px]" : "left-0.5"}`} />
        </span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-1 text-lg font-semibold">Language</h2>
        <p className="mb-4 text-sm text-ink-500">Applies immediately. Arabic switches the interface to RTL.</p>
        <div className="flex flex-wrap gap-2">
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => changeLanguage(l.code)}
              className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                language === l.code
                  ? "border-accent-500 bg-accent-50 font-medium text-accent-700 dark:bg-accent-900/30 dark:text-accent-300"
                  : "border-ink-200 hover:border-ink-300 dark:border-ink-700"
              }`}
            >
              {l.name}
            </button>
          ))}
        </div>
        {saved && <p className="mt-2 text-xs text-accent-600">Saved</p>}
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">AI & chat preferences</h2>
        <p className="mb-4 text-sm text-ink-500">How the Barada agent works in your chats.</p>
        <div className="flex flex-col gap-2">
          <Toggle
            label="Agent auto-verification"
            hint="Barada automatically builds, runs and tests before saying done"
            value={prefs.autoRun ?? true}
            onChange={(v) => savePrefs({ autoRun: v })}
          />
          <div className="flex items-center justify-between rounded-xl border border-ink-200 px-4 py-3 dark:border-ink-700">
            <span>
              <span className="block text-sm font-medium">Editor font size</span>
              <span className="block text-xs text-ink-500 dark:text-ink-400">Applies to the code editor</span>
            </span>
            <select
              value={prefs.editorFontSize ?? 14}
              onChange={(e) => savePrefs({ editorFontSize: Number(e.target.value) })}
              className="input w-24"
            >
              {[12, 13, 14, 16, 18].map((s) => (
                <option key={s} value={s}>{s}px</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-ink-200 px-4 py-3 dark:border-ink-700">
            <span>
              <span className="block text-sm font-medium">Default preview device</span>
              <span className="block text-xs text-ink-500 dark:text-ink-400">Initial size of the live preview panel</span>
            </span>
            <select
              value={prefs.previewDevice ?? "desktop"}
              onChange={(e) => savePrefs({ previewDevice: e.target.value as ChatPrefs["previewDevice"] })}
              className="input w-32"
            >
              <option value="desktop">Desktop</option>
              <option value="tablet">Tablet</option>
              <option value="mobile">Mobile</option>
            </select>
          </div>
          <Toggle
            label="Build notification emails"
            hint="Get an email when a long build finishes"
            value={prefs.notifications?.build ?? false}
            onChange={(v) => savePrefs({ notifications: { ...prefs.notifications, build: v } })}
          />
        </div>
        {(saving || saved) && (
          <p className={`mt-2 text-xs ${saved ? "text-accent-600" : "text-ink-400"}`}>{saving ? "Saving…" : "Saved"}</p>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Account</h2>
        <p className="text-sm text-ink-500">Signed in as {email}. Manage profile details under Profile.</p>
      </section>
    </div>
  );
}
