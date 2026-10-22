import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { gunzip } from 'node:zlib';
import { promisify } from 'node:util';
import type { PoolClient } from 'pg';
import type { DailySummary, WorkoutRecord } from '../src/types/health.ts';
import {
  parseHealthAutoExportJSON,
  type HaeDayPresence,
} from '../src/utils/haeParser.ts';
import { archiveJson, registerArchive, resolveArchivePath } from './archive.ts';
import { config } from './config.ts';
import { pool } from './db.ts';
import {
  completeImportBatch,
  createImportBatch,
  failImportBatch,
  persistRawAndSampleRows,
  type HealthSampleRow,
  type RawRecordRow,
} from './rawLibrary.ts';
import { dateInTimeZone } from './time.ts';

const gunzipAsync = promisify(gunzip);

export function mergeWorkouts(
  existingWorkouts: WorkoutRecord[] = [],
  newWorkouts: WorkoutRecord[] = []
): WorkoutRecord[] {
  const merged = [...existingWorkouts];
  for (const nw of newWorkouts) {
    const idx = merged.findIndex(
      (w) =>
        (w.id && nw.id && w.id === nw.id) ||
        (w.startTime === nw.startTime && w.name === nw.name)
    );
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], ...nw };
    } else {
      merged.push(nw);
    }
  }
  return merged;
}

const positiveOr = (next: number, previous: number): number =>
  Number.isFinite(next) && next > 0 ? next : previous;

export function mergeDailySummary(
  previous: DailySummary,
  next: DailySummary,
  presence: HaeDayPresence | undefined
): DailySummary {
  const workouts = mergeWorkouts(previous.workouts, next.workouts);
  if (!presence) {
    return {
      ...previous,
      date: next.date || previous.date,
      dayName: next.dayName || previous.dayName,
      shortDay: next.shortDay || previous.shortDay,
      isToday: next.isToday,
      workouts,
    };
  }

  const body = presence.body
    ? {
        ...previous.body,
        ...next.body,
        weightKg: positiveOr(next.body.weightKg, previous.body.weightKg),
        bodyFatPercent: positiveOr(next.body.bodyFatPercent, previous.body.bodyFatPercent),
        leanMassKg: positiveOr(next.body.leanMassKg, previous.body.leanMassKg),
        bmi: positiveOr(next.body.bmi, previous.body.bmi),
        fatMassKg: positiveOr(next.body.fatMassKg, previous.body.fatMassKg),
        statusLabel:
          next.body.weightKg > 0 ? next.body.statusLabel : previous.body.statusLabel,
        trend: next.body.trend.length > 0 ? next.body.trend : previous.body.trend,
      }
    : previous.body;

  const vitals = presence.vitals
    ? {
        ...previous.vitals,
        ...next.vitals,
        latestHr: positiveOr(next.vitals.latestHr, previous.vitals.latestHr),
        restingHr: positiveOr(next.vitals.restingHr, previous.vitals.restingHr),
        sleepingHr: positiveOr(next.vitals.sleepingHr, previous.vitals.sleepingHr),
        walkingHrAvg: positiveOr(next.vitals.walkingHrAvg, previous.vitals.walkingHrAvg),
        hrvCurrent: positiveOr(next.vitals.hrvCurrent, previous.vitals.hrvCurrent),
        hrvBaseline: positiveOr(next.vitals.hrvBaseline, previous.vitals.hrvBaseline),
        spo2: positiveOr(next.vitals.spo2, previous.vitals.spo2),
        respiratoryRate: positiveOr(
          next.vitals.respiratoryRate,
          previous.vitals.respiratoryRate
        ),
        wristTemperatureDiff:
          next.vitals.wristTemperatureAbs !== undefined
            ? next.vitals.wristTemperatureDiff
            : previous.vitals.wristTemperatureDiff,
        wristTemperatureAbs:
          next.vitals.wristTemperatureAbs ?? previous.vitals.wristTemperatureAbs,
        vo2Max: next.vitals.vo2Max ?? previous.vitals.vo2Max,
        restingHrTrend:
          next.vitals.restingHrTrend.length > 0
            ? next.vitals.restingHrTrend
            : previous.vitals.restingHrTrend,
        hrvTrend:
          next.vitals.hrvTrend.length > 0
            ? next.vitals.hrvTrend
            : previous.vitals.hrvTrend,
        hrvTimeline:
          next.vitals.hrvTimeline && next.vitals.hrvTimeline.length > 0
            ? next.vitals.hrvTimeline
            : previous.vitals.hrvTimeline,
        dailyHrRanges: next.vitals.dailyHrRanges ?? previous.vitals.dailyHrRanges,
        weeklyHrTrends: next.vitals.weeklyHrTrends ?? previous.vitals.weeklyHrTrends,
        bloodPressure: next.vitals.bloodPressure ?? previous.vitals.bloodPressure,
      }
    : previous.vitals;

  return {
    ...previous,
    date: next.date || previous.date,
    dayName: next.dayName || previous.dayName,
    shortDay: next.shortDay || previous.shortDay,
    isToday: next.isToday,
    rings: presence.rings ? next.rings : previous.rings,
    vitality: presence.vitals || presence.sleep ? next.vitality : previous.vitality,
    sleep: presence.sleep ? next.sleep : previous.sleep,
    vitals,
    heartRateTimeline: presence.heartRate
      ? next.heartRateTimeline
      : previous.heartRateTimeline,
    workouts,
    steps: presence.steps ? next.steps : previous.steps,
    body,
    mobility: presence.mobility ? next.mobility : previous.mobility,
    environment: presence.environment ? next.environment : previous.environment,
    cyclingDistanceKm: presence.steps
      ? next.cyclingDistanceKm
      : previous.cyclingDistanceKm,
    basalEnergyKcal: presence.steps
      ? next.basalEnergyKcal
      : previous.basalEnergyKcal,
    totalBurnedKcal: presence.rings || presence.steps
      ? next.totalBurnedKcal
      : previous.totalBurnedKcal,
    physicalEffortAvg: positiveOr(next.physicalEffortAvg, previous.physicalEffortAvg),
    mindfulMinutes: positiveOr(next.mindfulMinutes, previous.mindfulMinutes),
  };
}

