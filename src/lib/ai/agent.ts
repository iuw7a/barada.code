import { prisma } from "@/lib/prisma";
import { getProvider, getModel, type ChatMessage } from "./provider";
import { allToolSpecs, executeTool, CREATE_PROJECT_SPEC } from "./tools";
import { scaffoldProject, pickScaffold, type ScaffoldKind } from "@/lib/sandbox/scaffolds";
import { verifyProject } from "@/lib/sandbox/verify";
import { createCheckpoint, pruneCheckpoints } from "@/lib/sandbox/checkpoints";
import { hydrateWorkspace } from "@/lib/sandbox/sync";
import { z } from "zod";
import { randomUUID } from "node:crypto";

const MAX_TOOL_ITERATIONS = Number(process.env.AGENT_MAX_ITERATIONS ?? 120);
const MAX_REPAIR_CYCLES = 2;
const CHARS_PER_ITER_BUDGET = 700_000;

const SYSTEM_PROMPT = `You are Barada, a senior full-stack software engineer working inside Barada Code.
You build REAL, RUNNING applications — not mockups, not static previews.

EXECUTION ENVIRONMENT
Every project has a real sandbox: a Linux workspace with Node.js, npm, git and network
access. You run commands, install packages, start servers and probe them over HTTP.
Static HTML sites, React+Vite SPAs, Express APIs, fullstack Node apps and Python
FastAPI services are all fully supported.

THE GOLDEN RULE: AN APP IS DONE WHEN IT RUNS.
Never claim completion just because files were written. A build that hasn't been
installed, started and verified is NOT done.

HOW YOU WORK — for every build/change request:
1. INSPECT — if a project exists, run list_files and read the relevant files before
   changing anything. Never blindly overwrite existing code.
2. PLAN — for multi-step tasks, briefly state the plan first (pages, API, data model).
3. BUILD — write complete, production-quality files. Every href/src you reference
   must point to a file you actually wrote. Use professional structure:
   package.json, README.md, .env.example, clean directories, real components.
4. RUN — start the app: start_process with the dev/start command (pass the port),
   or run_command for one-shot scripts.
5. VERIFY — run verify_site for static QA. For server apps, probe the running
   server (run_command with curl) and READ the response — confirm your routes work.
6. DEBUG — when anything fails: read the error output, identify the root cause,
   fix the code, and run again. Repeat until green. Never ignore errors.
7. FINISH — summarize what was built, how to run it, and any limitations.

FRAMEWORK CHOICE:
- "website for X" / content site → clean multi-page static site (or React SPA if rich)
- "dashboard / SaaS / app with login" → React + Vite frontend + Express API + data
  layer (JSON-file store for demos, or Prisma+SQLite patterns for persistence)
- "API / backend" → Express (Node) or FastAPI (Python)
- simple static page request → static site is fine
Scaffold the project type via create_project — it creates a professional starting
structure you then customize.

DATABASE: for real persistence, use the patterns you scaffold (JSON-file store via
the provided API, or generate SQL schema files + Prisma schema). Never fake a
database with hard-coded arrays when the user asked for real data.

RESEARCH: use web_search / docs_search when the task involves current best
practices, specific library APIs, or design references; use image_search when the
user wants real imagery. Don't research trivial things.

CHECKPOINTS: before large refactors or risky deletions, create_checkpoint so you
can restore_checkpoint if the change breaks the build.

SECRETS: never hard-code API keys or passwords. Put them in .env.example with
placeholder values and tell the user which env vars are required.

RULES:
- If the conversation has no project yet and the user asks to build, FIRST call create_project.
- When the user asks to build or change something, USE the tools. Never just print code.
- If the request is clear, do not ask questions — build. Ask ONE short question only
  when a critical detail (brand name, core behavior) is truly missing.
- Keep answers concise. Explain briefly what you're doing as you go.
- Respond in the user's language.`;

