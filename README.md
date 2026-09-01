# Barada Code

AI-powered software development platform: describe what you want to build, and Barada —
the built-in AI engineer — asks smart follow-ups, creates a real project (files, structure,
history), and iterates with you through chat.

## Stack

- **Next.js 14 (App Router) + TypeScript** — UI + API in one modular monolith
- **PostgreSQL + Prisma** — all state (users, workspaces, projects, files, chats, AI jobs)
- **Tailwind CSS** — Barada Code design system (ink neutrals + emerald accent, dark mode)
- **CodeMirror 6** — project code editor
- **Zod** — API input validation
- **Vitest** — unit tests

## Setup

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env.local
# edit .env.local: DATABASE_URL, AUTH_SECRET, AI_API_KEY, INTEGRATION_ENC_KEY

# 3. Create database schema (requires a running PostgreSQL)
npm run db:migrate

# 4. Run
npm run dev          # http://localhost:3000
```

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | production build |
| `npm run typecheck` | TypeScript strict check |
| `npm test` | unit tests (Vitest) |
| `npm run db:migrate` | apply migrations (dev) |
| `npm run db:deploy` | apply migrations (prod) |
| `npm run db:studio` | Prisma Studio data browser |

## Environment variables

See `.env.example`. Required:

- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_SECRET` — session signing secret (`openssl rand -base64 48`)
- `AI_API_KEY` — AI provider key (server-side only, never exposed to the browser)
- `INTEGRATION_ENC_KEY` — AES-256-GCM key for integration credentials

Optional: `AI_BASE_URL`, `AI_MODEL`, `STORAGE_ROOT`.

## Architecture

```
src/
  app/                 # Next.js App Router
    api/               # REST endpoints (auth, chats, projects, files, settings…)
    chat/              # chat UI + [id] conversation view
    projects/          # project workspace: explorer + CodeMirror + preview
    settings/          # general/profile/notifications/appearance/security/ai/billing
    library/ integrations/ about/ story/ app/ help/
  components/          # AppShell (sidebar), ChatShell
  lib/
    ai/
      provider.ts      # AI provider abstraction (OpenAI-compatible, streaming)
      tools.ts         # agent tool registry (file ops, search, inspect)
      agent.ts         # agent loop: tool-calling iterations + streaming events
    auth/              # scrypt passwords, DB-backed sessions, route guards
    projects/pathSafe.ts  # path traversal protection (all file ops pass through it)
    crypto/secretBox.ts   # AES-256-GCM for integration credentials
    i18n/              # 5 languages (en/ar/de/es/fr), RTL support, cookie-persisted
    permissions.ts     # workspace roles: OWNER > ADMIN > MEMBER > VIEWER
    rateLimit.ts       # sliding-window limiter (swap for Redis at scale)
  middleware.ts        # edge guard for private routes
prisma/schema.prisma   # full data model
tests/                 # unit tests (path safety, crypto, roles)
```

### AI architecture

`runAgent` (lib/ai/agent.ts) drives one user turn:

1. Loads chat history → builds provider messages
2. Streams the model response (SSE to the client)
3. When the model requests tools, executes them server-side against the
   DB-backed project file system (path-safe, permission-checked) and loops
   (max 12 iterations)
4. Persists assistant/tool messages, updates chat status, records an `AIJob`
   (PENDING → RUNNING → COMPLETED/FAILED) with timestamps and error info

The preview renders project HTML in a sandboxed iframe (`sandbox="allow-scripts"`,
srcdoc) — no arbitrary generated code executes on the host. Isolated build/run
containers are the Phase 6 upgrade path.

### Security

- Session cookies: httpOnly, SameSite=Lax, Secure in production; tokens stored
  hashed (SHA-256) in the DB
- Passwords: scrypt (N=16384) with per-user salt, timing-safe compare
- Every API route: `requireUser` + Zod validation + rate limiting
- Project/workspace access: role checks (`requireWorkspaceRole`, `requireProjectAccess`)
- File operations: `normalizePath` rejects traversal, absolute paths, control
  characters, Windows reserved names
- Integration credentials: AES-256-GCM encrypted at rest, never returned to the client
- Password reset: hashed single-use tokens, sessions invalidated on change
