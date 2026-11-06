import { useQuery } from '@tanstack/react-query';
import { Check, ChevronRight, ExternalLink, FlipVertical2, Maximize2, Radio, Video } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { EventFeed } from '../components/EventFeed';
import { MachineTwin } from '../components/MachineTwin';
import { Plate } from '../components/Plate';
import { api } from '../lib/api';
import { useEventStream } from '../lib/events';
import { useLiveSession } from '../lib/live';
import { useProcedure } from '../lib/queries';
import { cn } from '../lib/utils';

const mmss = (s: number | null) => (s === null ? '—' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

function NoSignal() {
  return (
    <div className="absolute inset-0 grid place-items-center overflow-hidden bg-bg">
      <div className="absolute inset-0 opacity-[0.07]" style={{ background: 'repeating-linear-gradient(-45deg, var(--ink) 0 2px, transparent 2px 14px)' }} />
      <div className="relative max-w-sm px-6 text-center">
        <Video className="mx-auto size-9 text-muted" strokeWidth={1.4} />
        <p className="display mt-4 text-[22px] font-semibold">No signal</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">Waiting for the headset. Open the app on the Quest and start a session. The picture appears here within a second or two.</p>
      </div>
    </div>
  );
}

export function Live() {
  const stream = useEventStream();
  const procedure = useProcedure();
  const session = useLiveSession(stream.events);
  const status = useQuery({ queryKey: ['live-status'], queryFn: api.live, refetchInterval: 1500 });
  const wrap = useRef<HTMLDivElement>(null);
  const [epoch, setEpoch] = useState(0);
  // The headset's GPU may hand the picture over upside down; this fixes it in the browser, and is remembered.
  const [flip, setFlip] = useState(() => {
    try { return localStorage.getItem('pd-live-flip') === '1'; } catch { return false; }
  });
  const toggleFlip = () => setFlip((f) => {
    try { localStorage.setItem('pd-live-flip', f ? '0' : '1'); } catch { /* storage blocked */ }
    return !f;
  });
  const active = Boolean(status.data?.active);

  // The motion-JPEG stream is one long request; reopen it if it drops.
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      if (status.data && status.data.ageMs !== null && status.data.ageMs > 4000) setEpoch((x) => x + 1);
    }, 4000);
    return () => clearInterval(t);
  }, [active, status.data]);

  const steps = procedure.data?.steps ?? [];
  const next = steps.find((s) => !session.done.has(s.id));
  const caption = session.verdict && Date.now() - Date.parse(session.verdict.at) < 14000 ? session.verdict : null;
  const fullscreen = () => void wrap.current?.requestFullscreen?.();

  return (
    <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
      <div className="grid content-start gap-5">
        <Plate still>
          <div ref={wrap} className="relative aspect-video w-full overflow-hidden bg-black" style={{ borderRadius: 14 }}>
            <img key={epoch} src={`/live/stream?e=${epoch}`} alt="Live view from the headset" className={cn('absolute inset-0 size-full object-contain transition-opacity duration-500', active ? 'opacity-100' : 'opacity-0')} style={{ transform: flip ? 'scaleY(-1)' : undefined }} />
            {!active && <NoSignal />}

            <div className="absolute left-3 top-3 flex items-center gap-2">
              <span className="label flex items-center gap-2 border px-2.5 py-1.5 " style={{ borderRadius: 8, background: 'color-mix(in srgb, var(--bg) 70%, transparent)', borderColor: active ? 'var(--bad)' : 'var(--line)', color: active ? 'var(--bad)' : undefined }}>
                <span className="lamp" style={{ ['--lamp' as string]: active ? 'var(--bad)' : 'var(--muted)' }} />{active ? 'Live video' : 'Offline'}
              </span>
              {active && <span className="label bg-panel-2 px-2.5 py-1.5 " style={{ borderRadius: 8, background: 'color-mix(in srgb, var(--bg) 70%, transparent)' }}>{status.data?.fps} fps · {status.data?.ageMs ?? 0} ms</span>}
            </div>
            <div className="absolute right-3 top-3 flex gap-2">
              <button onClick={toggleFlip} className="grid size-9 place-items-center border text-muted  hover:text-ink" style={{ borderRadius: 12, borderColor: flip ? 'var(--accent)' : 'var(--line)', color: flip ? 'var(--accent)' : undefined, background: 'color-mix(in srgb, var(--bg) 70%, transparent)' }} aria-label="Flip the picture upside down" title="Flip upside down"><FlipVertical2 className="size-4" /></button>
              <button onClick={fullscreen} className="grid size-9 place-items-center bg-panel-2 text-muted  hover:text-ink" style={{ borderRadius: 12, background: 'color-mix(in srgb, var(--bg) 70%, transparent)' }} aria-label="Full screen"><Maximize2 className="size-4" /></button>
            </div>

            <AnimatePresence>
              {caption && (
                <motion.div key={caption.at} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute inset-x-4 bottom-4 border px-4 py-3 backdrop-blur-md" style={{ borderRadius: 12, borderColor: 'var(--warn)', background: 'color-mix(in srgb, var(--bg) 78%, transparent)' }}>
                  <p className="label !text-warn">AI technician{caption.ms ? ` · ${caption.ms} ms` : ''}</p>
                  <p className="mt-1 text-[clamp(14px,1.6vw,20px)] font-medium leading-snug">{caption.line}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="grid gap-px border-t border-line bg-line sm:grid-cols-4">
            {[
              ['Session', session.session ?? '—'],
              ['Mode', session.mode ? session.mode.toUpperCase() : '—'],
              ['Elapsed', mmss(session.elapsed)],
              ['Steps', `${session.done.size} / ${session.total || '—'}`],
            ].map(([k, v]) => (
              <div key={k} className="bg-panel px-4 py-3"><p className="label">{k}</p><p className="mt-1 font-mono text-[15px]">{v}</p></div>
            ))}
          </div>
          <div className="h-1 bg-line"><div className="h-full bg-accent transition-all duration-500" style={{ width: `${session.total ? (session.done.size / session.total) * 100 : 0}%` }} /></div>
        </Plate>

        <Plate still>
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <p className="text-[15px] font-semibold">AI technician, live</p>
            <span className="label flex items-center gap-2"><span className="lamp" style={{ ['--lamp' as string]: stream.status === 'live' ? 'var(--ok)' : 'var(--warn)' }} />{stream.status === 'live' ? 'Connected' : 'Reconnecting'}</span>
          </div>
          <EventFeed events={stream.events.filter((e) => e.track === '0g' && e.event !== 'session_start')} limit={7} />
        </Plate>
      </div>

      <div className="grid content-start gap-5">
        <Plate still className="p-5">
          <p className="text-[15px] font-semibold mb-3">Machine, as the worker sees it</p>
          <MachineTwin machine={session.machine} />
        </Plate>

        <Plate still className="p-5">
          <p className="label mb-2 flex items-center justify-between"><span>Procedure</span><span>{session.done.size} / {steps.length}</span></p>
          <ol className="max-h-[300px] overflow-y-auto pr-1">
            {steps.map((st) => {
              const done = session.done.has(st.id);
              const isNext = next?.id === st.id && session.session !== null;
              return (
                <li key={st.id} className={cn('flex items-center gap-2.5 border-b border-line py-1.5 text-[12.5px]', isNext ? 'text-ink' : !done && 'text-muted')}>
                  <span className="grid size-4 shrink-0 place-items-center">{done ? <Check className="size-3.5 text-ok" /> : isNext ? <ChevronRight className="size-3.5 text-accent" /> : <span className="size-1.5 bg-line" />}</span>
                  <span className="truncate">{st.title}</span>
                  {st.checkpoint && <span className="label ml-auto !text-[9.5px]" style={{ color: done ? 'var(--ok)' : undefined }}>CP</span>}
                </li>
              );
            })}
          </ol>
        </Plate>

        <Plate still className="p-5">
          <p className="label flex items-center gap-2"><Radio className="size-3.5" />Meta casting, for the full view</p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">This page shows the virtual machine and panels from the worker&apos;s eyes. To also show the real room through passthrough, cast the headset with Meta in a second window.</p>
          <ol className="mt-3 grid list-decimal gap-1 pl-5 text-[12.5px] text-muted">
            <li>Put the headset on and open the sharing menu.</li>
            <li>Choose Cast, then your browser or the Meta Horizon app.</li>
          </ol>
          <a href="https://www.oculus.com/casting/" target="_blank" rel="noreferrer" className="label mt-4 inline-flex items-center gap-2 bg-panel-2 px-3 py-2 hover:!text-ink" style={{ borderRadius: 12 }}>Open Meta casting <ExternalLink className="size-3.5" /></a>
        </Plate>
      </div>
    </div>
  );
}
