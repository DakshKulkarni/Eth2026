import { Check, ExternalLink, Headset, UserRound, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Plate } from '../components/Plate';
import { StationQr } from '../components/StationQr';
import { LogoENS, LogoWorld } from '../components/logos';
import { THEMES, setTheme, useTheme } from '../lib/theme';
import { cn } from '../lib/utils';

type Phase = 'intro' | 'starting' | 'waiting' | 'verified' | 'done' | 'failed';
interface Started { checkinId: string; userCode: string; link: string; qrPng: string; secondsLeft: number }
interface Status { status: string; reason: string | null; secondsLeft: number; name: string | null; humanTag: string | null }

const slug = (text: string): string => text.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14);
const mmss = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const EASE = [0.22, 1, 0.36, 1] as const;

async function call<T>(path: string, body?: unknown): Promise<{ ok: boolean; body: T }> {
  const res = await fetch(path, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { ok: res.ok, body: (await res.json().catch(() => ({}))) as T };
}

// A ring that empties as time runs out.
function Ring({ value, total, children, tint = 'var(--accent)' }: { value: number; total: number; children: ReactNode; tint?: string }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, total ? value / total : 0));
  return (
    <div className="relative grid size-32 place-items-center">
      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--line)" strokeWidth="4" />
        <motion.circle cx="60" cy="60" r={r} fill="none" stroke={tint} strokeWidth="4" strokeLinecap="butt" strokeDasharray={c} animate={{ strokeDashoffset: c * (1 - frac) }} transition={{ duration: 0.9, ease: 'linear' }} />
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  );
}

function Stepper({ phase }: { phase: Phase }) {
  const at = phase === 'intro' || phase === 'starting' || phase === 'waiting' || phase === 'failed' ? 0 : phase === 'verified' ? 1 : 2;
  const steps = ['Verify', 'Name', 'Headset'];
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s} className="grid gap-2" aria-current={i === at ? 'step' : undefined}>
          <div className="h-[3px] bg-line">
            <motion.div className="h-full bg-accent" initial={false} animate={{ width: i < at ? '100%' : i === at ? (phase === 'waiting' ? '55%' : phase === 'done' ? '100%' : '25%') : '0%' }} transition={{ duration: 0.6, ease: EASE }} />
          </div>
          <span className={cn('label !text-[10.5px]', i <= at && '!text-ink')}>{String(i + 1).padStart(2, '0')} · {s}</span>
        </li>
      ))}
    </ol>
  );
}

function Tick({ size = 88, tint = 'var(--ok)' }: { size?: number; tint?: string }) {
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} fill="none" aria-hidden>
      <motion.circle cx="48" cy="48" r="42" stroke={tint} strokeWidth="3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, ease: EASE }} />
      <motion.path d="M30 50 l13 13 l25 -28" stroke={tint} strokeWidth="5" strokeLinecap="square" strokeLinejoin="miter" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.55, duration: 0.45, ease: EASE }} />
    </svg>
  );
}

const card = { initial: { opacity: 0, y: 18, filter: 'blur(4px)' }, animate: { opacity: 1, y: 0, filter: 'blur(0px)' }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.35, ease: EASE } } as const;

function Primary({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={cn('flex h-14 w-full items-center justify-center gap-3 bg-accent px-5 font-mono text-[14px] font-medium text-accent-ink transition-transform active:scale-[0.98] disabled:opacity-50', rest.className)} style={{ borderRadius: 12 }}>
      {children}
    </button>
  );
}