interface HaeDataPoint {
  date?: string;
  startDate?: string;
  endDate?: string;
  inBedStart?: string;
  qty?: number;
  avg?: number;
  sum?: number;
  min?: number;
  max?: number;
  Avg?: number;
  source?: string;
  [key: string]: unknown;
}

interface HaeMetric {
  name?: string;
  units?: string;
  data?: HaeDataPoint[];
}

interface HaeWorkout {
  name?: string;
  start?: string;
  end?: string;
  duration?: number;
  activeEnergy?: { qty?: number; units?: string } | Array<{ qty?: number; units?: string }>;
  activeEnergyBurned?: { qty?: number; units?: string } | Array<{ qty?: number; units?: string }>;
  totalEnergyBurned?: { qty?: number; units?: string } | Array<{ qty?: number; units?: string }>;
  distance?: { qty?: number; units?: string };
  cyclingDistance?: { qty?: number; units?: string };
  avgHeartRate?: { qty?: number; units?: string };
  maxHeartRate?: { qty?: number; units?: string };
  elevationAscended?: { qty?: number; units?: string };
  [key: string]: unknown;
}

interface HaePayload {
  data?:
    | {
        metrics?: HaeMetric[];
        workouts?: HaeWorkout[];
      }
    | Array<{
        metrics?: HaeMetric[];
        workouts?: HaeWorkout[];
      }>;
  metrics?: HaeMetric[];
  workouts?: HaeWorkout[];
}

interface NormalizedMetric {
  fingerprint: string;
  naturalKey: string;
  metricName: string;
  units: string | null;
  sourceName: string;
  recordedAt: string | null;
  localDate: string | null;
  value: number | null;
  rawPoint: HaeDataPoint;
}

interface NormalizedWorkout {
  fingerprint: string;
  naturalKey: string;
  name: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  activeEnergyKcal: number | null;
  distanceKm: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  elevationGainM: number | null;
  sourceName: string | null;
  deviceName: string | null;
  rawWorkout: HaeWorkout;
}

export interface HaeImportResult {
  importId: string;
  dateFrom: string;
  dateTo: string;
  metricCount: number;
  workoutCount: number;
  dailySummaryCount: number;
  archivePath: string;
  days: Record<string, DailySummary>;
}

const finiteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const integerOrNull = (value: unknown): number | null => {
  const parsed = finiteNumber(value);
  return parsed === null ? null : Math.round(parsed);
};

const distanceToKm = (
  value: { qty?: number; units?: string } | undefined
): number | null => {
  const qty = finiteNumber(value?.qty);
  if (qty === null) return null;
  const unit = value?.units?.trim().toLowerCase() || '';
  if (unit === 'km' || unit.includes('kilometer')) return qty;
  if (unit === 'mi' || unit.includes('mile')) return qty * 1.609344;
  return qty / 1000;
};

const fingerprint = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

const parseTimestamp = (value: string | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const unpackPayload = (payload: unknown): { metrics: HaeMetric[]; workouts: HaeWorkout[] } => {
  const data = payload as HaePayload;
  const metrics: HaeMetric[] = [];
  const workouts: HaeWorkout[] = [];

  if (Array.isArray(data.data)) {
    for (const item of data.data) {
      metrics.push(...(item.metrics || []));
      workouts.push(...(item.workouts || []));
    }
  } else if (data.data && !Array.isArray(data.data)) {
    metrics.push(...(data.data.metrics || []));
    workouts.push(...(data.data.workouts || []));
  } else {
    metrics.push(...(data.metrics || []));
    workouts.push(...(data.workouts || []));
  }

  return { metrics, workouts };
};

const normalizeMetrics = (metrics: HaeMetric[]): NormalizedMetric[] => {
  const result: NormalizedMetric[] = [];
  for (const metric of metrics) {
    const metricName = metric.name?.trim();
    if (!metricName) continue;

    for (const point of metric.data || []) {
      const rawDate = point.date || point.startDate || point.inBedStart;
      const recordedAt = parseTimestamp(rawDate);
      const value =
        finiteNumber(point.qty) ??
        finiteNumber(point.avg) ??
        finiteNumber(point.sum) ??
        finiteNumber(point.Avg) ??
        finiteNumber(point.min) ??
        finiteNumber(point.max);
      const sourceName = typeof point.source === 'string' ? point.source : '';

      result.push({
        fingerprint: fingerprint({
          metricName,
          rawDate,
          sourceName,
          value,
          point,
        }),
        naturalKey: [
          metricName,
          recordedAt?.toISOString() || rawDate || '',
          sourceName,
          metric.units?.trim() || '',
        ].join('|'),
        metricName,
        units: metric.units?.trim() || null,
        sourceName,
        recordedAt: recordedAt?.toISOString() || null,
        localDate: recordedAt ? dateInTimeZone(recordedAt, config.timezone) : null,
        value,
        rawPoint: point,
      });
    }
  }
  return result;
};

const energyToKcal = (value: { qty?: number; units?: string } | undefined): number | null => {
  const qty = finiteNumber(value?.qty);
  if (qty === null) return null;
  return value?.units?.toLowerCase().includes('kj') ? Number((qty / 4.184).toFixed(2)) : qty;
};

const normalizeWorkouts = (workouts: HaeWorkout[]): NormalizedWorkout[] =>
  workouts.map((workout) => {
    const start = parseTimestamp(workout.start);
    const end = parseTimestamp(workout.end);
    const energySource =
      workout.activeEnergyBurned ?? workout.activeEnergy ?? workout.totalEnergyBurned;
    const activeEnergy = Array.isArray(energySource)
      ? energyToKcal(
          energySource.reduce<{ qty?: number; units?: string }>(
            (total, item) => ({
              qty: (total.qty || 0) + (finiteNumber(item.qty) || 0),
              units: total.units || item.units,
            }),
            {}
          )
        )
      : energyToKcal(energySource);
    const distanceKm = distanceToKm(workout.distance) ?? distanceToKm(workout.cyclingDistance);
    const source = workout.source;
    const sourceRecord =
      source && typeof source === 'object'
        ? (source as Record<string, unknown>)
        : null;
    const sourceName =
      typeof source === 'string'
        ? source
        : typeof sourceRecord?.name === 'string'
          ? sourceRecord.name
          : null;
    const deviceName =
      typeof sourceRecord?.identifier === 'string' ? sourceRecord.identifier : null;
    const name = workout.name?.trim() || '体能训练';
    const startedAt = start?.toISOString() || null;
    return {
      fingerprint: fingerprint(workout),
      naturalKey: `workout|${name.toLowerCase()}|${startedAt || workout.start || ''}|${sourceName || ''}`,
      name,
      startedAt,
      endedAt: end?.toISOString() || null,
      durationSec: integerOrNull(workout.duration),
      activeEnergyKcal: activeEnergy,
      distanceKm: distanceKm === null ? null : Number(distanceKm.toFixed(3)),
      avgHeartRate: integerOrNull(workout.avgHeartRate?.qty),
      maxHeartRate: integerOrNull(workout.maxHeartRate?.qty),
      elevationGainM: finiteNumber(workout.elevationAscended?.qty),
      sourceName,
      deviceName,
      rawWorkout: workout,
    };
  });

async function insertMetrics(client: PoolClient, importId: string, rows: NormalizedMetric[]): Promise<void> {
  const batchSize = 400;
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const values: unknown[] = [];
    const placeholders = batch.map((row, index) => {
      const base = index * 10;
      values.push(
        importId,
        row.fingerprint,
        row.naturalKey,
        row.metricName,
        row.units,
        row.sourceName,
        row.recordedAt,
        row.localDate,
        row.value,
        JSON.stringify(row.rawPoint)
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}::jsonb)`;
    });

    await client.query(
      `INSERT INTO health_metric_points
        (import_id, fingerprint, natural_key, metric_name, units, source_name,
         recorded_at, local_date, value, raw_point)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (natural_key) DO UPDATE SET
         import_id = EXCLUDED.import_id,
         fingerprint = EXCLUDED.fingerprint,
         metric_name = EXCLUDED.metric_name,
         units = EXCLUDED.units,
         source_name = EXCLUDED.source_name,
         recorded_at = EXCLUDED.recorded_at,
         local_date = EXCLUDED.local_date,
         value = EXCLUDED.value,
         raw_point = EXCLUDED.raw_point`,
      values
    );
  }
}

async function insertWorkouts(
  client: PoolClient,
  importId: string,
  rows: NormalizedWorkout[]
): Promise<void> {
  const batchSize = 200;
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const ignoredResult = await client.query<{ external_id: string }>(
      `SELECT external_id
       FROM data_tombstones
       WHERE record_kind = 'health_workout'
         AND source_id = 'hae'
         AND external_id = ANY($1::text[])`,
      [batch.map((row) => row.naturalKey)]
    );
    const ignoredKeys = new Set(ignoredResult.rows.map((row) => row.external_id));
    const effectiveBatch = batch.filter((row) => !ignoredKeys.has(row.naturalKey));
    if (effectiveBatch.length === 0) continue;

    const uniqueBatch = Array.from(
      new Map(effectiveBatch.map((row) => [row.fingerprint, row])).values()
    );
    const existingFingerprints = await client.query<{
      fingerprint: string;
      natural_key: string | null;
    }>(
      `SELECT fingerprint, natural_key
       FROM health_workouts
       WHERE fingerprint = ANY($1::text[])`,
      [uniqueBatch.map((row) => row.fingerprint)]
    );
    const existingFingerprintKeys = new Map(
      existingFingerprints.rows.map((row) => [row.fingerprint, row.natural_key])
    );
    const insertBatch = uniqueBatch.filter((row) => {
      const existingNaturalKey = existingFingerprintKeys.get(row.fingerprint);
      return existingNaturalKey === undefined || existingNaturalKey === row.naturalKey;
    });
    if (insertBatch.length === 0) continue;

    const values: unknown[] = [];
    const placeholders = insertBatch.map((row, index) => {
      const base = index * 15;
      values.push(
        importId,
        row.fingerprint,
        row.naturalKey,
        row.name,
        row.startedAt,
        row.endedAt,
        row.durationSec,
        row.activeEnergyKcal,
        row.distanceKm,
        row.avgHeartRate,
        row.maxHeartRate,
        row.elevationGainM,
        row.sourceName,
        row.deviceName,
        JSON.stringify(row.rawWorkout)
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}::jsonb)`;
    });

    await client.query(
      `INSERT INTO health_workouts
        (import_id, fingerprint, natural_key, name, started_at, ended_at, duration_sec,
         active_energy_kcal, distance_km, avg_heart_rate, max_heart_rate,
         elevation_gain_m, source_name, device_name, raw_workout)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (source_id, natural_key) DO UPDATE SET
         import_id = EXCLUDED.import_id,
         fingerprint = EXCLUDED.fingerprint,
         name = EXCLUDED.name,
         started_at = EXCLUDED.started_at,
         ended_at = EXCLUDED.ended_at,
         duration_sec = EXCLUDED.duration_sec,
         active_energy_kcal = EXCLUDED.active_energy_kcal,
         distance_km = EXCLUDED.distance_km,
         avg_heart_rate = EXCLUDED.avg_heart_rate,
         max_heart_rate = EXCLUDED.max_heart_rate,
         elevation_gain_m = EXCLUDED.elevation_gain_m,
         source_name = EXCLUDED.source_name,
         device_name = EXCLUDED.device_name,
         raw_workout = EXCLUDED.raw_workout`,
      values
    );
  }
}

