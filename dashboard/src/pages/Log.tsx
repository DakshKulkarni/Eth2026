import { Copy, Download, Pause, Play, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Plate } from '../components/Plate';
import { TrackMark, TRACK_COLOR, TRACK_LABEL } from '../components/TrackMark';
import type { LiveEvent, Track } from '../lib/api';
import { describe } from '../lib/describe';
import { useEventStream } from '../lib/events';
import { useBacklog } from '../lib/queries';
import { cn } from '../lib/utils';

const FILTERS: (Track | 'all')[] = ['all', '0g', 'ens', 'world', 'system'];
const TONE = { ok: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)', info: 'var(--muted)' } as const;

export function Log() {
  const stream = useEventStream();
  const backlog = useBacklog();
  const [track, setTrack] = useState<Track | 'all'>('all');
  const [query, setQuery] = useState('');
  const [problems, setProblems] = useState(false);
  const [paused, setPaused] = useState(false);
  const [frozen, setFrozen] = useState<LiveEvent[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  // Live events plus the server's recent history, newest first, without duplicates.
  const merged = useMemo(() => {
    const byId = new Map<number, LiveEvent>();
    for (const e of backlog.data?.events ?? []) byId.set(e.id, e);
    for (const e of stream.events) byId.set(e.id, e);
    return [...byId.values()].sort((a, b) => b.id - a.id);
  }, [backlog.data, stream.events]);

  const source = paused && frozen ? frozen : merged;
  const rows = source.filter((e) => {
    if (track !== 'all' && e.track !== track) return false;
    const d = describe(e);
    if (problems && d.tone !== 'bad' && d.tone !== 'warn') return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return `${e.event} ${d.title} ${d.detail ?? ''} ${JSON.stringify(e.data)}`.toLowerCase().includes(q);
  });

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `proof-deck-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Plate still>
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by track">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setTrack(f)} className={cn('label flex items-center gap-2 border px-2.5 py-1.5 transition-colors', track === f ? '!text-ink' : 'hover:!text-ink')} style={{ borderRadius: 3, borderColor: track === f ? (f === 'all' ? 'var(--accent)' : TRACK_COLOR[f]) : 'var(--line)' }}>
              {f !== 'all' && <TrackMark track={f} className="h-[11px] w-auto" />}{f === 'all' ? 'All' : TRACK_LABEL[f]}
            </button>
          ))}
        </div>
        <button onClick={() => setProblems((p) => !p)} className={cn('label border px-2.5 py-1.5', problems ? '!text-warn' : 'hover:!text-ink')} style={{ borderRadius: 3, borderColor: problems ? 'var(--warn)' : 'var(--line)' }}>Problems only</button>
        <label className="relative ml-auto min-w-[200px] flex-1 sm:max-w-[320px]">
          <span className="sr-only">Search events</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events, ids, hashes…" className="h-9 w-full border border-line bg-panel-2 pl-8 pr-2 font-mono text-[12px] outline-none focus:border-accent" style={{ borderRadius: 4 }} />
        </label>
        <button onClick={() => { setFrozen(paused ? null : merged); setPaused((p) => !p); }} className="label flex items-center gap-1.5 border border-line px-2.5 py-2 hover:!text-ink" style={{ borderRadius: 4 }}>
          {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}{paused ? 'Resume' : 'Pause'}
        </button>
        <button onClick={exportJson} className="label flex items-center gap-1.5 border border-line px-2.5 py-2 hover:!text-ink" style={{ borderRadius: 4 }}><Download className="size-3.5" />Export</button>
      </div>

      <div className="label flex items-center justify-between border-b border-line px-4 py-2">
        <span>{rows.length} of {source.length} events{paused ? ' · paused' : ''}</span>
        <span className="flex items-center gap-2"><span className="lamp" style={{ ['--lamp' as string]: stream.status === 'live' && !paused ? 'var(--ok)' : 'var(--warn)' }} />{paused ? 'Paused' : stream.status === 'live' ? 'Live' : 'Reconnecting'}</span>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-16 text-center text-sm text-muted">{source.length === 0 ? 'No events yet. Anything the backend does appears here.' : 'No events match these filters.'}</p>
      ) : (
        <ul>
          {rows.slice(0, 300).map((e) => {
            const d = describe(e);
            const expanded = open === e.id;
            return (
              <li key={e.id} className="border-b border-line last:border-b-0">
                <button onClick={() => setOpen(expanded ? null : e.id)} aria-expanded={expanded} className="grid w-full grid-cols-[72px_24px_minmax(0,1fr)_auto] items-start gap-x-3 px-4 py-2.5 text-left transition-colors hover:bg-panel-2">
                  <span className="hash tnum pt-0.5 text-muted">{new Date(e.at).toLocaleTimeString([], { hour12: false })}</span>
                  <span className="grid h-5 place-items-center"><TrackMark track={e.track} /></span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-[13px] font-medium"><span className="inline-block size-1.5 shrink-0" style={{ background: TONE[d.tone] }} />{d.title}<span className="hash font-normal text-muted">{e.event}</span></span>
                    {d.detail && <span className="mt-0.5 block truncate font-mono text-[11.5px] text-muted">{d.detail}</span>}
                  </span>
                  <span className="hash tnum pt-0.5 text-muted">{d.ms !== undefined ? `${d.ms} ms` : `#${e.id}`}</span>
                </button>
                {expanded && (
                  <div className="border-t border-line bg-panel-2 px-4 py-3">
                    <div className="mb-2 flex justify-end">
                      <button onClick={() => navigator.clipboard?.writeText(JSON.stringify(e, null, 2))} className="label flex items-center gap-1.5 hover:!text-ink"><Copy className="size-3" />Copy JSON</button>
                    </div>
                    <pre className="max-h-72 overflow-auto font-mono text-[11.5px] leading-relaxed">{JSON.stringify(e.data, null, 2)}</pre>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Plate>
  );
}
