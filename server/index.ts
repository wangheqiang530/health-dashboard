import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { startArchiveCleanupScheduler, stopArchiveCleanupScheduler } from './archive.ts';
import { config } from './config.ts';
import { closeDatabase, migrate, pool } from './db.ts';
import { configRoutes } from './routes/config.ts';
import { dashboardRoutes } from './routes/dashboard.ts';
import { haeRoutes } from './routes/hae.ts';
import { versionRoutes } from './routes/version.ts';
import { ensureHaeApiKey } from './settings.ts';
import { reloadSchedules, stopScheduler } from './sync.ts';

const app = Fastify({
  logger: {
    level: config.logLevel,
  },
  bodyLimit: config.maxHaeBytes,
  trustProxy: true,
  requestTimeout: 600_000,
});

await app.register(fastifyMultipart, {
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
});

app.addContentTypeParser(
  'application/json',
  { parseAs: 'string', bodyLimit: config.maxHaeBytes },
  (_request, body, done) => {
    try {
      done(null, JSON.parse(body as string));
    } catch (error) {
      done(error as Error, undefined);
    }
  }
);

app.get('/api/health', async () => {
  await pool.query('SELECT 1');
  return {
    ok: true,
    service: 'health-dashboard',
    database: 'connected',
    timezone: config.timezone,
    timestamp: new Date().toISOString(),
  };
});

await app.register(haeRoutes);
await app.register(dashboardRoutes);
await app.register(configRoutes);
await app.register(versionRoutes);

if (config.nodeEnv === 'production') {
  const distDirectory = path.resolve(fileURLToPath(new URL('../dist', import.meta.url)));
  try {
    await fs.access(path.join(distDirectory, 'index.html'));
    await app.register(fastifyStatic, {
      root: distDirectory,
      wildcard: false,
      index: false,
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/api/')) {
        return reply.sendFile('index.html');
      }
      return reply.code(404).send({ error: 'Not found' });
    });
  } catch {
    app.log.warn('未找到 dist/index.html，生产环境将只提供 API。');
  }
} else {
  app.get('/', async () => ({
    service: 'health-dashboard-api',
    message: '前端开发服务器请使用 pnpm dev；API 文档入口见 README。',
  }));
}

app.setErrorHandler((error, request, reply) => {
  request.log.error({ err: error }, 'Unhandled request error');
  const knownError = error as Error & { statusCode?: number };
  const statusCode =
    knownError.statusCode && knownError.statusCode >= 400 ? knownError.statusCode : 500;
  return reply.code(statusCode).send({
    error: statusCode >= 500 ? '服务内部错误' : knownError.message,
  });
});

const shutdown = async (signal: string): Promise<void> => {
  app.log.info(`收到 ${signal}，正在停止服务。`);
  await stopScheduler();
  await stopArchiveCleanupScheduler();
  await app.close();
  await closeDatabase();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await migrate();
  await ensureHaeApiKey();
  await reloadSchedules();
  await startArchiveCleanupScheduler();
  await app.listen({ host: config.host, port: config.port });
  app.log.info(`Health Dashboard API listening on http://${config.host}:${config.port}`);
} catch (error) {
  app.log.error(error);
  await closeDatabase();
  process.exit(1);
}
