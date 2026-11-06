import { randomUUID } from 'node:crypto';
import type { Outcome } from './episode/bundle.js';
import { EpisodeLog } from './episode/chain.js';
import type { Action } from './judge/schema.js';

export interface Coaching {
  at: number;
  line: string;
}

export interface Finalized {
  outcome: Outcome;
  rootHash: string;
  storageTx: string;
  storageTxSeq: number;
  anchorTx: string | null;
  anchorError: string | null;
  headHash: string;
  records: number;
  links: { storage: string; anchor: string | null };
}

export interface Certificate {
  name: string;
  holder: string;
  expiresAt: string;
  issueTx: string;
  recordsTx: string;
  links: { issueTx: string; recordsTx: string };
}

export interface Session {
  certificate: Certificate | null;
  id: string;
  startedAt: string;
  lastSeq: number;
  busy: boolean;
  actions: Action[];
  history: Coaching[];
  log: EpisodeLog;
  finalized: Finalized | null;
}

const sessions = new Map<string, Session>();

export function createSession(): Session {
  const session: Session = {
    id: randomUUID(),
    startedAt: new Date().toISOString(),
    lastSeq: 0,
    busy: false,
    actions: [],
    history: [],
    log: new EpisodeLog(),
    finalized: null,
    certificate: null,
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}
