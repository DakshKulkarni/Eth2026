import { config } from '../config.js';

export type SpeechResult =
  | { ok: true; audio: Buffer; contentType: string; requestId: string | null; latencyMs: number }
  | { ok: false; reason: 'no_key' | 'timeout' | 'http'; detail: string; latencyMs: number };

export async function speak(text: string, model: string = config.ZG_TTS_MODEL): Promise<SpeechResult> {
  const started = Date.now();
  const elapsed = () => Date.now() - started;
  if (!config.ZG_API_KEY) return { ok: false, reason: 'no_key', detail: 'ZG_API_KEY is not set', latencyMs: 0 };

  try {
    const res = await fetch(`${config.ZG_ROUTER_URL}/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.ZG_API_KEY}` },
      body: JSON.stringify({ model, input: text, voice: config.ZG_TTS_VOICE, response_format: 'wav' }),
      signal: AbortSignal.timeout(config.ZG_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = (await res.text().catch(() => '')).slice(0, 300);
      return { ok: false, reason: 'http', detail: `HTTP ${res.status} ${body}`.trim(), latencyMs: elapsed() };
    }
    return {
      ok: true,
      audio: Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get('content-type') ?? 'application/octet-stream',
      requestId: res.headers.get('x-request-id') ?? res.headers.get('x-0g-request-id'),
      latencyMs: elapsed(),
    };
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    return { ok: false, reason: timedOut ? 'timeout' : 'http', detail: timedOut ? 'request timed out' : 'network error', latencyMs: elapsed() };
  }
}
