import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { speak } from './zerog/speech.js';
import { config } from './config.js';
import { coach } from './judge/coach.js';
import { observeSchema } from './judge/schema.js';
import { createSession, getSession } from './session.js';
import { loadProcedure } from './shared/procedure.js';

const procedure = loadProcedure();
const ttsSchema = z.object({ text: z.string().min(1).max(400) });

export function registerRoutes(app: FastifyInstance): void {
  app.get('/health', async () => ({
    ok: true,
    version: '0.1.0',
    zerog: config.ZG_API_KEY ? 'configured' : 'no_key',
    model: config.ZG_COACH_MODEL,
  }));

  app.post('/tts', async (req, reply) => {
    const body = ttsSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const result = await speak(body.data.text);
    if (!result.ok) return reply.code(502).send({ error: 'tts_unavailable', reason: result.reason });
    if (result.requestId) reply.header('X-0G-Request-Id', result.requestId);
    return reply.type(result.contentType).send(result.audio);
  });

  app.post('/session/start', async () => {
    const session = createSession();
    return { sessionId: session.id, procedure, model: config.ZG_COACH_MODEL };
  });

  app.post<{ Params: { id: string } }>('/session/:id/observe', async (req, reply) => {
    const session = getSession(req.params.id);
    if (!session) return reply.code(404).send({ error: 'unknown_session' });

    const body = observeSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request', issues: body.error.issues });

    if (session.busy) return reply.code(409).send({ error: 'busy' });
    session.busy = true;
    try {
      return await coach(session, procedure, body.data);
    } finally {
      session.busy = false;
    }
  });
}