async function removeTombstonedWorkoutsFromSummaries(
  client: PoolClient,
  days: string[]
): Promise<void> {
  if (days.length === 0) return;

  await client.query(
    `UPDATE daily_summaries ds
     SET
       summary = jsonb_set(
         ds.summary,
         '{workouts}',
         COALESCE(
           (
             SELECT jsonb_agg(item.workout)
             FROM jsonb_array_elements(
               COALESCE(ds.summary->'workouts', '[]'::jsonb)
             ) AS item(workout)
             WHERE NOT EXISTS (
               SELECT 1
               FROM data_tombstones tombstone
               WHERE tombstone.record_kind = 'health_workout'
                 AND tombstone.source_id = 'hae'
                 AND tombstone.metadata->>'date' = to_char(ds.day, 'YYYY-MM-DD')
                 AND item.workout->>'startTime' IS NOT NULL
                 AND tombstone.metadata->>'startTime' IS NOT NULL
                 AND abs(
                   extract(epoch from (
                     (item.workout->>'startTime')::time
                     - (tombstone.metadata->>'startTime')::time
                   ))
                 ) <= 120
             )
           ),
           '[]'::jsonb
         ),
         true
       ),
       updated_at = NOW()
     WHERE ds.day = ANY($1::date[])`,
    [days]
  );
}

