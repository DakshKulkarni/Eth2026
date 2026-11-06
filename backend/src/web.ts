import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Serves the built dashboard (public/app) from the same address as the API, with the app's own pages
// (like /verify/d1-cert or /checkin) falling back to index.html so the browser's router can show them.
const root = fileURLToPath(new URL('../public/app/', import.meta.url));

export async function registerWeb(app: FastifyInstance): Promise<void> {
  if (!existsSync(`${root}index.html`)) {
    app.log.warn('dashboard build not found in public/app; only the API is served');
    return;
  }
  await app.register(fastifyStatic, {
    root,
    prefix: '/',
    wildcard: false,
    cacheControl: false,
    setHeaders: (res, path) => {
      if (path.endsWith('index.html')) res.setHeader('cache-control', 'no-cache');
      else if (path.includes('/assets/')) res.setHeader('cache-control', 'public, max-age=31536000, immutable');
    },
  });
  app.setNotFoundHandler((req, reply) => {
    const path = req.url.split('?')[0] ?? '/';
    const isPage = (req.method === 'GET' || req.method === 'HEAD') && !path.startsWith('/api/') && !/\.[a-z0-9]+$/i.test(path);
    if (isPage) return reply.header('cache-control', 'no-cache').sendFile('index.html');
    return reply.code(404).send({ error: 'not_found' });
  });
}
