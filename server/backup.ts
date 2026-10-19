import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import path from 'node:path';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import cron, { type ScheduledTask } from 'node-cron';
import { config } from './config.ts';
import { getArchiveRetentionDays } from './settings.ts';

const backupDir = path.join(config.dataDir, 'backups');
let backupTask: ScheduledTask | null = null;

export async function ensureBackupDirectory(): Promise<string> {
  await fs.mkdir(backupDir, { recursive: true });
  return backupDir;
}

export async function checkPgDumpAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('pg_dump', ['--version'], { stdio: 'ignore' });
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => resolve(code === 0));
  });
}

export async function createDatabaseBackup(): Promise<{
  ok: boolean;
  fileName?: string;
  filePath?: string;
  sizeBytes?: number;
  message?: string;
}> {
  await ensureBackupDirectory();
  const isPgDumpAvailable = await checkPgDumpAvailable();
  if (!isPgDumpAvailable) {
    console.info('[backup] 环境未检测到 pg_dump 工具，数据库由挂载目录 ./data/postgres 实时持久化。');
    return {
      ok: false,
      message: 'pg_dump not found; database is persistently stored in ./data/postgres',
    };
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `health_dashboard_${timestamp}.sql.gz`;
  const filePath = path.join(backupDir, fileName);
  const tempPath = `${filePath}.tmp`;

  try {
    const pgDumpProcess = spawn('pg_dump', [config.databaseUrl], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderrOutput = '';
    pgDumpProcess.stderr.on('data', (chunk) => {
      stderrOutput += chunk.toString();
    });

    const gzipStream = createGzip();
    const fileStream = createWriteStream(tempPath);

    const dumpPromise = new Promise<void>((resolve, reject) => {
      pgDumpProcess.on('error', reject);
      pgDumpProcess.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`pg_dump exited with code ${code}: ${stderrOutput}`));
      });
    });

    await Promise.all([
      pipeline(pgDumpProcess.stdout, gzipStream, fileStream),
      dumpPromise,
    ]);

    await fs.rename(tempPath, filePath);
    const stat = await fs.stat(filePath);
    console.info(`[backup] 数据库快照备份成功: ${fileName} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
    return {
      ok: true,
      fileName,
      filePath,
      sizeBytes: stat.size,
    };
  } catch (error) {
    if (existsSync(tempPath)) {
      await fs.unlink(tempPath).catch(() => undefined);
    }
    console.error('[backup] 数据库快照备份失败:', error);
    return {
      ok: false,
      message: (error as Error).message,
    };
  }
}

export async function cleanupExpiredBackups(retentionDays?: number): Promise<{
  deletedFiles: number;
  deletedBytes: number;
}> {
  await ensureBackupDirectory();
  const days = retentionDays ?? (await getArchiveRetentionDays());
  if (days === 0) return { deletedFiles: 0, deletedBytes: 0 };
  const cutoffMs = Date.now() - days * 86_400_000;

  let deletedFiles = 0;
  let deletedBytes = 0;

  try {
    const entries = await fs.readdir(backupDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.sql.gz')) continue;
      const absolutePath = path.join(backupDir, entry.name);
      const stat = await fs.stat(absolutePath).catch(() => null);
      if (!stat || stat.mtimeMs >= cutoffMs) continue;
      await fs.unlink(absolutePath).catch(() => undefined);
      deletedFiles += 1;
      deletedBytes += stat.size;
    }
  } catch (error) {
    console.error('[backup] 清理历史备份出错:', error);
  }

  return { deletedFiles, deletedBytes };
}

export async function startBackupScheduler(): Promise<void> {
  await ensureBackupDirectory();
  backupTask = cron.schedule(
    '15 3 * * *',
    async () => {
      try {
        await createDatabaseBackup();
        const cleanup = await cleanupExpiredBackups();
        if (cleanup.deletedFiles > 0) {
          console.info(`[backup] 已清理 ${cleanup.deletedFiles} 个过期数据库备份，释放 ${(cleanup.deletedBytes / 1024 / 1024).toFixed(2)} MB`);
        }
      } catch (error) {
        console.error('[backup] 自动备份计划执行失败:', error);
      }
    },
    { timezone: config.timezone, name: 'health-database-backup' }
  );
}

export async function stopBackupScheduler(): Promise<void> {
  if (backupTask) {
    await backupTask.destroy();
    backupTask = null;
  }
}
