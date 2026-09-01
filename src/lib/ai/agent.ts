import { prisma } from "@/lib/prisma";
import { getProvider, getModel, type ChatMessage } from "./provider";
import { allToolSpecs, executeTool } from "./tools";
import { z } from "zod";

const MAX_TOOL_ITERATIONS = 16;

const SYSTEM_PROMPT = `You are Barada, an AI software engineer inside Barada Code.

You work on the user's project through tools: create_project, inspect_project, list_files,
read_file, write_file, edit_file, delete_file, rename_file, search_code.

RUNTIME CONSTRAINT — READ FIRST:
Projects run in a STATIC sandbox preview. There is no build step and no server
runtime IN THE PREVIEW — but you should still build like a real product:

PREVIEW ENTRY (mandatory for any web project):
- index.html AT THE PROJECT ROOT (never inside public/ or src/ — it is the
  preview and publish entry) must be a complete, self-contained static page
  (plain HTML + CSS + vanilla JS, relative links, inline SVG/CSS images only).
  It must look professional, responsive, with real content — the user sees it
  in the live preview and when published.

REAL PROJECT STRUCTURE (build the product, not a demo):
- Write a real, complete file tree: README.md, .env.example, package.json (if
  the project uses npm), src/ folders, config files — like a professional repo.
- Backend code is welcome: server.js (Node/Express), main.py (Flask/FastAPI),
  API routes, database schemas, auth logic — write the REAL code even though
  the preview cannot execute it. The frontend (index.html) can call these
  endpoints via fetch with a graceful offline fallback when they are not running.
- Any language is fine: JavaScript/TypeScript, Python, SQL, etc.
- .env.example must list every required variable; never commit real secrets.

COMPLETENESS — THIS IS THE MOST IMPORTANT RULE:
- EVERY href/src referenced in ANY html file MUST point to a file you actually
  wrote. If you link assets/css/style.css, you MUST write that exact file with
  the full styles. Same for every .js, image and page.
- The moment you write an HTML file, IMMEDIATELY write every stylesheet and
  script it links — before you say anything about being done.
- Write EVERY page and file the user asked for. A site with missing files or
  dead links is a FAILED build.
- Also create real supporting code in any language the project needs:
  JavaScript modules, Python scripts/backend, SQL, config files — a real
  product, not a demo.
- Before your final answer: run list_files and verify every referenced file
  exists. Then briefly tell the user what you built.

Rules:
- If the conversation has no project yet and the user asks you to build something, FIRST call
  create_project, then use the file tools to build it.
- When the user asks you to build or change something, USE the tools to modify the actual
  project files. Never just print code and claim it's done.
- If the request already contains enough information, do not ask questions — build.
- If a critical detail is missing (e.g. name/brand for a website), ask ONE short follow-up
  question instead of guessing.
- Keep answers concise. Explain briefly what you are doing as you do it.
- Prefer small, correct, complete files. Generate production-quality code.`;

export type AgentEvent =
  | { type: "status"; text: string }
  | { type: "delta"; text: string }
  | { type: "tool"; name: string; ok: boolean; summary: string }
  | { type: "done"; content: string }
  | { type: "error"; message: string };

