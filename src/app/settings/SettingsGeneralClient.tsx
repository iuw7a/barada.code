"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SettingsGeneralClient({
  languages,
  currentLanguage,
  email,
}: {
  languages: Array<{ code: string; name: string }>;
  currentLanguage: string;
  email: string;
}) {
  const router = useRouter();
  const [language, setLanguage] = useState(currentLanguage);
  const [saved, setSaved] = useState(false);

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
        <h2 className="mb-1 text-lg font-semibold">Account</h2>
        <p className="text-sm text-ink-500">Signed in as {email}. Manage profile details under Profile.</p>
      </section>
    </div>
  );
}
