import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { anchorSession } from './chain/anchor.js';
import { activity } from './activity.js';
import { config, keyProblem } from './config.js';
import { buildBundle, OUTCOMES } from './episode/bundle.js';
import { sha256 } from './episode/chain.js';
import { loadDeployment } from './ens/deployment.js';
import { issueCertificate, revokeCertificate } from './ens/issuer.js';
import { CERT_LABEL, chooseCertLabel, slugify } from './ens/naming.js';
import { checkCredential, getPassport, LABEL_PATTERN } from './ens/read.js';
import { explorer } from './explorer.js';
import { uploadBundle } from './episode/storage.js';
import { coach } from './judge/coach.js';
import { observeSchema } from './judge/schema.js';
import { createSession, getSession } from './session.js';
import { readFileSync } from 'node:fs';
import { loadProcedure } from './shared/procedure.js';
import { speak } from './zerog/speech.js';
import { cancelCheckin, claimCheckin, createCheckin, expireIfDue, getCheckin, publicView, readyCheckin, setName } from './world/checkins.js';
import { worldConfigured } from './world/oidc.js';

const procedure = loadProcedure();
const checkinPage = readFileSync(new URL('../public/checkin.html', import.meta.url), 'utf8');
const ttsSchema = z.object({ text: z.string().min(1).max(400), sessionId: z.string().optional() });
const finalizeSchema = z.object({ outcome: z.enum(OUTCOMES) });
const certificateSchema = z.object({
  holder: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
  validityDays: z.number().int().min(1).max(365).default(90),
  name: z.string().max(40).nullish(),
});

function displayName(name: string | undefined): string {
  const slug = slugify(name ?? '');
  return slug.length < 2 ? '' : slug.charAt(0).toUpperCase() + slug.slice(1);
}

