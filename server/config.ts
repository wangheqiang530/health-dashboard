import 'dotenv/config';
import path from 'node:path';

const toPositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const encryptionKey = process.env.APP_ENCRYPTION_KEY?.trim();
if (!encryptionKey) {
  throw new Error('缺少 APP_ENCRYPTION_KEY。请根据 .env.example 创建 .env 后再启动后端。');
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: toPositiveInt(process.env.PORT, 8080),
  host: process.env.HOST ?? '0.0.0.0',
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://health:health@localhost:5433/health_dashboard',
  encryptionKey,
  timezone: process.env.TZ ?? 'Asia/Shanghai',
  dataDir: path.resolve(process.env.DATA_DIR ?? './data'),
  haeApiKey: process.env.HAE_API_KEY?.trim() || null,
  maxHaeBytes: toPositiveInt(process.env.MAX_HAE_BYTES, 256 * 1024 * 1024),
  archiveRetentionDays: toPositiveInt(
    process.env.BACKUP_RETENTION_DAYS ?? process.env.HAE_RETENTION_DAYS,
    365
  ),
  publicBaseUrl: process.env.PUBLIC_BASE_URL?.replace(/\/$/, '') || null,
  dashboardPassword: process.env.DASHBOARD_PASSWORD?.trim() || null,
  logLevel: process.env.LOG_LEVEL ?? 'info',
  dockerHubRepository: process.env.DOCKERHUB_REPOSITORY ?? 'wangheqiang/health-dashboard',
  githubRepository: process.env.GITHUB_REPOSITORY ?? 'wangheqiang530/health-dashboard',
};
