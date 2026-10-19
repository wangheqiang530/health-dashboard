import type { FastifyInstance, FastifyRequest } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import cron from 'node-cron';
import { z } from 'zod';
import {
  cleanupExpiredArchives,
  deleteArchive,
  getArchiveStats,
  getArchiveStream,
  listArchives,
  testArchiveWritable,
} from '../archive.ts';
import { config } from '../config.ts';
import { decryptSecret, encryptSecret } from '../crypto.ts';
import { pool } from '../db.ts';
import { importAppleHealthZip } from '../appleHealthXml.ts';
import { parseFitActivity, safeFitFilename } from '../fit.ts';
import {
  ensureHaeApiKey,
  getArchiveRetentionDays,
  setArchiveRetentionDays,
} from '../settings.ts';
import { testFitdaysConnection } from '../sources/fitdays.ts';
import { testIgpsportConnection } from '../sources/igpsport.ts';
import {
  getNextScheduledRun,
  isSourceRunning,
  queueSourceSync,
  reloadSchedules,
  type SyncSourceId,
} from '../sync.ts';

interface SourceRow {
  id: 'hae' | SyncSourceId;
  display_name: string;
  enabled: boolean;
  account: string | null;
  encrypted_password: string | null;
  cron_expression: string | null;
  config: {
    targetSuid?: number | null;
    syncDays?: number;
    syncLimit?: number;
  };
  last_sync_at: Date | null;
  last_success_at: Date | null;
  last_error: string | null;
}

interface RunRow {
  id: string;
  source_id: SyncSourceId;
  trigger_type: 'manual' | 'cron';
  status: 'running' | 'success' | 'failed';
  started_at: Date;
  finished_at: Date | null;
  records_count: number;
  message: string | null;
  details: Record<string, unknown>;
}

const sourceUpdateSchema = z.object({
  account: z.string().trim().min(1).max(200),
  password: z.string().max(300).optional().default(''),
  cronExpression: z.string().trim().min(1).max(100),
  enabled: z.boolean(),
  targetSuid: z.number().int().positive().nullable().optional(),
  syncDays: z.number().int().min(1).max(3650).optional(),
  syncLimit: z.number().int().min(1).max(100).optional(),
});

const syncSourceParamSchema = z.object({
  sourceId: z.enum(['fitdays', 'igpsport']),
});

const allSourceParamSchema = z.object({
  sourceId: z.enum(['hae', 'fitdays', 'igpsport']),
});

const storageSchema = z.object({
  retentionDays: z.number().int().min(0).max(3650),
});

const publicEndpoint = (request: FastifyRequest): string => {
  if (config.publicBaseUrl) return config.publicBaseUrl;
  const forwardedProto = request.headers['x-forwarded-proto'];
  const protocol =
    typeof forwardedProto === 'string' ? forwardedProto.split(',')[0].trim() : request.protocol;
  return `${protocol}://${request.host}`;
};

const sourceView = (source: SourceRow) => ({
  id: source.id,
  displayName: source.display_name,
  enabled: source.enabled,
  account: source.account || '',
  passwordConfigured: Boolean(source.encrypted_password),
  cronExpression: source.cron_expression || '',
  targetSuid: source.config.targetSuid || null,
  syncDays: source.config.syncDays || 1095,
  syncLimit: source.config.syncLimit || 20,
  lastSyncAt: source.last_sync_at?.toISOString() || null,
  lastSuccessAt: source.last_success_at?.toISOString() || null,
  lastError: source.last_error,
  running: source.id === 'hae' ? false : isSourceRunning(source.id),
  nextRunAt: source.id === 'hae' ? null : getNextScheduledRun(source.id),
});

