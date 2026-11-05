import { randomUUID } from 'node:crypto';
import { Tracker } from './judge/tracker.js';
import type { Procedure } from './shared/procedure.js';

export interface Coaching {
  at: number;
  line: string;
}

export interface Session {
  id: string;
  tracker: Tracker;
  lastSeq: number;
  busy: boolean;
  history: Coaching[];
}

const sessions = new Map<string, Session>();

export function createSession(procedure: Procedure): Session {
  const session: Session = { id: randomUUID(), tracker: new Tracker(procedure), lastSeq: 0, busy: false, history: [] };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}
