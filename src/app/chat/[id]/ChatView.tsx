"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SponsoredCard from "@/components/SponsoredCard";
import { useRouter } from "next/navigation";
import { Send, Wrench, CheckCircle2, XCircle, Loader2, ChevronDown, Copy, Check, Sparkles, Mic, PhoneOff, AudioLines } from "lucide-react";
import { useVoiceAgent, type ProjectBrief, type VoiceState, type VoiceTurn } from "@/lib/voice/useVoiceAgent";

type Msg = {
  id: string;
  role: string;
  content: string;
  status: string;
  toolCalls?: unknown;
};

type ToolEvent = { name: string; ok: boolean; summary: string };

export default function ChatView({
  chatId,
  projectId,
  autoStartVoice,
  initialStatus,
  initialMessages,
}: {
  chatId: string;
  projectId: string | null;
  autoStartVoice?: boolean;
  initialStatus: string;
  initialMessages: Msg[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [improving, setImproving] = useState(false);
  const [improved, setImproved] = useState<string | null>(null);
  const [improveError, setImproveError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Voice (AssemblyAI Voice Agent) ────────────────────────────────────
  // Compact transcript of this chat, seeded into the voice session so short
  // follow-ups ("make it green") refer to the existing conversation.
  const voiceContext = useCallback(
    () =>
      initialMessages
        .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
        .slice(-12)
        .map((m) => `${m.role === "USER" ? "User" : "Barada"}: ${m.content.slice(0, 300)}`)
        .join("\n")
        .slice(0, 2400) || null,
    [initialMessages]
  );

  // Persist each finalized voice turn as a normal chat message (voice ↔ text
  // share one history). Fire-and-forget; failures are ignored — the voice
  // conversation itself never depended on persistence.
  // The provider can deliver the same finalized transcript more than once
  // (e.g. greeting + turn transcript), so skip exact consecutive repeats.
  const lastPersistedRef = useRef<string>("");
  const persistTurn = useCallback(
    (turn: VoiceTurn) => {
      const key = `${turn.role}:${turn.text}`;
      if (key === lastPersistedRef.current) return;
      lastPersistedRef.current = key;
      void fetch(`/api/chats/${chatId}/voice-turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: turn.role === "user" ? "USER" : "ASSISTANT", content: turn.text }),
      }).catch(() => {});
    },
    [chatId]
  );

  const submitVoiceBrief = useCallback(
    async (brief: ProjectBrief) => {
      if (streaming) return null; // a build is already running in this chat
      try {
        const res = await fetch(`/api/chats/${chatId}/voice-brief`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(brief),
        });
        if (!res.ok) return null;
        // Kick off the existing build agent in THIS chat (collapsed "Working…" UI).
        void runStream();
        return chatId;
      } catch {
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatId, streaming]
  );

  const voice = useVoiceAgent({
    context: voiceContext(),
    onTurn: persistTurn,
    onBrief: submitVoiceBrief,
  });

  // After the confirmed build starts, let the agent say goodbye (~3s), end
  // the session, then pull the brief + build into the visible history.
  useEffect(() => {
    if (!voice.building) return;
    const t = setTimeout(() => voice.end(), 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.building]);

  useEffect(() => {
    if (voice.state === "ended" && voice.building) {
      setVoiceOpen(false);
      void syncMessages();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.state, voice.building]);

  // Arriving from the "New Chat" page mic button (?voice=1): open the voice
  // session once, then strip the query param so a refresh doesn't restart it.
  useEffect(() => {
    if (!autoStartVoice) return;
    setVoiceOpen(true);
    void voice.start();
    router.replace(`/chat/${chatId}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Ensures the auto-run for an unanswered first message happens only once.
  const autoRanRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText, toolEvents]);

  // Elapsed seconds while the agent is working (shown as "Working · 8s").
  useEffect(() => {
    if (!streaming) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      1000
    );
    return () => clearInterval(timer);
  }, [streaming]);

  // Resume-once: if the page opens with a GENERATING chat whose last message
  // is an unanswered USER message (created via the landing composer, or a
  // previously interrupted generation), run the stream exactly once.
  // Regular sends are triggered by send() itself — never by this effect.
  useEffect(() => {
    if (autoRanRef.current) return;
    autoRanRef.current = true;
    const last = initialMessages[initialMessages.length - 1];
    if (initialStatus === "GENERATING" && last?.role === "USER") {
      void runStream();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runStream() {
    setStreaming(true);
    setStreamText("");
    setToolEvents([]);
    setStatusNote(null);
    setError(null);
    // Split-view shell listens: shows the "Launching Barada" splash.
    window.dispatchEvent(new CustomEvent("barada:build-start"));
    try {
      const res = await fetch(`/api/chats/${chatId}/stream`, { method: "POST" });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Stream failed");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const ev = JSON.parse(payload);
            if (ev.type === "delta") {
              acc += ev.text;
              setStreamText(acc);
            } else if (ev.type === "tool") {
              setStatusNote(null);
              setToolEvents((prev) => [...prev, { name: ev.name, ok: ev.ok, summary: ev.summary }]);
            } else if (ev.type === "status") {
              setStatusNote(ev.text);
            } else if (ev.type === "error") {
              setError(ev.message);
            }
          } catch {
            /* ignore malformed chunk */
          }
        }
      }
      await syncMessages();
      router.refresh(); // update sidebar/recent list
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stream failed");
      await syncMessages();
    } finally {
      setStreaming(false);
      setStreamText("");
      setToolEvents([]);
      window.dispatchEvent(new CustomEvent("barada:build-end"));
    }
  }

  /**
   * Pull the persisted messages from the server into client state.
   * router.refresh() alone is not enough: ChatView's message list is React
   * state (seeded only on mount), so refreshed server props would be dropped.
   */
  async function improvePrompt() {
    if (!input.trim() || improving) return;
    setImproving(true);
    setImproveError(null);
    try {
      const res = await fetch("/api/ai/improve-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input.trim() }),
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

  async function syncMessages() {
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(
        data.messages.map((m: Msg) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          status: m.status,
          toolCalls: m.toolCalls,
        }))
      );
    } catch {
      /* keep current state */
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || streaming) return;
    setInput("");
    const optimistic: Msg = {
      id: `tmp-${Date.now()}`,
      role: "USER",
      content,
      status: "DONE",
    };
    setMessages((m) => [...m, optimistic]);
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Send failed");
      }
      await runStream();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
      setStreaming(false);
    }
  }

  const lastAssistantFailed = messages.at(-1)?.status === "ERROR";

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 thin-scroll">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.length === 0 && !streaming && (
            <div className="pt-24 text-center text-ink-400">
              <p className="text-lg font-medium">What should we build?</p>
            </div>
          )}
          {/* History: AI messages render normally; internal tool steps are
              grouped into one collapsed "Completed · N steps" row. */}
          {messages.flatMap((m) => {
            if (m.role === "TOOL") {
              // Buffered into the surrounding tool group below.
              return [];
            }
            return [(
              <div key={m.id} className={m.role === "USER" ? "flex justify-end" : "group flex justify-start"}>
                <div className="relative max-w-[85%]">
                  <div
                    className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                      m.role === "USER"
                        ? "bg-accent-600 text-white"
                        : m.status === "ERROR"
                          ? "bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300"
                          : "card"
                    }`}
                  >
                    {m.content}
                  </div>
                  {m.role === "ASSISTANT" && m.status !== "ERROR" && <CopyButton text={m.content} />}
                </div>
              </div>
            )];
          })}
          {messages.some((m) => m.role === "TOOL") && (
            <ToolGroup tools={messages.filter((m) => m.role === "TOOL")} />
          )}

          {/* Streaming */}
          {(streaming || streamText) && (
            <div className="flex flex-col gap-2">
              {/* Internal activity — collapsed by default, expandable. */}
              {(toolEvents.length > 0 || statusNote) && (
                <details className="group text-xs text-ink-500 dark:text-ink-400">
                  <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 hover:text-ink-700 dark:hover:text-ink-200">
                    {streaming ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src="/barada-logo.png" alt="" className="logo-think h-4 w-4 rounded object-contain" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-accent-600" />
                    )}
                    {streaming
                      ? `Working${toolEvents.length > 0 ? ` · Step ${toolEvents.length}` : ""} · ${elapsed}s`
                      : "Completed"}
                    <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-1 flex flex-col gap-1 ps-4">
                    {statusNote && <div className="text-ink-400">{statusNote}</div>}
                    {toolEvents.map((t, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {t.ok ? (
                          <CheckCircle2 className="h-3 w-3 shrink-0 text-accent-600" />
                        ) : (
                          <XCircle className="h-3 w-3 shrink-0 text-red-500" />
                        )}
                        <Wrench className="h-3 w-3 shrink-0" />
                        <span className="font-mono">{t.name}</span>
                        <span className="truncate">{t.summary}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              {streamText && (
                <div className="card max-w-[85%] whitespace-pre-wrap px-4 py-2.5 text-sm">{streamText}</div>
              )}
              {streaming && !streamText && toolEvents.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-ink-400">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/barada-logo.png" alt="" className="logo-think h-5 w-5 rounded object-contain" />
                  Working{elapsed > 0 ? ` · ${elapsed}s` : "…"}
                </div>
              )}
            </div>
          )}

          {(error || lastAssistantFailed) && !streaming && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-red-600 dark:text-red-400">{error ?? "Generation failed"}</span>
              <button onClick={runStream} className="btn-ghost text-xs">Retry</button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-ink-200 p-4 dark:border-ink-800">
        {voiceOpen && (
          <div className="card mx-auto mb-3 max-w-3xl p-4 text-start">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-accent-600">
                {voice.state === "thinking" || voice.state === "speaking" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/barada-logo.png" alt="" className="logo-think h-4 w-4 rounded object-contain" />
                ) : (
                  <AudioLines
                    className={`h-4 w-4 ${voice.state === "listening" ? "animate-pulse" : ""}`}
                  />
                )}
                {voiceStateLabel(voice.state, voice.building)}
              </p>
              <div className="flex gap-2">
                {(voice.state === "listening" ||
                  voice.state === "thinking" ||
                  voice.state === "speaking" ||
                  voice.state === "connecting") && (
                  <button onClick={voice.end} className="btn-ghost flex items-center gap-1 text-xs">
                    <PhoneOff className="h-3.5 w-3.5" /> End
                  </button>
                )}
                {(voice.state === "ended" || voice.state === "error") && (
                  <button onClick={() => setVoiceOpen(false)} className="btn-ghost text-xs">
                    Close
                  </button>
                )}
              </div>
            </div>
            {voice.error && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{voice.error}</p>
            )}
            {voice.turns.length > 0 && (
              <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">
                {voice.turns.map((t, i) => (
                  <p
                    key={i}
                    className={`text-sm ${
                      t.role === "user"
                        ? "text-ink-700 dark:text-ink-200"
                        : "text-accent-700 dark:text-accent-400"
                    }`}
                  >
                    <span className="font-medium">{t.role === "user" ? "You: " : "Barada: "}</span>
                    {t.text}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
        {improved && (
          <div className="card mx-auto mb-3 max-w-3xl p-4 text-start">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-accent-600">
              <Sparkles className="h-3.5 w-3.5" /> Improved prompt — review before sending
            </p>
            <p className="whitespace-pre-wrap text-sm text-ink-700 dark:text-ink-200">{improved}</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  setInput(improved);
                  setImproved(null);
                }}
                className="btn-primary text-xs"
              >
                Use improved prompt
              </button>
              <button onClick={() => setImproved(null)} className="btn-ghost text-xs">Discard</button>
            </div>
          </div>
        )}
        <SponsoredCard />
        <form onSubmit={send} className="glass mx-auto flex max-w-3xl items-end gap-2 rounded-2xl p-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(e);
              }
            }}
            rows={1}
            placeholder="Ask Barada to build or change something…"
            className="max-h-40 flex-1 resize-none bg-transparent p-2 text-sm outline-none placeholder:text-ink-400"
            disabled={streaming}
          />
          <button
            type="button"
            onClick={improvePrompt}
            disabled={improving || streaming || !input.trim()}
            className="btn-ghost shrink-0"
            title="Improve prompt with AI"
          >
            <Sparkles className={`h-4 w-4 ${improving ? "animate-pulse text-accent-600" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              setVoiceOpen(true);
              void voice.start();
            }}
            disabled={voiceOpen || streaming}
            className="btn-ghost shrink-0"
            title="Talk to Barada"
            aria-label="Start voice conversation"
          >
            <Mic className={`h-4 w-4 ${voiceOpen ? "animate-pulse text-accent-600" : ""}`} />
          </button>
          <button type="submit" disabled={streaming || !input.trim()} className="btn-primary shrink-0" aria-label="Send">
            <Send className="h-4 w-4" />
          </button>
        </form>
        {improveError && (
          <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-red-600 dark:text-red-400">{improveError}</p>
        )}
        {projectId && (
          <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-ink-400">
            Project linked: <span className="font-mono">{projectId}</span>
          </p>
        )}
      </div>
    </div>
  );
}

// ── Voice session label ─────────────────────────────────────────────────

function voiceStateLabel(state: VoiceState, building: boolean): string {
  if (building) return "Building your project…";
  switch (state) {
    case "connecting":
      return "Connecting…";
    case "listening":
      return "Listening…";
    case "thinking":
      return "Thinking…";
    case "speaking":
      return "Speaking…";
    case "ended":
      return "Ready";
    case "error":
      return "Try again";
    default:
      return "Talk to Barada";
  }
}

// ── Copy button for AI messages ─────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="absolute -top-2 end-2 flex items-center gap-1 rounded-full border border-ink-200 bg-white px-2 py-0.5 text-[10px] text-ink-500 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:text-ink-800 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 dark:hover:text-ink-100"
      aria-label="Copy message"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-accent-600" /> Copied
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" /> Copy
        </>
      )}
    </button>
  );
}

