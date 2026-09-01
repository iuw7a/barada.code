"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Sparkles, Mic } from "lucide-react";

export default function ChatEmpty({ greeting }: { greeting: string }) {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!idea.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstMessage: idea.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start chat");
      router.push(`/chat/${data.chatId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start chat");
      setBusy(false);
    }
  }

  // Voice: create an empty chat, then start the voice session inside it.
  async function startVoice() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start chat");
      router.push(`/chat/${data.chatId}?voice=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start chat");
      setBusy(false);
    }
  }

  const [improving, setImproving] = useState(false);
  const [improved, setImproved] = useState<string | null>(null);
  const [improveError, setImproveError] = useState<string | null>(null);

  async function improvePrompt() {
    if (!idea.trim() || improving) return;
    setImproving(true);
    setImproveError(null);
    try {
      const res = await fetch("/api/ai/improve-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: idea.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not improve prompt");
      setImproved(data.improved);
    } catch (err) {
      setImproveError(err instanceof Error ? err.message : "Could not improve prompt");
    } finally {
      setImproving(false);
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      <div className="w-full max-w-2xl text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/barada-logo.png"
          alt="Barada Code"
          className="logo-float mx-auto mb-5 h-16 w-16 rounded-2xl object-contain shadow-lg shadow-accent-600/20"
        />
        <h1 className="text-2xl font-semibold">{greeting}</h1>
        <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
          Describe an idea and Barada will start the project with you.
        </p>
        {improved && (
          <div className="card mt-6 p-4 text-start">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-accent-600">
              <Sparkles className="h-3.5 w-3.5" /> Improved prompt — review before sending
            </p>
            <p className="whitespace-pre-wrap text-sm text-ink-700 dark:text-ink-200">{improved}</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  setIdea(improved);
                  setImproved(null);
                }}
                className="btn-primary text-xs"
              >
                Use improved prompt
              </button>
              <button onClick={() => setImproved(null)} className="btn-ghost text-xs">
                Discard
              </button>
            </div>
          </div>
        )}
        <form onSubmit={start} className="glass mt-8 flex items-end gap-2 rounded-2xl p-3">
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="e.g. Build a coffee shop website called Moon Coffee with dark green and cream colors…"
            rows={2}
            className="max-h-40 flex-1 resize-none bg-transparent p-2 text-sm outline-none placeholder:text-ink-400"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                start(e);
              }
            }}
          />
          <button
            type="button"
            onClick={improvePrompt}
            disabled={improving || busy || !idea.trim()}
            className="btn-ghost shrink-0"
            title="Improve prompt with AI"
          >
            <Sparkles className={`h-4 w-4 ${improving ? "animate-pulse text-accent-600" : ""}`} />
          </button>
          <button
            type="button"
            onClick={startVoice}
            disabled={busy}
            className="btn-ghost shrink-0"
            title="Talk to Barada"
            aria-label="Start voice conversation"
          >
            <Mic className="h-4 w-4" />
          </button>
          <button type="submit" disabled={busy || !idea.trim()} className="btn-primary shrink-0" aria-label="Send">
            <Send className="h-4 w-4" />
          </button>
        </form>
        {improveError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{improveError}</p>}
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}
