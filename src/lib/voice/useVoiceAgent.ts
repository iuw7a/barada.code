"use client";

// useVoiceAgent — browser client for the AssemblyAI Voice Agent API (managed
// speech-in / speech-out). One WebSocket, per-session inline configuration.
//
// Flow: POST /api/voice/token (single-use token) → wss://agents.assemblyai.com
// /v1/ws?token=… → session.update (system prompt + tool) → mic PCM16 24 kHz in
// → reply.audio out. The `submit_project_brief` function tool fires back into
// the app (authenticated by the user's session cookie) and starts a build in
// the CURRENT chat via the existing agent + stream.
//
// States: idle → connecting → listening ⇄ thinking → speaking → … → ended.
// Audio is never recorded or stored — it streams through memory only.

import { useCallback, useEffect, useRef, useState } from "react";

const WS_BASE = "wss://agents.assemblyai.com/v1/ws";

export const BRIEF_TOOL = {
  type: "function",
  name: "submit_project_brief",
  description:
    "Start building the project the user just confirmed. " +
    "IMPORTANT: before calling this you must FIRST read back a short summary (type, name, style, colors, features) and ask the user whether to start building. " +
    "Call this ONLY after the user explicitly confirms in this session (yes / sure / نعم / أيوه / ja / sí…). " +
    "If the user corrects anything, update your summary and confirm again — never call this after a correction without re-confirming.",
  parameters: {
    type: "object",
    properties: {
      site_type: {
        type: "string",
        description: "What to build, e.g. coffee shop website, SaaS dashboard, personal portfolio",
        examples: ["coffee shop website", "personal portfolio", "e-commerce store"],
      },
      name: { type: "string", description: "Name of the site/app/project, if the user gave one" },
      style: { type: "string", description: "Visual style, e.g. modern minimal, playful" },
      colors: { type: "string", description: "Color preferences, e.g. dark green and cream" },
      pages: {
        type: "array",
        items: { type: "string" },
        description: "Pages or sections, e.g. Home, Menu, About, Contact",
      },
      features: {
        type: "array",
        items: { type: "string" },
        description: "Key features, e.g. online ordering, blog, contact form",
      },
      language: { type: "string", description: "ISO code of the language the website content should be in, e.g. en, ar" },
      notes: { type: "string", description: "Any other requirements mentioned during the conversation" },
    },
    required: ["site_type"],
  },
} as const;

export function buildVoiceSystemPrompt(context: string | null): string {
  const ctx = context
    ? `\n\nPREVIOUS CONVERSATION IN THIS CHAT (for context — the user may refer back to it with short phrases like "make it green"):\n${context}\nContinue this conversation naturally; do not ask again for details the user already gave.`
    : "";
  return (
    "You are Barada, a friendly voice assistant that helps people build websites and apps " +
    "inside an existing chat conversation. Your job is to collect a clear project brief through a short, natural dialogue." +
    ctx +
    "\n\nRULES:\n" +
    "- Keep every reply to one or two short spoken sentences.\n" +
    "- Ask ONE question at a time.\n" +
    "- Always reply in the same language the user is speaking (Arabic, English, German, Spanish or French).\n" +
    "- Find out: what to build, project name, visual style and colors, pages or sections, and key features. Never invent details the user did not say.\n" +
    "- When you have enough to build: read back a SHORT summary (project, type, style, colors, features) and ask whether to start building.\n" +
    "- ONLY after the user clearly confirms, call submit_project_brief with everything collected.\n" +
    "- After the build starts, say a one-sentence goodbye.\n" +
    "- Never mention JSON, tools, internal systems or technical details."
  );
}

export type VoiceState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "ended"
  | "error";

export type VoiceTurn = { role: "user" | "agent"; text: string };

export type ProjectBrief = {
  siteType: string;
  name?: string;
  style?: string;
  colors?: string;
  pages?: string[];
  features?: string[];
  language?: string;
  notes?: string;
};

/** Stable machine code; the UI maps it to a friendly localized message. */
export type VoiceErrorCode =
  | "mic-permission"
  | "mic-unavailable"
  | "network"
  | "busy"
  | "provider"
  | "unknown";

type AnyRec = Record<string, unknown>;

export type VoiceAgentOptions = {
  /** Chat-history seed so "make it green" refers to the existing conversation. */
  context?: string | null;
  /** Fired for each finalized turn so the app can persist it into the chat. */
  onTurn?: (turn: VoiceTurn) => void;
  /** Executes the confirmed brief; resolves to a chat id or null. */
  onBrief: (brief: ProjectBrief) => Promise<string | null>;
};

