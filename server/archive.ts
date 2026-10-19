import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import type { PoolClient } from 'pg';
import cron, { type ScheduledTask } from 'node-cron';
import { config } from './config.ts';
import { pool } from './db.ts';
import { getArchiveRetentionDays } from './settings.ts';

const gzipAsync = promisify(gzip);
const archiveRoot = path.join(config.dataDir, 'archive');
let cleanupTask: ScheduledTask | null = null;

export interface ArchiveFile {
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
  sha256: string;
  capturedAt: string;
}

export interface ArchiveListItem {
  id: string;
  sourceId: 'hae' | 'fitdays' | 'igpsport';
  archiveKind: string;
  relativePath: string;
  capturedAt: string;
  sizeBytes: number;
  recordCount: number;
  deletedAt: string | null;
}

export function resolveArchivePath(relativePath: string): string {
  const absolutePath = path.resolve(config.dataDir, relativePath);
  const root = path.resolve(config.dataDir) + path.sep;
  if (!absolutePath.startsWith(root)) {
    throw new Error('归档路径越界。');
  }
  return absolutePath;
}

export async function archiveJson(
  sourceId: 'hae' | 'fitdays' | 'igpsport',
  archiveKind: string,
  payload: unknown
): Promise<ArchiveFile> {
  const capturedAt = new Date();
  const year = String(capturedAt.getUTCFullYear());
  const month = String(capturedAt.getUTCMonth() + 1).padStart(2, '0');
  const timestamp = capturedAt.toISOString().replace(/[:.]/g, '-');
  const fileName = `${timestamp}-${archiveKind}-${randomUUID().slice(0, 8)}.json.gz`;
  const relativePath = path.posix.join('archive', sourceId, year, month, fileName);
  const absolutePath = resolveArchivePath(relativePath);
  const temporaryPath = `${absolutePath}.tmp`;
  const content = Buffer.from(JSON.stringify(payload), 'utf8');
  const compressed = await gzipAsync(content);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(temporaryPath, compressed);
  await fs.rename(temporaryPath, absolutePath);

  return {
    relativePath,
    absolutePath,
    sizeBytes: compressed.byteLength,
    sha256: createHash('sha256').update(compressed).digest('hex'),
    capturedAt: capturedAt.toISOString(),
  };
}

export async function archiveZip(
  sourceId: 'hae' | 'fitdays' | 'igpsport',
  archiveKind: string,
  buffer: Buffer,
  originalFilename?: string
): Promise<ArchiveFile> {
  const capturedAt = new Date();
  const year = String(capturedAt.getUTCFullYear());
  const month = String(capturedAt.getUTCMonth() + 1).padStart(2, '0');
  const timestamp = capturedAt.toISOString().replace(/[:.]/g, '-');
  const baseName = originalFilename
    ? path.basename(originalFilename).replace(/\.[^/.]+$/, '').replace(/[^\w-]/g, '_')
    : archiveKind;
  const fileName = `${timestamp}-${baseName}-${randomUUID().slice(0, 8)}.zip`;
  const relativePath = path.posix.join('archive', sourceId, year, month, fileName);
  const absolutePath = resolveArchivePath(relativePath);
  const temporaryPath = `${absolutePath}.tmp`;

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(temporaryPath, buffer);
  await fs.rename(temporaryPath, absolutePath);

  return {
    relativePath,
    absolutePath,
    sizeBytes: buffer.byteLength,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    capturedAt: capturedAt.toISOString(),
  };
}

