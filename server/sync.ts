import cron, { type ScheduledTask } from 'node-cron';
import { archiveJson, registerArchive, type ArchiveFile } from './archive.ts';
import { config } from './config.ts';
import { decryptSecret } from './crypto.ts';
import { pool } from './db.ts';
import { fetchFitdaysRecords } from './sources/fitdays.ts';
import { syncRecentRides } from './sources/igpsport.ts';

export type SyncSourceId = 'fitdays' | 'igpsport';

interface SourceRow {
  id: SyncSourceId;
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

const scheduledTasks = new Map<SyncSourceId, ScheduledTask>();
const runningSources = new Set<SyncSourceId>();

const clampInteger = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), min), max);
};

const getSource = async (sourceId: SyncSourceId): Promise<SourceRow | null> => {
  const result = await pool.query<SourceRow>('SELECT * FROM data_sources WHERE id = $1', [sourceId]);
  return result.rows[0] || null;
};

async function persistFitdays(
  records: Awaited<ReturnType<typeof fetchFitdaysRecords>>['records'],
  archive: ArchiveFile,
  archiveMetadata: Record<string, unknown>
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await registerArchive(
      client,
      archive,
      'fitdays',
      'fitdays-cloud-sync',
      records.length,
      archiveMetadata
    );
    for (const record of records) {
      await client.query(
        `INSERT INTO body_measurements
          (source_id, external_id, profile_id, measured_at, measured_date, weight_kg, bmi,
           body_fat_rate, skeletal_muscle_rate, muscle_rate, lean_body_mass_kg,
           visceral_fat_level, water_rate, bone_mass_kg, bmr_kcal, subcutaneous_fat_rate,
           protein_rate, body_age, heart_rate, score, smi, whr, raw_record)
         VALUES
          ('fitdays', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
           $15, $16, $17, $18, $19, $20, $21, $22::jsonb)
         ON CONFLICT (source_id, external_id) DO UPDATE SET
           profile_id = EXCLUDED.profile_id,
           measured_at = EXCLUDED.measured_at,
           measured_date = EXCLUDED.measured_date,
           weight_kg = EXCLUDED.weight_kg,
           bmi = EXCLUDED.bmi,
           body_fat_rate = EXCLUDED.body_fat_rate,
           skeletal_muscle_rate = EXCLUDED.skeletal_muscle_rate,
           muscle_rate = EXCLUDED.muscle_rate,
           lean_body_mass_kg = EXCLUDED.lean_body_mass_kg,
           visceral_fat_level = EXCLUDED.visceral_fat_level,
           water_rate = EXCLUDED.water_rate,
           bone_mass_kg = EXCLUDED.bone_mass_kg,
           bmr_kcal = EXCLUDED.bmr_kcal,
           subcutaneous_fat_rate = EXCLUDED.subcutaneous_fat_rate,
           protein_rate = EXCLUDED.protein_rate,
           body_age = EXCLUDED.body_age,
           heart_rate = EXCLUDED.heart_rate,
           score = EXCLUDED.score,
           smi = EXCLUDED.smi,
           whr = EXCLUDED.whr,
           raw_record = EXCLUDED.raw_record,
           updated_at = NOW()`,
        [
          record.externalId,
          record.profileId,
          record.measuredAt,
          record.measuredDate,
          record.weightKg,
          record.bmi,
          record.bodyFatRate,
          record.skeletalMuscleRate,
          record.muscleRate,
          record.leanBodyMassKg,
          record.visceralFatLevel,
          record.waterRate,
          record.boneMassKg,
          record.bmrKcal,
          record.subcutaneousFatRate,
          record.proteinRate,
          record.bodyAge,
          record.heartRate,
          record.score,
          record.smi,
          record.whr,
          JSON.stringify(record.rawRecord),
        ]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function persistRides(
  rides: Awaited<ReturnType<typeof syncRecentRides>>['rides'],
  archive: ArchiveFile,
  archiveMetadata: Record<string, unknown>
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await registerArchive(
      client,
      archive,
      'igpsport',
      'igpsport-rides',
      rides.length,
      archiveMetadata
    );
    for (const ride of rides) {
      await client.query(
        `INSERT INTO cycling_activities
          (source_id, external_id, title, device, started_at, ended_at, moving_time_sec,
           distance_km, avg_speed_kmh, max_speed_kmh, avg_heart_rate, max_heart_rate,
           avg_cadence, avg_power, max_power, normalized_power, tss, ascent_m, calories,
           fit_file_path, fit_file_name, file_size_bytes, raw_record)
         VALUES
          ('igpsport', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
           $15, $16, $17, $18, $19, $20, $21, $22::jsonb)
         ON CONFLICT (source_id, external_id) DO UPDATE SET
           title = EXCLUDED.title,
           device = EXCLUDED.device,
           started_at = EXCLUDED.started_at,
           ended_at = EXCLUDED.ended_at,
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
          ride.externalId,
          ride.title,
          ride.device,
          ride.startedAt,
          ride.endedAt,
          ride.movingTimeSec,
          ride.distanceKm,
          ride.avgSpeedKmh,
          ride.maxSpeedKmh,
          ride.avgHeartRate,
          ride.maxHeartRate,
          ride.avgCadence,
          ride.avgPower,
          ride.maxPower,
          ride.normalizedPower,
          ride.tss,
          ride.ascentM,
          ride.calories,
          ride.fitFilePath,
          ride.fitFileName,
          ride.fileSizeBytes,
          JSON.stringify(ride.rawRecord),
        ]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function executeSourceSync(
  sourceId: SyncSourceId,
  runId: string,
  options?: { full?: boolean }
): Promise<void> {
  const source = await getSource(sourceId);
  if (!source) throw new Error(`未知数据源: ${sourceId}`);
  if (!source.account || !source.encrypted_password) {
    throw new Error('数据源尚未填写账号和密码。');
  }

  const password = decryptSecret(source.encrypted_password);
  let count = 0;
  let details: Record<string, unknown> = {};
  const isFull = Boolean(options?.full);

  if (sourceId === 'fitdays') {
    const syncDays = isFull ? 3650 : clampInteger(source.config.syncDays, 30, 1, 3650);
    const result = await fetchFitdaysRecords({
      account: source.account,
      password,
      targetSuid: source.config.targetSuid || null,
      syncDays,
    });
    const archive = await archiveJson('fitdays', isFull ? 'fitdays-full-sync' : 'fitdays-cloud-sync', {
      activeSuid: result.activeSuid,
      users: result.users,
      devices: result.devices,
      records: result.records,
      isFullSync: isFull,
    });
    await persistFitdays(result.records, archive, {
      activeSuid: result.activeSuid,
      profileCount: result.users.length,
      deviceCount: result.devices.length,
      isFullSync: isFull,
    });
    count = result.records.length;
    details = {
      activeSuid: result.activeSuid,
      profileCount: result.users.length,
      deviceCount: result.devices.length,
      archivePath: archive.relativePath,
      isFullSync: isFull,
    };
  } else {
    const syncLimit = isFull ? 500 : clampInteger(source.config.syncLimit, 20, 1, 100);
    const result = await syncRecentRides({
      account: source.account,
      password,
      syncLimit,
    });
    const archive = await archiveJson('igpsport', isFull ? 'igpsport-full-rides' : 'igpsport-rides', {
      totalAccountRides: result.totalAccountRides,
      outputDirectory: result.outputDirectory,
      rides: result.rides,
      isFullSync: isFull,
    });
    await persistRides(result.rides, archive, {
      totalAccountRides: result.totalAccountRides,
      outputDirectory: result.outputDirectory,
      isFullSync: isFull,
    });
    count = result.rides.length;
    details = {
      totalAccountRides: result.totalAccountRides,
      outputDirectory: result.outputDirectory,
      archivePath: archive.relativePath,
      isFullSync: isFull,
    };
  }

  await pool.query(
    `UPDATE sync_runs
     SET status = 'success', finished_at = NOW(), records_count = $2, details = $3::jsonb
     WHERE id = $1`,
    [runId, count, JSON.stringify(details)]
  );
  await pool.query(
    `UPDATE data_sources
     SET last_sync_at = NOW(), last_success_at = NOW(), last_error = NULL, updated_at = NOW()
     WHERE id = $1`,
    [sourceId]
  );
}

export async function queueSourceSync(
  sourceId: SyncSourceId,
  triggerType: 'manual' | 'cron',
  options?: { full?: boolean }
): Promise<{ runId: string; status: 'running' }> {
  if (runningSources.has(sourceId)) {
    throw new Error('该数据源正在同步，请等待当前任务结束。');
  }

  const source = await getSource(sourceId);
  if (!source) throw new Error(`未知数据源: ${sourceId}`);
  if (!source.account || !source.encrypted_password) {
    throw new Error('请先在配置中心填写账号和密码。');
  }

  const run = await pool.query<{ id: string }>(
    `INSERT INTO sync_runs (source_id, trigger_type, status)
     VALUES ($1, $2, 'running')
     RETURNING id`,
    [sourceId, triggerType]
  );
  const runId = run.rows[0].id;
  runningSources.add(sourceId);

  void executeSourceSync(sourceId, runId, options)
    .catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[sync:${sourceId}]`, error);
      await pool.query(
        `UPDATE sync_runs
         SET status = 'failed', finished_at = NOW(), message = $2
         WHERE id = $1`,
        [runId, message]
      );
      await pool.query(
        `UPDATE data_sources
         SET last_sync_at = NOW(), last_error = $2, updated_at = NOW()
         WHERE id = $1`,
        [sourceId, message]
      );
    })
    .finally(() => {
      runningSources.delete(sourceId);
    });

  return { runId, status: 'running' };
}

export async function reloadSchedules(): Promise<void> {
  for (const task of scheduledTasks.values()) {
    await task.destroy();
  }
  scheduledTasks.clear();

  const sources = await pool.query<SourceRow>(
    `SELECT * FROM data_sources
     WHERE id IN ('fitdays', 'igpsport')
       AND enabled = TRUE
       AND account IS NOT NULL
       AND encrypted_password IS NOT NULL`
  );

  for (const source of sources.rows) {
    if (!source.cron_expression || !cron.validate(source.cron_expression)) {
      console.warn(`[scheduler] ${source.id} 的 Cron 无效，已跳过。`);
      continue;
    }

    const task = cron.schedule(
      source.cron_expression,
      async () => {
        try {
          await queueSourceSync(source.id, 'cron');
        } catch (error) {
          if (error instanceof Error && error.message.includes('正在同步')) return;
          console.error(`[scheduler:${source.id}]`, error);
        }
      },
      {
        timezone: config.timezone,
        noOverlap: true,
        name: `health-sync-${source.id}`,
      }
    );
    scheduledTasks.set(source.id, task);
  }
}

export function getNextScheduledRun(sourceId: SyncSourceId): string | null {
  const nextRun = scheduledTasks.get(sourceId)?.getNextRun();
  return nextRun?.toISOString() || null;
}

export function isSourceRunning(sourceId: SyncSourceId): boolean {
  return runningSources.has(sourceId);
}

export async function stopScheduler(): Promise<void> {
  for (const task of scheduledTasks.values()) {
    await task.destroy();
  }
  scheduledTasks.clear();
}