export type AgentEvent =
  | { type: "status"; text: string }
  | { type: "plan"; tasks: Array<{ title: string; status: string }> }
  | { type: "delta"; text: string }
  | { type: "tool"; name: string; ok: boolean; summary: string }
  | { type: "verify"; ok: boolean; summary: string }
  | { type: "done"; content: string }
  | { type: "error"; message: string };

/**
 * Runs the agent for one user turn and streams events to the caller.
 * Persists: final ASSISTANT message (content + toolCalls metadata),
 * TOOL messages, chat status transitions, an AIJob record, token usage,
 * and runs the enforced verification gate before completing.
 */
export async function* runAgent(opts: {
  chatId: string;
  userId: string;
  projectId?: string | null;
  signal?: AbortSignal;
}): AsyncGenerator<AgentEvent> {
  const { chatId, userId } = opts;
  const provider = getProvider();
  const model = getModel();
  const agentRun = randomUUID();

  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!chat) {
    yield { type: "error", message: "chat not found" };
    return;
  }

  let projectId: string | null = opts.projectId ?? chat.projectId ?? null;
  let scaffoldKind: ScaffoldKind | null = null;
  let verifyOk = false;
  let verifySummary = "";

  const job = await prisma.aIJob.create({
    data: { userId, chatId, projectId, model, status: "RUNNING", startedAt: new Date() },
  });
  await prisma.chat.update({ where: { id: chatId }, data: { status: "GENERATING", model } });

  // Usage metering accumulators (written to AIJob at the end).
  let promptTokens = 0;
  let completionTokens = 0;
  let toolCalls = 0;

  try {
    const history: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...chat.messages
        .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
        .slice(-24)
        .map((m) => ({ role: m.role.toLowerCase() as "user" | "assistant", content: m.content })),
    ];

    let finalContent = "";
    let iterations = 0;
    let usedChars = 0;

    while (iterations < MAX_TOOL_ITERATIONS && usedChars < CHARS_PER_ITER_BUDGET) {
      iterations++;
      let iterationText = "";
      let requestedTools: Array<{ id: string; name: string; arguments: string }> | null = null;
      const usage: { prompt_tokens?: number; completion_tokens?: number } = {};

      // Transient provider errors (5xx / 429 / connection drops) are retried
      // with backoff — but only before any content streamed in this iteration,
      // so a retry can never duplicate already-shown text.
      const MAX_ATTEMPTS = 3;
      for (let attempt = 1; ; attempt++) {
        try {
          const stream = provider.streamChat({
            model,
            messages: trimToolHistory(compactHistory(history)),
            tools: allToolSpecs(),
            signal: opts.signal,
            onUsage: (u) => { Object.assign(usage, u); },
          });

          for await (const ev of stream) {
            if (ev.type === "delta") {
              iterationText += ev.text;
              yield { type: "delta", text: ev.text };
            } else if (ev.type === "tool_calls") {
              requestedTools = ev.toolCalls;
            }
          }
          break;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const transient = /provider (stream )?error (429|5\d\d)|ECONNRESET|fetch failed|socket|timeout/i.test(msg);
          if (attempt < MAX_ATTEMPTS && !iterationText && !requestedTools && transient) {
            yield { type: "status", text: `Provider hiccup (${attempt}/${MAX_ATTEMPTS - 1}) — retrying…` };
            await new Promise((r) => setTimeout(r, 1500 * attempt));
            continue;
          }
          throw err;
        }
      }

      if (usage.prompt_tokens || usage.completion_tokens) {
        promptTokens += usage.prompt_tokens ?? 0;
        completionTokens += usage.completion_tokens ?? 0;
      }
      usedChars += iterationText.length;

      if (!requestedTools || requestedTools.length === 0) {
        // Reasoning models sometimes emit only internal analysis and stop —
        // an empty response is not a final answer. Retry within the loop.
        if (!iterationText && iterations < MAX_TOOL_ITERATIONS) {
          yield { type: "status", text: "Empty response — retrying…" };
          continue;
        }
        finalContent = iterationText;
        break;
      }

      // Model wants tools: persist the assistant turn + execute each tool.
      finalContent = iterationText; // text before tool calls (explanations)
      if (iterationText) {
        await prisma.message.create({
          data: { chatId, userId, role: "ASSISTANT", content: iterationText, status: "DONE" },
        });
      }

      history.push({
        role: "assistant",
        content: iterationText || ("" as unknown as string),
        tool_calls: requestedTools.map((t) => ({
          id: t.id,
          type: "function",
          function: { name: t.name, arguments: t.arguments },
        })),
      } as ChatMessage);

      for (const tc of requestedTools) {
        toolCalls++;
        yield { type: "status", text: `Running ${tc.name}…` };

        let result;
        if (tc.name === "create_project") {
          result = await handleCreateProject(
            safeParseArgs(tc.arguments),
            { userId, workspaceId: chat.workspaceId, currentProjectId: projectId },
            {
              onProject: (id, kind) => {
                projectId = id;
                scaffoldKind = kind;
              },
            }
          );
          if (result.ok) {
            const created = result as { projectId: string };
            projectId = created.projectId;
            await prisma.chat.update({ where: { id: chatId }, data: { projectId } });
            await prisma.aIJob.update({ where: { id: job.id }, data: { projectId } });
          }
        } else if (!projectId) {
          result = { ok: false as const, error: "No project yet — call create_project first." };
        } else {
          result = await executeTool(tc.name, safeParseArgs(tc.arguments), { projectId, agentRun });
        }
        yield {
          type: "tool",
          name: tc.name,
          ok: result.ok,
          summary: truncate(result.ok ? result.output : result.error, 200),
        };
        await prisma.message.create({
          data: {
            chatId,
            userId,
            role: "TOOL",
            content: result.ok ? result.output : `ERROR: ${result.error}`,
            status: "DONE",
            toolCalls: { name: tc.name, arguments: tc.arguments, ok: result.ok },
          },
        });
        history.push({
          role: "tool",
          tool_call_id: tc.id,
          name: tc.name,
          content: result.ok ? truncate(result.output, 8000) : `ERROR: ${truncate(result.error, 2000)}`,
        });
      }
    }

    // ── ENFORCED VERIFICATION GATE ─────────────────────────────────────────
    // The agent may not declare success until the project passes the pipeline.
    // If verification fails, the report is fed back to the model for repair.
    if (projectId) {
      yield { type: "status", text: "Verifying build (install → build → boot → probe)…" };
      let report = await verifyProject(projectId);
      verifyOk = report.ok;
      verifySummary = report.summary;

      let repairCycle = 0;
      while (!report.ok && repairCycle < MAX_REPAIR_CYCLES) {
        repairCycle++;
        yield { type: "verify", ok: false, summary: truncate(report.summary, 400) };
        yield { type: "status", text: `Verification failed — repair cycle ${repairCycle}/${MAX_REPAIR_CYCLES}…` };

        // Ask the model to fix the failures, with the full report in context.
        history.push({
          role: "user",
          content: `AUTOMATED VERIFICATION FAILED (attempt ${repairCycle}). Fix every error and re-verify. Report:\n${report.summary.slice(0, 6000)}\n\nFix the code now with your tools, then run the failing checks again.`,
        });
        let repaired = false;
        let iter = 0;
        while (iter < 24) {
          iter++;
          let text = "";
          let tools: Array<{ id: string; name: string; arguments: string }> | null = null;
          const usage: { prompt_tokens?: number; completion_tokens?: number } = {};
          const stream = provider.streamChat({
            model,
            messages: trimToolHistory(compactHistory(history)),
            tools: allToolSpecs(),
            signal: opts.signal,
            onUsage: (u) => { Object.assign(usage, u); },
          });
          for await (const ev of stream) {
            if (ev.type === "delta") text += ev.text;
            else if (ev.type === "tool_calls") tools = ev.toolCalls;
          }
          if (usage.prompt_tokens || usage.completion_tokens) {
            promptTokens += usage.prompt_tokens ?? 0;
            completionTokens += usage.completion_tokens ?? 0;
          }
          if (text) {
            yield { type: "delta", text };
            finalContent = text;
            history.push({ role: "assistant", content: text } as ChatMessage);
          }
          if (!tools || tools.length === 0) break;
          history.push({
            role: "assistant",
            content: text || "",
            tool_calls: tools.map((t) => ({ id: t.id, type: "function", function: { name: t.name, arguments: t.arguments } })),
          } as ChatMessage);
          for (const tc of tools) {
            toolCalls++;
            yield { type: "status", text: `Repair: ${tc.name}…` };
            let result;
            if (tc.name === "create_project") {
              result = { ok: true as const, output: "project already exists" };
            } else if (projectId) {
              result = await executeTool(tc.name, safeParseArgs(tc.arguments), { projectId, agentRun });
            } else {
              result = { ok: false as const, error: "no project" };
            }
            yield {
              type: "tool",
              name: tc.name,
              ok: result.ok,
              summary: truncate(result.ok ? result.output : result.error, 200),
            };
            await prisma.message.create({
              data: {
                chatId,
                userId,
                role: "TOOL",
                content: result.ok ? result.output : `ERROR: ${result.error}`,
                status: "DONE",
                toolCalls: { name: tc.name, arguments: tc.arguments, ok: result.ok, repair: repairCycle },
              },
            });
            history.push({
              role: "tool",
              tool_call_id: tc.id,
              name: tc.name,
              content: result.ok ? truncate(result.output, 8000) : `ERROR: ${truncate(result.error, 2000)}`,
            });
          }
          repaired = true;
        }
        if (!repaired) break;
        report = await verifyProject(projectId);
        verifyOk = report.ok;
        verifySummary = report.summary;
      }

      yield { type: "verify", ok: verifyOk, summary: truncate(verifySummary, 400) };
      if (verifyOk) {
        await prisma.project.update({ where: { id: projectId }, data: { status: "ACTIVE" } }).catch(() => {});
      }
      await pruneCheckpoints(projectId).catch(() => {});
    }

    // Final answer must reflect verification truthfully.
    if (projectId && finalContent) {
      const verdict = verifyOk
        ? "✅ Verification passed — install, build and health checks are green."
        : `⚠️ Verification could not fully pass: ${verifySummary || "unknown"}`;
      finalContent = `${finalContent}\n\n${verdict}`;
    }

    if (finalContent) {
      await prisma.message.create({
        data: {
          chatId,
          userId,
          role: "ASSISTANT",
          content: finalContent,
          status: "DONE",
          toolCalls: { iterations, verified: verifyOk },
        },
      });
    }

    await prisma.chat.update({ where: { id: chatId }, data: { status: "IDLE" } });
    await prisma.aIJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        promptTokens,
        completionTokens,
        error: verifyOk ? null : truncate(verifySummary, 500),
      },
    });
    await recordUsage(userId, promptTokens, completionTokens);
    yield { type: "done", content: finalContent };
  } catch (err) {
    const message = err instanceof Error ? err.message : "agent failed";
    console.error("[agent] error:", err);
    await prisma.chat.update({ where: { id: chatId }, data: { status: "ERROR" } });
    await prisma.aIJob.update({
      where: { id: job.id },
      data: { status: "FAILED", error: message.slice(0, 2000), completedAt: new Date(), promptTokens, completionTokens },
    });
    await recordUsage(userId, promptTokens, completionTokens);
    await prisma.message.create({
      data: { chatId, userId, role: "ASSISTANT", content: `⚠️ ${message}`, status: "ERROR" },
    });
    yield { type: "error", message };
  }
}

