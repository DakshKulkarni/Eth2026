import { cn } from '../lib/utils';

const MAP: Record<string, { label: string; color: string }> = {
  valid: { label: 'Valid', color: 'var(--ok)' },
  expired: { label: 'Expired', color: 'var(--warn)' },
  revoked_or_unknown: { label: 'Revoked', color: 'var(--bad)' },
  reserved: { label: 'Reserved', color: 'var(--muted)' },
};

export function StatusBadge({ reason, className }: { reason: string; className?: string }) {
  const s = MAP[reason] ?? { label: reason, color: 'var(--muted)' };
  return (
    <span className={cn('label inline-flex items-center gap-1.5 border px-2 py-1 !text-[10.5px]', className)} style={{ borderRadius: 8, color: s.color, borderColor: s.color }}>
      <span className="size-1.5" style={{ background: s.color }} aria-hidden />
      {s.label}
    </span>
  );
}
