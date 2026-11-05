import { chat } from '../zerog/client.js';
import type { Procedure } from '../shared/procedure.js';
import type { Session } from '../session.js';
import { buildMessages } from './prompt.js';
import { modelOutputSchema, type CoachResult, type Observe } from './schema.js';

const SAFE_STOP_LINE = 'Verification unavailable. Do not continue.';
const REPEAT_WINDOW_MS = 8000;

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

function safeStop(session: Session, latencyMs: number): CoachResult {
  return {
    verdict: 'safe_stop',
    completedSteps: session.tracker.completed,
    mistakes: [],
    coachingLine: SAFE_STOP_LINE,
    speak: false,
    requestId: '',
    model: '',
    latencyMs,
  };
}

export async function coach(session: Session, procedure: Procedure, req: Observe): Promise<CoachResult> {
  for (const a of [...req.actions].sort((x, y) => x.seq - y.seq)) {
    if (a.seq <= session.lastSeq) continue;
    session.tracker.apply(a);
    session.lastSeq = a.seq;
  }
  const violations = session.tracker.pendingViolations;

  const result = await chat({
    messages: buildMessages(req, {
      procedure,
      currentStepId: session.tracker.currentStepId,
      completed: session.tracker.completed,
      violations,
      previousCoaching: session.history.slice(-3).map((c) => c.line),
    }),
    maxTokens: 220,
  });
  if (!result.ok) return safeStop(session, result.latencyMs);

  let parsed;
  try {
    parsed = modelOutputSchema.safeParse(parseModelJson(result.content));
  } catch {
    return safeStop(session, result.latencyMs);
  }
  if (!parsed.success) return safeStop(session, result.latencyMs);

  session.tracker.clearViolations();
  let { verdict, mistakes, coachingLine } = parsed.data;
  if (verdict === 'ok' && violations.length > 0) {
    verdict = 'correct';
    mistakes = violations.map((s) => ({ stepId: s.id, code: 'order_violation', explanation: s.rationale }));
    if (!coachingLine) coachingLine = `${firstTitle(violations)} was done too early. ${violations[0]?.rationale ?? ''}`;
  }
  coachingLine = trimWords(coachingLine, 25);

  const now = Date.now();
  const repeated = session.history.some((c) => c.line === coachingLine && now - c.at < REPEAT_WINDOW_MS);
  const speak = verdict !== 'ok' && coachingLine.length > 0 && !repeated;
  if (speak) session.history.push({ at: now, line: coachingLine });

  return {
    verdict,
    completedSteps: session.tracker.completed,
    mistakes,
    coachingLine,
    speak,
    requestId: result.requestId,
    model: result.model,
    latencyMs: result.latencyMs,
  };
}

function firstTitle(steps: { title: string }[]): string {
  return steps[0]?.title ?? 'That step';
}
