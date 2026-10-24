import type { PoolClient } from 'pg';
import { pool } from './db.ts';

export type IgnoredRecordKind =
  | 'body_measurement'
  | 'health_workout'
  | 'cycling_activity';

interface IgnoredRow {
  id: string;
  record_kind: IgnoredRecordKind;
  source_id: string;
  external_id: string;
  deleted_at: Date;
  metadata: Record<string, unknown>;
}

export interface IgnoredRecord {
  id: string;
  recordKind: IgnoredRecordKind;
  sourceId: string;
  externalId: string;
  deletedAt: string;
  reasonCode: string | null;
  reason: string;
  autoIgnored: boolean;
  displayName: string;
  recordDate: string | null;
  snapshotAvailable: boolean;
  rawRecordAvailable: boolean;
  canRestore: boolean;
}

const objectValue = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const textValue = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const numberValue = (value: unknown): number | null => {
  const parsed = Number(value);
  return value !== null && value !== undefined && value !== '' && Number.isFinite(parsed)
    ? parsed
    : null;
};

const positiveNumberValue = (value: unknown): number | null => {
  const parsed = numberValue(value);
  return parsed !== null && parsed > 0 ? parsed : null;
};

const jsonValue = (value: unknown): string =>
  JSON.stringify(objectValue(value) || {});

const defaultReason = (kind: IgnoredRecordKind): string => {
  if (kind === 'body_measurement') return '手动删除的体测记录';
  if (kind === 'cycling_activity') return '手动删除的骑行记录';
  return '手动删除的运动记录';
};

const displayNameFor = (row: IgnoredRow): string => {
  const metadata = row.metadata;
  const explicitName = textValue(metadata.name);
  if (explicitName) return explicitName;
  if (row.record_kind === 'body_measurement') {
    const date = textValue(metadata.measuredDate) || textValue(metadata.date);
    return date ? `${date} 体测记录` : '体测记录';
  }
  const date = textValue(metadata.date);
  return date ? `${date} 运动记录` : '运动记录';
};

const toIgnoredRecord = (row: IgnoredRow): IgnoredRecord => {
  const rawReason = textValue(row.metadata.reason);
  const legacyAutoIgnored =
    rawReason === 'weight-only incomplete upstream measurement';
  const snapshotAvailable = Boolean(objectValue(row.metadata.snapshot));
  const rawRecordAvailable = Boolean(objectValue(row.metadata.rawRecord));
  return {
    id: row.id,
    recordKind: row.record_kind,
    sourceId: row.source_id,
    externalId: row.external_id,
    deletedAt: row.deleted_at.toISOString(),
    reasonCode: textValue(row.metadata.reasonCode),
    reason: legacyAutoIgnored
      ? '自动忽略：旧版同步留下了只有体重、缺少完整体成分字段的记录'
      : rawReason || defaultReason(row.record_kind),
    autoIgnored: row.metadata.autoIgnored === true || legacyAutoIgnored,
    displayName: displayNameFor(row),
    recordDate:
      textValue(row.metadata.measuredDate) ||
      textValue(row.metadata.date) ||
      null,
    snapshotAvailable,
    rawRecordAvailable,
    canRestore:
      row.record_kind === 'body_measurement'
        ? snapshotAvailable || rawRecordAvailable
        : true,
  };
};

export async function listIgnoredRecords(limit = 200): Promise<IgnoredRecord[]> {
  const result = await pool.query<IgnoredRow>(
    `SELECT
       id::text,
       record_kind,
       source_id,
       external_id,
       deleted_at,
       metadata
     FROM data_tombstones
     ORDER BY deleted_at DESC, id DESC
     LIMIT $1`,
    [Math.min(Math.max(limit, 1), 500)]
  );
  return result.rows.map(toIgnoredRecord);
}