export async function configRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/config', async (request) => {
    const [sources, runs, counts, retentionDays, archiveStats, archives] = await Promise.all([
      pool.query<SourceRow>('SELECT * FROM data_sources ORDER BY id'),
      pool.query<RunRow>(
        `SELECT id, source_id, trigger_type, status, started_at, finished_at,
                records_count, message, details
         FROM sync_runs
         ORDER BY started_at DESC
         LIMIT 20`
      ),
      pool.query<{
        daily_count: string;
        metric_count: string;
        workout_count: string;
        body_count: string;
        ride_count: string;
        raw_record_count: string;
        sample_count: string;
        import_batch_count: string;
        failed_batch_count: string;
        daily_earliest: string | null;
        daily_latest: string | null;
        body_earliest: string | null;
        body_latest: string | null;
        ride_earliest: string | null;
        ride_latest: string | null;
        workout_earliest: string | null;
        workout_latest: string | null;
      }>(
        `SELECT
          (SELECT COUNT(*) FROM daily_summaries)::text AS daily_count,
          (SELECT COUNT(*) FROM health_metric_points)::text AS metric_count,
          (SELECT COUNT(*) FROM health_workouts)::text AS workout_count,
          (SELECT COUNT(*) FROM body_measurements)::text AS body_count,
          (SELECT COUNT(*) FROM cycling_activities)::text AS ride_count,
          (SELECT COUNT(*) FROM health_raw_records)::text AS raw_record_count,
          (SELECT COUNT(*) FROM health_samples)::text AS sample_count,
          (SELECT COUNT(*) FROM import_batches)::text AS import_batch_count,
          (SELECT COUNT(*) FROM import_batches WHERE status = 'failed')::text AS failed_batch_count,
          (SELECT to_char(MIN(day), 'YYYY-MM-DD') FROM daily_summaries) AS daily_earliest,
          (SELECT to_char(MAX(day), 'YYYY-MM-DD') FROM daily_summaries) AS daily_latest,
          (SELECT to_char(MIN(measured_date), 'YYYY-MM-DD') FROM body_measurements) AS body_earliest,
          (SELECT to_char(MAX(measured_date), 'YYYY-MM-DD') FROM body_measurements) AS body_latest,
          (SELECT to_char(MIN((started_at AT TIME ZONE $1)::date), 'YYYY-MM-DD') FROM cycling_activities) AS ride_earliest,
          (SELECT to_char(MAX((started_at AT TIME ZONE $1)::date), 'YYYY-MM-DD') FROM cycling_activities) AS ride_latest,
          (SELECT to_char(MIN((started_at AT TIME ZONE $1)::date), 'YYYY-MM-DD') FROM health_workouts WHERE started_at IS NOT NULL) AS workout_earliest,
          (SELECT to_char(MAX((started_at AT TIME ZONE $1)::date), 'YYYY-MM-DD') FROM health_workouts WHERE started_at IS NOT NULL) AS workout_latest`,
        [config.timezone]
      ),
      getArchiveRetentionDays(),
      getArchiveStats(),
      listArchives(12),
    ]);
    const haeApiKey = await ensureHaeApiKey();
    const endpoint = `${publicEndpoint(request)}/api/v1/health-auto-export`;
    const count = counts.rows[0];

    return {
      sources: sources.rows.map(sourceView),
      hae: {
        endpoint,
        apiKey: haeApiKey,
      },
      database: {
        connected: true,
        dailySummaries: Number(count?.daily_count || 0),
        metricPoints: Number(count?.metric_count || 0),
        workouts: Number(count?.workout_count || 0),
        bodyMeasurements: Number(count?.body_count || 0),
        cyclingActivities: Number(count?.ride_count || 0),
        rawRecords: Number(count?.raw_record_count || 0),
        healthSamples: Number(count?.sample_count || 0),
        importBatches: Number(count?.import_batch_count || 0),
        failedImportBatches: Number(count?.failed_batch_count || 0),
      },
      coverage: {
        dailySummaries: {
          count: Number(count?.daily_count || 0),
          earliest: count?.daily_earliest || null,
          latest: count?.daily_latest || null,
        },
        bodyMeasurements: {
          count: Number(count?.body_count || 0),
          earliest: count?.body_earliest || null,
          latest: count?.body_latest || null,
        },
        cyclingActivities: {
          count: Number(count?.ride_count || 0),
          earliest: count?.ride_earliest || null,
          latest: count?.ride_latest || null,
        },
        healthWorkouts: {
          count: Number(count?.workout_count || 0),
          earliest: count?.workout_earliest || null,
          latest: count?.workout_latest || null,
        },
      },
      storage: {
        retentionDays,
        archiveCount: archiveStats.activeFiles,
        archiveSizeBytes: archiveStats.activeBytes,
        totalArchiveCount: archiveStats.totalFiles,
        archives,
      },
      recentRuns: runs.rows.map((run) => ({
        id: run.id,
        sourceId: run.source_id,
        triggerType: run.trigger_type,
        status: run.status,
        startedAt: run.started_at.toISOString(),
        finishedAt: run.finished_at?.toISOString() || null,
        recordsCount: run.records_count,
        message: run.message,
        details: run.details,
      })),
      timezone: config.timezone,
    };
  });

  app.put<{ Params: { sourceId: string } }>(
    '/api/v1/config/sources/:sourceId',
    async (request, reply) => {
      const params = syncSourceParamSchema.safeParse(request.params);
      const body = sourceUpdateSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply.code(400).send({
          error: '配置参数无效',
          details: body.success ? params.error?.flatten() : body.error.flatten(),
        });
      }
      if (!cron.validate(body.data.cronExpression)) {
        return reply.code(400).send({ error: 'Cron 表达式无效。例如每 6 小时：15 */6 * * *' });
      }

      const sourceId = params.data.sourceId;
      const existing = await pool.query<SourceRow>('SELECT * FROM data_sources WHERE id = $1', [
        sourceId,
      ]);
      if (!existing.rows[0]) {
        return reply.code(404).send({ error: '数据源不存在' });
      }
      if (body.data.enabled && !body.data.password && !existing.rows[0].encrypted_password) {
        return reply.code(400).send({ error: '启用数据源前必须填写密码。' });
      }

      const sourceConfig =
        sourceId === 'fitdays'
          ? {
              targetSuid: body.data.targetSuid || null,
              syncDays: body.data.syncDays || 1095,
            }
          : {
              syncLimit: body.data.syncLimit || 20,
            };
      const encryptedPassword = body.data.password
        ? encryptSecret(body.data.password)
        : existing.rows[0].encrypted_password;

      const updated = await pool.query<SourceRow>(
        `UPDATE data_sources
         SET account = $2,
             encrypted_password = $3,
             cron_expression = $4,
             enabled = $5,
             config = $6::jsonb,
             last_error = NULL,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          sourceId,
          body.data.account,
          encryptedPassword,
          body.data.cronExpression,
          body.data.enabled,
          JSON.stringify(sourceConfig),
        ]
      );
      await reloadSchedules();
      return { source: sourceView(updated.rows[0]) };
    }
  );

  app.post<{ Params: { sourceId: string } }>(
    '/api/v1/config/sources/:sourceId/sync',
    async (request, reply) => {
      const params = syncSourceParamSchema.safeParse(request.params);
      if (!params.success) {
        return reply.code(400).send({ error: '未知数据源' });
      }

      const body = (request.body as { full?: boolean } | null) || {};
      const query = (request.query as { full?: string } | null) || {};
      const isFull = Boolean(body.full || query.full === 'true');

      try {
        const run = await queueSourceSync(params.data.sourceId, 'manual', { full: isFull });
        return reply.code(202).send(run);
      } catch (error) {
        return reply.code(409).send({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.get<{ Params: { sourceId: string } }>(
    '/api/v1/config/sources/:sourceId/runs',
    async (request, reply) => {
      const params = syncSourceParamSchema.safeParse(request.params);
      if (!params.success) {
        return reply.code(400).send({ error: '未知数据源' });
      }
      const result = await pool.query<RunRow>(
        `SELECT id, source_id, trigger_type, status, started_at, finished_at,
                records_count, message, details
         FROM sync_runs
         WHERE source_id = $1
         ORDER BY started_at DESC
         LIMIT 20`,
        [params.data.sourceId]
      );
      return {
        runs: result.rows.map((run) => ({
          id: run.id,
          sourceId: run.source_id,
          triggerType: run.trigger_type,
          status: run.status,
          startedAt: run.started_at.toISOString(),
          finishedAt: run.finished_at?.toISOString() || null,
          recordsCount: run.records_count,
          message: run.message,
          details: run.details,
        })),
      };
    }
  );

  app.post<{ Params: { sourceId: string } }>(
    '/api/v1/config/sources/:sourceId/test',
    async (request, reply) => {
      const params = allSourceParamSchema.safeParse(request.params);
      if (!params.success) {
        return reply.code(400).send({ error: '未知数据源' });
      }

      try {
        if (params.data.sourceId === 'hae') {
          const [archiveProbe, latestImport] = await Promise.all([
            testArchiveWritable(),
            pool.query<{
              received_at: Date;
              date_from: string | null;
              date_to: string | null;
              metric_count: number;
              workout_count: number;
            }>(
              `SELECT received_at,
                      to_char(date_from, 'YYYY-MM-DD') AS date_from,
                      to_char(date_to, 'YYYY-MM-DD') AS date_to,
                      metric_count, workout_count
               FROM hae_imports
               ORDER BY received_at DESC
               LIMIT 1`
            ),
          ]);
          const latest = latestImport.rows[0];
          return {
            ok: true,
            message: latest
              ? `Webhook 已正常接收数据，最近一次为 ${latest.date_from} 至 ${latest.date_to}。`
              : '接收端点和本地备份目录正常，尚未收到 iPhone 推送。',
            details: {
              archiveWritable: archiveProbe.ok,
              archivePath: archiveProbe.path,
              lastReceivedAt: latest?.received_at.toISOString() || null,
              dateFrom: latest?.date_from || null,
              dateTo: latest?.date_to || null,
              metricCount: latest?.metric_count || 0,
              workoutCount: latest?.workout_count || 0,
            },
          };
        }

        const source = await pool.query<SourceRow>('SELECT * FROM data_sources WHERE id = $1', [
          params.data.sourceId,
        ]);
        const row = source.rows[0];
        if (!row) {
          return reply.code(404).send({ ok: false, message: '数据源不存在。' });
        }
        if (!row.account || !row.encrypted_password) {
          return {
            ok: false,
            message: '请先保存账号和密码，再测试连接。',
            details: { passwordConfigured: Boolean(row.encrypted_password) },
          };
        }

        const password = decryptSecret(row.encrypted_password);
        if (params.data.sourceId === 'fitdays') {
          return await testFitdaysConnection({
            account: row.account,
            password,
            targetSuid: row.config.targetSuid || null,
            syncDays: 1,
          });
        }
        return await testIgpsportConnection({
          account: row.account,
          password,
          syncLimit: 1,
        });
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
          details: {},
        };
      }
    }
  );

  app.put('/api/v1/config/storage', async (request, reply) => {
    const body = storageSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: '保留天数必须为 0 到 3650 的整数，0 表示永久保留。' });
    }
    const retentionDays = await setArchiveRetentionDays(body.data.retentionDays);
    const cleanup = await cleanupExpiredArchives(retentionDays);
    return {
      retentionDays,
      cleanup,
      storage: {
        ...(await getArchiveStats()),
        retentionDays,
        archives: await listArchives(12),
      },
    };
  });

  app.get<{ Params: { archiveId: string } }>(
    '/api/v1/config/archives/:archiveId/download',
    async (request, reply) => {
      const params = z
        .object({ archiveId: z.string().uuid() })
        .safeParse(request.params);
      if (!params.success) {
        return reply.code(400).send({ error: '备份 ID 无效。' });
      }
      try {
        const archive = await getArchiveStream(params.data.archiveId);
        const contentType = archive.isZip ? 'application/zip' : 'application/gzip';
        return reply
          .type(contentType)
          .header('Content-Disposition', `attachment; filename="${archive.fileName}"`)
          .send(archive.stream);
      } catch (error) {
        return reply.code(404).send({
          error: error instanceof Error ? error.message : '备份文件不存在。',
        });
      }
    }
  );

  app.delete<{ Params: { archiveId: string } }>(
    '/api/v1/config/archives/:archiveId',
    async (request, reply) => {
      const params = z.object({ archiveId: z.string().uuid() }).safeParse(request.params);
      if (!params.success) {
        return reply.code(400).send({ error: '备份 ID 无效。' });
      }
      try {
        await deleteArchive(params.data.archiveId);
        return { ok: true, deletedArchiveId: params.data.archiveId };
      } catch (error) {
        return reply.code(400).send({
          error: error instanceof Error ? error.message : '删除备份文件失败。',
        });
      }
    }
  );

  app.post('/api/v1/config/import/apple-health-zip', async (request, reply) => {
    try {
      let buffer: Buffer | null = null;
      let filename = 'export.zip';

      if (request.isMultipart()) {
        const part = await request.file();
        if (!part) {
          return reply.code(400).send({ error: '未接收到上传的 ZIP 文件。' });
        }
        buffer = await part.toBuffer();
        filename = part.filename || 'export.zip';
      } else if (Buffer.isBuffer(request.body)) {
        buffer = request.body;
      }

      if (!buffer || buffer.length === 0) {
        return reply.code(400).send({ error: '上传内容为空，请选择有效的 Apple Health 导出 ZIP 文件。' });
      }

      const result = await importAppleHealthZip(buffer, filename);
      return result;
    } catch (error) {
      request.log.error(error, '导入 Apple Health ZIP 失败');
      return reply.code(500).send({
        error: error instanceof Error ? error.message : '解析或导入 Apple Health ZIP 失败',
      });
    }
  });

  app.post('/api/v1/workouts/upload-fit', async (request, reply) => {
    try {
      let buffer: Buffer | null = null;
      let filename = 'activity.fit';

      if (request.isMultipart()) {
        const part = await request.file();
        if (!part) {
          return reply.code(400).send({ error: '未接收到上传的 FIT 文件。' });
        }
        buffer = await part.toBuffer();
        filename = part.filename || 'activity.fit';
      } else if (Buffer.isBuffer(request.body)) {
        buffer = request.body;
      }

      if (!buffer || buffer.length < 14) {
        return reply.code(400).send({ error: '上传文件体积过小，并非有效的 FIT 文件。' });
      }

      const activity = parseFitActivity(buffer, filename);
      const safeFilename = safeFitFilename(filename);

      const fitsDir = path.join(config.dataDir, 'archive', 'igpsport', 'fits');
      await fs.promises.mkdir(fitsDir, { recursive: true });
      const fitFilePath = path.join(fitsDir, `${activity.externalId}-${safeFilename}`);
      await fs.promises.writeFile(fitFilePath, buffer);

      await pool.query(
        `INSERT INTO cycling_activities
          (source_id, external_id, title, device, started_at, moving_time_sec,
           distance_km, avg_speed_kmh, max_speed_kmh, avg_heart_rate, max_heart_rate,
           avg_cadence, avg_power, max_power, normalized_power, tss, ascent_m, calories,
           fit_file_path, fit_file_name, file_size_bytes, raw_record)
         VALUES
          ('igpsport', $1, $2, 'FIT 设备', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::jsonb)
         ON CONFLICT (source_id, external_id) DO UPDATE SET
           title = EXCLUDED.title,
           started_at = EXCLUDED.started_at,
           moving_time_sec = EXCLUDED.moving_time_sec,
           distance_km = EXCLUDED.distance_km,
           avg_speed_kmh = EXCLUDED.avg_speed_kmh,
           max_speed_kmh = EXCLUDED.max_speed_kmh,
           avg_heart_rate = EXCLUDED.avg_heart_rate,
           max_heart_rate = EXCLUDED.max_heart_rate,
           avg_cadence = EXCLUDED.avg_cadence,
           avg_power = EXCLUDED.avg_power,
           max_power = EXCLUDED.max_power,
           normalized_power = EXCLUDED.normalized_power,
           tss = EXCLUDED.tss,
           ascent_m = EXCLUDED.ascent_m,
           calories = EXCLUDED.calories,
           fit_file_path = EXCLUDED.fit_file_path,
           fit_file_name = EXCLUDED.fit_file_name,
           file_size_bytes = EXCLUDED.file_size_bytes,
           raw_record = EXCLUDED.raw_record,
           updated_at = NOW()`,
        [
          activity.externalId,
          activity.title,
          activity.startedAt,
          activity.durationSec,
          activity.distanceKm,
          activity.avgSpeedKmh,
          activity.maxSpeedKmh,
          activity.avgHeartRate,
          activity.maxHeartRate,
          activity.avgCadence,
          activity.avgPower,
          activity.maxPower,
          activity.normalizedPower,
          activity.tss,
          activity.ascentM,
          activity.calories,
          fitFilePath,
          safeFilename,
          buffer.byteLength,
          JSON.stringify({
            heartRateZones: activity.heartRateZones,
            routePoints: activity.routePoints,
            telemetry: activity.telemetry,
            session: activity.rawSession,
          }),
        ]
      );

      return {
        ok: true,
        message: `已解析 ${activity.title}：${activity.durationSec / 60} 分钟，${activity.distanceKm ?? '—'} km。`,
        filename: safeFilename,
        fileSizeBytes: buffer.byteLength,
        startedAt: activity.startedAt,
      };
    } catch (error) {
      request.log.error(error, '上传 FIT 文件失败');
      return reply.code(500).send({
        error: error instanceof Error ? error.message : '解析或导入 FIT 记录失败',
      });
    }
  });

  app.get('/api/v1/config/logs', async (_request, reply) => {
    const logFile = path.join(config.dataDir, 'logs', 'app.log');
    try {
      if (!fs.existsSync(logFile)) {
        return { lines: ['[INFO] 日志系统已就绪，当前暂无历史日志。'], totalBytes: 0, logFilePath: logFile };
      }
      const stats = fs.statSync(logFile);
      const readBytes = Math.min(stats.size, 256 * 1024);
      const buffer = Buffer.alloc(readBytes);
      const fd = fs.openSync(logFile, 'r');
      fs.readSync(fd, buffer, 0, readBytes, Math.max(0, stats.size - readBytes));
      fs.closeSync(fd);

      const content = buffer.toString('utf8');
      const lines = content.split('\n').filter((l) => l.trim().length > 0).slice(-400);
      return { lines, totalBytes: stats.size, logFilePath: logFile };
    } catch (err) {
      return reply.code(500).send({
        error: err instanceof Error ? err.message : '读取运行日志失败',
      });
    }
  });

  app.delete('/api/v1/config/logs', async (_request, reply) => {
    const logFile = path.join(config.dataDir, 'logs', 'app.log');
    try {
      if (fs.existsSync(logFile)) {
        fs.writeFileSync(logFile, `[${new Date().toISOString()}] [INFO] 系统运行日志已由管理员清空重置。\n`, 'utf8');
      }
      return { ok: true, message: '日志视窗已清空' };
    } catch (err) {
      return reply.code(500).send({
        error: err instanceof Error ? err.message : '清空日志失败',
      });
    }
  });
}
