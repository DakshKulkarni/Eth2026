import { AnimatePresence, motion } from 'motion/react';
import type { LiveEvent } from '../lib/api';
import { describe, type Tone } from '../lib/describe';
import { cn } from '../lib/utils';
import { TrackMark } from './TrackMark';

const TONE: Record<Tone, string> = { ok: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)', info: 'var(--muted)' };

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour12: false });
}

export function EventRow({ e }: { e: LiveEvent }) {
  const d = describe(e);
  return (
    <div className="grid grid-cols-[62px_22px_1fr_auto] items-start gap-x-3 px-6 py-2.5">
      <span className="hash tnum pt-0.5 text-muted">{clock(e.at)}</span>
      <span className="grid h-5 place-items-center"><TrackMark track={e.track} /></span>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[13px] font-medium">
          <span className="inline-block size-1.5 shrink-0 rounded-full" style={{ background: TONE[d.tone] }} aria-hidden />
          <span className="truncate">{d.title}</span>
        </p>
        {d.detail && <p className="mt-0.5 truncate font-mono text-[11.5px] text-muted" title={d.detail}>{d.detail}</p>}
      </div>
      {d.ms !== undefined && <span className="hash tnum pt-0.5 text-muted">{d.ms} ms</span>}
    </div>
  );
}

export function EventFeed({ events, limit = 14, className }: { events: LiveEvent[]; limit?: number; className?: string }) {
  const shown = events.slice(0, limit);
  return (
    <div className={cn('overflow-hidden', className)}>
      {shown.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-muted">Waiting for activity. Start a session on the headset and it appears here.</p>
      ) : (
        <AnimatePresence initial={false}>
          {shown.map((e) => (
            <motion.div key={e.id} layout="position" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
              <EventRow e={e} />
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
