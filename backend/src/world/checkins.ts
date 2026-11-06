import { createHash, randomUUID } from 'node:crypto';
import QRCode from 'qrcode';
import { activity } from '../activity.js';
import { config } from '../config.js';
import { pollDevice, startDevice, validateIdToken, type Identity } from './oidc.js';

export type CheckinStatus = 'pending' | 'verified' | 'denied' | 'expired' | 'cancelled' | 'error';

// A verified check-in stays usable for this long, until a certificate is issued from it.
export const VERIFIED_TTL_MS = 30 * 60 * 1000;
const MAX_NAME = 24;

export interface Checkin {
  id: string;
  status: CheckinStatus;
  reason: string | null;
  startedAt: number;
  expiresAt: number;
  userCode: string;
  link: string;
  qrPng: string;
  intervalSeconds: number;
  deviceCode: string;
  identity: Identity | null;
  humanHash: string | null;
  verifiedAt: number | null;
  useUntil: number | null;
  name: string | null;
  claimedBy: string | null;
  issuing: boolean;
  certified: boolean;
}

const checkins = new Map<string, Checkin>();

export function getCheckin(id: string): Checkin | undefined {
  return checkins.get(id);
}

// The public view never includes the device code, the subject or the full hash.
export function publicView(c: Checkin): Record<string, unknown> {
  const now = Date.now();
  return {
    checkinId: c.id,
    status: c.status,
    reason: c.reason,
    secondsLeft: Math.max(0, Math.round(((c.status === 'verified' ? (c.useUntil ?? 0) : c.expiresAt) - now) / 1000)),
    name: c.name,
    humanTag: c.humanHash ? c.humanHash.slice(0, 8) : null,
    acr: c.identity?.acr ?? null,
    environment: new URL(config.WORLD_ISSUER).hostname.startsWith('sandbox') ? 'sandbox' : 'production',
  };
}

export async function createCheckin(): Promise<{ ok: true; checkin: Checkin } | { ok: false; reason: string }> {
  const started = await startDevice();
  if (!started.ok) return { ok: false, reason: started.reason };
  const d = started.device;
  const link = d.verification_uri_complete ?? d.verification_uri;
  const qr = await QRCode.toBuffer(link, { width: 480, margin: 2, errorCorrectionLevel: 'M' });
  const now = Date.now();
  const checkin: Checkin = {
    id: randomUUID(),
    status: 'pending',
    reason: null,
    startedAt: now,
    expiresAt: now + d.expires_in * 1000,
    userCode: d.user_code,
    link,
    qrPng: qr.toString('base64'),
    intervalSeconds: d.interval,
    deviceCode: d.device_code,
    identity: null,
    humanHash: null,
    verifiedAt: null,
    useUntil: null,
    name: null,
    claimedBy: null,
    issuing: false,
    certified: false,
  };
  checkins.set(checkin.id, checkin);
  activity('checkin_started', { checkin: checkin.id.slice(0, 8), expiresInS: d.expires_in });
  void poll(checkin);
  return { ok: true, checkin };
}

export function cancelCheckin(id: string): Checkin | undefined {
  const c = checkins.get(id);
  if (c && (c.status === 'pending' || (c.status === 'verified' && !c.certified))) settle(c, 'cancelled', 'cancelled by the worker');
  return c;
}

export function expireIfDue(c: Checkin): void {
  const now = Date.now();
  if (c.status === 'pending' && now >= c.expiresAt) settle(c, 'expired', 'the request expired before it was approved');
  if (c.status === 'verified' && c.useUntil !== null && now >= c.useUntil) settle(c, 'expired', 'the verification was not used in time');
}

// The name is only a label the worker chose; it is not part of the proof of human.
export function setName(c: Checkin, raw: string): string {
  const cleaned = raw.replace(/[^\p{L}\p{N} '-]/gu, '').trim().slice(0, MAX_NAME);
  c.name = cleaned.length > 0 ? cleaned : null;
  return c.name ?? '';
}

// Oldest verified check-in that nobody has picked up yet and that has not been used for a certificate.
export function readyCheckin(): Checkin | undefined {
  const now = Date.now();
  let best: Checkin | undefined;
  for (const c of checkins.values()) {
    expireIfDue(c);
    if (c.status !== 'verified' || c.certified || c.claimedBy !== null || (c.useUntil ?? 0) <= now) continue;
    if (!best || (c.verifiedAt ?? 0) < (best.verifiedAt ?? 0)) best = c;
  }
  return best;
}

// A session may take a verified check-in. The same check-in can be taken again for a retry until a certificate is issued.
export function claimCheckin(id: string, sessionId: string): { ok: true; checkin: Checkin } | { ok: false; reason: string } {
  const c = checkins.get(id);
  if (!c) return { ok: false, reason: 'unknown_checkin' };
  expireIfDue(c);
  if (c.status !== 'verified') return { ok: false, reason: `checkin_${c.status}` };
  if (c.certified) return { ok: false, reason: 'checkin_already_used' };
  c.claimedBy = sessionId;
  activity('checkin_claimed', { checkin: c.id.slice(0, 8), session: sessionId.slice(0, 8) });
  return { ok: true, checkin: c };
}

function settle(c: Checkin, status: CheckinStatus, reason: string | null): void {
  if (c.status === 'denied' || c.status === 'expired' || c.status === 'cancelled' || c.status === 'error') return;
  c.status = status;
  c.reason = reason;
  activity('checkin_' + status, { checkin: c.id.slice(0, 8), reason });
}

async function poll(c: Checkin): Promise<void> {
  let interval = c.intervalSeconds;
  let retries = 0;
  while (c.status === 'pending') {
    await new Promise((r) => setTimeout(r, interval * 1000));
    if (c.status !== 'pending') return;
    if (Date.now() >= c.expiresAt) return settle(c, 'expired', 'the request expired before it was approved');
    const result = await pollDevice(c.deviceCode);
    if (c.status !== 'pending') return;
    switch (result.state) {
      case 'pending':
        retries = 0;
        break;
      case 'slow_down':
        interval += 5;
        break;
      case 'retry':
        if (++retries > 20) return settle(c, 'error', 'World could not be reached');
        interval = Math.min(interval + 1, 10);
        break;
      case 'denied':
        return settle(c, 'denied', result.reason);
      case 'expired':
        return settle(c, 'expired', 'the request expired before it was approved');
      case 'error':
        return settle(c, 'error', result.reason);
      case 'approved': {
        const checked = await validateIdToken(result.idToken, c.startedAt);
        if (!checked.ok) return settle(c, 'denied', `the signed result was rejected: ${checked.reason}`);
        c.identity = checked.identity;
        c.humanHash = createHash('sha256').update(`${config.WORLD_ISSUER}|${checked.identity.sub}`).digest('hex');
        c.verifiedAt = Date.now();
        c.useUntil = c.verifiedAt + VERIFIED_TTL_MS;
        c.status = 'verified';
        activity('checkin_verified', { checkin: c.id.slice(0, 8), human: c.humanHash.slice(0, 8), acr: checked.identity.acr });
        return;
      }
    }
  }
}
