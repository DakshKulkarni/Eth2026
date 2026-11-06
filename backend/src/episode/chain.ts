import { createHash } from 'node:crypto';

export const GENESIS_HASH = '0'.repeat(64);

export interface EpisodeRecord {
  index: number;
  at: string;
  kind: string;
  data: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function hashOf(record: Omit<EpisodeRecord, 'hash'>): string {
  return sha256(canonical(record));
}

export class EpisodeLog {
  private readonly records: EpisodeRecord[] = [];

  append(kind: string, data: Record<string, unknown>): EpisodeRecord {
    const body = {
      index: this.records.length,
      at: new Date().toISOString(),
      kind,
      data,
      prevHash: this.head,
    };
    const record: EpisodeRecord = { ...body, hash: hashOf(body) };
    this.records.push(record);
    return record;
  }

  get head(): string {
    return this.records[this.records.length - 1]?.hash ?? GENESIS_HASH;
  }

  get all(): EpisodeRecord[] {
    return [...this.records];
  }
}

export type ChainCheck = { ok: true } | { ok: false; brokenAt: number; reason: string };

export function verifyChain(records: EpisodeRecord[]): ChainCheck {
  let prev = GENESIS_HASH;
  for (const [i, r] of records.entries()) {
    if (r.index !== i) return { ok: false, brokenAt: i, reason: 'index out of order' };
    if (r.prevHash !== prev) return { ok: false, brokenAt: i, reason: 'prevHash does not match the previous record' };
    const { hash, ...body } = r;
    if (hashOf(body) !== hash) return { ok: false, brokenAt: i, reason: 'record content does not match its hash' };
    prev = hash;
  }
  return { ok: true };
}
