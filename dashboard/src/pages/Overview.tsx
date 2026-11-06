import { useQuery } from '@tanstack/react-query';
import { CountUp } from '../components/CountUp';
import { EventFeed } from '../components/EventFeed';
import { HashChip } from '../components/HashChip';
import { Plate } from '../components/Plate';
import { ProofChain } from '../components/ProofChain';
import { TrackMark } from '../components/TrackMark';
import { api, type LiveEvent, type Track } from '../lib/api';
import { useEventStream } from '../lib/events';

function Stat({ label, value, suffix, note }: { label: string; value: number | undefined; suffix?: string; note?: string }) {
  return (
    <div className="min-w-0">
      <p className="label">{label}</p>
      <p className="display mt-1.5 text-[34px] font-semibold tnum">
        {value === undefined ? <span className="skeleton inline-block h-8 w-14 align-middle" /> : <CountUp value={value} suffix={suffix} />}
      </p>
      {note && <p className="mt-1 truncate text-[12.5px] text-muted">{note}</p>}
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="label shrink-0">{k}</dt>
      <dd className="min-w-0 truncate text-right font-mono text-[12.5px]">{children}</dd>
    </div>
  );
}

function TrackStatus({ track, name, children }: { track: Track; name: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 p-6">
      <h3 className="mb-3 flex items-center gap-2.5 text-[15px] font-semibold">
        <TrackMark track={track} className="h-[14px] w-auto" />
        {name}
      </h3>
      <dl>{children}</dl>
    </section>
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
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-x-8 gap-y-6 px-1 md:grid-cols-5">
        <Stat label="Sessions anchored" value={anchors.data?.anchors.length} />
        <Stat label="AI verdicts" value={overview.data?.judge.verdicts} />
        <Stat label="Median verdict" value={overview.data?.judge.medianMs ?? undefined} suffix=" ms" />
        <Stat label="Valid licences" value={validCount} note={licences ? `${licences.length} issued` : undefined} />
        <Stat label="Humans verified" value={verified} note={denied ? `${denied} did not complete` : undefined} />
      </div>

      <ProofChain licence={licence} anchor={anchor} episode={episode.data} />

      <Plate still>
        <div className="grid divide-line md:grid-cols-3 md:divide-x">
          <TrackStatus track="0g" name="0G">
            <Row k="Judge">{overview.data?.model ?? '—'}</Row>
            <Row k="Last verdict">{lastVerdict ? `${String(lastVerdict.data.verdict)} · ${String(lastVerdict.data.ms)} ms` : 'none yet'}</Row>
            <Row k="Latest anchor">{latestAnchor ? <HashChip value={latestAnchor.txHash} href={latestAnchor.link} head={7} tail={5} /> : '—'}</Row>
            <Row k="Registry">{overview.data?.registry ? <HashChip value={overview.data.registry} head={7} tail={5} /> : '—'}</Row>
          </TrackStatus>
          <TrackStatus track="ens" name="ENS">
            <Row k="Parent">smartician.eth</Row>
            <Row k="Licences">{licences ? `${validCount} valid of ${licences.length}` : '—'}</Row>
            <Row k="Newest">{licences?.[0]?.name ?? '—'}</Row>
          </TrackStatus>
          <TrackStatus track="world" name="World">
            <Row k="Issuer">{overview.data?.world ? overview.data.world.replace('https://', '') : 'not configured'}</Row>
            <Row k="Verified">{verified}</Row>
            <Row k="Not completed">{denied}</Row>
          </TrackStatus>
        </div>
      </Plate>

      <Plate still>
        <div className="flex items-center justify-between px-6 pt-5">
          <p className="text-[15px] font-semibold">Activity</p>
          <span className="label">{stream.status === 'live' ? 'Connected' : stream.status === 'connecting' ? 'Connecting' : 'Offline'}</span>
        </div>
        <EventFeed events={stream.events} limit={12} />
      </Plate>
    </div>
  );
}
