# Voice Conversation System

Status: **implemented** (AssemblyAI Voice Agent API, managed speech-in / speech-out).
Voice is a front-end on the existing chat: one conversation, one context, one builder.

## Flow

```
Browser (chat page, mic button)
  │  POST /api/voice/token          ← requireUser; single-use token, key server-side
  ▼
wss://agents.assemblyai.com/v1/ws?token=…
  │  session.update: system_prompt (+ chat-history seed) + greeting + tool
  │  ⇄ input.audio (PCM16 24 kHz) / reply.audio — streaming, barge-in supported
  │  ⇄ transcript.user / transcript.agent → live captions + persisted turns
  ▼
tool.call: submit_project_brief — ONLY after the agent reads back a summary
  │                                  and the user explicitly confirms
  ▼
POST /api/chats/[id]/voice-brief    → USER message in THIS chat, status GENERATING
  ▼
existing /stream agent builds the project (collapsed "Working…" UI)
```

## Context (voice ↔ text, one conversation)

- The voice session's system prompt is **seeded with the chat's recent messages**,
  so «خليه أخضر» refers to the project already discussed.
- Every finalized voice turn is persisted via `POST /api/chats/[id]/voice-turns`
  as a normal USER/ASSISTANT message — voice and text share one history.
- The confirmed brief lands in the **same chat** and runs through the same
  existing agent, streaming, and project tools. No separate builder.

## UI states (chat composer mic button)

| State | Label | Indicator |
|---|---|---|
| idle | Talk to Barada | mic button |
| connecting | Connecting… | spinner |
| listening | Listening… | pulsing waves icon |
| thinking | Thinking… | green logo animation |
| speaking | Speaking… | green logo animation |
| building | Building your project… | logo animation, session auto-ends |
| ended | Ready | — |
| error | Try again + friendly message | — |

Technical errors are logged server/console-side only. Friendly messages cover:
mic permission denied, no microphone, network failure, provider outage, unknown.

## Privacy

- Audio is never stored — it streams through memory only.
- Only the transcribed text is persisted (as normal chat messages).
- API keys server-side only (`ASSEMBLYAI_API_KEY`).

## Components

| Component | Purpose |
|---|---|
| `POST /api/voice/token` | Single-use session token (rate-limited, `requireUser`) |
| `POST /api/chats/[id]/voice-turns` | Persist a finalized voice turn (no generation) |
| `POST /api/chats/[id]/voice-brief` | Confirmed brief → USER message + GENERATING |
| `public/voice/pcm-worklet.js` | AudioWorklet: Float32 → PCM16 @24 kHz, Safari-safe |
| `src/lib/voice/useVoiceAgent.ts` | WS lifecycle, states, playback, barge-in, `session.end` |

## Notes / limits

- Mic requires `localhost` (dev) or HTTPS (production).
- TTS voice: `anna`. STT understands Arabic natively (Universal model).
- Account needs included usage/credits on AssemblyAI for voice sessions.
