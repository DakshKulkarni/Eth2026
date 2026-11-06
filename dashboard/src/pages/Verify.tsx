import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Check, Copy, Loader2, Search, ShieldAlert, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { HashChip } from '../components/HashChip';
import { Plate } from '../components/Plate';
import { StationQr } from '../components/StationQr';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../lib/api';
import { useAnchors, useCertificates } from '../lib/queries';
import { cn, daysLeft } from '../lib/utils';

type State = 'pending' | 'pass' | 'warn' | 'fail';
interface Check { title: string; state: State; detail?: React.ReactNode }

const LABEL = /^[a-z0-9-]{3,40}$/;
const normalise = (raw: string): string => raw.trim().toLowerCase().replace(/\.smartician\.eth$/, '').replace(/\s+/g, '');

function Mark({ state }: { state: State }) {
  if (state === 'pending') return <Loader2 className="size-[18px] animate-spin text-muted" />;
  if (state === 'pass') return <span className="grid size-[18px] place-items-center rounded-full bg-ok text-accent-ink"><Check className="size-3" strokeWidth={3} /></span>;
  if (state === 'warn') return <ShieldAlert className="size-[18px] text-warn" />;
  return <span className="grid size-[18px] place-items-center rounded-full bg-bad text-white"><X className="size-3" strokeWidth={3} /></span>;
}

