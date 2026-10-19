import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { startArchiveCleanupScheduler, stopArchiveCleanupScheduler } from './archive.ts';
import {
  extractDashboardSessionToken,
  findDashboardSession,
} from './auth.ts';
import { backfillCyclingRoutes } from './backfill.ts';
import { startBackupScheduler, stopBackupScheduler } from './backup.ts';
import { config } from './config.ts';
import { closeDatabase, migrate, pool } from './db.ts';
import { authRoutes } from './routes/auth.ts';
import { configRoutes } from './routes/config.ts';
import { dashboardRoutes } from './routes/dashboard.ts';
import { haeRoutes } from './routes/hae.ts';
import { mapRoutes } from './routes/map.ts';
import { repairHistoricalHaeSummaries } from './hae.ts';
import { appLogStream, closeLogger } from './logger.ts';
import { versionRoutes } from './routes/version.ts';
import { bodyRoutes } from './routes/body.ts';
import {
  ensureDashboardPassword,
  getDashboardPasswordRecoveryPath,
  ensureHaeApiKey,
} from './settings.ts';
import { reloadSchedules, stopScheduler } from './sync.ts';

const app = Fastify({
  logger: {
    level: config.logLevel,
    stream: appLogStream,
  },
  bodyLimit: config.maxHaeBytes,
  trustProxy: true,
  requestTimeout: 1_800_000,
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

const publicApiPaths = new Set([
  '/api/health',
  '/api/v1/health-auto-export',
  '/api/v1/auth/status',
  '/api/v1/auth/login',
  '/api/v1/auth/logout',
]);

app.addHook('onSend', async (request, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'SAMEORIGIN');
  reply.header('Referrer-Policy', 'no-referrer');
  reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  const url = request.raw.url || '';
  if (url.startsWith('/api/v1/map/tiles/')) {
    reply.header('Cache-Control', 'public, max-age=604800, immutable');
  } else if (url.startsWith('/api/')) {
    reply.header('Cache-Control', 'no-store');
  }
});

app.addHook('onRequest', async (request, reply) => {
  const pathname = (request.raw.url || '').split('?')[0];
  if (!pathname.startsWith('/api/') || publicApiPaths.has(pathname)) return;

  const token = extractDashboardSessionToken(request.headers);
  const session = await findDashboardSession(token);
  if (!session) {
    return reply.code(401).send({ error: '登录会话已失效，请重新输入面板密码。' });
  }
});

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
await app.register(authRoutes);
await app.register(dashboardRoutes);
await app.register(mapRoutes);
await app.register(configRoutes);
await app.register(versionRoutes);
await app.register(bodyRoutes);

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
  await stopBackupScheduler();
  await app.close();
  await closeDatabase();
  closeLogger();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await migrate();
  await ensureHaeApiKey();
  await ensureDashboardPassword();
  const passwordRecoveryFile = await getDashboardPasswordRecoveryPath();
  if (passwordRecoveryFile) {
    app.log.info(`面板密码找回文件：${passwordRecoveryFile}`);
  }
  try {
    const repair = await repairHistoricalHaeSummaries();
    if (repair.repairedCount > 0) {
      app.log.info(`[hae:repair] 成功自愈与增量合并 ${repair.repairedCount} 天历史健康数据。`);
    }
  } catch (repairErr) {
    app.log.warn({ err: repairErr }, '[hae:repair] 历史数据自愈合并跳过');
  }
  await reloadSchedules();
  await startArchiveCleanupScheduler();
  await startBackupScheduler();
  await app.listen({ host: config.host, port: config.port });
  app.log.info(`Health Dashboard API listening on http://${config.host}:${config.port}`);
  void backfillCyclingRoutes()
    .then((result) => {
      if (result.scanned > 0) {
        app.log.info(
          `[fit:backfill] 扫描 ${result.scanned} 条，回填 ${result.repaired} 条轨迹，缺失文件 ${result.missingFiles} 条，失败 ${result.failed} 条。`
        );
      }
    })
    .catch((error) => app.log.warn({ err: error }, '[fit:backfill] 历史轨迹回填失败'));
} catch (error) {
  app.log.error(error);
  await closeDatabase();
  closeLogger();
  process.exit(1);
}
