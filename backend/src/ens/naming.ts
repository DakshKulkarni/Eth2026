import { nameState } from './read.js';

const MAX_SLUG = 14;

export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, MAX_SLUG);
}

// A certificate label is either the new "<name>-cert" form (optionally numbered) or the old "cert-<id>" form.
export const CERT_LABEL = /^(cert-[a-z0-9]{3,32}|[a-z0-9]{2,14}-cert(-[2-9])?)$/;

export async function chooseCertLabel(name: string | undefined, sessionId: string): Promise<string> {
  const fallback = `cert-${sessionId.slice(0, 8)}`;
  const slug = slugify(name ?? '');
  if (slug.length < 2) return fallback;
  for (let n = 1; n <= 9; n++) {
    const label = n === 1 ? `${slug}-cert` : `${slug}-cert-${n}`;
    try {
      if ((await nameState(label)).status === 'available') return label;
    } catch {
      return fallback;
    }
  }
  return fallback;
}
