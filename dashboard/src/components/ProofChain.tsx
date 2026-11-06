import { BadgeCheck } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import type { AnchorRow, CertificateRow, EpisodeView, Track } from '../lib/api';
import { shortHash } from '../lib/utils';
import { HashChip } from './HashChip';
import { Plate } from './Plate';
import { TrackMark, TRACK_COLOR, TRACK_LABEL } from './TrackMark';

interface NodeProps {
  track: Track;
  kicker: string;
  value: ReactNode;
  caption: ReactNode;
  index: number;
}

function Node({ track, kicker, value, caption, index }: NodeProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + index * 0.09, duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="min-w-0 flex-1">
      <Plate still className="flex h-full flex-col gap-3 p-4" style={{ borderTop: `2px solid ${TRACK_COLOR[track]}` }}>
        <div className="flex items-center justify-between">
          <span className="label" style={{ color: TRACK_COLOR[track] }}>{TRACK_LABEL[track]}</span>
          <TrackMark track={track} />
        </div>
        <p className="label">{kicker}</p>
        <div className="min-h-[28px] font-mono text-[14px] leading-snug">{value}</div>
        <div className="mt-auto text-[12.5px] leading-snug text-muted">{caption}</div>
      </Plate>
    </motion.div>
  );
}

function Connector({ ok }: { ok: boolean }) {
  return (
    <div className="flex items-center justify-center py-1 lg:px-1 lg:py-0" aria-hidden>
      <div className="hidden w-8 lg:block">{ok ? <div className="flow-x" /> : <div className="h-0.5 w-full bg-line" />}</div>
      <div className="h-7 lg:hidden">{ok ? <div className="flow-y h-full" /> : <div className="h-full w-0.5 bg-line" />}</div>
    </div>
  );
}

interface Props {
  licence: CertificateRow | null;
  anchor: AnchorRow | null;
  episode: EpisodeView | null | undefined;
}

// The latest passed test, from the worker's check-in to the licence, with every link checked.
export function ProofChain({ licence, anchor, episode }: Props) {
  const root = licence?.evidence?.replace('0g://', '') ?? null;
  const human = licence?.human?.split(':') ?? [];
  const matches = Boolean(root && anchor && anchor.rootHash === root && episode?.verified);
  const acr = human.slice(3).join(':').split('/').pop();

  const skeleton = <span className="skeleton inline-block h-4 w-28" />;
  return (
    <Plate still className="p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label flex items-center gap-2"><span className="hazard inline-block size-2.5" aria-hidden />Proof chain</p>
          <h2 className="display mt-1.5 text-[26px] font-semibold">Latest passed test, end to end</h2>
        </div>
        <span className="label flex items-center gap-2 border px-2.5 py-1.5" style={{ borderRadius: 4, borderColor: matches ? 'var(--ok)' : 'var(--line)', color: matches ? 'var(--ok)' : undefined }}>
          <BadgeCheck className="size-3.5" />
          {matches ? 'Same root hash in every proof' : 'Checking links'}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-stretch">
        <Node
          index={0}
          track="world"
          kicker="Human check"
          value={human.length ? <>id {human[2]?.slice(0, 8)}</> : skeleton}
          caption={human.length ? <>{human[1]} identity{acr ? `, ${acr} class` : ''}. Checked on the worker&apos;s phone.</> : 'Waiting for data'}
        />
        <Connector ok={Boolean(human.length)} />
        <Node
          index={1}
          track="0g"
          kicker="AI examiner"
          value={episode ? <>{episode.counts.observe ?? 0} verdicts</> : skeleton}
          caption={episode ? <>{episode.model} judged every step. {episode.counts.speech ?? 0} spoken.</> : 'Reading the stored session'}
        />
        <Connector ok={Boolean(episode)} />
        <Node
          index={2}
          track="0g"
          kicker="0G Storage"
          value={root ? <HashChip value={root} head={8} tail={6} /> : skeleton}
          caption={episode ? <>{episode.events.length} records, hash chain {episode.verified ? 'verified' : 'not verified'}.</> : 'Downloading from 0G Storage'}
        />
        <Connector ok={Boolean(anchor)} />
        <Node
          index={3}
          track="0g"
          kicker="0G Chain anchor"
          value={anchor ? <HashChip value={anchor.txHash} href={anchor.link} head={8} tail={6} /> : skeleton}
          caption={anchor ? <>{anchor.outcome.replace('_', ' ')}{anchor.at ? ` at ${new Date(anchor.at).toLocaleTimeString([], { hour12: false })}` : ''}.</> : 'Looking up the anchor'}
        />
        <Connector ok={Boolean(licence)} />
        <Node
          index={4}
          track="ens"
          kicker="ENS licence"
          value={licence ? <span className="break-all">{licence.name}</span> : skeleton}
          caption={licence ? <>{licence.valid ? 'Valid' : 'Not valid'}{licence.expiresAt ? ` until ${new Date(licence.expiresAt).toLocaleDateString()}` : ''}. Record <span className="hash">mrt.evidence</span> = {shortHash(root, 6, 4)}.</> : 'Reading ENS'}
        />
      </div>
    </Plate>
  );
}