async function recordUsage(userId: string, promptTokens: number, completionTokens: number) {
  const month = new Date().toISOString().slice(0, 7);
  try {
    await prisma.usage.upsert({
      where: { userId_month: { userId, month } },
      create: { userId, month, aiCalls: 1, aiTokens: promptTokens + completionTokens },
      update: {
        aiCalls: { increment: 1 },
        aiTokens: { increment: promptTokens + completionTokens },
      },
    });
  } catch {
    /* metering is best-effort */
  }
}

function safeParseArgs(raw: string): unknown {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return { __raw: raw };
  }
}

const CreateProjectArgs = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  framework: z.string().max(60).optional(),
  language: z.string().max(60).optional(),
});

async function handleCreateProject(
  args: unknown,
  ctx: { userId: string; workspaceId: string; currentProjectId: string | null },
  hooks: { onProject: (id: string, kind: ScaffoldKind) => void }
): Promise<{ ok: true; output: string; projectId: string } | { ok: false; error: string }> {
  if (ctx.currentProjectId) {
    return { ok: true, output: `Project already exists: ${ctx.currentProjectId}`, projectId: ctx.currentProjectId };
  }
  const parsed = CreateProjectArgs.safeParse(args);
  if (!parsed.success) return { ok: false, error: "name is required (max 120 chars)" };
  const { name, description, framework, language } = parsed.data;

  const kind = pickScaffold({ framework, language, brief: description ?? "" });
  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      description,
      framework: kind,
      language: language ?? (kind === "python-fastapi" ? "python" : kind === "static" ? "html" : "typescript"),
      workspaceId: ctx.workspaceId,
      ownerId: ctx.userId,
    },
  });

  // Scaffold the professional starting structure (DB + sandbox disk).
  const scaffolded = await scaffoldProject(project.id, kind, { name: name.trim(), description }, `scaffold-${project.id}`);
  await hydrateWorkspace(project.id).catch(() => {});

  hooks.onProject(project.id, kind);
  return {
    ok: true,
    output: `Project created: ${project.id} ("${project.name}") with a ${kind} scaffold (${scaffolded.files} files: package.json, README, entry points). Customize it with your tools, then install deps and run it.`,
    projectId: project.id,
  };
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