const restoreBodySnapshot = async (
  client: PoolClient,
  row: IgnoredRow,
  snapshot: Record<string, unknown>
): Promise<void> => {
  await client.query(
    `INSERT INTO body_measurements
      (source_id, external_id, profile_id, measured_at, measured_date, weight_kg,
       bmi, body_fat_rate, skeletal_muscle_rate, muscle_rate, lean_body_mass_kg,
       visceral_fat_level, water_rate, bone_mass_kg, bmr_kcal, subcutaneous_fat_rate,
       protein_rate, body_age, heart_rate, score, smi, whr, raw_record, import_batch_id)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
       $16, $17, $18, $19, $20, $21, $22, $23::jsonb, $24)
     ON CONFLICT (source_id, external_id) DO NOTHING`,
    [
      row.source_id,
      row.external_id,
      textValue(snapshot.profile_id),
      snapshot.measured_at || snapshot.measuredAt || row.metadata.measuredAt,
      snapshot.measured_date || snapshot.measuredDate || row.metadata.measuredDate,
      positiveNumberValue(snapshot.weight_kg),
      positiveNumberValue(snapshot.bmi),
      positiveNumberValue(snapshot.body_fat_rate),
      positiveNumberValue(snapshot.skeletal_muscle_rate),
      positiveNumberValue(snapshot.muscle_rate),
      positiveNumberValue(snapshot.lean_body_mass_kg),
      positiveNumberValue(snapshot.visceral_fat_level),
      positiveNumberValue(snapshot.water_rate),
      positiveNumberValue(snapshot.bone_mass_kg),
      positiveNumberValue(snapshot.bmr_kcal),
      positiveNumberValue(snapshot.subcutaneous_fat_rate),
      positiveNumberValue(snapshot.protein_rate),
      positiveNumberValue(snapshot.body_age),
      positiveNumberValue(snapshot.heart_rate),
      positiveNumberValue(snapshot.score),
      positiveNumberValue(snapshot.smi),
      positiveNumberValue(snapshot.whr),
      jsonValue(snapshot.raw_record),
      null,
    ]
  );
};

const restoreBodyFromRaw = async (client: PoolClient, row: IgnoredRow): Promise<void> => {
  const raw = objectValue(row.metadata.rawRecord) || {};
  const [profileId, timestamp] = row.external_id.split(':');
  const measuredAt =
    textValue(row.metadata.measuredAt) ||
    (Number(timestamp) > 0 ? new Date(Number(timestamp) * 1000).toISOString() : null);
  const measuredDate =
    textValue(row.metadata.measuredDate) ||
    (measuredAt
      ? new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Shanghai',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(measuredAt))
      : null);
  if (!measuredAt || !measuredDate) {
    throw new Error('忽略记录缺少可恢复的测量时间。');
  }

  const weight = positiveNumberValue(raw.weight_kg);
  const bodyFat = positiveNumberValue(raw.bfr);
  const leanMass =
    weight !== null && bodyFat !== null
      ? Number((weight * (1 - bodyFat / 100)).toFixed(3))
      : null;

  await client.query(
    `INSERT INTO body_measurements
      (source_id, external_id, profile_id, measured_at, measured_date, weight_kg,
       bmi, body_fat_rate, skeletal_muscle_rate, muscle_rate, lean_body_mass_kg,
       visceral_fat_level, water_rate, bone_mass_kg, bmr_kcal, subcutaneous_fat_rate,
       protein_rate, body_age, heart_rate, raw_record, import_batch_id)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
       $16, $17, $18, $19, $20::jsonb, NULL)
     ON CONFLICT (source_id, external_id) DO NOTHING`,
    [
      row.source_id,
      row.external_id,
      profileId || null,
      measuredAt,
      measuredDate,
      weight,
      positiveNumberValue(raw.bmi),
      bodyFat,
      positiveNumberValue(raw.rosm),
      positiveNumberValue(raw.rom),
      leanMass,
      positiveNumberValue(raw.uvi),
      positiveNumberValue(raw.vwc),
      positiveNumberValue(raw.bm),
      positiveNumberValue(raw.bmr),
      positiveNumberValue(raw.sfr),
      positiveNumberValue(raw.pp),
      positiveNumberValue(raw.bodyage),
      positiveNumberValue(raw.hr),
      jsonValue(raw),
    ]
  );
};

