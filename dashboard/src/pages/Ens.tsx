import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { EventFeed } from '../components/EventFeed';
import { HashChip } from '../components/HashChip';
import { LicenceDialog } from '../components/LicenceDialog';
import { Stat } from '../components/Stat';
import { Plate } from '../components/Plate';
import { StatusBadge } from '../components/StatusBadge';
import { LogoWorld } from '../components/logos';
import { api } from '../lib/api';
import { useEventStream } from '../lib/events';
import { useCertificates } from '../lib/queries';
import { daysLeft } from '../lib/utils';

function KV({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-start gap-3 border-t border-line py-2.5 first:border-t-0">
      <dt className="font-mono text-[12px] text-muted">{k}</dt>
      <dd className="min-w-0 break-all font-mono text-[12.5px]">{children}</dd>
    </div>
  );
}

export function Ens() {
  const stream = useEventStream();
  const certs = useCertificates();
  const passport = useQuery({ queryKey: ['passport', 'cnc-01'], queryFn: () => api.passport('cnc-01'), refetchInterval: 60_000 });
  const chain = useQuery({ queryKey: ['chain'], queryFn: api.chain, staleTime: Infinity });
  const [open, setOpen] = useState<string | null>(null);

  const list = certs.data?.certificates;
  const valid = list?.filter((c) => c.valid).length;
  const gone = list ? list.length - (valid ?? 0) : undefined;
  const withHuman = list?.filter((c) => c.human).length;
  const p = passport.data;
  const e = chain.data?.ens;
  const addr = (a: string) => `https://sepolia.etherscan.io/address/${a}`;

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-x-8 gap-y-6 px-1 md:grid-cols-4">
        <Stat i={0} label="Licences" value={list?.length} caption="Issued in recent blocks" />
        <Stat i={1} label="Valid" value={valid} caption="Readable on ENS right now" />
        <Stat i={2} label="Revoked or expired" value={gone} caption="No longer valid" />
        <Stat i={3} label="With human proof" value={withHuman} caption="Carry a World mrt.human record" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Plate still className="p-5 md:p-6">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-semibold">Machine passport</p>
              <h2 className="display mt-1.5 break-all text-[20px] font-semibold">{p?.name ?? 'cnc-01.smartician.eth'}</h2>
            </div>
            <span className="label flex items-center gap-2 border px-2 py-1" style={{ borderRadius: 8, color: p?.registered ? 'var(--ok)' : 'var(--warn)', borderColor: p?.registered ? 'var(--ok)' : 'var(--warn)' }}>
              <span className="size-1.5" style={{ background: p?.registered ? 'var(--ok)' : 'var(--warn)' }} />{p ? (p.registered ? 'Registered' : 'Not registered') : 'Reading'}
            </span>
          </div>
          {passport.isLoading && <div className="grid gap-2"><span className="skeleton h-4 w-full" /><span className="skeleton h-4 w-5/6" /><span className="skeleton h-4 w-2/3" /></div>}
          {passport.isError && <p className="text-sm text-bad">Could not read the passport from ENS.</p>}
          {p && (
            <dl>
              <KV k="owner">{p.owner ? <HashChip value={p.owner} href={addr(p.owner)} head={8} tail={6} /> : '—'}</KV>
              <KV k="mrt.model">{p.model ?? '—'}</KV>
              <KV k="mrt.procedure">{p.procedure ? <HashChip value={p.procedure} head={14} tail={8} /> : '—'}</KV>
              <KV k="mrt.guide">{p.guide ? `${p.guide} · v${p.guideVersion ?? '?'}` : '—'}</KV>
              <KV k="description">{p.description ?? '—'}</KV>
              <KV k="expires">{p.expiresAt ? `${new Date(p.expiresAt).toLocaleDateString()} · ${daysLeft(p.expiresAt)}` : '—'}</KV>
            </dl>
          )}
          <p className="mt-3 text-[11.5px] text-muted">{p?.readFrom ?? 'Read live from ENS on Sepolia'}</p>
        </Plate>

        <Plate still className="p-5 md:p-6">
          <p className="text-[15px] font-semibold">ENSv2 contracts · Sepolia</p>
          <dl className="mt-3">
            {e ? (
              <>
                <KV k="registrar"><HashChip value={e.registrar} href={addr(e.registrar)} head={8} tail={6} /></KV>
                <KV k="resolver"><HashChip value={e.resolver} href={addr(e.resolver)} head={8} tail={6} /></KV>
                <KV k="registry"><HashChip value={e.userRegistry} href={addr(e.userRegistry)} head={8} tail={6} /></KV>
                <KV k="issuer"><HashChip value={e.issuer} href={addr(e.issuer)} head={8} tail={6} /></KV>
              </>
            ) : <span className="skeleton block h-24 w-full" />}
          </dl>
          <p className="mt-3 text-[11.5px] leading-relaxed text-muted">The issuer wallet can only write the record keys it was granted. Anyone else is refused by the resolver.</p>
        </Plate>
      </div>

      <Plate still>
        <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
          <p className="text-[15px] font-semibold">Licences</p>
          <span className="label">{list ? `${list.length} shown` : 'Reading ENS…'}</span>
        </div>
        {certs.isError && <p className="px-4 py-8 text-center text-sm text-bad">Could not read licences from the chain.</p>}
        {list && list.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">No licences yet. Pass a test and the first one appears here.</p>}
        <ul>
          {list?.map((c, i) => (
            <motion.li key={c.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <button onClick={() => setOpen(c.label)} className="grid w-full grid-cols-[96px_1fr_auto] items-center gap-3 border-b border-line px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-panel-2 sm:grid-cols-[96px_1.2fr_1fr_auto]">
                <StatusBadge reason={c.reason} />
                <div className="min-w-0">
                  <p className="truncate font-mono text-[13.5px] font-medium">{c.name}</p>
                  <p className="mt-0.5 truncate text-[12px] text-muted">{c.alias ? `Name: ${c.alias}` : 'No name set'} · {c.valid ? daysLeft(c.expiresAt) : c.reason === 'expired' ? 'expired' : 'revoked'}</p>
                </div>
                <div className="hidden min-w-0 items-center gap-2 sm:flex">
                  {c.human ? <span className="label flex items-center gap-1.5 !tracking-[0.08em]"><LogoWorld className="h-3 w-auto text-world" />{c.human.split(':')[2]?.slice(0, 8)}</span> : <span className="label">no human proof</span>}
                  {c.evidence && <HashChip value={c.evidence.replace('0g://', '')} head={6} tail={4} />}
                </div>
                <ChevronRight className="size-4 text-muted" />
              </button>
            </motion.li>
          ))}
        </ul>
      </Plate>

      <Plate still>
        <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
          <p className="text-[15px] font-semibold">ENS activity</p>
        </div>
        <EventFeed events={stream.events.filter((x) => x.track === 'ens')} limit={8} />
      </Plate>

      <LicenceDialog label={open} onClose={() => setOpen(null)} />
    </div>
  );
}
