import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { CountUp } from '../components/CountUp';
import { EventFeed } from '../components/EventFeed';
import { HashChip } from '../components/HashChip';
import { Plate } from '../components/Plate';
import { ProofChain } from '../components/ProofChain';
import { TrackMark, TRACK_COLOR } from '../components/TrackMark';
import { api, type LiveEvent, type Track } from '../lib/api';
import { useEventStream } from '../lib/events';

interface KpiProps {
  label: string;
  value: number | undefined;
  suffix?: string;
  caption: string;
  index: number;
  tint?: string;
}

function Kpi({ label, value, suffix, caption, index, tint }: KpiProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
      <Plate still className="flex h-full flex-col justify-between gap-4 p-5" style={tint ? { borderTop: `2px solid ${tint}` } : undefined}>
        <p className="label">{label}</p>
        <p className="display text-[52px] font-bold leading-none">
          {value === undefined ? <span className="skeleton inline-block h-11 w-20" /> : <CountUp value={value} suffix={suffix} />}
        </p>
        <p className="text-[12.5px] text-muted">{caption}</p>
      </Plate>
    </motion.div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] items-center gap-3 border-t border-line py-2.5 first:border-t-0">
      <dt className="label">{k}</dt>
      <dd className="min-w-0 truncate font-mono text-[12.5px]">{children}</dd>
    </div>
  );
}

function TrackStatus({ track, name, lamp, children }: { track: Track; name: string; lamp: string; children: React.ReactNode }) {
  return (
    <Plate tint={TRACK_COLOR[track]} className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-14 place-items-center rounded-md border border-line bg-panel-2"><TrackMark track={track} className="h-[17px] w-auto" /></span>
          <h3 className="display text-[24px] font-semibold">{name}</h3>
        </div>
        <span className="lamp" style={{ ['--lamp' as string]: lamp }} aria-hidden />
      </div>
      <dl>{children}</dl>
    </Plate>
  );
}

const count = (events: LiveEvent[], event: string) => events.filter((e) => e.event === event).length;

export function Overview() {
  const stream = useEventStream();
  const overview = useQuery({ queryKey: ['overview'], queryFn: api.overview, refetchInterval: 5000 });
  const anchors = useQuery({ queryKey: ['anchors'], queryFn: api.anchors, refetchInterval: 20000 });
  const certs = useQuery({ queryKey: ['certs'], queryFn: api.certificates, refetchInterval: 30000 });
  const backlog = useQuery({
    queryKey: ['events-backlog'],
    queryFn: async () => (await (await fetch('/api/events?limit=800')).json()) as { events: LiveEvent[] },
    refetchInterval: 8000,
  });

  const licences = certs.data?.certificates;
  const licence = licences?.find((c) => c.valid && c.human) ?? licences?.find((c) => c.valid) ?? null;
  const root = licence?.evidence?.replace('0g://', '') ?? null;
  const anchor = anchors.data?.anchors.find((a) => a.rootHash === root) ?? null;
  const episode = useQuery({ queryKey: ['episode', root], queryFn: () => api.episode(root!), enabled: Boolean(root), staleTime: Infinity });

  const all = backlog.data?.events ?? [];
  const verified = count(all, 'checkin_verified');
  const denied = count(all, 'checkin_denied') + count(all, 'checkin_expired') + count(all, 'checkin_cancelled');
  const lastVerdict = stream.events.find((e) => e.event === 'observe');
  const validCount = licences?.filter((c) => c.valid).length;
  const latestAnchor = anchors.data?.anchors[0];

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-3 xl:grid-cols-5">
        <Kpi index={0} label="Sessions anchored" value={anchors.data?.anchors.length} caption="On 0G Chain, recent blocks" tint={TRACK_COLOR['0g']} />
        <Kpi index={1} label="AI verdicts" value={overview.data?.judge.verdicts} caption="Judged by the 0G model since the server started" tint={TRACK_COLOR['0g']} />
        <Kpi index={2} label="Median verdict" value={overview.data?.judge.medianMs ?? undefined} suffix=" ms" caption={overview.data?.judge.p95Ms ? `Slowest 1 in 20: ${overview.data.judge.p95Ms} ms` : 'No verdicts yet'} tint={TRACK_COLOR['0g']} />
        <Kpi index={3} label="Valid licences" value={validCount} caption={licences ? `${licences.length} issued recently on ENS` : 'Reading ENS'} tint={TRACK_COLOR.ens} />
        <Kpi index={4} label="Humans verified" value={verified} caption={denied ? `${denied} did not complete` : 'By World, since the server started'} tint={TRACK_COLOR.world} />
      </div>

      <ProofChain licence={licence} anchor={anchor} episode={episode.data} />

      <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <Plate still>
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <p className="label flex items-center gap-2"><span className="hazard inline-block size-2.5" aria-hidden />Live event stream</p>
            <span className="label flex items-center gap-2">
              <span className="lamp" style={{ ['--lamp' as string]: stream.status === 'live' ? 'var(--ok)' : 'var(--warn)' }} />
              {stream.status === 'live' ? 'Connected' : stream.status === 'connecting' ? 'Connecting' : 'Offline'}
            </span>
          </div>
          <EventFeed events={stream.events} limit={13} />
        </Plate>

        <div className="grid content-start gap-5">
          <TrackStatus track="0g" name="0G" lamp="var(--ok)">
            <Row k="Judge">{overview.data?.model ?? '—'}</Row>
            <Row k="Last verdict">{lastVerdict ? `${String(lastVerdict.data.verdict)} · ${String(lastVerdict.data.ms)} ms` : 'none yet'}</Row>
            <Row k="Latest anchor">{latestAnchor ? <HashChip value={latestAnchor.txHash} href={latestAnchor.link} head={7} tail={5} /> : '—'}</Row>
            <Row k="Registry">{overview.data?.registry ? <HashChip value={overview.data.registry} head={7} tail={5} /> : '—'}</Row>
          </TrackStatus>
          <TrackStatus track="ens" name="ENS" lamp={certs.isError ? 'var(--bad)' : 'var(--ok)'}>
            <Row k="Parent">smartician.eth · Sepolia</Row>
            <Row k="Licences">{licences ? `${validCount} valid of ${licences.length}` : '—'}</Row>
            <Row k="Newest">{licences?.[0]?.name ?? '—'}</Row>
          </TrackStatus>
          <TrackStatus track="world" name="World" lamp={overview.data?.world ? 'var(--ok)' : 'var(--warn)'}>
            <Row k="Issuer">{overview.data?.world ? overview.data.world.replace('https://', '') : 'not configured'}</Row>
            <Row k="Verified">{verified}</Row>
            <Row k="Not completed">{denied}</Row>
          </TrackStatus>
        </div>
      </div>
    </div>
  );
}