/**
 * Long builds accumulate many large tool results. Keep the last few verbatim;
 * collapse older ones to a compact placeholder. System, user and assistant
 * turns are always kept.
 */
function trimToolHistory(history: ChatMessage[], keepLast = 8): ChatMessage[] {
  const toolIdx: number[] = [];
  history.forEach((m, i) => {
    if (m.role === "tool") toolIdx.push(i);
  });
  const omit = new Set(toolIdx.slice(0, Math.max(0, toolIdx.length - keepLast)));
  if (omit.size === 0) return history;
  return history.map((m, i) => (omit.has(i) ? { ...m, content: "[older tool result omitted]" } : m));
}

/**
 * Context compaction: when the running history grows past the budget, replace
 * the oldest assistant/tool turns (after the system prompt and first user
 * message) with a single summary marker so the loop can keep going on large
 * builds without exceeding provider limits.
 */
function compactHistory(history: ChatMessage[]): ChatMessage[] {
  let total = history.reduce((n, m) => n + (m.content?.length ?? 0), 0);
  if (total < CHARS_PER_ITER_BUDGET) return history;

  // find the range to collapse: after system (0) + first user (1)
  let i = 2;
  const collapsed: ChatMessage[] = [history[0], history[1]];
  let collapsedCount = 0;
  while (i < history.length - 8 && total > CHARS_PER_ITER_BUDGET * 0.8) {
    total -= (history[i].content?.length ?? 0);
    collapsedCount++;
    i++;
  }
  if (collapsedCount > 0) {
    collapsed.push({
      role: "user",
      content: `[context compacted — ${collapsedCount} earlier turns summarized. The project state lives in the sandbox; re-run list_files/read_file if you need details.]`,
    });
  }
  for (; i < history.length; i++) collapsed.push(history[i]);
  return collapsed;
}
