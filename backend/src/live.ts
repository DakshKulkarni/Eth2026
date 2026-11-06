import type { FastifyInstance } from 'fastify';
import { config } from './config.js';

// Live view of the headset: the app posts small JPEG frames, and this relays the latest one to any browser
// as a motion-JPEG stream. Nothing is stored; only the newest frame is kept in memory.
const BOUNDARY = 'frame';
const MAX_BYTES = 400_000;
const MIN_GAP_MS = 120; // at most about 8 frames per second are accepted
const ACTIVE_MS = 6000;

let latest: Buffer | null = null;
let lastAt = 0;
let lastAccepted = 0;
let totalFrames = 0;
const recent: number[] = [];
const viewers = new Set<NodeJS.WritableStream>();

function fps(): number {
  const now = Date.now();
  while (recent.length > 0 && now - (recent[0] ?? now) > 3000) recent.shift();
  return Math.round((recent.length / 3) * 10) / 10;
}

function broadcast(frame: Buffer): void {
  const head = `--${BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`;
  for (const res of viewers) {
    try {
      res.write(head);
      res.write(frame);
      res.write('\r\n');
    } catch {
      viewers.delete(res);
    }
  }
}

export function registerLive(app: FastifyInstance): void {
  app.addContentTypeParser('image/jpeg', { parseAs: 'buffer', bodyLimit: MAX_BYTES }, (_req, body, done) => done(null, body));

  // The headset posts a frame. An optional LIVE_KEY keeps strangers from injecting pictures.
  app.post('/live/frame', async (req, reply) => {
    if (config.LIVE_KEY && req.headers['x-live-key'] !== config.LIVE_KEY) return reply.code(401).send({ error: 'live_key_required' });
    const body = req.body as Buffer | undefined;
    if (!Buffer.isBuffer(body) || body.length < 200) return reply.code(400).send({ error: 'invalid_frame' });
    if (body[0] !== 0xff || body[1] !== 0xd8) return reply.code(400).send({ error: 'not_a_jpeg' });
    const now = Date.now();
    if (now - lastAccepted < MIN_GAP_MS) return reply.code(429).send({ error: 'too_fast' });
    lastAccepted = now;
    latest = body;
    lastAt = now;
    totalFrames++;
    recent.push(now);
    broadcast(body);
    return { ok: true };
  });

  app.get('/api/live', async () => ({
    active: Date.now() - lastAt < ACTIVE_MS,
    lastFrameAt: lastAt ? new Date(lastAt).toISOString() : null,
    ageMs: lastAt ? Date.now() - lastAt : null,
    fps: fps(),
    frameBytes: latest?.length ?? 0,
    frames: totalFrames,
    viewers: viewers.size,
  }));

  app.get('/live/latest.jpg', async (_req, reply) => {
    if (!latest) return reply.code(404).send({ error: 'no_frame_yet' });
    return reply.header('cache-control', 'no-store').type('image/jpeg').send(latest);
  });

  app.get('/live/stream', (req, reply) => {
    const raw = reply.raw;
    reply.hijack();
    raw.writeHead(200, {
      'content-type': `multipart/x-mixed-replace; boundary=${BOUNDARY}`,
      'cache-control': 'no-cache, no-store, must-revalidate',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    if (latest) broadcastTo(raw, latest);
    viewers.add(raw);
    req.raw.on('close', () => viewers.delete(raw));
  });
}

function broadcastTo(res: NodeJS.WritableStream, frame: Buffer): void {
  res.write(`--${BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`);
  res.write(frame);
  res.write('\r\n');
}
