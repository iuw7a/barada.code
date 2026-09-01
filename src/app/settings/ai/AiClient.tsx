"use client";

import { useState } from "react";

export default function AiClient({
  model: initialModel,
  autoRun: initialAutoRun,
  usage,
}: {
  model: string;
  autoRun: boolean;
  usage: { jobs: number; completed: number; failed: number; tokens: number };
}) {
  const [model, setModel] = useState(initialModel);
  const [autoRun, setAutoRun] = useState(initialAutoRun);
  const [saved, setSaved] = useState(false);

  async function persist(next: { model?: string; autoRun?: boolean }) {
    setSaved(false);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ai: next }),
    });
    setSaved(true);
  }

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="mb-4 text-lg font-semibold">AI preferences</h2>
        <div className="flex max-w-md flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-ink-600 dark:text-ink-300">Preferred model (blank = platform default)</span>
            <input
              className="input"
              placeholder="e.g. gpt-4o"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              onBlur={() => persist({ model })}
            />
          </label>
          <label className="card flex items-center justify-between p-4">
            <span className="text-sm">Auto-run tools without confirmation</span>
            <button
              role="switch"
              aria-checked={autoRun}
              onClick={() => {
                const next = !autoRun;
                setAutoRun(next);
                persist({ autoRun: next });
              }}
              className={`relative h-6 w-11 rounded-full transition-colors ${autoRun ? "bg-accent-600" : "bg-ink-300 dark:bg-ink-700"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${autoRun ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </label>
          {saved && <span className="text-xs text-accent-600">Saved</span>}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Usage</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "AI jobs", value: usage.jobs },
            { label: "Completed", value: usage.completed },
            { label: "Failed", value: usage.failed },
            { label: "Tokens", value: usage.tokens.toLocaleString() },
          ].map(({ label, value }) => (
            <div key={label} className="card p-4 text-center">
              <p className="text-xl font-semibold">{value}</p>
              <p className="text-xs text-ink-400">{label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
