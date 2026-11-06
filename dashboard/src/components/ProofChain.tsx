import { BadgeCheck } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import type { AnchorRow, CertificateRow, EpisodeView, Track } from '../lib/api';
import { shortHash } from '../lib/utils';
import { HashChip } from './HashChip';
import { Plate } from './Plate';
import { TrackMark } from './TrackMark';

interface NodeProps {
  track: Track;
  kicker: string;
  value: ReactNode;
  caption: ReactNode;
  index: number;
}

function Node({ track, kicker, value, caption, index }: NodeProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + index * 0.06, duration: 0.4 }} className="flex min-w-0 flex-col gap-2 py-4 lg:px-5 lg:py-1 lg:first:pl-0 lg:last:pr-0">
      <p className="label flex items-center gap-2"><TrackMark track={track} className="h-[11px] w-auto" />{kicker}</p>
      <div className="min-h-[24px] font-mono text-[13.5px] leading-snug">{value}</div>
      <div className="text-[12.5px] leading-snug text-muted">{caption}</div>
    </motion.div>
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
    <Plate still className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold">Latest passed test</h2>
          <p className="label mt-1">From the worker's phone to the licence, every link checked</p>
        </div>
        <span className="flex items-center gap-2 rounded-full bg-panel-2 px-3 py-1.5 text-[12.5px] font-medium" style={{ color: matches ? 'var(--ok)' : 'var(--muted)' }}>
          <BadgeCheck className="size-3.5" />
          {matches ? 'Same root hash in every proof' : 'Checking links'}
        </span>
      </div>

      <div className="grid divide-y divide-line lg:grid-cols-5 lg:divide-x lg:divide-y-0">
        <Node
          index={0}
          track="world"
          kicker="Human check"
          value={human.length ? <>id {human[2]?.slice(0, 8)}</> : skeleton}
          caption={human.length ? <>{human[1]} identity{acr ? `, ${acr} class` : ''}. Checked on the worker&apos;s phone.</> : 'Waiting for data'}
        />
        <Node
          index={1}
          track="0g"
          kicker="AI examiner"
          value={episode ? <>{episode.counts.observe ?? 0} verdicts</> : skeleton}
          caption={episode ? <>{episode.model} judged every step. {episode.counts.speech ?? 0} spoken.</> : 'Reading the stored session'}
        />
        <Node
          index={2}
          track="0g"
          kicker="0G Storage"
          value={root ? <HashChip value={root} head={8} tail={6} /> : skeleton}
          caption={episode ? <>{episode.events.length} records, hash chain {episode.verified ? 'verified' : 'not verified'}.</> : 'Downloading from 0G Storage'}
        />
        <Node
          index={3}
          track="0g"
          kicker="0G Chain anchor"
          value={anchor ? <HashChip value={anchor.txHash} href={anchor.link} head={8} tail={6} /> : skeleton}
          caption={anchor ? <>{anchor.outcome.replace('_', ' ')}{anchor.at ? ` at ${new Date(anchor.at).toLocaleTimeString([], { hour12: false })}` : ''}.</> : 'Looking up the anchor'}
        />
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