export async function registerArchive(
  client: PoolClient,
  archive: ArchiveFile,
  sourceId: 'hae' | 'fitdays' | 'igpsport',
  archiveKind: string,
  recordCount: number,
  metadata: Record<string, unknown> = {}
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO source_archive_files
      (source_id, archive_kind, relative_path, captured_at, size_bytes, sha256,
       record_count, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     RETURNING id`,
    [
      sourceId,
      archiveKind,
      archive.relativePath,
      archive.capturedAt,
      archive.sizeBytes,
      archive.sha256,
      recordCount,
      JSON.stringify(metadata),
    ]
  );
  return result.rows[0].id;
}

async function deleteOldFiles(directory: string, cutoffMs: number): Promise<{ files: number; bytes: number }> {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return { files: 0, bytes: 0 };
  }

  let files = 0;
  let bytes = 0;
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await deleteOldFiles(absolutePath, cutoffMs);
      files += nested.files;
      bytes += nested.bytes;
      const remaining = await fs.readdir(absolutePath).catch(() => []);
      if (remaining.length === 0) {
        await fs.rmdir(absolutePath).catch(() => undefined);
      }
      continue;
    }

    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat || stat.mtimeMs >= cutoffMs) continue;
    await fs.unlink(absolutePath).catch(() => undefined);
    files += 1;
    bytes += stat.size;
  }
  return { files, bytes };
}

export async function cleanupExpiredArchives(retentionDays?: number): Promise<{
  retentionDays: number;
  deletedFiles: number;
  deletedBytes: number;
  cutoff: string;
}> {
  const days = retentionDays ?? (await getArchiveRetentionDays());
  if (days === 0) {
    return {
      retentionDays: 0,
      deletedFiles: 0,
      deletedBytes: 0,
      cutoff: '1970-01-01T00:00:00.000Z',
    };
  }
  const cutoffMs = Date.now() - days * 86_400_000;
  const cutoff = new Date(cutoffMs);
  const archiveResult = await deleteOldFiles(archiveRoot, cutoffMs);
  const legacyFitResult = await deleteOldFiles(path.join(config.dataDir, 'igpsport_fits'), cutoffMs);

  await pool.query(
    `UPDATE source_archive_files
     SET deleted_at = NOW()
     WHERE deleted_at IS NULL AND captured_at < $1`,
    [cutoff]
  );

  return {
    retentionDays: days,
    deletedFiles: archiveResult.files + legacyFitResult.files,
    deletedBytes: archiveResult.bytes + legacyFitResult.bytes,
    cutoff: cutoff.toISOString(),
  };
}

export async function listArchives(limit = 12): Promise<ArchiveListItem[]> {
  const result = await pool.query<{
    id: string;
    source_id: 'hae' | 'fitdays' | 'igpsport';
    archive_kind: string;
    relative_path: string;
    captured_at: Date;
    size_bytes: string;
    record_count: number;
    deleted_at: Date | null;
  }>(
    `SELECT id, source_id, archive_kind, relative_path, captured_at, size_bytes,
            record_count, deleted_at
     FROM source_archive_files
     ORDER BY captured_at DESC
     LIMIT $1`,
    [Math.min(Math.max(limit, 1), 100)]
  );

  return result.rows.map((row) => ({
    id: row.id,
    sourceId: row.source_id,
    archiveKind: row.archive_kind,
    relativePath: row.relative_path,
    capturedAt: row.captured_at.toISOString(),
    sizeBytes: Number(row.size_bytes),
    recordCount: row.record_count,
    deletedAt: row.deleted_at?.toISOString() || null,
  }));
}

export async function getArchiveStats(): Promise<{
  activeFiles: number;
  activeBytes: number;
  totalFiles: number;
}> {
  const result = await pool.query<{
    active_files: string;
    active_bytes: string;
    total_files: string;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE deleted_at IS NULL)::text AS active_files,
       COALESCE(SUM(size_bytes) FILTER (WHERE deleted_at IS NULL), 0)::text AS active_bytes,
       COUNT(*)::text AS total_files
     FROM source_archive_files`
  );
  const row = result.rows[0];
  return {
    activeFiles: Number(row?.active_files || 0),
    activeBytes: Number(row?.active_bytes || 0),
    totalFiles: Number(row?.total_files || 0),
  };
}

export async function getArchiveStream(
  archiveId: string
): Promise<{ stream: NodeJS.ReadableStream; fileName: string; isZip: boolean }> {
  const result = await pool.query<{
    relative_path: string;
    deleted_at: Date | null;
  }>(
    `SELECT relative_path, deleted_at
     FROM source_archive_files
     WHERE id = $1`,
    [archiveId]
  );
  const archive = result.rows[0];
  if (!archive || archive.deleted_at) {
    throw new Error('备份文件不存在或已超过保留期限。');
  }
  const absolutePath = resolveArchivePath(archive.relative_path);
  await fs.access(absolutePath);
  return {
    stream: createReadStream(absolutePath),
    fileName: path.basename(absolutePath),
    isZip: archive.relative_path.endsWith('.zip'),
  };
}

export async function deleteArchive(archiveId: string): Promise<void> {
  const result = await pool.query<{ relative_path: string }>(
    `UPDATE source_archive_files
     SET deleted_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING relative_path`,
    [archiveId]
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('备份记录不存在或已被删除。');
  }
  try {
    const absolutePath = resolveArchivePath(row.relative_path);
    await fs.unlink(absolutePath);
  } catch {
    // File might already be deleted or missing
  }
}

export async function testArchiveWritable(): Promise<{ ok: true; path: string }> {
  await fs.mkdir(archiveRoot, { recursive: true });
  const probe = path.join(archiveRoot, `.write-test-${randomUUID()}`);
  await fs.writeFile(probe, 'ok', 'utf8');
  await fs.unlink(probe);
  return { ok: true, path: archiveRoot };
}

export async function startArchiveCleanupScheduler(): Promise<void> {
  const result = await cleanupExpiredArchives();
  console.info(
    `[archive] 保留 ${result.retentionDays} 天，启动清理删除 ${result.deletedFiles} 个文件`
  );
  cleanupTask = cron.schedule(
    '20 3 * * *',
    async () => {
      try {
        const cleanup = await cleanupExpiredArchives();
        console.info(
          `[archive] 每日清理删除 ${cleanup.deletedFiles} 个文件，共 ${cleanup.deletedBytes} 字节`
        );
      } catch (error) {
        console.error('[archive] 清理失败', error);
      }
    },
    { timezone: config.timezone, name: 'health-archive-cleanup' }
  );
}

export async function stopArchiveCleanupScheduler(): Promise<void> {
  if (cleanupTask) {
    await cleanupTask.destroy();
    cleanupTask = null;
  }
}
