import { Check, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { cn, shortHash } from '../lib/utils';

interface Props {
  value: string;
  href?: string;
  head?: number;
  tail?: number;
  className?: string;
}

// A hash or address in mono type, with copy and an optional link to an explorer.
export function HashChip({ value, href, head = 10, tail = 6, className }: Props) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard can be blocked; nothing else to do
    }
  };
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded bg-panel-2 px-1.5 py-0.5 align-middle', className)}>
      <span className="hash" title={value}>{shortHash(value, head, tail)}</span>
      <button onClick={copy} className="text-muted transition-colors hover:text-ink" aria-label="Copy" title="Copy">
        {copied ? <Check className="size-3 text-ok" /> : <Copy className="size-3" />}
      </button>
      {href && (
        <a href={href} target="_blank" rel="noreferrer" className="text-muted transition-colors hover:text-ink" aria-label="Open in explorer" title="Open in explorer">
          <ExternalLink className="size-3" />
        </a>
      )}
    </span>
  );
}
