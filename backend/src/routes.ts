import type { FastifyInstance } from 'fastify';
import { config } from './config.js';
import { coach } from './judge/coach.js';
import { observeSchema } from './judge/schema.js';
import { createSession, getSession } from './session.js';
import { loadProcedure } from './shared/procedure.js';

const procedure = loadProcedure();

export function registerRoutes(app: FastifyInstance): void {
  app.get('/health', async () => ({
    ok: true,
    version: '0.1.0',
    zerog: config.ZG_API_KEY ? 'configured' : 'no_key',
    model: config.ZG_COACH_MODEL,
  }));

  app.post('/session/start', async () => {
    const session = createSession(procedure);
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
