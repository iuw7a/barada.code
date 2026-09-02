"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Trash2, Loader2, History } from "lucide-react";

type LogEntry = {
  id: string;
  command: string;
  output: string;
  exitCode: number | null;
  kind: string;
  createdAt: string;
};

/**
 * Terminal panel — real sandbox shell: run commands, see stdout/stderr,
 * exit codes, timestamps and history. The same logs the agent produces.
 */
export default function TerminalPanel({ projectId }: { projectId: string }) {
  const [command, setCommand] = useState("");
  const [busy, setBusy] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/terminal`);
      if (!res.ok) return;
      const data = await res.json();
      setEntries((data.logs ?? []).slice().reverse());
    } catch {
      /* ignore */
    }
  }, [projectId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [entries, busy]);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    const cmd = command.trim();
    if (!cmd || busy) return;
    setCommand("");
    setBusy(true);
    // Optimistic running entry
    const tempId = `tmp-${Date.now()}`;
    setEntries((prev) => [
      ...prev,
      { id: tempId, command: cmd, output: "running…", exitCode: null, kind: "exec", createdAt: new Date().toISOString() },
    ]);
    try {
      const res = await fetch(`/api/projects/${projectId}/terminal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });
      const data = await res.json();
      setEntries((prev) =>
        prev.map((en) =>
          en.id === tempId
            ? {
                ...en,
                output: res.ok
                  ? `${data.header}\n${[data.stdout, data.stderr].filter(Boolean).join("\n") || "(no output)"}`
                  : (data.error ?? "request failed"),
                exitCode: res.ok ? data.exitCode : -1,
                createdAt: new Date().toISOString(),
              }
            : en
        )
      );
    } catch {
      setEntries((prev) => prev.map((en) => (en.id === tempId ? { ...en, output: "network error", exitCode: -1 } : en)));
    } finally {
      setBusy(false);
    }
  }

  async function clearHistory() {
    // Client-side clear only (audit log stays server-side).
    setEntries([]);
  }

  return (
    <div className="flex h-full flex-col bg-ink-950 font-mono text-xs text-ink-200">
      <div className="flex items-center justify-between border-b border-ink-800 px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-400">
          <History className="h-3 w-3" /> Terminal — {projectId.slice(0, 8)}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={loadHistory} className="p-1 text-ink-400 hover:text-ink-200" title="Reload history" aria-label="Reload">
            <Loader2 className={`h-3 w-3 ${busy ? "animate-spin" : "opacity-0"}`} />
          </button>
          <button onClick={clearHistory} className="p-1 text-ink-400 hover:text-ink-200" title="Clear view" aria-label="Clear">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 thin-scroll">
        {entries.length === 0 && (
          <p className="text-ink-500">No commands yet. Type a command below — e.g. `npm install` or `ls`.</p>
        )}
        {entries.map((en) => (
          <div key={en.id} className="space-y-1">
            <div className="flex items-start gap-1.5 text-ink-300">
              <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-accent-500" />
              <span className="break-all">{en.command}</span>
              <span className="ml-auto shrink-0 text-[10px] text-ink-500">
                {new Date(en.createdAt).toLocaleTimeString()}
              </span>
            </div>
            <pre
              className={`max-h-48 overflow-y-auto whitespace-pre-wrap break-all rounded-md bg-black/40 p-2 text-[11px] leading-relaxed thin-scroll ${
                en.exitCode === null ? "text-ink-400" : en.exitCode === 0 ? "text-emerald-300/80" : "text-red-300"
              }`}
            >
              {en.output}
            </pre>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-ink-400">
            <Loader2 className="h-3 w-3 animate-spin" /> running…
          </div>
        )}
      </div>

      <form onSubmit={run} className="flex items-center gap-2 border-t border-ink-800 px-3 py-2">
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-accent-500" />
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="npm install express …"
          className="flex-1 bg-transparent text-ink-100 outline-none placeholder:text-ink-600"
          disabled={busy}
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={busy || !command.trim()}
          className="rounded-md bg-accent-600 px-3 py-1 text-[11px] font-medium text-white disabled:opacity-40"
        >
          Run
        </button>
      </form>
    </div>
  );
}
