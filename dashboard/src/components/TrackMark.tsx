import { Server } from 'lucide-react';
import type { Track } from '../lib/api';
import { Logo0G, LogoENS, LogoWorld } from './logos';

export const TRACK_COLOR: Record<Track, string> = { '0g': 'var(--g0)', ens: 'var(--ens)', world: 'var(--world)', system: 'var(--muted)' };
export const TRACK_LABEL: Record<Track, string> = { '0g': '0G', ens: 'ENS', world: 'World', system: 'System' };

// The partner mark for a track, in its colour.
export function TrackMark({ track, className = 'h-[13px] w-auto' }: { track: Track; className?: string }) {
  const style = { color: TRACK_COLOR[track] };
  if (track === '0g') return <Logo0G className={className} style={style} />;
  if (track === 'ens') return <LogoENS className={className} style={style} />;
  if (track === 'world') return <LogoWorld className={className} style={style} />;
  return <Server className="size-3.5" style={style} />;
}
