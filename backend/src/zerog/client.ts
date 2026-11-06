import { zgFetch } from './http.js';
import { z } from 'zod';
import { config } from '../config.js';

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

export type ZgResult =
  | { ok: true; content: string; requestId: string; model: string; latencyMs: number }
  | { ok: false; reason: 'no_key' | 'timeout' | 'http' | 'invalid'; detail: string; latencyMs: number };

const responseSchema = z.object({
  model: z.string().optional(),
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
  x_0g_trace: z.object({ request_id: z.string() }).optional(),
});

interface ChatOptions {
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  json?: boolean;
  timeoutMs?: number;
}

function describe(err: unknown): string {
  if (!(err instanceof Error)) return 'network error';
  const cause = err.cause instanceof Error ? ` (${(err.cause as NodeJS.ErrnoException).code ?? err.cause.message})` : '';
  return `${err.name}: ${err.message}${cause}`;
}

function thinkingOff(model: string): Record<string, unknown> {
  if (model.startsWith('glm')) return { chat_template_kwargs: { enable_thinking: false } };
  if (model.startsWith('qwen') || model.startsWith('deepseek')) return { enable_thinking: false };
  if (lowEffortClaude(model)) return { reasoning_effort: 'low' };
  return {};
}

function lowEffortClaude(model: string): boolean {
  return model === 'claude-haiku-5.5' || model === 'claude-sonnet-5.5';
}

function acceptsTemperature(model: string): boolean {
  return model.startsWith('qwen') || model.startsWith('deepseek') || model.startsWith('glm') || model.startsWith('gpt-4');
}

export function tokenBudget(model: string): number {
  if (lowEffortClaude(model)) return 400;
  return /^gpt-[56]|^claude/.test(model) ? 1500 : 450;
}

export async function chat(options: ChatOptions): Promise<ZgResult> {
  const started = Date.now();
  const elapsed = () => Date.now() - started;
  if (!config.ZG_API_KEY) return { ok: false, reason: 'no_key', detail: 'ZG_API_KEY is not set', latencyMs: 0 };

  const model = options.model ?? config.ZG_COACH_MODEL;
  const body = {
    model,
    messages: options.messages,
    ...(acceptsTemperature(model) ? { temperature: options.temperature ?? 0.2 } : {}),
    max_tokens: options.maxTokens ?? tokenBudget(model),
    ...(options.json ? { response_format: { type: 'json_object' } } : {}),
    ...thinkingOff(model),
  };

  try {
    const res = await zgFetch(`${config.ZG_ROUTER_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.ZG_API_KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs ?? config.ZG_TIMEOUT_MS),
    }, 4500);
    if (!res.ok) {
      const text = (await res.text().catch(() => '')).slice(0, 300);
      return { ok: false, reason: 'http', detail: `HTTP ${res.status} ${text}`.trim(), latencyMs: elapsed() };
    }

    const parsed = responseSchema.safeParse(await res.json());
    if (!parsed.success) return { ok: false, reason: 'invalid', detail: 'unexpected response shape', latencyMs: elapsed() };

    const requestId = parsed.data.x_0g_trace?.request_id;
    const content = parsed.data.choices[0]?.message.content;
    if (!requestId) return { ok: false, reason: 'invalid', detail: 'missing x_0g_trace.request_id', latencyMs: elapsed() };
    if (!content) return { ok: false, reason: 'invalid', detail: 'empty content', latencyMs: elapsed() };
    return { ok: true, content, requestId, model: parsed.data.model ?? model, latencyMs: elapsed() };
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    return {
      ok: false,
      reason: timedOut ? 'timeout' : 'http',
      detail: timedOut ? 'request timed out' : describe(err),
      latencyMs: elapsed(),
    };
  }
}