const restoreHealthWorkoutSnapshot = async (
  client: PoolClient,
  row: IgnoredRow,
  snapshot: Record<string, unknown>
): Promise<void> => {
  await client.query(
    `INSERT INTO health_workouts
      (import_id, fingerprint, natural_key, source_id, name, started_at, ended_at,
       duration_sec, active_energy_kcal, distance_km, avg_heart_rate, max_heart_rate,
       elevation_gain_m, source_name, device_name, source_updated_at, raw_record_id,
       raw_workout)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
       $17, $18::jsonb)
     ON CONFLICT (source_id, natural_key) DO NOTHING`,
    [
      snapshot.import_id,
      snapshot.fingerprint,
      snapshot.natural_key || row.external_id,
      snapshot.source_id || row.source_id,
      snapshot.name || row.metadata.name || '恢复的运动记录',
      snapshot.started_at,
      snapshot.ended_at,
      snapshot.duration_sec,
      snapshot.active_energy_kcal,
      snapshot.distance_km,
      snapshot.avg_heart_rate,
      snapshot.max_heart_rate,
      snapshot.elevation_gain_m,
      snapshot.source_name,
      snapshot.device_name,
      snapshot.source_updated_at,
      snapshot.raw_record_id,
      jsonValue(snapshot.raw_workout),
    ]
  );
};

const restoreCyclingSnapshot = async (
  client: PoolClient,
  row: IgnoredRow,
  snapshot: Record<string, unknown>
): Promise<void> => {
  await client.query(
    `INSERT INTO cycling_activities
      (source_id, external_id, title, device, started_at, ended_at, moving_time_sec,
       distance_km, avg_speed_kmh, max_speed_kmh, avg_heart_rate, max_heart_rate,
       avg_cadence, avg_power, max_power, normalized_power, tss, ascent_m, calories,
       fit_file_path, fit_file_name, file_size_bytes, raw_record, import_batch_id)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
       $17, $18, $19, $20, $21, $22, $23::jsonb, $24)
     ON CONFLICT (source_id, external_id) DO NOTHING`,
    [
      snapshot.source_id || row.source_id,
      snapshot.external_id || row.external_id,
      snapshot.title || row.metadata.name || '恢复的骑行记录',
      snapshot.device,
      snapshot.started_at,
      snapshot.ended_at,
      snapshot.moving_time_sec,
      snapshot.distance_km,
      snapshot.avg_speed_kmh,
      snapshot.max_speed_kmh,
      snapshot.avg_heart_rate,
      snapshot.max_heart_rate,
      snapshot.avg_cadence,
      snapshot.avg_power,
      snapshot.max_power,
      snapshot.normalized_power,
      snapshot.tss,
      snapshot.ascent_m,
      snapshot.calories,
      snapshot.fit_file_path,
      snapshot.fit_file_name,
      snapshot.file_size_bytes,
      jsonValue(snapshot.raw_record),
      null,
    ]
  );
};

export async function restoreIgnoredRecord(id: string): Promise<{
  restored: boolean;
  requiresSync: boolean;
  message: string;
}> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<IgnoredRow>(
      `SELECT
         id::text,
         record_kind,
         source_id,
         external_id,
         deleted_at,
         metadata
       FROM data_tombstones
       WHERE id = $1::bigint
       FOR UPDATE`,
      [id]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('忽略记录不存在或已恢复。');
    }
    const snapshot = objectValue(row.metadata.snapshot);
    if (row.record_kind === 'body_measurement') {
      if (snapshot) await restoreBodySnapshot(client, row, snapshot);
      else if (objectValue(row.metadata.rawRecord)) {
        await restoreBodyFromRaw(client, row);
      } else {
        throw new Error('这条体测记录没有可恢复的原始数据，请等待下一次同步。');
      }
    } else if (snapshot && row.record_kind === 'health_workout') {
      await restoreHealthWorkoutSnapshot(client, row, snapshot);
    } else if (snapshot && row.record_kind === 'cycling_activity') {
      await restoreCyclingSnapshot(client, row, snapshot);
    }

    await client.query('DELETE FROM data_tombstones WHERE id = $1::bigint', [id]);
    await client.query('COMMIT');

    const requiresSync = row.record_kind !== 'body_measurement' && !snapshot;
    return {
      restored: !requiresSync,
      requiresSync,
      message: requiresSync
        ? '已移出忽略列表，下一次数据源同步时会重新写入。'
        : '记录已恢复到数据库。',
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteIgnoredRule(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM data_tombstones WHERE id = $1::bigint', [
    id,
  ]);
  return (result.rowCount || 0) > 0;
}
