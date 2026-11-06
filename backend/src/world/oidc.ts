import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { z } from 'zod';
import { config } from '../config.js';

const discoverySchema = z.object({
  issuer: z.string(),
  token_endpoint: z.string().url(),
  device_authorization_endpoint: z.string().url(),
  jwks_uri: z.string().url(),
});
type Discovery = z.infer<typeof discoverySchema>;

const deviceSchema = z.object({
  device_code: z.string(),
  user_code: z.string(),
  verification_uri: z.string().url(),
  verification_uri_complete: z.string().url().optional(),
  expires_in: z.number().int().positive(),
  interval: z.number().int().positive().default(5),
});
export type DeviceStart = z.infer<typeof deviceSchema>;

export const worldConfigured = (): boolean => Boolean(config.WORLD_CLIENT_ID && config.WORLD_CLIENT_SECRET);

let discovery: Discovery | null = null;
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

async function endpoints(): Promise<Discovery> {
  if (discovery) return discovery;
  const res = await fetch(`${config.WORLD_ISSUER}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`World discovery failed with HTTP ${res.status}`);
  const parsed = discoverySchema.parse(await res.json());
  if (parsed.issuer !== config.WORLD_ISSUER) throw new Error('World discovery issuer does not match WORLD_ISSUER');
  discovery = parsed;
  jwks = createRemoteJWKSet(new URL(parsed.jwks_uri));
  return parsed;
}

// client_secret_basic, the portal default: the form-encoded id and secret in an Authorization header.
function basicAuth(): string {
  const id = encodeURIComponent(config.WORLD_CLIENT_ID ?? '');
  const secret = encodeURIComponent(config.WORLD_CLIENT_SECRET ?? '');
  return `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`;
}

async function form(url: string, fields: Record<string, string>): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basicAuth() },
    body: new URLSearchParams(fields).toString(),
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    body = { error: 'invalid_response' };
  }
  return { status: res.status, body };
}

export async function startDevice(): Promise<{ ok: true; device: DeviceStart } | { ok: false; reason: string }> {
  try {
    const d = await endpoints();
    const { status, body } = await form(d.device_authorization_endpoint, { scope: 'openid' });
    if (status !== 200) return { ok: false, reason: `${String(body.error ?? 'error')} (HTTP ${status})` };
    return { ok: true, device: deviceSchema.parse(body) };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message.slice(0, 160) : 'unknown error' };
  }
}

export type PollResult =
  | { state: 'pending' }
  | { state: 'slow_down' }
  | { state: 'approved'; idToken: string }
  | { state: 'denied'; reason: string }
  | { state: 'expired' }
  | { state: 'error'; reason: string };

export async function pollDevice(deviceCode: string): Promise<PollResult> {
  try {
    const d = await endpoints();
    const { status, body } = await form(d.token_endpoint, {
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: deviceCode,
    });
    if (status === 200 && typeof body.id_token === 'string') return { state: 'approved', idToken: body.id_token };
    const code = String(body.error ?? '');
    if (code === 'authorization_pending') return { state: 'pending' };
    if (code === 'slow_down') return { state: 'slow_down' };
    if (code === 'access_denied') return { state: 'denied', reason: 'the supervisor denied the request' };
    if (code === 'expired_token') return { state: 'expired' };
    return { state: 'error', reason: `${code || 'error'} (HTTP ${status})` };
  } catch (err) {
    return { state: 'error', reason: err instanceof Error ? err.message.slice(0, 120) : 'network error' };
  }
}

export interface Identity {
  sub: string;
  acr: string | null;
  amr: string[];
  authTime: number;
}

// Validates the signed result: signature, issuer, audience and expiry through the published keys,
// then the freshness and method claims the step-up policy requires. Device tokens omit nonce.
export async function validateIdToken(idToken: string, attemptStartedMs: number): Promise<{ ok: true; identity: Identity } | { ok: false; reason: string }> {
  try {
    const d = await endpoints();
    if (!jwks) return { ok: false, reason: 'signing keys unavailable' };
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: d.issuer,
      audience: config.WORLD_CLIENT_ID,
      algorithms: ['RS256'],
      clockTolerance: 30,
    });
    return checkClaims(payload, attemptStartedMs);
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message.slice(0, 140) : 'token validation failed' };
  }
}

function checkClaims(payload: JWTPayload, attemptStartedMs: number): { ok: true; identity: Identity } | { ok: false; reason: string } {
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) return { ok: false, reason: 'token has no subject' };
  const authTime = payload.auth_time;
  if (typeof authTime !== 'number') return { ok: false, reason: 'token has no auth_time' };
  const nowS = Date.now() / 1000;
  if (authTime > nowS + 30) return { ok: false, reason: 'auth_time is in the future' };
  if (authTime < attemptStartedMs / 1000 - 30) return { ok: false, reason: 'authentication is older than this attempt' };
  const amr = Array.isArray(payload.amr) ? payload.amr.filter((v): v is string => typeof v === 'string') : [];
  if (amr.length === 0) return { ok: false, reason: 'token has no amr' };
  return { ok: true, identity: { sub: payload.sub, acr: typeof payload.acr === 'string' ? payload.acr : null, amr, authTime } };
}
