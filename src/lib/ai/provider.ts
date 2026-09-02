/**
 * AI provider abstraction.
 * v1: OpenAI-compatible /chat/completions with SSE streaming.
 * Swap providers by implementing ChatProvider — the agent only sees this interface.
 */

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: unknown[]; // provider-native tool_call objects (assistant)
  tool_call_id?: string; // for role === "tool"
  name?: string;
};

export type ToolSpec = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export interface ChatProvider {
  /** Streams text deltas; yields full tool_calls when the model requests them. */
  streamChat(opts: {
    model: string;
    messages: ChatMessage[];
    tools?: ToolSpec[];
    signal?: AbortSignal;
    /** Receives token usage when the provider reports it (final chunk). */
    onUsage?: (usage: { prompt_tokens?: number; completion_tokens?: number }) => void;
  }): AsyncGenerator<
    | { type: "delta"; text: string }
    | { type: "tool_calls"; toolCalls: Array<{ id: string; name: string; arguments: string }> }
    | { type: "done"; finishReason: string | null }
  >;
}

export class OpenAICompatibleProvider implements ChatProvider {
  constructor(
    private baseUrl: string,
    private apiKey: string
  ) {}

  async *streamChat(opts: {
    model: string;
    messages: ChatMessage[];
    tools?: ToolSpec[];
    signal?: AbortSignal;
    onUsage?: (usage: { prompt_tokens?: number; completion_tokens?: number }) => void;
  }): AsyncGenerator<
    | { type: "delta"; text: string }
    | { type: "tool_calls"; toolCalls: Array<{ id: string; name: string; arguments: string }> }
    | { type: "done"; finishReason: string | null }
  > {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        tools: opts.tools?.length ? opts.tools : undefined,
        stream: true,
      }),
      signal: opts.signal,
    });

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      throw new Error(`AI provider error ${res.status}: ${detail.slice(0, 300)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finishReason: string | null = null;

    // Accumulate tool calls across chunks (index-keyed). Some providers reuse
    // the same index for parallel tool calls — a new id on an occupied slot
    // flushes the previous call so their arguments never merge into one.
    const toolAcc = new Map<number, { id: string; name: string; args: string }>();
    const extraCalls: Array<{ id: string; name: string; args: string }> = [];
    const flushCalls = (): Array<{ id: string; name: string; arguments: string }> => [
      ...extraCalls.map((t) => ({ id: t.id, name: t.name, arguments: t.args || "{}" })),
      ...[...toolAcc.values()].map((t) => ({ id: t.id, name: t.name, arguments: t.args || "{}" })),
    ];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") {
          if (toolAcc.size > 0 || extraCalls.length > 0) {
            yield { type: "tool_calls", toolCalls: flushCalls() };
          }
          yield { type: "done", finishReason };
          return;
        }
        let json: any;
        try {
          json = JSON.parse(payload);
        } catch {
          continue;
        }
        // Some providers (e.g. Groq) send mid-stream errors as HTTP 200 SSE.
        if (json.error) {
          const msg = json.error?.message ?? json.error?.type ?? "provider stream error";
          throw new Error(`AI provider stream error: ${String(msg).slice(0, 300)}`);
        }
        const choice = json.choices?.[0];
        if (!choice) continue;
        if (choice.finish_reason) finishReason = choice.finish_reason;
        if (json.usage && opts.onUsage) {
          opts.onUsage({ prompt_tokens: json.usage.prompt_tokens, completion_tokens: json.usage.completion_tokens });
        }
        const delta = choice.delta;
        if (delta?.content) yield { type: "delta", text: delta.content };
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            let acc = toolAcc.get(idx);
            if (acc && tc.id && acc.id && acc.args && tc.id !== acc.id) {
              extraCalls.push(acc);
              acc = undefined;
            }
            acc ??= { id: "", name: "", args: "" };
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.name += tc.function.name;
            if (tc.function?.arguments) {
              // Most providers stream arguments as string fragments; some
              // (e.g. Ollama) send the complete arguments as a JSON OBJECT.
              const a = tc.function.arguments;
              acc.args += typeof a === "string" ? a : JSON.stringify(a);
            }
            toolAcc.set(idx, acc);
          }
        }
      }
    }
    if (toolAcc.size > 0 || extraCalls.length > 0) {
      yield { type: "tool_calls", toolCalls: flushCalls() };
    }
    yield { type: "done", finishReason };
  }
}

/** Build the configured provider from environment. */
export function getProvider(): ChatProvider {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) throw new Error("AI_API_KEY is not configured");
  const baseUrl = process.env.AI_BASE_URL ?? "https://api.openai.com/v1";
  return new OpenAICompatibleProvider(baseUrl, apiKey);
}

export function getModel(): string {
  return process.env.AI_MODEL ?? "gpt-4o";
}
