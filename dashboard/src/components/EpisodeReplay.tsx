import { useQuery } from '@tanstack/react-query';
import { Check, ChevronRight, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api, type EpisodeEvent } from '../lib/api';
import { useProcedure } from '../lib/queries';
import { cn } from '../lib/utils';
import { HashChip } from './HashChip';
import { MachineTwin } from './MachineTwin';
import { Plate } from './Plate';

const str = (v: unknown): string => (v == null ? '' : String(v));

interface Act { control: string; action: string; value: string }

function tickColor(e: EpisodeEvent): string {
  if (e.kind === 'observe') {
    const v = str(e.summary.verdict);
    return v === 'ok' ? 'var(--ok)' : v === 'safe_stop' ? 'var(--bad)' : 'var(--warn)';
  }
  if (e.kind === 'human_verified') return 'var(--world)';
  if (e.kind === 'speech') return 'var(--g0)';
  return 'var(--muted)';
}

function Detail({ e }: { e: EpisodeEvent }) {
  const s = e.summary;
  const actions = (Array.isArray(s.actions) ? (s.actions as Act[]) : []).map((a) => `${a.control} ${a.action} ${a.value}`.trim());
  const row = (k: string, v: React.ReactNode) => (
    <div className="grid grid-cols-[104px_1fr] gap-3 border-t border-line py-2 first:border-t-0">
      <dt className="label pt-0.5">{k}</dt>
      <dd className="min-w-0 break-words font-mono text-[12.5px]">{v}</dd>
    </div>
  );
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="label border px-2 py-1" style={{ borderRadius: 3, color: tickColor(e), borderColor: tickColor(e) }}>{e.kind.replace('_', ' ')}</span>
        <span className="hash text-muted">#{e.index} · {new Date(e.at).toLocaleTimeString([], { hour12: false })} · hash {e.hash}</span>
      </div>
      <dl>
        {e.kind === 'observe' && (
          <>
            {row('Trigger', s.checkpoint ? `checkpoint ${str(s.checkpoint)}` : str(s.trigger))}
            {row('Actions', actions.length ? actions.join(' · ') : 'none new')}
            {row('Verdict', <span style={{ color: tickColor(e) }}>{str(s.verdict)}</span>)}
            {s.line ? row('Coaching', <span className="font-sans text-[13px]">{str(s.line)}</span>) : null}
            {row('0G request', s.requestId ? <HashChip value={str(s.requestId)} head={10} tail={4} /> : '—')}
            {row('Model', `${str(s.model)} · ${str(s.latencyMs)} ms`)}
          </>
        )}
        {e.kind === 'human_verified' && (
          <>
            {row('Provider', `${str(s.provider)} · ${str(s.issuer).replace('https://', '')}`)}
            {row('Class', str(s.acr).split('/').pop() || '—')}
            {row('Human id', str(s.humanHash))}
          </>
        )}
        {e.kind === 'speech' && (
          <>
            {row('Voice', `${str(s.words)} words · ${str(s.latencyMs)} ms`)}
            {row('0G request', s.requestId ? <HashChip value={str(s.requestId)} head={10} tail={4} /> : '—')}
          </>
        )}
        {(e.kind === 'session_start' || e.kind === 'session_end') && Object.entries(s).map(([k, v]) => row(k, str(v)))}
      </dl>
    </div>
  );
}