export function CheckIn() {
  const theme = useTheme();
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const preview = import.meta.env.DEV ? (params.get('preview') as Phase | null) : null; // design preview, development only

  const [phase, setPhase] = useState<Phase>(preview ?? 'intro');
  const [info, setInfo] = useState<Started | null>(preview ? { checkinId: 'preview', userCode: 'V593G-CHLQC', link: '#', qrPng: '', secondsLeft: 1140 } : null);
  const [status, setStatus] = useState<Status | null>(preview ? { status: 'verified', reason: preview === 'failed' ? 'The supervisor denied the request' : null, secondsLeft: 1680, name: 'Daksh', humanTag: '5c998d83' } : null);
  const [name, setName] = useState('');
  const [error, setError] = useState(preview === 'failed' ? 'The request was denied.' : '');
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(preview ? 1140 : 0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wide = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

  const stop = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const remember = (id: string | null) => { try { id ? sessionStorage.setItem('checkin', id) : sessionStorage.removeItem('checkin'); } catch { /* storage blocked */ } };
  const fail = useCallback((reason: string) => { stop(); remember(null); setError(reason); setPhase('failed'); }, []);

  const poll = useCallback(async (id: string) => {
    try {
      const r = await call<Status>(`/checkin/${id}`);
      if (!r.ok) return fail('This check-in is no longer available.');
      const c = r.body;
      setStatus(c);
      setLeft(c.secondsLeft);
      if (c.status === 'pending') { timer.current = setTimeout(() => void poll(id), 2000); return; }
      if (c.status === 'verified') { stop(); try { navigator.vibrate?.(60); } catch { /* not supported */ } setPhase(c.name ? 'done' : 'verified'); return; }
      if (c.status === 'denied') return fail(c.reason || 'The request was denied.');
      if (c.status === 'expired') return fail(c.reason || 'The request expired before it was approved.');
      if (c.status === 'cancelled') return fail('The check-in was cancelled.');
      fail(c.reason || 'World could not complete the request.');
    } catch {
      timer.current = setTimeout(() => void poll(id), 3000);
    }
  }, [fail]);

  // Resume a verified check-in if the page was reloaded.
  useEffect(() => {
    if (preview) return;
    let saved: string | null = null;
    try { saved = sessionStorage.getItem('checkin'); } catch { /* storage blocked */ }
    if (!saved) return;
    void call<Status>(`/checkin/${saved}`).then((r) => {
      if (r.ok && r.body.status === 'verified') { setInfo({ checkinId: saved!, userCode: '', link: '', qrPng: '', secondsLeft: 0 }); setStatus(r.body); setLeft(r.body.secondsLeft); setPhase(r.body.name ? 'done' : 'verified'); } else remember(null);
    });
  }, [preview]);

  // A once-a-second countdown while waiting or checked in.
  useEffect(() => {
    if (preview || (phase !== 'waiting' && phase !== 'done')) return;
    const t = setInterval(() => setLeft((x) => Math.max(0, x - 1)), 1000);
    return () => clearInterval(t);
  }, [phase, preview]);
  useEffect(() => () => stop(), []);

  const begin = async () => {
    setBusy(true);
    setPhase('starting');
    try {
      const r = await call<Started & { error?: string }>('/checkin/start', {});
      if (!r.ok) return fail(r.body.error === 'world_not_configured' ? 'World is not set up on the server yet.' : 'Could not reach World. Please try again in a moment.');
      setInfo(r.body);
      setLeft(r.body.secondsLeft);
      remember(r.body.checkinId);
      setPhase('waiting');
      void poll(r.body.checkinId);
    } catch {
      fail('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    stop();
    if (info) void call(`/checkin/${info.checkinId}/cancel`, {});
    remember(null);
    setPhase('intro');
  };

  const saveName = async (withName: boolean) => {
    if (!info) return;
    setBusy(true);
    const r = await call<{ error?: string }>(`/checkin/${info.checkinId}/name`, { name: withName ? name : '' });
    if (!r.ok) { setBusy(false); return fail('The verification is no longer valid. Please check in again.'); }
    const s = await call<Status>(`/checkin/${info.checkinId}`);
    setBusy(false);
    if (s.ok) { setStatus(s.body); setLeft(s.body.secondsLeft); }
    setPhase('done');
  };

  const preview2 = slug(name);
  const licence = preview2.length >= 2 ? `${preview2}-cert` : 'your-name-cert';

  return (
    <div className="relative min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col px-5 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-accent text-accent-ink" aria-hidden>
              <svg viewBox="0 0 32 32" className="size-6" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="square"><path d="M7 24V8l9 8 9-8v16" /></svg>
            </div>
            <div>
              <p className="text-[15px] font-semibold">Proof Deck</p>
              <p className="display mt-1 text-[22px] font-semibold">Operator check-in</p>
            </div>
          </div>
          <div className="flex gap-1.5" role="radiogroup" aria-label="Colour theme">
            {THEMES.map((t) => (
              <button key={t.id} role="radio" aria-checked={theme === t.id} aria-label={t.label} onClick={() => setTheme(t.id)} className={cn('size-5 rounded-[4px] bg-panel-2', theme === t.id && 'outline-2 outline-offset-2 outline-ink')} style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)` }} />
            ))}
          </div>
        </header>

        <Stepper phase={phase} />

        <main className="mt-6 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            {(phase === 'intro' || phase === 'starting') && (
              <motion.div key="intro" {...card}>
                <Plate still className="p-6">
                  <p className="label flex items-center gap-2"><LogoWorld className="h-3.5 w-auto text-world" />World · proof of human</p>
                  <h1 className="display mt-3 text-[clamp(2.4rem,11vw,3.4rem)] font-semibold">Prove you&apos;re a real person before you train.</h1>
                  <p className="mt-4 text-[15px] leading-relaxed text-muted">World checks that one real human is taking this test. No personal details are shared. It takes about ten seconds, and Test mode unlocks on the headset when it succeeds.</p>
                  <ul className="mt-6 grid gap-3">
                    {[[UserRound, 'Verify with World', 'Approve one request in the World app.'], [LogoENS, 'Name your licence', 'Optional. It appears on your ENS licence.'], [Headset, 'Put on the headset', 'Tap Test mode and start.']].map(([Icon, t, d], i) => {
                      const I = Icon as typeof Headset;
                      return (
                        <motion.li key={String(t)} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.1, duration: 0.4 }} className="flex items-start gap-3.5 border-t border-line pt-3">
                          <span className="grid size-9 shrink-0 place-items-center bg-panel-2" style={{ borderRadius: 12 }}><I className="h-4 w-auto" strokeWidth={1.7} /></span>
                          <span><span className="block text-[14px] font-medium">{String(t)}</span><span className="block text-[12.5px] text-muted">{String(d)}</span></span>
                        </motion.li>
                      );
                    })}
                  </ul>
                  <Primary onClick={() => void begin()} disabled={busy} className="mt-7"><LogoWorld className="h-5 w-auto" />{phase === 'starting' ? 'Contacting World…' : 'Verify with World'}</Primary>
                  <p className="mt-3 text-center text-[12.5px] text-muted">Learn mode needs no check-in.</p>
                </Plate>
              </motion.div>
            )}

            {phase === 'waiting' && info && (
              <motion.div key="waiting" {...card}>
                <Plate still className="grid justify-items-center gap-5 p-6 text-center">
                  <Ring value={left} total={1200}>
                    <motion.span animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.8, repeat: Infinity }} className="grid place-items-center"><LogoWorld className="h-8 w-auto text-world" /></motion.span>
                    <p className="hash tnum mt-1.5 text-muted">{mmss(left)}</p>
                  </Ring>
                  <div>
                    <h2 className="display text-[22px] font-semibold">Waiting for World</h2>
                    <p className="mt-2 text-[14px] text-muted">Open World, approve the request, then come back. This page updates by itself.</p>
                  </div>
                  <a href={info.link} target="_blank" rel="noopener" className="flex h-14 w-full items-center justify-center gap-3 bg-accent font-mono text-[14px] font-medium text-accent-ink active:scale-[0.98]" style={{ borderRadius: 12 }}><LogoWorld className="h-5 w-auto" />Open World verification<ExternalLink className="size-4" /></a>
                  <div className="w-full bg-panel-2 px-4 py-3" style={{ borderRadius: 12 }}>
                    <p className="label">World shows this code. It should match</p>
                    <p className="mt-1.5 font-mono text-[22px] font-medium tracking-[0.12em]">{info.userCode}</p>
                  </div>
                  {wide && info.qrPng && <div className="grid justify-items-center gap-2"><StationQr url={info.link} size={150} /><p className="text-[12px] text-muted">On a computer? Scan with your phone instead.</p></div>}
                  <button onClick={cancel} className="label hover:!text-ink">Cancel check-in</button>
                </Plate>
              </motion.div>
            )}

            {phase === 'verified' && (
              <motion.div key="verified" {...card}>
                <Plate still className="grid gap-5 p-6">
                  <div className="flex items-center gap-4">
                    <Tick size={64} />
                    <div>
                      <p className="label !text-ok">Verified by World</p>
                      <h2 className="display mt-1 text-[26px] font-semibold">Name your licence</h2>
                    </div>
                  </div>
                  <p className="text-[14px] leading-relaxed text-muted">This is the name on your ENS operator licence. It is a label you choose and is not checked. You can skip it.</p>
                  <form onSubmit={(e: FormEvent) => { e.preventDefault(); void saveName(true); }} className="grid gap-4">
                    <label className="grid gap-2">
                      <span className="label">Your name (optional)</span>
                      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="given-name" autoCapitalize="words" placeholder="e.g. Daksh" className="h-14 bg-panel-2 px-4 text-[18px] outline-none transition-colors focus:border-accent" style={{ borderRadius: 12 }} />
                    </label>
                    <div className="flex items-center gap-2.5 bg-panel-2 px-3.5 py-3" style={{ borderRadius: 12 }}>
                      <LogoENS className="h-4 w-auto shrink-0 text-ens" />
                      <span className="min-w-0 break-all font-mono text-[13px]"><motion.span key={licence} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className={cn(preview2.length < 2 && 'text-muted')}>{licence}</motion.span><span className="text-muted">.smartician.eth</span></span>
                    </div>
                    <Primary type="submit" disabled={busy}>Continue</Primary>
                    <button type="button" disabled={busy} onClick={() => void saveName(false)} className="label hover:!text-ink">Skip, use a generated name</button>
                  </form>
                  <p className="border-l-2 border-accent pl-3 text-[12px] leading-snug text-muted">Hackathon build: World proofs here use test identities, so this is not production verification.</p>
                </Plate>
              </motion.div>
            )}

            {phase === 'done' && (
              <motion.div key="done" {...card}>
                <Plate still className="grid justify-items-center gap-5 p-6 text-center">
                  <Ring value={left} total={1800} tint="var(--ok)"><Tick size={52} /></Ring>
                  <div>
                    <p className="label !text-ok">You&apos;re checked in{status?.name ? ` · ${status.name}` : ''}</p>
                    <h2 className="display mt-2 text-[clamp(2.2rem,10vw,3rem)] font-semibold">Put on the headset.</h2>
                    <p className="mt-3 text-[14px] leading-relaxed text-muted">Tap <b className="text-ink">Test mode</b>. The headset will show your name and start your test.</p>
                  </div>
                  <div className="grid w-full grid-cols-2 gap-px bg-line" style={{ borderRadius: 12, overflow: 'hidden' }}>
                    <div className="bg-panel px-3 py-3 text-left"><p className="label">Valid for</p><p className="mt-1 font-mono text-[15px] tnum">{mmss(left)}</p></div>
                    <div className="bg-panel px-3 py-3 text-left"><p className="label">Human id</p><p className="mt-1 font-mono text-[15px]">{status?.humanTag ?? '—'}</p></div>
                  </div>
                  <p className="text-[12px] text-muted">The id is a short fingerprint of your World ID. It is saved with your test as proof a real person took it.</p>
                </Plate>
              </motion.div>
            )}

            {phase === 'failed' && (
              <motion.div key="failed" {...card}>
                <Plate still className="grid gap-5 p-6">
                  <div className="flex items-center gap-4">
                    <span className="grid size-16 place-items-center rounded-full border-2" style={{ borderColor: 'var(--bad)', color: 'var(--bad)' }}><X className="size-8" strokeWidth={2.4} /></span>
                    <div><p className="label !text-bad">Not verified</p><h2 className="display mt-1 text-[26px] font-semibold">That didn&apos;t go through.</h2></div>
                  </div>
                  <p className="text-[14px] leading-relaxed text-muted">{error}</p>
                  <div className="flex items-start gap-3 bg-panel-2 px-3.5 py-3" style={{ borderRadius: 12 }}>
                    <Check className="mt-0.5 size-4 shrink-0 text-ok" />
                    <p className="text-[13px] leading-snug"><b>Test mode stays locked and no licence is issued.</b> Nothing was started on the headset.</p>
                  </div>
                  <Primary onClick={() => { setError(''); setPhase('intro'); }}>Try again</Primary>
                </Plate>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
