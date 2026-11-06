// A small in-memory event bus. Everything the backend logs as activity also lands here,
// so the dashboard can show the last events and follow new ones live.
export type Track = '0g' | 'ens' | 'world' | 'system';

export interface LiveEvent {
  id: number;
  at: string;
  track: Track;
  event: string;
  data: Record<string, unknown>;
}

const RING_SIZE = 800;
const ring: LiveEvent[] = [];
const listeners = new Set<(e: LiveEvent) => void>();
let nextId = 1;

const ZERO_G = new Set(['session_start', 'observe', 'tts', 'finalize', 'finalize_failed', 'invalid_reply']);
const ENS = new Set(['passport', 'certificate', 'revoke']);
const WORLD = new Set(['claim', 'certificate_blocked']);

export function trackOf(event: string): Track {
  if (ZERO_G.has(event)) return '0g';
  if (ENS.has(event)) return 'ens';
  if (WORLD.has(event) || event.startsWith('checkin_')) return 'world';
  return 'system';
}

export function publish(event: string, data: Record<string, unknown>): LiveEvent {
  const entry: LiveEvent = { id: nextId++, at: new Date().toISOString(), track: trackOf(event), event, data };
  ring.push(entry);
  if (ring.length > RING_SIZE) ring.shift();
  for (const fn of listeners) {
    try {
      fn(entry);
    } catch {
      listeners.delete(fn);
    }
  }
  return entry;
}

export function recent(limit = 100, track?: Track, afterId = 0): LiveEvent[] {
  const list = ring.filter((e) => e.id > afterId && (!track || e.track === track));
  return list.slice(-Math.max(1, Math.min(limit, RING_SIZE)));
}

export function subscribe(fn: (e: LiveEvent) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function stats(): { total: number; byTrack: Record<Track, number> } {
  const byTrack: Record<Track, number> = { '0g': 0, ens: 0, world: 0, system: 0 };
  for (const e of ring) byTrack[e.track]++;
  return { total: ring.length, byTrack };
}