export function useVoiceAgent(opts: VoiceAgentOptions) {
  const [state, setState] = useState<VoiceState>("idle");
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<VoiceErrorCode | null>(null);
  const [building, setBuilding] = useState(false);

  const optsRef = useRef(opts);
  optsRef.current = opts;

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readyRef = useRef(false);
  const playbackTimeRef = useRef(0);
  const pendingToolRef = useRef<{ callId: string } | null>(null);
  const lastToolArgsRef = useRef<AnyRec | null>(null);
  const buildingRef = useRef(false);
  const endedRef = useRef(false);

  const fail = useCallback((code: VoiceErrorCode, friendly: string, detail?: unknown) => {
    if (detail) console.error(`[voice] ${code}:`, detail); // technical details → logs only
    setError(friendly);
    setErrorCode(code);
    setState("error");
    cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = useCallback(() => {
    readyRef.current = false;
    wsRef.current?.close();
    wsRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  const finish = useCallback(() => {
    cleanup();
    setState((s) => (s === "error" ? s : "ended"));
  }, [cleanup]);

  const end = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      endedRef.current = true;
      // session.end avoids the 30s billable resume grace window.
      ws.send(JSON.stringify({ type: "session.end" }));
      // Safety net if session.ended never arrives.
      setTimeout(() => {
        cleanup();
        setState((s) => (s === "error" ? s : "ended"));
      }, 1500);
    } else {
      finish();
    }
  }, [cleanup, finish]);

  // Synchronous session.end on tab close/navigation.
  useEffect(() => {
    const onPageHide = () => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "session.end" }));
      }
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  // Full teardown on unmount.
  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    if (wsRef.current) return;
    setState("connecting");
    setError(null);
    setErrorCode(null);
    setTurns([]);
    setBuilding(false);
    endedRef.current = false;

    try {
      const tokenRes = await fetch("/api/voice/token", { method: "POST" });
      if (!tokenRes.ok) {
        const body = (await tokenRes.json().catch(() => null)) as { error?: string } | null;
        fail("provider", body?.error || "Voice is temporarily unavailable. Please try again.");
        return;
      }
      const { token }: { token: string } = await tokenRes.json();

      // 24 kHz context avoids manual resampling in Chromium/Firefox; Safari
      // ignores it and the worklet resamples instead.
      const audioCtx = new AudioContext({ sampleRate: 24000 });
      await audioCtx.resume(); // user-gesture gated
      await audioCtx.audioWorklet.addModule("/voice/pcm-worklet.js");

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: false },
        });
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        audioCtx.close().catch(() => {});
        if (name === "NotAllowedError" || name === "SecurityError") {
          fail("mic-permission", "Microphone access was blocked. Allow the microphone in your browser and try again.", err);
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          fail("mic-unavailable", "No microphone was found. Connect one and try again.", err);
        } else {
          fail("unknown", "Could not start the microphone. Please try again.", err);
        }
        return;
      }
      const source = audioCtx.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(audioCtx, "barada-pcm-capture", {
        processorOptions: { inputSampleRate: audioCtx.sampleRate, targetSampleRate: 24000 },
      });
      source.connect(worklet);
      // (worklet is NOT connected to destination — no mic feedback.)

      const wsUrl = new URL(WS_BASE);
      wsUrl.searchParams.set("token", token);
      const ws = new WebSocket(wsUrl);

      wsRef.current = ws;
      audioCtxRef.current = audioCtx;
      streamRef.current = stream;

      worklet.port.onmessage = (e: MessageEvent) => {
        if (readyRef.current && ws.readyState === WebSocket.OPEN) {
          const b64 = arrayBufferToBase64(e.data as ArrayBuffer);
          ws.send(JSON.stringify({ type: "input.audio", audio: b64 }));
        }
      };

      ws.addEventListener("open", () => {
        // session.update goes out immediately on connect (do not wait for ready).
        ws.send(
          JSON.stringify({
            type: "session.update",
            session: {
              system_prompt: buildVoiceSystemPrompt(optsRef.current.context ?? null),
              greeting: "Hi! What do you want to build today?",
              input: {
                format: { encoding: "audio/pcm" },
                turn_detection: { interrupt_response: true },
              },
              output: {
                voice: "anna",
                format: { encoding: "audio/pcm" },
              },
              tools: [BRIEF_TOOL],
            },
          })
        );
      });

      let connectFailed = false;
      ws.addEventListener("error", () => {
        if (!readyRef.current) {
          connectFailed = true;
          fail("network", "Could not reach the voice service. Check your connection and try again.");
        }
      });

      ws.addEventListener("message", (event) => {
        let msg: AnyRec;
        try {
          msg = JSON.parse(event.data as string) as AnyRec;
        } catch {
          return;
        }
        const type = msg.type as string;

        if (type === "session.ready") {
          readyRef.current = true;
          playbackTimeRef.current = audioCtx.currentTime;
          setState("listening");
        } else if (type === "input.speech.started") {
          if (!buildingRef.current) setState("listening");
        } else if (type === "input.speech.stopped") {
          if (!buildingRef.current) setState("thinking");
        } else if (type === "reply.started") {
          setState("speaking");
        } else if (type === "reply.audio") {
          schedulePlayback(audioCtx, msg.data as string);
        } else if (type === "reply.done") {
          if (msg.status === "interrupted") {
            // Barge-in: drop scheduled audio so stale speech doesn't play.
            playbackTimeRef.current = audioCtx.currentTime;
          }
          if (!buildingRef.current) setState("listening");
          // Flush pending function-tool results only after reply.done
          // (per protocol: accumulate, then send after reply.done).
          const pending = pendingToolRef.current;
          if (pending) {
            pendingToolRef.current = null;
            void handleBrief(pending.callId, ws);
          }
        } else if (type === "transcript.user") {
          pushTurn("user", String(msg.text ?? ""));
        } else if (type === "transcript.agent") {
          pushTurn("agent", String(msg.text ?? ""));
        } else if (type === "tool.call") {
          pendingToolRef.current = { callId: String(msg.call_id ?? "") };
          lastToolArgsRef.current = (msg.arguments ?? {}) as AnyRec;
        } else if (type === "session.ended") {
          finish();
        } else if (type === "session.error" || type === "error") {
          const message = String(msg.message ?? msg.code ?? "");
          console.error("[voice] session error:", message);
          fail("provider", "The voice service hit a problem. Please try again in a moment.", message);
        }
      });

      ws.addEventListener("close", () => {
        if (!endedRef.current && !connectFailed) {
          cleanup();
          setState((s) => (s === "error" ? s : "ended"));
        }
      });
    } catch (err) {
      fail("unknown", "Voice could not start. Please try again.", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanup, fail, finish]);

  async function handleBrief(callId: string, ws: WebSocket) {
    const args = (lastToolArgsRef.current ?? {}) as AnyRec;
    let chatId: string | null = null;
    let result = "Brief received.";
    try {
      chatId = await optsRef.current.onBrief({
        siteType: String(args.site_type ?? "website"),
        name: optStr(args.name),
        style: optStr(args.style),
        colors: optStr(args.colors),
        pages: optStrArray(args.pages),
        features: optStrArray(args.features),
        language: optStr(args.language),
        notes: optStr(args.notes),
      });
      if (chatId) {
        result = "Build started. Say a one-sentence goodbye — the project is now being built in the chat.";
        setBuilding(true);
        buildingRef.current = true;
      } else {
        result =
          "The build could not start right now. Apologize briefly and suggest trying again or using text chat.";
      }
    } catch {
      result = "The build could not start right now. Apologize briefly.";
    }
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "tool.result", call_id: callId, result }));
    }
  }

  function pushTurn(role: "user" | "agent", text: string) {
    if (!text) return;
    optsRef.current.onTurn?.({ role, text });
    setTurns((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role) {
        const next = prev.slice(0, -1);
        next.push({ role, text });
        return next;
      }
      return [...prev, { role, text }];
    });
  }

  function schedulePlayback(ctx: AudioContext, base64: string) {
    const raw = base64ToBytes(base64);
    if (raw.length === 0) return;
    const pcm16 = new Int16Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 2));
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;
    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    // Monotonic playback head: chunks chain seamlessly, OS drains at 24 kHz.
    const now = ctx.currentTime;
    playbackTimeRef.current = Math.max(playbackTimeRef.current, now);
    src.start(playbackTimeRef.current);
    playbackTimeRef.current += buffer.duration;
  }

  return { state, turns, error, errorCode, building, start, end };
}

// ── helpers ────────────────────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function optStr(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s || undefined;
}

function optStrArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const arr = v.map((x) => String(x).trim()).filter(Boolean);
  return arr.length ? arr : undefined;
}
