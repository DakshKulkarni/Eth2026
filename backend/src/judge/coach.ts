import type { z } from 'zod';
import { chat } from '../zerog/client.js';
import type { Procedure } from '../shared/procedure.js';
import type { Session } from '../session.js';
import { buildMessages } from './prompt.js';
import { modelOutputSchema, type CoachResult, type Observe } from './schema.js';

const SAFE_STOP_LINE = 'Verification unavailable. Do not continue.';
const REPEAT_WINDOW_MS = 8000;
const HISTORY_LIMIT = 80;

function trimWords(text: string, max: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length <= max ? words.join(' ') : words.slice(0, max).join(' ');
}

function parseModelJson(content: string): unknown {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in reply');
  return JSON.parse(content.slice(start, end + 1));
}

function safeStop(latencyMs: number, failure: string): CoachResult {
  return {
    verdict: 'safe_stop',
    completedSteps: [],
    mistakes: [],
    coachingLine: SAFE_STOP_LINE,
    speak: false,
    requestId: '',
    model: '',
    latencyMs,
    failure,
  };
}

function transient(r: { ok: boolean; reason?: string; detail?: string }): boolean {
  return !r.ok && (r.reason === 'timeout' || (r.reason === 'http' && /fetch failed|ECONN|ETIMEDOUT|ENOTFOUND|socket/i.test(r.detail ?? '')));
}

export async function coach(session: Session, procedure: Procedure, req: Observe): Promise<CoachResult> {
  const fresh = req.actions.filter((a) => a.seq > session.lastSeq).sort((x, y) => x.seq - y.seq);

  const messages = buildMessages(req, {
    procedure,
    earlier: session.actions.slice(-HISTORY_LIMIT),
    fresh,
    previousCoaching: session.history.slice(-3).map((c) => c.line),
  });

  let totalMs = 0;
  let result = await chat({ messages });
  totalMs += result.latencyMs;
  if (!result.ok && transient(result)) {
    result = await chat({ messages });
    totalMs += result.latencyMs;
  }
  if (!result.ok) return safeStop(totalMs, `${result.reason}: ${result.detail}`);
  let parsed = parseOutput(result.content);

  if (!parsed) {
    messages.push({ role: 'assistant', content: result.content });
    messages.push({
      role: 'user',
      content:
        'That reply was not valid. Reply with the JSON object only. If the verdict is correct or unsafe it must include at least one mistake and a coachingLine; otherwise use ok.',
    });
    result = await chat({ messages });
    totalMs += result.latencyMs;
    if (!result.ok && transient(result)) {
      result = await chat({ messages });
      totalMs += result.latencyMs;
    }
    if (!result.ok) return safeStop(totalMs, `${result.reason}: ${result.detail}`);
    parsed = parseOutput(result.content);
    if (!parsed) return safeStop(totalMs, 'invalid reply after retry');
  }

  for (const a of fresh) {
    session.actions.push(a);
    session.lastSeq = a.seq;
  }

  const { verdict, mistakes } = parsed;
  const coachingLine = trimWords(parsed.coachingLine, 25);
  const now = Date.now();
  const repeated = session.history.some((c) => c.line === coachingLine && now - c.at < REPEAT_WINDOW_MS);
  const speak = verdict !== 'ok' && coachingLine.length > 0 && !repeated;
  if (speak) session.history.push({ at: now, line: coachingLine });

  return {
    verdict,
    completedSteps: [],
    mistakes,
    coachingLine,
    speak,
    requestId: result.requestId,
    model: result.model,
    latencyMs: totalMs,
  };
}

function parseOutput(content: string): z.infer<typeof modelOutputSchema> | null {
  try {
    const out = modelOutputSchema.safeParse(parseModelJson(content));
    return out.success ? out.data : null;
  } catch {
    return null;
  }
}