/**
 * Runs the agent for one user turn and streams events to the caller.
 * Persists: final ASSISTANT message (content + toolCalls metadata),
 * TOOL messages, chat status transitions, and an AIJob record.
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

  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!chat) {
    yield { type: "error", message: "chat not found" };
    return;
  }

  let projectId: string | null = opts.projectId ?? chat.projectId ?? null;

  const job = await prisma.aIJob.create({
    data: { userId, chatId, projectId, model, status: "RUNNING", startedAt: new Date() },
  });
  await prisma.chat.update({ where: { id: chatId }, data: { status: "GENERATING", model } });

  try {
    const history: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...chat.messages
        .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
        .slice(-20)
        .map((m) => ({ role: m.role.toLowerCase() as "user" | "assistant", content: m.content })),
    ];

    let finalContent = "";
    let iterations = 0;

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;
      let iterationText = "";
      let requestedTools: Array<{ id: string; name: string; arguments: string }> | null = null;

      // Transient provider errors (5xx / 429 / connection drops) are retried
      // with backoff — but only before any content streamed in this iteration,
      // so a retry can never duplicate already-shown text.
      const MAX_ATTEMPTS = 3;
      for (let attempt = 1; ; attempt++) {
        try {
          const stream = provider.streamChat({
            model,
            messages: trimToolHistory(history),
            tools: allToolSpecs(),
            signal: opts.signal,
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
        content: iterationText || null as unknown as string,
        tool_calls: requestedTools.map((t) => ({
          id: t.id,
          type: "function",
          function: { name: t.name, arguments: t.arguments },
        })),
      } as ChatMessage);

      for (const tc of requestedTools) {
        yield { type: "status", text: `Running ${tc.name}…` };

        // create_project is executed here: it creates + links the project and
        // updates the running context for the remaining file tools.
        let result;
        if (tc.name === "create_project") {
          result = await handleCreateProject(safeParseArgs(tc.arguments), {
            userId,
            workspaceId: chat.workspaceId,
            currentProjectId: projectId,
          });
          if (result.ok) {
            projectId = (result as { projectId: string }).projectId;
            await prisma.chat.update({ where: { id: chatId }, data: { projectId } });
            await prisma.aIJob.update({ where: { id: job.id }, data: { projectId } });
          }
        } else if (!projectId) {
          result = { ok: false as const, error: "No project yet — call create_project first." };
        } else {
          result = await executeTool(tc.name, safeParseArgs(tc.arguments), { projectId });
        }
        yield {
          type: "tool",
          name: tc.name,
          ok: result.ok,
          summary: result.ok ? truncate(result.output, 200) : truncate(result.error, 200),
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

    if (finalContent) {
      await prisma.message.create({
        data: {
          chatId,
          userId,
          role: "ASSISTANT",
          content: finalContent,
          status: "DONE",
          toolCalls: { iterations },
        },
      });
    }

    await prisma.chat.update({ where: { id: chatId }, data: { status: "IDLE" } });
    await prisma.aIJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    yield { type: "done", content: finalContent };
  } catch (err) {
    const message = err instanceof Error ? err.message : "agent failed";
    console.error("[agent] error:", err);
    await prisma.chat.update({ where: { id: chatId }, data: { status: "ERROR" } });
    await prisma.aIJob.update({
      where: { id: job.id },
      data: { status: "FAILED", error: message.slice(0, 2000), completedAt: new Date() },
    });
    await prisma.message.create({
      data: { chatId, userId, role: "ASSISTANT", content: `⚠️ ${message}`, status: "ERROR" },
    });
    yield { type: "error", message };
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
  ctx: { userId: string; workspaceId: string; currentProjectId: string | null }
): Promise<{ ok: true; output: string; projectId: string } | { ok: false; error: string }> {
  if (ctx.currentProjectId) {
    return { ok: true, output: `Project already exists: ${ctx.currentProjectId}`, projectId: ctx.currentProjectId };
  }
  const parsed = CreateProjectArgs.safeParse(args);
  if (!parsed.success) return { ok: false, error: "name is required (max 120 chars)" };
  const { name, description, framework, language } = parsed.data;

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      description,
      framework,
      language,
      workspaceId: ctx.workspaceId,
      ownerId: ctx.userId,
    },
  });
  return {
    ok: true,
    output: `Project created: ${project.id} ("${project.name}"). You can now use the file tools.`,
    projectId: project.id,
  };
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

/**
 * Long builds accumulate many large tool results, eventually exceeding
 * provider request limits (Ollama/Groq return 4xx/5xx). Keep the last few
 * tool results verbatim; older ones collapse to a placeholder. System,
 * user, and assistant turns are always kept.
 */
function trimToolHistory(history: ChatMessage[], keepLast = 6): ChatMessage[] {
  const toolIdx: number[] = [];
  history.forEach((m, i) => {
    if (m.role === "tool") toolIdx.push(i);
  });
  const omit = new Set(toolIdx.slice(0, Math.max(0, toolIdx.length - keepLast)));
  if (omit.size === 0) return history;
  return history.map((m, i) =>
    omit.has(i) ? { ...m, content: "[tool result omitted]" } : m
  );
}