export function Verify() {
  const { '*': rest } = useParams();
  const label = rest ? normalise(rest) : '';
  const navigate = useNavigate();
  const [input, setInput] = useState(label);
  const [copied, setCopied] = useState(false);
  const certs = useCertificates();
  const anchors = useAnchors();

  const cred = useQuery({ queryKey: ['credential', label], queryFn: () => api.credential(label), enabled: LABEL.test(label), retry: 0 });
  const root = cred.data?.evidence?.replace('0g://', '') ?? null;
  const episode = useQuery({ queryKey: ['episode', root], queryFn: () => api.episode(root!), enabled: Boolean(root), staleTime: Infinity });
  const anchor = anchors.data?.anchors.find((a) => a.rootHash === root) ?? null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = normalise(input);
    if (LABEL.test(next)) navigate(`/verify/${next}`);
  };

  const c = cred.data;
  const checks: Check[] = [];
  if (label && LABEL.test(label)) {
    checks.push({
      title: 'Licence found on ENS',
      state: cred.isLoading ? 'pending' : c && c.reason !== 'revoked_or_unknown' ? 'pass' : 'fail',
      detail: c ? (c.reason === 'revoked_or_unknown' ? 'No such licence, or it was revoked' : `${c.name} · read live from ENSv2 on Sepolia`) : undefined,
    });
    checks.push({
      title: 'Licence is current',
      state: cred.isLoading ? 'pending' : c?.valid ? 'pass' : 'fail',
      detail: c ? (c.valid ? `${daysLeft(c.expiresAt)} · expires ${c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : '—'}` : c.reason === 'expired' ? 'Expired' : 'Revoked') : undefined,
    });
    checks.push({
      title: 'Evidence record points to 0G Storage',
      state: cred.isLoading ? 'pending' : root ? 'pass' : 'fail',
      detail: root ? <HashChip value={root} head={10} tail={8} /> : c?.valid === false ? 'Records are gone with the licence' : 'The licence has no mrt.evidence record',
    });
    checks.push({
      title: 'Evidence root anchored on 0G Chain',
      state: !root ? (cred.isLoading ? 'pending' : 'fail') : anchors.isLoading || (anchors.isFetching && !anchors.data) ? 'pending' : anchor ? 'pass' : 'warn',
      detail: anchor ? <span>Anchored as {anchor.outcome.replace('_', ' ')} · <HashChip value={anchor.txHash} href={anchor.link} head={8} tail={6} /></span> : root ? (anchors.isError ? 'Could not read 0G Chain just now' : 'Not in the recent blocks that were scanned (it may be older)') : cred.isLoading ? undefined : 'No evidence record, so there is nothing to look up',
    });
    checks.push({
      title: 'Stored session downloaded and hash chain verified',
      state: !root ? (cred.isLoading ? 'pending' : 'fail') : episode.isLoading ? 'pending' : episode.data?.verified ? 'pass' : 'fail',
      detail: episode.data ? (episode.data.verified ? `${episode.data.events.length} records, ${episode.data.counts.observe ?? 0} AI verdicts by ${episode.data.model}` : episode.data.reason ?? 'The chain is broken') : !root && !cred.isLoading ? 'No evidence record, so there is no session to download' : undefined,
    });
    checks.push({
      title: 'Recorded result is a pass',
      state: !root ? (cred.isLoading ? 'pending' : 'fail') : episode.isLoading ? 'pending' : episode.data?.outcome === 'test_pass' && c?.verdict === 'test_pass' ? 'pass' : 'fail',
      detail: episode.data ? `Stored session: ${episode.data.outcome?.replace('_', ' ')} · licence record: ${(c?.verdict ?? '—').replace('_', ' ')}` : !root && !cred.isLoading ? 'No stored session to compare' : undefined,
    });
    checks.push({
      title: 'Proof of human from World',
      state: cred.isLoading ? 'pending' : c?.human ? 'pass' : 'warn',
      detail: c?.human ? <span className="hash">{c.human}</span> : c ? 'This licence carries no World record' : undefined,
    });
  }

  const pending = checks.some((x) => x.state === 'pending');
  const failed = checks.some((x) => x.state === 'fail');
  const warned = checks.some((x) => x.state === 'warn');
  const verdict = pending ? 'Checking' : failed ? (c && !c.valid ? 'Not valid' : 'Not verified') : warned ? 'Verified, with notes' : 'Verified';
  const tone = pending ? 'var(--muted)' : failed ? 'var(--bad)' : warned ? 'var(--warn)' : 'var(--ok)';
  const url = typeof window === 'undefined' || !label ? '' : `${window.location.origin}/verify/${label}`;

  return (
    <div className="grid gap-5">
      <Plate still className="p-5 md:p-6">
        <p className="text-[15px] font-semibold">Verify a licence</p>
        <h2 className="display mt-2 max-w-2xl text-[clamp(1.8rem,4vw,3rem)] font-semibold">Check any operator licence, without asking us.</h2>
        <form onSubmit={submit} className="mt-5 flex max-w-2xl gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Licence name</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="d1-cert  or  d1-cert.smartician.eth" spellCheck={false} autoCapitalize="none" className="h-12 w-full bg-panel-2 pl-10 pr-3 font-mono text-[14px] outline-none transition-colors focus:border-accent" style={{ borderRadius: 12 }} />
          </label>
          <button type="submit" className="h-12 bg-accent px-5 font-mono text-[12.5px] font-medium text-accent-ink" style={{ borderRadius: 12 }}>Verify</button>
        </form>
        {certs.data && certs.data.certificates.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="label">Recent</span>
            {certs.data.certificates.slice(0, 5).map((x) => (
              <Link key={x.label} to={`/verify/${x.label}`} className={cn('bg-panel-2 px-2.5 py-1 font-mono text-[12px] transition-colors hover:border-accent', x.label === label && 'border-accent text-accent')} style={{ borderRadius: 8 }}>{x.label}</Link>
            ))}
          </div>
        )}
      </Plate>

      {label && !LABEL.test(label) && <Plate still className="p-6 text-sm text-bad">That does not look like a licence name. Use letters, numbers and dashes, for example <span className="font-mono">d1-cert</span>.</Plate>}

      {label && LABEL.test(label) && (
        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <Plate still className="p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="label">Verification report</p>
                <h3 className="mt-1.5 break-all font-mono text-[18px] font-medium">{label}.smartician.eth</h3>
              </div>
              {c && <StatusBadge reason={c.reason} />}
            </div>
            <motion.p key={verdict} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="display mt-4 text-[clamp(2.4rem,6vw,4rem)] font-semibold leading-none" style={{ color: tone }}>{verdict}</motion.p>

            <ul className="mt-6">
              <AnimatePresence initial={false}>
                {checks.map((k, i) => (
                  <motion.li key={k.title} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.09, duration: 0.35 }} className="grid grid-cols-[24px_1fr] gap-3 border-t border-line py-3">
                    <span className="pt-0.5"><Mark state={k.state} /></span>
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium">{k.title}</p>
                      {k.detail && <p className="mt-1 break-words text-[12.5px] text-muted">{k.detail}</p>}
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>

            {c && c.valid && (
              <dl className="mt-4 grid gap-px bg-line sm:grid-cols-3" style={{ borderRadius: 12, overflow: 'hidden' }}>
                {[['Name on licence', c.alias ?? '—'], ['Class', c.class ?? '—'], ['Issued', c.issuedAt ? new Date(c.issuedAt).toLocaleString([], { hour12: false }) : '—']].map(([k, v]) => (
                  <div key={k} className="bg-panel px-3 py-2.5"><dt className="label">{k}</dt><dd className="mt-1 font-mono text-[13px]">{v}</dd></div>
                ))}
              </dl>
            )}
            {c?.description && <p className="mt-3 text-[12.5px] text-muted">{c.description}</p>}
            {root && (
              <div className="mt-5 flex flex-wrap gap-2">
                <Link to={`/0g?root=${root}`} className="label flex items-center gap-1.5 bg-panel-2 px-3 py-2 hover:!text-ink" style={{ borderRadius: 12 }}>Replay the session <ArrowUpRight className="size-3" /></Link>
                <Link to="/ens" className="label flex items-center gap-1.5 bg-panel-2 px-3 py-2 hover:!text-ink" style={{ borderRadius: 12 }}>Licence records <ArrowUpRight className="size-3" /></Link>
              </div>
            )}
          </Plate>

          <Plate still className="flex h-fit flex-col items-center gap-4 p-5 text-center">
            <p className="label self-start">Share this check</p>
            {url && <StationQr url={url} size={170} />}
            <p className="break-all font-mono text-[11.5px] text-muted">{url.replace(/^https?:\/\//, '')}</p>
            <button
              onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1300); } catch { /* clipboard blocked */ } }}
              className="label flex items-center gap-2 bg-panel-2 px-3 py-2 hover:!text-ink"
              style={{ borderRadius: 12 }}
            >
              {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}{copied ? 'Copied' : 'Copy link'}
            </button>
            <p className="text-[12px] leading-snug text-muted">Anyone can open this link. Every check runs live against ENS, 0G Chain and 0G Storage. Nothing comes from our database.</p>
          </Plate>
        </div>
      )}
    </div>
  );
}
