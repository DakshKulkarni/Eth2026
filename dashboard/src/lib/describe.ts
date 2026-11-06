import type { LiveEvent } from './api';
import { shortHash } from './utils';

export type Tone = 'ok' | 'warn' | 'bad' | 'info';
export interface Described {
  title: string;
  detail?: string;
  tone: Tone;
  ms?: number;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

// One readable line per event, for the feed and the log.
export function describe(e: LiveEvent): Described {
  const d = e.data;
  switch (e.event) {
    case 'session_start':
      return { title: 'Session started', detail: `session ${str(d.session)}`, tone: 'info' };
    case 'observe': {
      const verdict = str(d.verdict);
      const actions = Array.isArray(d.newActions) ? (d.newActions as string[]).join(', ') : '';
      const where = d.checkpoint ? `checkpoint ${str(d.checkpoint)}` : str(d.trigger);
      if (verdict === 'safe_stop') return { title: 'Safe stop', detail: str(d.failure) || 'verification unavailable', tone: 'bad', ms: num(d.ms) };
      if (verdict === 'correct' || verdict === 'unsafe')
        return { title: `AI correction`, detail: str(d.line) || actions, tone: 'warn', ms: num(d.ms) };
      return { title: d.checkpoint ? 'Checkpoint passed' : 'AI judged: ok', detail: actions || where, tone: 'ok', ms: num(d.ms) };
    }
    case 'tts':
      return { title: d.ok ? 'Voice line spoken' : 'Voice failed', detail: d.ok ? '0G text to speech' : str(d.reason), tone: d.ok ? 'info' : 'bad', ms: num(d.ms) };
    case 'finalize':
      return { title: d.anchored ? 'Saved and anchored' : 'Saved, anchor failed', detail: `${str(d.outcome)} · root ${shortHash(str(d.rootHash))}`, tone: d.anchored ? 'ok' : 'warn' };
    case 'finalize_failed':
      return { title: 'Save failed', detail: str(d.reason), tone: 'bad' };
    case 'certificate':
      return d.ok
        ? { title: 'Licence issued', detail: str(d.name), tone: 'ok' }
        : { title: 'Licence failed', detail: str(d.reason), tone: 'bad' };
    case 'certificate_blocked':
      return { title: 'Licence blocked', detail: 'no verified human on this session', tone: 'warn' };
    case 'passport':
      return { title: d.ok ? 'Passport read from ENS' : 'Passport read failed', detail: str(d.label), tone: d.ok ? 'info' : 'bad', ms: num(d.ms) };
    case 'checkin_started':
      return { title: 'Check-in started', detail: `check-in ${str(d.checkin)}`, tone: 'info' };
    case 'checkin_verified':
      return { title: 'Human verified', detail: `World · id ${str(d.human)}`, tone: 'ok' };
    case 'checkin_denied':
      return { title: 'Check-in denied', detail: str(d.reason), tone: 'bad' };
    case 'checkin_expired':
      return { title: 'Check-in expired', detail: str(d.reason), tone: 'warn' };
    case 'checkin_cancelled':
      return { title: 'Check-in cancelled', detail: str(d.reason), tone: 'warn' };
    case 'checkin_error':
      return { title: 'Check-in error', detail: str(d.reason), tone: 'bad' };
    case 'checkin_claimed':
    case 'claim':
      return { title: 'Worker bound to session', detail: d.human ? `id ${str(d.human)}` : `session ${str(d.session)}`, tone: 'ok' };
    case 'rejected':
      return { title: `Request rejected ${str(d.status)}`, detail: `${str(d.method)} ${str(d.url)}`, tone: 'warn' };
    case 'invalid_reply':
      return { title: 'Model reply unusable', detail: str(d.why), tone: 'warn' };
    default:
      return { title: e.event.replace(/_/g, ' '), tone: 'info' };
  }
}
