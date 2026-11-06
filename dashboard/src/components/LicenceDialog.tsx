import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Check, ShieldAlert, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api, sepoliaTxLink } from '../lib/api';
import { daysLeft } from '../lib/utils';
import { HashChip } from './HashChip';
import { StatusBadge } from './StatusBadge';
import { LogoENS, LogoWorld } from './logos';

// The records stored on one licence, the transactions that wrote them, and the revoke control.
export function LicenceDialog({ label, onClose }: { label: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: ['cert', label], queryFn: () => api.certificate(label!), enabled: Boolean(label) });
  const [confirming, setConfirming] = useState(false);
  const [token, setToken] = useState('');
  const revoke = useMutation({
    mutationFn: () => api.revoke(label!, token),
    onSuccess: (r) => {
      toast.success('Licence revoked', { description: `Transaction ${r.revokeTx.slice(0, 12)}…` });
      setConfirming(false);
      setToken('');
      void qc.invalidateQueries({ queryKey: ['certs'] });
      void qc.invalidateQueries({ queryKey: ['cert', label] });
    },
  });

  const lic = detail.data?.licence;
  const root = lic?.evidence?.replace('0g://', '') ?? null;
  const close = () => {
    setConfirming(false);
    setToken('');
    revoke.reset();
    onClose();
  };

  return (
    <Dialog.Root open={Boolean(label)} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dlg-overlay fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" />
        <Dialog.Content className="dlg-content plate fixed left-1/2 top-1/2 z-50 max-h-[88dvh] w-[min(720px,94vw)] overflow-y-auto p-6" aria-describedby={undefined}>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="label flex items-center gap-2"><LogoENS className="h-3 w-auto text-ens" />ENS licence</p>
              <Dialog.Title className="display mt-1.5 break-all text-[28px] font-semibold">{label}.smartician.eth</Dialog.Title>
            </div>
            <div className="flex items-center gap-3">
              {lic && <StatusBadge reason={lic.reason} />}
              <Dialog.Close className="grid size-8 place-items-center border border-line text-muted hover:text-ink" style={{ borderRadius: 4 }} aria-label="Close"><X className="size-4" /></Dialog.Close>
            </div>
          </div>

          {detail.isLoading && <div className="grid gap-3"><span className="skeleton h-5 w-2/3" /><span className="skeleton h-24 w-full" /></div>}
          {detail.isError && <p className="text-sm text-bad">Could not read this licence from the chain.</p>}

          {lic && (
            <>
              <dl className="mb-5 grid gap-px border border-line bg-line sm:grid-cols-3" style={{ borderRadius: 4, overflow: 'hidden' }}>
                {[
                  ['Name on licence', lic.alias ?? '—'],
                  ['Expires', `${lic.expiresAt ? new Date(lic.expiresAt).toLocaleDateString() : '—'} · ${daysLeft(lic.expiresAt)}`],
                  ['Verdict', (lic.verdict ?? '—').replace('_', ' ')],
                ].map(([k, v]) => (
                  <div key={k} className="bg-panel px-3 py-2.5"><dt className="label">{k}</dt><dd className="mt-1 font-mono text-[13px]">{v}</dd></div>
                ))}
              </dl>

              <p className="label mb-2 flex items-center gap-2"><span className="hazard inline-block size-2.5" aria-hidden />Key-value records on this name</p>
              {detail.data?.writes.length ? (
                <div className="grid gap-3">
                  {detail.data.writes.map((w) => (
                    <div key={w.tx} className="border border-line" style={{ borderRadius: 4 }}>
                      <div className="flex items-center justify-between border-b border-line bg-panel-2 px-3 py-2">
                        <span className="label !text-[10px]">Written in one transaction</span>
                        <HashChip value={w.tx} href={w.link ?? sepoliaTxLink(w.tx)} head={8} tail={6} />
                      </div>
                      <dl>
                        {w.records.map((r) => (
                          <div key={r.key} className="grid grid-cols-[120px_1fr] gap-3 border-b border-line px-3 py-2 last:border-b-0">
                            <dt className="font-mono text-[12px] text-accent">{r.key}</dt>
                            <dd className="min-w-0 break-all font-mono text-[12px]">{r.key === 'mrt.human' ? <span className="inline-flex items-center gap-1.5"><LogoWorld className="h-3 w-auto text-world" />{r.value}</span> : r.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="border border-line px-3 py-4 text-sm text-muted" style={{ borderRadius: 4 }}>{lic.valid ? 'No record transactions found in recent blocks.' : 'This licence no longer has records.'}</p>
              )}

              <ul className="mt-5 grid gap-2 text-[13px]">
                <li className="flex items-center gap-2"><Check className="size-4 text-ok" />Issued in transaction <HashChip value={lic.issueTx} href={lic.issueLink} head={8} tail={6} /></li>
                <li className="flex items-center gap-2">
                  {detail.data?.anchored ? <Check className="size-4 text-ok" /> : <ShieldAlert className="size-4 text-warn" />}
                  {detail.data?.anchored ? 'Evidence root is anchored on 0G Chain' : 'Evidence root not found in recent 0G blocks'}
                  {root && <Link to={`/0g?root=${root}`} onClick={close} className="label ml-auto flex items-center gap-1 hover:!text-ink">Replay <ArrowUpRight className="size-3" /></Link>}
                </li>
              </ul>

              {lic.valid && (
                <div className="mt-6 border-t border-line pt-5">
                  {!confirming ? (
                    <button onClick={() => setConfirming(true)} className="label border px-3 py-2 transition-colors hover:!text-ink" style={{ borderRadius: 4, borderColor: 'var(--bad)', color: 'var(--bad)' }}>Revoke licence…</button>
                  ) : (
                    <form onSubmit={(e) => { e.preventDefault(); revoke.mutate(); }} className="grid gap-3">
                      <p className="text-[13px] text-muted">Revoking removes this licence on ENS for everyone, and it cannot be undone. Enter the admin token to confirm. It stays in this tab and is not stored.</p>
                      <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Admin token" autoComplete="off" className="h-10 border border-line bg-panel-2 px-3 font-mono text-[13px] outline-none focus:border-accent" style={{ borderRadius: 4 }} />
                      {revoke.isError && <p className="text-[13px] text-bad">{(revoke.error as Error).message}</p>}
                      <div className="flex gap-2">
                        <button type="submit" disabled={!token || revoke.isPending} className="h-10 px-4 font-mono text-[12px] font-medium disabled:opacity-50" style={{ borderRadius: 4, background: 'var(--bad)', color: '#fff' }}>{revoke.isPending ? 'Revoking on Sepolia…' : 'Revoke now'}</button>
                        <button type="button" onClick={() => { setConfirming(false); setToken(''); revoke.reset(); }} className="label h-10 border border-line px-3 hover:!text-ink" style={{ borderRadius: 4 }}>Cancel</button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