// ── Collapsed internal-activity display ─────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  create_project: "Project created",
  inspect_project: "Project inspected",
  list_files: "Files listed",
  read_file: "File read",
  write_file: "File written",
  edit_file: "File updated",
  delete_file: "File deleted",
  rename_file: "File renamed",
  search_code: "Code searched",
};

/**
 * Collapsed-by-default group for persisted internal tool steps.
 * The user sees "Completed · N steps"; details only on click.
 */
function ToolGroup({ tools }: { tools: Msg[] }) {
  const hasError = tools.some((t) => String(t.content).startsWith("ERROR"));
  return (
    <details className="group text-xs text-ink-400">
      <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 hover:text-ink-600 dark:hover:text-ink-200">
        {hasError ? (
          <XCircle className="h-3.5 w-3.5 text-red-500" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 text-accent-600" />
        )}
        {hasError ? "Completed with errors" : "Completed"} · {tools.length} step{tools.length > 1 ? "s" : ""}
        <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-1 flex flex-col gap-1 ps-4">
        {tools.map((t) => {
          const meta = t.toolCalls as { name?: string } | null;
          const label = TOOL_LABELS[meta?.name ?? ""] ?? "Step";
          const content = String(t.content);
          const isErr = content.startsWith("ERROR");
          return (
            <div key={t.id} className="flex items-center gap-2">
              {isErr ? (
                <XCircle className="h-3 w-3 shrink-0 text-red-500" />
              ) : (
                <CheckCircle2 className="h-3 w-3 shrink-0 text-accent-600" />
              )}
              <span>{label}</span>
              {isErr && <span className="truncate text-red-500">{content.slice(6, 120)}</span>}
            </div>
          );
        })}
      </div>
    </details>
  );
}
