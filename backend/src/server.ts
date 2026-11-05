import Fastify from 'fastify';
import { config } from './config.js';
import { registerRoutes } from './routes.js';

const app = Fastify({ logger: { level: 'info' }, bodyLimit: 6 * 1024 * 1024 });
registerRoutes(app);

app.listen({ port: config.PORT, host: config.HOST }).catch((err: unknown) => {
  app.log.error(err);
  process.exit(1);
});