export function EpisodeReplay({ root }: { root: string | null }) {
  const procedure = useProcedure();
  const q = useQuery({ queryKey: ['episode', root], queryFn: () => api.episode(root!), enabled: Boolean(root), staleTime: Infinity });
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);

  const events = q.data?.events ?? [];
  const last = Math.max(0, events.length - 1);

  useEffect(() => {
    setI(0);
    setPlaying(false);
  }, [root]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setI((x) => (x >= last ? x : x + 1)), 900 / speed);
    return () => clearInterval(t);
  }, [playing, speed, last]);
  useEffect(() => {
    if (playing && i >= last) setPlaying(false);
  }, [i, last, playing]);

  const machine = useMemo(() => {
    for (let k = Math.min(i, last); k >= 0; k--) {
      const e = events[k];
      if (e?.kind === 'observe' && e.summary.machine) return e.summary.machine as Record<string, unknown>;
    }
    return null;
  }, [events, i, last]);

  const done = useMemo(() => {
    const finished = new Set<string>();
    const steps = procedure.data?.steps ?? [];
    for (let k = 0; k <= Math.min(i, last); k++) {
      const e = events[k];
      if (e?.kind !== 'observe' || !Array.isArray(e.summary.actions)) continue;
      for (const a of e.summary.actions as Act[]) {
        const hit = steps.find((st) => !finished.has(st.id) && st.expectedAction.control === a.control && st.expectedAction.action === a.action && (st.expectedAction.value === '' || st.expectedAction.value === a.value));
        if (hit) finished.add(hit.id);
      }
    }
    // The last action ends the session before it is recorded as an event, so a finished session has done every step.
    const outcome = q.data?.outcome;
    if (i >= last && last > 0 && (outcome === 'test_pass' || outcome === 'learn_complete')) steps.forEach((st) => finished.add(st.id));
    return finished;
  }, [events, i, last, procedure.data, q.data?.outcome]);

  if (!root) return <Plate still className="grid min-h-[260px] place-items-center p-8 text-sm text-muted">No stored session yet. Run a test and it appears here.</Plate>;
  if (q.isLoading) return <Plate still className="grid min-h-[260px] place-items-center p-8"><span className="skeleton h-5 w-64" /></Plate>;
  if (q.isError || !q.data) return <Plate still className="grid min-h-[260px] place-items-center p-8 text-sm text-bad">Could not read this episode from 0G Storage.</Plate>;
  const ep = q.data;
  const cur = events[Math.min(i, last)];
  const steps = procedure.data?.steps ?? [];
  const next = steps.find((st) => !done.has(st.id));
  const seconds = ep.startedAt && ep.endedAt ? Math.round((Date.parse(ep.endedAt) - Date.parse(ep.startedAt)) / 1000) : null;

  return (
    <Plate still className="p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label flex items-center gap-2"><span className="hazard inline-block size-2.5" aria-hidden />Episode replay</p>
          <h2 className="display mt-1.5 text-[26px] font-semibold">{ep.outcome?.replace('_', ' ')} · {ep.events.length} records</h2>
          <p className="mt-1 text-[12.5px] text-muted">{ep.model}{seconds !== null ? ` · ${Math.floor(seconds / 60)}m ${seconds % 60}s` : ''} · downloaded from 0G Storage, hash chain {ep.verified ? 'verified' : 'NOT verified'}</p>
        </div>
        <HashChip value={ep.rootHash} head={10} tail={8} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px_1fr_320px]">
        <MachineTwin machine={machine} />

        <div className="min-w-0">
          <div className="flex items-end gap-[3px] pb-2" style={{ height: 64 }} role="group" aria-label="Timeline">
            {events.map((e, k) => (
              <button key={e.index} onClick={() => { setI(k); setPlaying(false); }} aria-label={`Event ${k + 1}: ${e.kind}`} className="min-w-[4px] flex-1 transition-all duration-200 hover:opacity-100" style={{ height: e.kind === 'observe' ? 40 : 22, background: tickColor(e), opacity: k === i ? 1 : k < i ? 0.75 : 0.25, outline: k === i ? '2px solid var(--ink)' : 'none', outlineOffset: 1 }} />
            ))}
          </div>
          <input type="range" min={0} max={last} value={Math.min(i, last)} onChange={(e) => { setI(Number(e.target.value)); setPlaying(false); }} className="w-full accent-[var(--accent)]" aria-label="Replay position" />
          <div className="my-3 flex flex-wrap items-center gap-2">
            <button onClick={() => setI((x) => Math.max(0, x - 1))} className="grid size-9 place-items-center border border-line text-muted hover:text-ink" style={{ borderRadius: 4 }} aria-label="Previous event"><SkipBack className="size-4" /></button>
            <button onClick={() => { if (i >= last) setI(0); setPlaying((p) => !p); }} className="flex h-9 items-center gap-2 bg-accent px-4 font-mono text-[12px] font-medium text-accent-ink" style={{ borderRadius: 4 }}>
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}{playing ? 'Pause' : 'Play'}
            </button>
            <button onClick={() => setI((x) => Math.min(last, x + 1))} className="grid size-9 place-items-center border border-line text-muted hover:text-ink" style={{ borderRadius: 4 }} aria-label="Next event"><SkipForward className="size-4" /></button>
            <div className="ml-auto flex items-center gap-1.5">
              {[1, 4, 16].map((x) => (
                <button key={x} onClick={() => setSpeed(x)} className={cn('h-9 border px-2.5 font-mono text-[11.5px]', speed === x ? 'border-accent text-accent' : 'border-line text-muted hover:text-ink')} style={{ borderRadius: 4 }}>{x}×</button>
              ))}
              <span className="hash tnum ml-2 text-muted">{Math.min(i, last) + 1} / {events.length}</span>
            </div>
          </div>
          <div className="border border-line bg-panel-2 p-4" style={{ borderRadius: 4 }}>{cur && <Detail e={cur} />}</div>
        </div>

        <div className="min-w-0">
          <p className="label mb-2 flex justify-between"><span>Procedure</span><span>{done.size} / {steps.length}</span></p>
          <div className="h-1 bg-line"><div className="h-full bg-accent transition-all duration-500" style={{ width: `${steps.length ? (done.size / steps.length) * 100 : 0}%` }} /></div>
          <ol className="mt-3 max-h-[430px] overflow-y-auto pr-1">
            {steps.map((st) => {
              const isDone = done.has(st.id);
              const isNext = next?.id === st.id;
              return (
                <li key={st.id} className={cn('flex items-center gap-2.5 border-b border-line py-1.5 text-[12.5px] transition-colors', isNext && 'text-ink', !isDone && !isNext && 'text-muted')}>
                  <span className="grid size-4 shrink-0 place-items-center">
                    {isDone ? <Check className="size-3.5 text-ok" /> : isNext ? <ChevronRight className="size-3.5 text-accent" /> : <span className="size-1.5 bg-line" />}
                  </span>
                  <span className="truncate">{st.title}</span>
                  {st.checkpoint && <span className="label ml-auto !text-[9.5px] !tracking-[0.08em]" style={{ color: isDone ? 'var(--ok)' : undefined }}>CP</span>}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </Plate>
  );
}
