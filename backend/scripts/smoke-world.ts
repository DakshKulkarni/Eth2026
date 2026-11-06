import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, SignJWT, type KeyLike } from 'jose';

// A local stand-in for the World IdP: discovery, device authorization, token polling and signing keys.
const good = await generateKeyPair('RS256');
const evil = await generateKeyPair('RS256');
const jwk = { ...(await exportJWK(good.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
const CLIENT = 'test-client';
const mode: { next: 'approve' | 'deny' | 'forged' | 'stale' | 'slow'; polls: number; expiresIn: number } = { next: 'approve', polls: 0, expiresIn: 600 };
let origin = '';

const sign = (key: KeyLike, claims: Record<string, unknown>) =>
  new SignJWT({ amr: ['proof'], ...claims }).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(origin).setAudience(CLIENT).setSubject('sub-123').setIssuedAt().setExpirationTime('5m').sign(key);

const server = createServer(async (req, res) => {
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if (req.url === '/.well-known/openid-configuration')
    return send(200, { issuer: origin, token_endpoint: `${origin}/token`, device_authorization_endpoint: `${origin}/device`, jwks_uri: `${origin}/jwks` });
  if (req.url === '/jwks') return send(200, { keys: [jwk] });
  const auth = req.headers.authorization ?? '';
  if (auth !== `Basic ${Buffer.from(`${CLIENT}:test-secret`).toString('base64')}`) return send(401, { error: 'invalid_client' });
  if (req.url === '/device')
    return send(200, { device_code: 'dev-secret-code', user_code: 'ABCD-1234', verification_uri: `${origin}/activate`, verification_uri_complete: `${origin}/activate?code=ABCD-1234`, expires_in: mode.expiresIn, interval: 1 });
  if (req.url === '/token') {
    mode.polls++;
    if (mode.next === 'slow' && mode.polls === 1) return send(400, { error: 'slow_down' });
    if (mode.polls < 3) return send(400, { error: 'authorization_pending' });
    if (mode.next === 'deny') return send(400, { error: 'access_denied' });
    const now = Math.floor(Date.now() / 1000);
    if (mode.next === 'forged') return send(200, { id_token: await sign(evil.privateKey, { auth_time: now }) });
    if (mode.next === 'stale') return send(200, { id_token: await sign(good.privateKey, { auth_time: now - 3600 }) });
    return send(200, { id_token: await sign(good.privateKey, { auth_time: now, acr: 'https://world.org/oidc/acr/orb' }) });
  }
  send(404, {});
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
Object.assign(process.env, { WORLD_ISSUER: origin, WORLD_CLIENT_ID: CLIENT, WORLD_CLIENT_SECRET: 'test-secret' });

const { createCheckin, getCheckin, cancelCheckin, claimCheckin, readyCheckin, publicView, setName } = await import('../src/world/checkins.js');
let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
};
async function run(label: string, next: typeof mode.next, expected: string, opts: { expiresIn?: number; cancelAfterMs?: number } = {}) {
  Object.assign(mode, { next, polls: 0, expiresIn: opts.expiresIn ?? 600 });
  const created = await createCheckin();
  if (!created.ok) return check(label, false, created.reason);
  const c = created.checkin;
  if (opts.cancelAfterMs) setTimeout(() => cancelCheckin(c.id), opts.cancelAfterMs);
  const deadline = Date.now() + 20000;
  while (getCheckin(c.id)?.status === 'pending' && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200));
  const view = JSON.stringify(publicView(c));
  check(label, c.status === expected, `status=${c.status} reason=${c.reason ?? '-'}`);
  check(`${label}: device code, subject and full hash are not exposed`, !view.includes('dev-secret-code') && !view.includes('sub-123') && !(c.humanHash && view.includes(c.humanHash)));
  return c;
}

const approved = await run('approve', 'approve', 'verified');
if (approved) {
  check('verified: a human hash and the credential class are recorded', Boolean(approved.humanHash) && approved.identity?.acr !== null);
  check('verified: the check-in is waiting in the pool', readyCheckin()?.id === approved.id);
  check('a name is cleaned and kept as a label only', setName(approved, '  Daksh <b>K</b>  ') === 'Daksh bKb');
  const claimA = claimCheckin(approved.id, 'session-A');
  check('a session can claim the verified check-in', claimA.ok);
  check('a claimed check-in leaves the pool', readyCheckin()?.id !== approved.id);
  check('the same check-in can be claimed again for a retry', claimCheckin(approved.id, 'session-B').ok);
  approved.certified = true;
  check('after a certificate it cannot be claimed again', !claimCheckin(approved.id, 'session-C').ok);
}
await run('slow_down then verify', 'slow', 'verified');
await run('deny', 'deny', 'denied');
await run('forged token', 'forged', 'denied');
await run('stale token', 'stale', 'denied');
await run('cancel', 'approve', 'cancelled', { cancelAfterMs: 1500 });
await run('expire', 'approve', 'expired', { expiresIn: 2 });
check('an unverified check-in cannot be claimed', !claimCheckin('nope', 'session-X').ok);

// Empty the pool so the route checks below see only their own check-in.
for (let left = readyCheckin(); left; left = readyCheckin()) cancelCheckin(left.id);

// The HTTP surface, without starting a listener.
const Fastify = (await import('fastify')).default;
const { registerRoutes } = await import('../src/routes.js');
const app = Fastify();
registerRoutes(app);
const page = await app.inject({ method: 'GET', url: '/checkin' });
check('GET /checkin serves the page', page.statusCode === 200 && page.body.includes('Verify with World'));
Object.assign(mode, { next: 'approve', polls: 0, expiresIn: 600 });
const start = await app.inject({ method: 'POST', url: '/checkin/start', payload: {} });
const started = start.json() as { checkinId: string; userCode: string; link: string; qrPng: string };
check('POST /checkin/start returns a link, code and QR', start.statusCode === 200 && Boolean(started.link && started.userCode && started.qrPng));
check('/worker/ready is empty before approval', (await app.inject({ method: 'GET', url: '/worker/ready' })).json().ready === false);
let status = 'pending';
for (let i = 0; i < 60 && status === 'pending'; i++) {
  await new Promise((r) => setTimeout(r, 300));
  status = (await app.inject({ method: 'GET', url: `/checkin/${started.checkinId}` })).json().status;
}
check('the check-in becomes verified through the routes', status === 'verified');
const named = await app.inject({ method: 'POST', url: `/checkin/${started.checkinId}/name`, payload: { name: 'Daksh' } });
check('naming shows the licence preview', named.json().preview === 'daksh-cert.smartician.eth');
const ready = (await app.inject({ method: 'GET', url: '/worker/ready' })).json();
check('/worker/ready now offers this worker', ready.ready === true && ready.alias === 'Daksh' && ready.checkinId === started.checkinId);
const session = (await app.inject({ method: 'POST', url: '/session/start', payload: {} })).json() as { sessionId: string };
const claim = await app.inject({ method: 'POST', url: `/session/${session.sessionId}/claim`, payload: { checkinId: started.checkinId } });
check('claiming binds the human to the session', claim.statusCode === 200 && claim.json().alias === 'Daksh');
// The headset sends {"name": null}; that must pass validation and then stop at the human check, not at a 400.
const { getSession } = await import('../src/session.js');
const finalizedSession = getSession(session.sessionId);
if (finalizedSession) {
  finalizedSession.human = null;
  finalizedSession.finalized = { outcome: 'test_pass', rootHash: '0x' + '1'.repeat(64), storageTx: '', storageTxSeq: 0, anchorTx: null, anchorError: null, headHash: '', records: 0, links: { storage: '', anchor: null } };
  const nullName = await app.inject({ method: 'POST', url: `/session/${session.sessionId}/certificate`, payload: { name: null } });
  check('a null name passes validation and is stopped by the human check (403), not a 400', nullName.statusCode === 403);
}
const noHuman = (await app.inject({ method: 'POST', url: '/session/start', payload: {} })).json() as { sessionId: string };
const blocked = await app.inject({ method: 'POST', url: `/session/${noHuman.sessionId}/certificate`, payload: {} });
check('a certificate is refused without a finalized passing test', blocked.statusCode === 409);

server.close();
console.log(failures === 0 ? '\nall World checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
