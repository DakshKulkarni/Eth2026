import { randomUUID } from 'node:crypto';
import type { Action } from './judge/schema.js';

export interface Coaching {
  at: number;
  line: string;
}

export interface Session {
  id: string;
  lastSeq: number;
  busy: boolean;
  actions: Action[];
  history: Coaching[];
}

const sessions = new Map<string, Session>();

export function createSession(): Session {
  const session: Session = { id: randomUUID(), lastSeq: 0, busy: false, actions: [], history: [] };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}
