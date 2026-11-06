import dns from 'node:dns';
import net from 'node:net';

dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamilyAttemptTimeout(500);
import Fastify from 'fastify';
import { config } from './config.js';
import { activity } from './activity.js';
import { registerApi } from './api.js';
import { registerLive } from './live.js';
import { registerRoutes } from './routes.js';
import { registerWeb } from './web.js';
import { keepWarm } from './zerog/http.js';

const app = Fastify({ logger: { level: 'info' }, bodyLimit: 6 * 1024 * 1024 });
app.addHook('onResponse', async (req, reply) => {
  if (reply.statusCode >= 400) activity('rejected', { method: req.method, url: req.url.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/, ':id'), status: reply.statusCode });
});
registerRoutes(app);
registerApi(app);
registerLive(app);
await registerWeb(app);
keepWarm(`${config.ZG_ROUTER_URL}/models`, config.ZG_API_KEY);

app.listen({ port: config.PORT, host: config.HOST }).catch((err: unknown) => {
  app.log.error(err);
  process.exit(1);
});
