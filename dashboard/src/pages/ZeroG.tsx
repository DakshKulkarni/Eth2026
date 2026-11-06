import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { CountUp } from '../components/CountUp';
import { EpisodeReplay } from '../components/EpisodeReplay';
import { EventFeed } from '../components/EventFeed';
import { HashChip } from '../components/HashChip';
import { Plate } from '../components/Plate';
import { Sparkline } from '../components/Sparkline';
import { Logo0G } from '../components/logos';
import { useEventStream } from '../lib/events';
import { useAnchors, useBacklog, useOverview } from '../lib/queries';

function Stat({ label, value, suffix, caption, i }: { label: string; value: number | undefined; suffix?: string; caption: string; i: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.4 }}>
      <Plate still className="flex h-full flex-col gap-3 p-5" style={{ borderTop: '2px solid var(--g0)' }}>
        <p className="label">{label}</p>
        <p className="display text-[44px] font-bold leading-none">{value === undefined ? <span className="skeleton inline-block h-9 w-16" /> : <CountUp value={value} suffix={suffix} />}</p>
        <p className="text-[12.5px] text-muted">{caption}</p>
      </Plate>
    </motion.div>
  );
}

const OUTCOME_TONE: Record<string, string> = { test_pass: 'var(--ok)', test_fail: 'var(--bad)', learn_complete: 'var(--accent)', abandoned: 'var(--muted)' };

export function ZeroG() {
  const stream = useEventStream();
  const overview = useOverview();
  const anchors = useAnchors();
  const backlog = useBacklog();
  const [picked, setPicked] = useState<string | null>(null);
  const replayRef = useRef<HTMLDivElement>(null);

  const rows = anchors.data?.anchors ?? [];
  const root = picked ?? rows.find((a) => a.outcome === 'test_pass')?.rootHash ?? rows[0]?.rootHash ?? null;
  useEffect(() => {
    if (picked) replayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [picked]);

  const observes = (backlog.data?.events ?? []).filter((e) => e.event === 'observe');
  const latencies = observes.map((e) => Number(e.data.ms)).filter((n) => n > 0).slice(-60);
  const ok = observes.filter((e) => e.data.verdict === 'ok').length;
  const corrections = observes.filter((e) => e.data.verdict === 'correct' || e.data.verdict === 'unsafe').length;
  const stops = observes.filter((e) => e.data.verdict === 'safe_stop').length;
  const total = Math.max(1, ok + corrections + stops);
  const j = overview.data?.judge;

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-5">
        <Stat i={0} label="AI verdicts" value={j?.verdicts} caption="Since the server started" />
        <Stat i={1} label="Corrections" value={j?.corrections} caption="Mistakes the judge caught" />
        <Stat i={2} label="Safe stops" value={j?.safeStops} caption="Judge unreachable, nothing unlocked" />
        <Stat i={3} label="Median" value={j?.medianMs ?? undefined} suffix=" ms" caption="Per verdict" />
        <Stat i={4} label="Slowest 1 in 20" value={j?.p95Ms ?? undefined} suffix=" ms" caption="95th percentile" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Plate still className="p-5 md:p-6">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <p className="label flex items-center gap-2"><span className="hazard inline-block size-2.5" aria-hidden />AI examiner</p>
              <h2 className="display mt-1.5 text-[26px] font-semibold">Verdict time</h2>
            </div>
            <span className="label flex items-center gap-2"><Logo0G className="h-3 w-auto text-g0" /> {overview.data?.model ?? '—'}</span>
          </div>
          <Sparkline values={latencies} />
        </Plate>
        <Plate still className="flex flex-col justify-between gap-4 p-5 md:p-6">
          <div>
            <p className="label">Verdict mix</p>
            <div className="mt-4 flex h-3 w-full overflow-hidden bg-line" role="img" aria-label={`${ok} ok, ${corrections} corrections, ${stops} safe stops`}>
              <div style={{ width: `${(ok / total) * 100}%`, background: 'var(--ok)' }} />
              <div style={{ width: `${(corrections / total) * 100}%`, background: 'var(--warn)' }} />
              <div style={{ width: `${(stops / total) * 100}%`, background: 'var(--bad)' }} />
            </div>
          </div>
          <dl className="grid gap-2 text-[13px]">
            {[['OK', ok, 'var(--ok)'], ['Correction', corrections, 'var(--warn)'], ['Safe stop', stops, 'var(--bad)']].map(([k, v, c]) => (
              <div key={String(k)} className="flex items-center justify-between border-t border-line pt-2">
                <dt className="flex items-center gap-2"><span className="size-2" style={{ background: String(c) }} />{k}</dt>
                <dd className="font-mono tnum">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </Plate>
      </div>

      <div ref={replayRef} className="scroll-mt-5"><EpisodeReplay root={root} /></div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Plate still>
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <p className="label flex items-center gap-2"><span className="hazard inline-block size-2.5" aria-hidden />0G Chain anchors</p>
            {anchors.data?.contract && <HashChip value={anchors.data.contract} head={8} tail={6} />}
          </div>
          {rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">{anchors.isLoading ? 'Reading 0G Chain…' : 'No anchored sessions in recent blocks.'}</p>
          ) : (
            <ul>
              {rows.map((a) => (
                <li key={a.txHash} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                  <span className="label !text-[10.5px]" style={{ color: OUTCOME_TONE[a.outcome] }}>{a.outcome.replace('_', ' ')}</span>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <HashChip value={a.rootHash} head={8} tail={6} />
                    <HashChip value={a.txHash} href={a.link} head={6} tail={4} />
                    <span className="hash text-muted">{a.at ? new Date(a.at).toLocaleString([], { hour12: false }) : `block ${a.block}`}</span>
                  </div>
                  <button onClick={() => setPicked(a.rootHash)} className={`label border px-2.5 py-1.5 transition-colors hover:!text-ink ${root === a.rootHash ? '!text-accent' : ''}`} style={{ borderRadius: 3, borderColor: root === a.rootHash ? 'var(--accent)' : 'var(--line)' }}>
                    Replay
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Plate>

        <Plate still>
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <p className="label flex items-center gap-2"><span className="hazard inline-block size-2.5" aria-hidden />Judge and voice</p>
          </div>
          <EventFeed events={stream.events.filter((e) => e.track === '0g')} limit={9} />
        </Plate>
      </div>
    </div>
  );
}
