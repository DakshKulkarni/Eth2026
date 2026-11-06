import { useQuery } from '@tanstack/react-query';
import { Check, Lock, LockOpen } from 'lucide-react';
import { motion } from 'motion/react';
import { CountUp } from '../components/CountUp';
import { EventFeed } from '../components/EventFeed';
import { Stat } from '../components/Stat';
import { Plate } from '../components/Plate';
import { StationQr } from '../components/StationQr';
import { LogoWorld } from '../components/logos';
import { api, type LiveEvent } from '../lib/api';
import { useEventStream } from '../lib/events';
import { useBacklog, useCertificates, useOverview } from '../lib/queries';

const count = (events: LiveEvent[], name: string) => events.filter((e) => e.event === name).length;

const CHECKS = [
  'Signature verified with World’s published keys (RS256)',
  'Issuer and audience match this app’s client',
  'Token not expired',
  'Authentication is fresh: no older than this attempt',
  'Authentication method (amr) is present',
];

export function World() {
  const stream = useEventStream();
  const overview = useOverview();
  const backlog = useBacklog();
  const certs = useCertificates();
  const gate = useQuery({ queryKey: ['worker-ready'], queryFn: api.workerReady, refetchInterval: 3000 });

  const all = backlog.data?.events ?? [];
  const started = count(all, 'checkin_started');
  const verified = count(all, 'checkin_verified');
  const notDone = count(all, 'checkin_denied') + count(all, 'checkin_expired') + count(all, 'checkin_cancelled') + count(all, 'checkin_error');
  const claimed = count(all, 'claim');
  const licences = all.filter((e) => e.event === 'certificate' && e.data.ok).length;
  const env = overview.data?.world ? (overview.data.world.includes('sandbox') ? 'Sandbox' : 'Production') : 'Not configured';

  const steps = [
    { k: 'Check-in started', v: started, c: 'Worker opened the phone page' },
    { k: 'Human verified', v: verified, c: 'Signed World result accepted' },
    { k: 'Bound to a session', v: claimed, c: 'Headset unlocked Test mode' },
    { k: 'Licence issued', v: licences, c: 'With a mrt.human record' },
  ];
  const top = Math.max(1, started);

  // Humans behind licences: the same id on more than one licence is shown, not hidden.
  const byHuman = new Map<string, string[]>();
  for (const c of certs.data?.certificates ?? []) {
    const id = c.human?.split(':')[2];
    if (id) byHuman.set(id, [...(byHuman.get(id) ?? []), c.name]);
  }

  const g = gate.data;
  const open = Boolean(g?.required === false || g?.ready);
  const url = typeof window === 'undefined' ? '' : `${window.location.origin}/checkin`;

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-x-8 gap-y-6 px-1 md:grid-cols-4">
        <Stat i={0} label="Check-ins" value={started} caption="Started since the server began" />
        <Stat i={1} label="Verified" value={verified} caption="Real person confirmed by World" />
        <Stat i={2} label="Not completed" value={notDone} caption="Denied, expired or cancelled" />
        <Stat i={3} label="Licences with proof" value={[...byHuman.values()].flat().length} caption="Carry a World human record" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Plate still className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[15px] font-semibold">Test mode gate</p>
              <h2 className="display mt-1.5 text-[22px] font-semibold" style={{ color: open ? 'var(--ok)' : 'var(--warn)' }}>
                {g === undefined ? '…' : g.required === false ? 'Open · World not required' : g.ready ? 'Unlocked' : 'Locked'}
              </h2>
              <p className="mt-2 max-w-md text-[13.5px] text-muted">
                {g?.ready
                  ? <>A verified worker is waiting{g.alias ? <> — <span className="text-ink">{g.alias}</span></> : null}, id <span className="hash text-ink">{g.humanTag}</span>, valid for {Math.max(1, Math.round((g.secondsLeft ?? 0) / 60))} more minutes. Tapping Test mode in the headset will offer to start as them.</>
                  : g?.required === false
                    ? 'World is not configured on the server, so Test mode is not gated.'
                    : 'No verified worker is waiting. The headset will ask the worker to check in on their phone first.'}
              </p>
            </div>
            <div className="grid size-14 shrink-0 place-items-center bg-panel-2" style={{ borderRadius: 14, color: open ? 'var(--ok)' : 'var(--warn)' }}>
              {open ? <LockOpen className="size-6" /> : <Lock className="size-6" />}
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2 border-t border-line pt-4">
            <LogoWorld className="h-4 w-auto text-world" />
            <span className="label">{env} · {overview.data?.world?.replace('https://', '') ?? '—'}</span>
            <span className="label ml-auto">Hackathon build: test identities</span>
          </div>
        </Plate>

        <Plate still className="flex items-center gap-5 p-5 md:p-6">
          {url && <StationQr url={url} />}
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">Station code</p>
            <h3 className="display mt-1.5 text-[20px] font-semibold">Scan to check in</h3>
            <p className="mt-2 break-all font-mono text-[12px] text-muted">{url.replace(/^https?:\/\//, '')}</p>
            <p className="mt-2 text-[12.5px] leading-snug text-muted">Show this on a screen at the station. The worker scans it before putting the headset on.</p>
          </div>
        </Plate>
      </div>

      <Plate still className="p-5 md:p-6">
        <p className="text-[15px] font-semibold">From check-in to licence</p>
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          {steps.map((s, i) => (
            <motion.div key={s.k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }}>
              <div className="flex items-baseline justify-between">
                <span className="label">{s.k}</span>
                <span className="display text-[22px] font-semibold leading-none"><CountUp value={s.v} /></span>
              </div>
              <div className="mt-3 h-2 bg-line"><motion.div className="h-full" style={{ background: 'var(--world)' }} initial={{ width: 0 }} animate={{ width: `${(s.v / top) * 100}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} /></div>
              <p className="mt-2 text-[12px] text-muted">{s.c}</p>
            </motion.div>
          ))}
        </div>
      </Plate>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Plate still>
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <p className="text-[15px] font-semibold">World activity</p>
          </div>
          <EventFeed events={stream.events.filter((e) => e.track === 'world')} limit={9} />
        </Plate>

        <div className="grid content-start gap-5">
          <Plate still className="p-5">
            <p className="text-[15px] font-semibold">What the server checks</p>
            <ul className="mt-3 grid gap-2.5">
              {CHECKS.map((c) => (
                <li key={c} className="flex items-start gap-2.5 text-[13px]"><Check className="mt-0.5 size-4 shrink-0 text-ok" />{c}</li>
              ))}
            </ul>
            <p className="mt-3 border-t border-line pt-3 text-[12px] leading-snug text-muted">The browser result is never trusted. Test mode and the licence stay locked until the server accepts the signed token.</p>
          </Plate>
          <Plate still className="p-5">
            <p className="text-[15px] font-semibold">Humans behind licences</p>
            {byHuman.size === 0 ? (
              <p className="mt-3 text-[13px] text-muted">{certs.isLoading ? 'Reading ENS…' : 'No licence carries a human record yet.'}</p>
            ) : (
              <ul className="mt-3">
                {[...byHuman.entries()].map(([id, names]) => (
                  <li key={id} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0">
                    <LogoWorld className="h-3.5 w-auto text-world" />
                    <span className="hash">{id}</span>
                    <span className="min-w-0 flex-1 truncate text-right text-[12.5px] text-muted">{names.join(', ')}</span>
                    {names.length > 1 && <span className="label !text-[9.5px]" style={{ color: 'var(--warn)' }}>×{names.length}</span>}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11.5px] leading-snug text-muted">The same id on several licences is shown, not blocked. A person can be recognised across licences, not identified.</p>
          </Plate>
        </div>
      </div>
    </div>
  );
}
