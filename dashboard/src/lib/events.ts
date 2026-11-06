import { useSyncExternalStore } from 'react';
import type { LiveEvent } from './api';

// One shared connection to the server's event stream. Every page reads from this store.
const MAX = 400;

export type StreamStatus = 'connecting' | 'live' | 'offline';
interface Snapshot {
  events: LiveEvent[]; // newest first
  status: StreamStatus;
}

let snapshot: Snapshot = { events: [], status: 'connecting' };
const listeners = new Set<() => void>();
let source: EventSource | null = null;
const seen = new Set<number>();

function emit(next: Snapshot): void {
  snapshot = next;
  listeners.forEach((l) => l());
}

function start(): void {
  if (source || typeof EventSource === 'undefined') return;
  source = new EventSource('/api/stream');
  source.onopen = () => emit({ ...snapshot, status: 'live' });
  source.onerror = () => emit({ ...snapshot, status: source?.readyState === EventSource.CLOSED ? 'offline' : 'connecting' });
  source.addEventListener('activity', (msg) => {
    try {
      const e = JSON.parse((msg as MessageEvent<string>).data) as LiveEvent;
      if (seen.has(e.id)) return;
      seen.add(e.id);
      emit({ events: [e, ...snapshot.events].slice(0, MAX), status: 'live' });
    } catch {
      // ignore a malformed frame
    }
  });
}

export function useEventStream(): Snapshot {
  start();
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshot,
  );
}