export async function importHaePayload(
  payload: unknown,
  metadata: {
    payloadSizeBytes: number;
    sourceIp: string | null;
    apiKeyId?: string | null;
    deviceName?: string | null;
  }
): Promise<HaeImportResult> {
  const parsed = parseHealthAutoExportJSON(payload);
  const { metrics, workouts } = unpackPayload(payload);
  const normalizedMetrics = normalizeMetrics(metrics);
  const normalizedWorkouts = normalizeWorkouts(workouts);
  const dates = parsed.dates;
  if (dates.length === 0) {
    throw new Error('HAE 数据中没有可用的日期。');
  }
  const archive = await archiveJson('hae', 'health-auto-export', payload);

  const client = await pool.connect();
  let batchId: string | null = null;
  try {
    await client.query('BEGIN');
    const archiveId = await registerArchive(
      client,
      archive,
      'hae',
      'health-auto-export',
      normalizedMetrics.length + normalizedWorkouts.length,
      {
        dateFrom: dates[0],
        dateTo: dates[dates.length - 1],
        metricCount: normalizedMetrics.length,
        workoutCount: normalizedWorkouts.length,
        apiKeyId: metadata.apiKeyId || null,
        deviceName: metadata.deviceName || null,
      }
    );
    batchId = await createImportBatch(client, {
      sourceId: 'hae',
      importKind: 'health-auto-export',
      fileName: null,
      archiveId,
      archivePath: archive.relativePath,
      sha256: archive.sha256,
      sizeBytes: archive.sizeBytes,
      metadata: {
        metricCount: normalizedMetrics.length,
        workoutCount: normalizedWorkouts.length,
        sourceIp: metadata.sourceIp,
        apiKeyId: metadata.apiKeyId || null,
        deviceName: metadata.deviceName || null,
      },
    });
    const importRow = await client.query<{ id: string }>(
      `INSERT INTO hae_imports
        (payload_size_bytes, source_ip, date_from, date_to, metric_count, workout_count,
         daily_summary_count, raw_payload, batch_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
       RETURNING id`,
      [
        metadata.payloadSizeBytes,
        metadata.sourceIp,
        dates[0],
        dates[dates.length - 1],
        normalizedMetrics.length,
        normalizedWorkouts.length,
        parsed.totalDays,
        JSON.stringify(payload),
        batchId,
      ]
    );
    const importId = importRow.rows[0].id;

    const rawOccurrences = new Map<string, number>();
    const nextOccurrence = (objectType: string, hash: string): number => {
      const key = `${objectType}|${hash}`;
      const next = (rawOccurrences.get(key) || 0) + 1;
      rawOccurrences.set(key, next);
      return next;
    };
    const rawRows: RawRecordRow[] = [
      ...normalizedMetrics.map((row) => ({
        sourceId: 'hae' as const,
        objectType: 'HaeMetricPoint',
        contentHash: row.fingerprint,
        occurrenceIndex: nextOccurrence('HaeMetricPoint', row.fingerprint),
        metricType: row.metricName,
        startAt: row.recordedAt,
        endAt:
          typeof row.rawPoint.endDate === 'string'
            ? new Date(row.rawPoint.endDate).toISOString()
            : null,
        localDate: row.localDate,
        valueText:
          typeof row.rawPoint.value === 'string' ? row.rawPoint.value : null,
        valueNum: row.value,
        unit: row.units,
        sourceName: row.sourceName,
        metadata: { metricName: row.metricName, units: row.units },
        rawAttributes: row.rawPoint as Record<string, unknown>,
        rawPayload: row.rawPoint,
      })),
      ...normalizedWorkouts.map((row) => ({
        sourceId: 'hae' as const,
        objectType: 'HaeWorkout',
        contentHash: row.fingerprint,
        occurrenceIndex: nextOccurrence('HaeWorkout', row.fingerprint),
        metricType: row.name,
        startAt: row.startedAt,
        endAt: row.endedAt,
        localDate: row.startedAt
          ? dateInTimeZone(new Date(row.startedAt), config.timezone)
          : null,
        valueNum: row.activeEnergyKcal,
        unit: row.activeEnergyKcal === null ? null : 'kcal',
        sourceName: row.sourceName,
        deviceName: row.deviceName,
        metadata: { workoutName: row.name },
        rawAttributes: row.rawWorkout as Record<string, unknown>,
        rawPayload: row.rawWorkout,
      })),
    ];
    const sampleRows: HealthSampleRow[] = normalizedMetrics.map((row) => ({
      sourceId: 'hae',
      rawContentHash: row.fingerprint,
      naturalKey: row.naturalKey,
      metricName: row.metricName,
      startAt: row.recordedAt,
      endAt:
        typeof row.rawPoint.endDate === 'string'
          ? new Date(row.rawPoint.endDate).toISOString()
          : null,
      localDate: row.localDate,
      valueNum: row.value,
      valueText:
        typeof row.rawPoint.value === 'string' ? row.rawPoint.value : null,
      unit: row.units,
      sourceName: row.sourceName,
      metadata: row.rawPoint as Record<string, unknown>,
      rawPayload: row.rawPoint,
    }));
    await persistRawAndSampleRows(client, batchId, rawRows, sampleRows);
    await insertMetrics(client, importId, normalizedMetrics);
    await insertWorkouts(client, importId, normalizedWorkouts);

    for (const [day, summary] of Object.entries(parsed.days)) {
      const existing = await client.query<{ summary: DailySummary }>(
        'SELECT summary FROM daily_summaries WHERE day = $1',
        [day]
      );

      let finalSummary = summary;
      if (existing.rows[0]) {
        const prev = existing.rows[0].summary;
        finalSummary = mergeDailySummary(prev, summary, parsed.presence[day]);
      }

      await client.query(
        `INSERT INTO daily_summaries
           (day, summary, hae_import_id, import_batch_id, updated_at)
         VALUES ($1, $2::jsonb, $3, $4, NOW())
         ON CONFLICT (day) DO UPDATE SET
           summary = EXCLUDED.summary,
           hae_import_id = EXCLUDED.hae_import_id,
           import_batch_id = EXCLUDED.import_batch_id,
           updated_at = NOW()`,
        [day, JSON.stringify(finalSummary), importId, batchId]
      );
    }
    await removeTombstonedWorkoutsFromSummaries(client, Object.keys(parsed.days));

    await client.query(
      `UPDATE source_archive_files
       SET record_count = $2,
           metadata = metadata || $3::jsonb
       WHERE id = $1`,
      [
        archiveId,
        normalizedMetrics.length + normalizedWorkouts.length,
        JSON.stringify({
          rawRecordCount: normalizedMetrics.length + normalizedWorkouts.length,
          normalizedCount: normalizedMetrics.length + normalizedWorkouts.length,
        }),
      ]
    );

    await completeImportBatch(client, batchId, {
      rawCount: normalizedMetrics.length + normalizedWorkouts.length,
      normalizedCount: normalizedMetrics.length + normalizedWorkouts.length,
      metadata: {
        dateFrom: dates[0],
        dateTo: dates[dates.length - 1],
        dailySummaryCount: parsed.totalDays,
      },
    });

    await client.query(
      `UPDATE data_sources
       SET last_sync_at = NOW(), last_success_at = NOW(), last_error = NULL, updated_at = NOW()
       WHERE id = 'hae'`
    );

    await client.query('COMMIT');
    return {
      importId,
      dateFrom: dates[0],
      dateTo: dates[dates.length - 1],
      metricCount: normalizedMetrics.length,
      workoutCount: normalizedWorkouts.length,
      dailySummaryCount: parsed.totalDays,
      archivePath: archive.relativePath,
      days: parsed.days,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    if (batchId) {
      await failImportBatch(client, batchId, error).catch(() => undefined);
    }
    await pool.query(
      `UPDATE data_sources
       SET last_error = $1, updated_at = NOW()
       WHERE id = 'hae'`,
      [error instanceof Error ? error.message : String(error)]
    );
    throw error;
  } finally {
    client.release();
  }
}

export async function repairHistoricalHaeSummaries(): Promise<{ repairedCount: number }> {
  const archives = await pool.query<{ id: string; relative_path: string }>(
    `SELECT id, relative_path
     FROM source_archive_files
     WHERE source_id = 'hae' AND deleted_at IS NULL
     ORDER BY captured_at ASC`
  );
  if (archives.rows.length === 0) return { repairedCount: 0 };

  let repairedCount = 0;
  const rebuiltDays = new Set<string>();
  for (const row of archives.rows) {
    try {
      if (!row.relative_path.endsWith('.json.gz') && !row.relative_path.endsWith('.json')) {
        continue;
      }
      const absPath = resolveArchivePath(row.relative_path);
      const fileBuf = await fs.readFile(absPath);
      let contentStr = '';
      if (row.relative_path.endsWith('.gz')) {
        contentStr = (await gunzipAsync(fileBuf)).toString('utf8');
      } else {
        contentStr = fileBuf.toString('utf8');
      }
      const payload = JSON.parse(contentStr);
      const parsed = parseHealthAutoExportJSON(payload);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const [day, summary] of Object.entries(parsed.days)) {
          const existing = await client.query<{ summary: DailySummary }>(
            'SELECT summary FROM daily_summaries WHERE day = $1',
            [day]
          );

          let finalSummary = summary;
          if (existing.rows[0] && rebuiltDays.has(day)) {
            const prev = existing.rows[0].summary;
            finalSummary = mergeDailySummary(prev, summary, parsed.presence[day]);
          }

          await client.query(
            `INSERT INTO daily_summaries (day, summary, updated_at)
             VALUES ($1, $2::jsonb, NOW())
             ON CONFLICT (day) DO UPDATE SET
               summary = EXCLUDED.summary,
               updated_at = NOW()`,
            [day, JSON.stringify(finalSummary)]
          );
          rebuiltDays.add(day);
          repairedCount += 1;
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.warn(`[hae:repair] 归档 ${row.relative_path} 合并失败:`, err);
      } finally {
        client.release();
      }
    } catch (err) {
      console.warn(`[hae:repair] 读取归档 ${row.relative_path} 异常:`, err);
    }
  }
  return { repairedCount };
}
