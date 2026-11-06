import { useEffect, useMemo, useState } from 'react';
import type { LiveEvent } from './api';
import { useProcedure } from './queries';

export interface LiveSession {
  session: string | null;
  mode: string | null;
  startedAt: string | null;
  machine: Record<string, unknown> | null;
  done: Set<string>;
  total: number;
  verdict: { verdict: string; line: string; at: string; ms: number | null } | null;
  observes: LiveEvent[];
  elapsed: number | null;
}

const parse = (s: string) => {
  const t = s.split(' ');
  return { control: t[0] ?? '', action: t[1] ?? '', value: t.slice(2).join(' ') };
};

// Follows the newest session in the live stream: its machine state, finished steps and latest AI verdict.
export function useLiveSession(events: LiveEvent[]): LiveSession {
  const procedure = useProcedure();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return useMemo(() => {
    const start = events.find((e) => e.event === 'session_start');
    const steps = procedure.data?.steps ?? [];
    const empty: LiveSession = { session: null, mode: null, startedAt: null, machine: null, done: new Set(), total: steps.length, verdict: null, observes: [], elapsed: null };
    if (!start) return empty;
    const session = String(start.data.session);
    const mine = events.filter((e) => e.event === 'observe' && e.data.session === session && e.id >= start.id).reverse(); // oldest first
    const done = new Set<string>();
    for (const e of mine) {
      const list = Array.isArray(e.data.newActions) ? (e.data.newActions as string[]) : [];
      for (const raw of list) {
        const a = parse(raw);
        if (a.action === 'blocked') continue;
        const hit = steps.find((st) => !done.has(st.id) && st.expectedAction.control === a.control && st.expectedAction.action === a.action && (st.expectedAction.value === '' || st.expectedAction.value === a.value));
        if (hit) done.add(hit.id);
      }
    }
    const last = mine[mine.length - 1];
    const spoken = [...mine].reverse().find((e) => e.data.verdict && e.data.verdict !== 'ok' && e.data.line);
    return {
      session,
      mode: mine[0] ? String(mine[0].data.mode) : null,
      startedAt: start.at,
      machine: last ? ((last.data.machine as Record<string, unknown>) ?? null) : null,
      done,
      total: steps.length,
      verdict: spoken ? { verdict: String(spoken.data.verdict), line: String(spoken.data.line), at: spoken.at, ms: Number(spoken.data.ms) || null } : null,
      observes: mine.slice().reverse(),
      elapsed: Math.max(0, Math.round((now - Date.parse(start.at)) / 1000)),
    };
  }, [events, procedure.data, now]);
}