export function registerRoutes(app: FastifyInstance): void {
  app.get('/health', async () => ({
    ok: true,
    version: '0.1.0',
    zerog: config.ZG_API_KEY ? 'configured' : 'no_key',
    model: config.ZG_COACH_MODEL,
    world: worldConfigured() ? config.WORLD_ISSUER : 'not_configured',
    evidence: {
      wallet: !config.AGENT_PRIVATE_KEY ? 'no_key' : keyProblem() ? 'invalid_key' : 'configured',
      registry: config.ZG_REGISTRY_ADDRESS ?? 'not_deployed',
    },
  }));

  app.post('/tts', async (req, reply) => {
    const body = ttsSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const result = await speak(body.data.text);
    activity('tts', { ok: result.ok, ms: result.ok ? result.latencyMs : null, reason: result.ok ? null : result.reason });
    if (!result.ok) return reply.code(502).send({ error: 'tts_unavailable', reason: result.reason });
    const session = body.data.sessionId ? getSession(body.data.sessionId) : undefined;
    session?.log.append('speech', {
      requestId: result.requestId,
      model: config.ZG_TTS_MODEL,
      latencyMs: result.latencyMs,
      textSha256: sha256(body.data.text),
      words: body.data.text.split(/\s+/).length,
    });
    if (result.requestId) reply.header('X-0G-Request-Id', result.requestId);
    return reply.type(result.contentType).send(result.audio);
  });

  app.post('/session/start', async () => {
    const session = createSession();
    session.log.append('session_start', {
      procedureId: procedure.id,
      procedureVersion: procedure.version,
      coachModel: config.ZG_COACH_MODEL,
    });
    activity('session_start', { session: session.id.slice(0, 8) });
    return { sessionId: session.id, procedure, model: config.ZG_COACH_MODEL };
  });

  app.post<{ Params: { id: string } }>('/session/:id/observe', async (req, reply) => {
    const session = getSession(req.params.id);
    if (!session) return reply.code(404).send({ error: 'unknown_session' });
    if (session.finalized) return reply.code(409).send({ error: 'session_finalized' });

    const body = observeSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request', issues: body.error.issues });

    if (session.busy) return reply.code(409).send({ error: 'busy' });
    session.busy = true;
    try {
      const result = await coach(session, procedure, body.data);
      session.log.append('observe', {
        trigger: body.data.trigger,
        checkpointId: body.data.checkpointId ?? null,
        mode: body.data.mode,
        machine: body.data.machine,
        actions: body.data.actions,
        frameSha256: body.data.frame ? sha256(body.data.frame) : null,
        result,
      });
      activity('observe', {
        session: session.id.slice(0, 8),
        trigger: body.data.trigger,
        checkpoint: body.data.checkpointId ?? null,
        mode: body.data.mode,
        newActions: body.data.actions.map((a) => `${a.control} ${a.action} ${a.value}`.trim()),
        verdict: result.verdict,
        line: result.coachingLine,
        failure: result.failure ?? null,
        ms: result.latencyMs,
      });
      return result;
    } finally {
      session.busy = false;
    }
  });

  app.get<{ Params: { label: string } }>('/machine/:label', async (req, reply) => {
    if (!LABEL_PATTERN.test(req.params.label)) return reply.code(400).send({ error: 'invalid_label' });
    const started = Date.now();
    try {
      const passport = await getPassport(req.params.label);
      activity('passport', { label: req.params.label, ok: true, ms: Date.now() - started });
      return passport;
    } catch (err) {
      activity('passport', { label: req.params.label, ok: false, ms: Date.now() - started, reason: err instanceof Error ? err.message.slice(0, 200) : 'unknown' });
      return reply.code(502).send({ error: 'passport_unavailable' });
    }
  });

  app.get<{ Params: { label: string } }>('/credential/:label', async (req, reply) => {
    if (!LABEL_PATTERN.test(req.params.label) || !CERT_LABEL.test(req.params.label)) {
      return reply.code(400).send({ error: 'not_a_certificate_label' });
    }
    return checkCredential(req.params.label);
  });

  app.post<{ Params: { label: string } }>('/credential/:label/revoke', async (req, reply) => {
    if (config.ADMIN_TOKEN && req.headers['x-admin-token'] !== config.ADMIN_TOKEN) {
      return reply.code(401).send({ error: 'admin_token_required' });
    }
    if (!LABEL_PATTERN.test(req.params.label)) return reply.code(400).send({ error: 'invalid_label' });
    const result = await revokeCertificate(req.params.label);
    if (!result.ok) return reply.code(502).send({ error: 'revoke_failed', reason: result.reason });
    return { revoked: true, revokeTx: result.revokeTx, link: explorer.sepoliaTx(result.revokeTx), credential: await checkCredential(req.params.label) };
  });

  // Worker check-in: a phone page proves the worker is a real human through World before Test mode unlocks.
  app.get('/checkin', async (_req, reply) => reply.type('text/html; charset=utf-8').send(checkinPage));

  app.post('/checkin/start', async (_req, reply) => {
    if (!worldConfigured()) return reply.code(503).send({ error: 'world_not_configured' });
    const created = await createCheckin();
    if (!created.ok) return reply.code(502).send({ error: 'world_unavailable', reason: created.reason });
    const c = created.checkin;
    return { ...publicView(c), userCode: c.userCode, link: c.link, qrPng: c.qrPng };
  });

  app.get<{ Params: { id: string } }>('/checkin/:id', async (req, reply) => {
    const c = getCheckin(req.params.id);
    if (!c) return reply.code(404).send({ error: 'unknown_checkin' });
    expireIfDue(c);
    return publicView(c);
  });

  app.post<{ Params: { id: string } }>('/checkin/:id/name', async (req, reply) => {
    const c = getCheckin(req.params.id);
    if (!c) return reply.code(404).send({ error: 'unknown_checkin' });
    expireIfDue(c);
    if (c.status !== 'verified' || c.certified) return reply.code(409).send({ error: 'not_verified' });
    const body = z.object({ name: z.string().max(60) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const saved = setName(c, body.data.name);
    const slug = slugify(saved);
    return { name: saved, preview: slug.length >= 2 ? `${slug}-cert.smartician.eth` : null };
  });

  app.post<{ Params: { id: string } }>('/checkin/:id/cancel', async (req, reply) => {
    const c = cancelCheckin(req.params.id);
    if (!c) return reply.code(404).send({ error: 'unknown_checkin' });
    return publicView(c);
  });

  // The headset asks whether a verified worker is waiting. Without World configured, Test mode is not gated.
  app.get('/worker/ready', async () => {
    if (!worldConfigured()) return { required: false, ready: false };
    const c = readyCheckin();
    if (!c) return { required: true, ready: false };
    return { required: true, ready: true, checkinId: c.id, alias: displayName(c.name ?? undefined) || null, humanTag: c.humanHash?.slice(0, 8) ?? null, secondsLeft: publicView(c).secondsLeft };
  });

  app.post<{ Params: { id: string } }>('/session/:id/claim', async (req, reply) => {
    const session = getSession(req.params.id);
    if (!session) return reply.code(404).send({ error: 'unknown_session' });
    const body = z.object({ checkinId: z.string() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const claimed = claimCheckin(body.data.checkinId, session.id);
    if (!claimed.ok) return reply.code(409).send({ error: claimed.reason });
    const c = claimed.checkin;
    session.human = { checkinId: c.id, humanHash: c.humanHash ?? '', name: c.name, acr: c.identity?.acr ?? null, verifiedAt: new Date(c.verifiedAt ?? Date.now()).toISOString() };
    // The proof of human becomes part of the evidence that is stored on 0G.
    session.log.append('human_verified', {
      provider: 'world',
      issuer: config.WORLD_ISSUER,
      humanHash: session.human.humanHash,
      acr: session.human.acr,
      amr: c.identity?.amr ?? [],
      verifiedAt: session.human.verifiedAt,
    });
    activity('claim', { session: session.id.slice(0, 8), checkin: c.id.slice(0, 8), human: session.human.humanHash.slice(0, 8) });
    return { ok: true, alias: displayName(c.name ?? undefined) || null, humanTag: session.human.humanHash.slice(0, 8) };
  });

  app.post<{ Params: { id: string } }>('/session/:id/certificate', async (req, reply) => {
    const session = getSession(req.params.id);
    if (!session) return reply.code(404).send({ error: 'unknown_session' });
    if (session.certificate) return session.certificate;
    if (session.finalized?.outcome !== 'test_pass') {
      return reply.code(409).send({ error: 'not_eligible', reason: 'a certificate needs a finalized session with outcome test_pass' });
    }
    const body = certificateSchema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });

    // With World configured, a certificate needs a verified human bound to this session, used once.
    const checkin = worldConfigured() && session.human ? getCheckin(session.human.checkinId) : undefined;
    if (worldConfigured()) {
      if (checkin) expireIfDue(checkin);
      if (!session.human || !checkin || checkin.status !== 'verified') {
        activity('certificate_blocked', { session: session.id.slice(0, 8), checkin: checkin?.status ?? 'none' });
        return reply.code(403).send({ error: 'human_required', status: checkin?.status ?? 'none' });
      }
      if (checkin.certified || checkin.issuing) return reply.code(409).send({ error: 'checkin_already_used' });
      checkin.issuing = true;
    }
    const certName = body.data.name ?? session.human?.name ?? undefined;

    let issued: Awaited<ReturnType<typeof issueCertificate>>;
    try {
      issued = await issueCertificate({
        label: await chooseCertLabel(certName, session.id),
        holder: body.data.holder ?? loadDeployment().issuer,
        validityDays: body.data.validityDays,
        evidenceRoot: session.finalized.rootHash,
        outcome: session.finalized.outcome,
        displayName: displayName(certName),
        human: session.human ? `world:${new URL(config.WORLD_ISSUER).hostname.startsWith('sandbox') ? 'sandbox' : 'production'}:${session.human.humanHash.slice(0, 12)}:${session.human.acr ?? 'none'}` : undefined,
      });
    } catch (err) {
      if (checkin) checkin.issuing = false;
      throw err;
    }
    activity('certificate', { session: session.id.slice(0, 8), ok: issued.ok, name: issued.ok ? issued.name : null, reason: issued.ok ? null : issued.reason });
    if (checkin) {
      checkin.issuing = false;
      if (issued.ok) checkin.certified = true;
    }
    if (!issued.ok) return reply.code(502).send({ error: 'issue_failed', reason: issued.reason });
    session.certificate = {
      name: issued.name,
      holder: body.data.holder ?? loadDeployment().issuer,
      expiresAt: issued.expiresAt,
      issueTx: issued.issueTx,
      recordsTx: issued.recordsTx,
      links: { issueTx: explorer.sepoliaTx(issued.issueTx), recordsTx: explorer.sepoliaTx(issued.recordsTx) },
    };
    return session.certificate;
  });

  app.post<{ Params: { id: string } }>('/session/:id/finalize', async (req, reply) => {
    const session = getSession(req.params.id);
    if (!session) return reply.code(404).send({ error: 'unknown_session' });
    if (session.finalized) return session.finalized;

    const body = finalizeSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });

    session.log.append('session_end', { outcome: body.data.outcome });
    const records = session.log.all;
    const bundle = buildBundle({
      sessionId: session.id,
      procedureId: procedure.id,
      procedureVersion: procedure.version,
      coachModel: config.ZG_COACH_MODEL,
      startedAt: session.startedAt,
      outcome: body.data.outcome,
      records,
      headHash: session.log.head,
    });

    const upload = await uploadBundle(bundle);
    if (!upload.ok) {
      activity('finalize_failed', { session: session.id.slice(0, 8), outcome: body.data.outcome, reason: upload.reason });
      return reply.code(502).send({ error: 'storage_unavailable', reason: upload.reason });
    }

    const anchor = await anchorSession(session.id, upload.rootHash, body.data.outcome);
    session.finalized = {
      outcome: body.data.outcome,
      rootHash: upload.rootHash,
      storageTx: upload.txHash,
      storageTxSeq: upload.txSeq,
      anchorTx: anchor.ok ? anchor.txHash : null,
      anchorError: anchor.ok ? null : anchor.reason,
      headHash: bundle.headHash,
      records: records.length,
      links: {
        storage: explorer.storageSubmission(upload.txSeq),
        anchor: anchor.ok ? explorer.chainTx(anchor.txHash) : null,
      },
    };
    activity('finalize', {
      session: session.id.slice(0, 8),
      outcome: body.data.outcome,
      rootHash: upload.rootHash,
      anchored: anchor.ok,
      anchorError: anchor.ok ? null : anchor.reason,
    });
    return session.finalized;
  });
}
