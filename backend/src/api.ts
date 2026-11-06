import type { FastifyInstance } from 'fastify';
import { config } from './config.js';
import { recent, stats, subscribe, type Track } from './events.js';
import { loadProcedure } from './shared/procedure.js';
import { worldConfigured } from './world/oidc.js';

const TRACKS = new Set<Track>(['0g', 'ens', 'world', 'system']);
const startedAt = Date.now();
const procedure = loadProcedure();

export function registerApi(app: FastifyInstance): void {
  // The last events, newest last. Optional ?track=0g|ens|world and ?limit=.
  app.get<{ Querystring: { track?: string; limit?: string } }>('/api/events', async (req) => {
    const track = req.query.track && TRACKS.has(req.query.track as Track) ? (req.query.track as Track) : undefined;
    return { events: recent(Number(req.query.limit) || 100, track) };
  });

  // Server-sent events: a short backlog first, then every new event as it happens.
  app.get<{ Querystring: { track?: string } }>('/api/stream', (req, reply) => {
    const track = req.query.track && TRACKS.has(req.query.track as Track) ? (req.query.track as Track) : undefined;
    const raw = reply.raw;
    reply.hijack();
    raw.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
      'access-control-allow-origin': '*',
    });
    const lastId = Number(req.headers['last-event-id']) || 0;
    const send = (e: { id: number }) => raw.write(`id: ${e.id}\nevent: activity\ndata: ${JSON.stringify(e)}\n\n`);
    raw.write('retry: 2000\n\n');
    for (const e of recent(lastId ? 400 : 80, track, lastId)) send(e);
    const off = subscribe((e) => {
      if (!track || e.track === track) send(e);
    });
    const beat = setInterval(() => raw.write(': keepalive\n\n'), 15000);
    req.raw.on('close', () => {
      clearInterval(beat);
      off();
    });
  });

  app.get('/api/procedure', async () => procedure);

  // Quick facts about this server, for the dashboard header and overview.
  app.get('/api/overview', async () => {
    const s = stats();
    const observes = recent(800).filter((e) => e.event === 'observe');
    const latencies = observes.map((e) => Number(e.data.ms)).filter((n) => Number.isFinite(n) && n > 0);
    const sorted = [...latencies].sort((a, b) => a - b);
    return {
      version: '0.1.0',
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      model: config.ZG_COACH_MODEL,
      world: worldConfigured() ? config.WORLD_ISSUER : null,
      registry: config.ZG_REGISTRY_ADDRESS ?? null,
      events: s,
      judge: {
        verdicts: observes.length,
        safeStops: observes.filter((e) => e.data.verdict === 'safe_stop').length,
        corrections: observes.filter((e) => e.data.verdict === 'correct' || e.data.verdict === 'unsafe').length,
        medianMs: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
        p95Ms: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : null,
      },
    };
  });
}
