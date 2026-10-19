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
  name: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  activeEnergyKcal: number | null;
  distanceKm: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  elevationGainM: number | null;
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
    const activeEnergy = Array.isArray(workout.activeEnergy)
      ? energyToKcal(
          workout.activeEnergy.reduce<{ qty?: number; units?: string }>(
            (total, item) => ({
              qty: (total.qty || 0) + (finiteNumber(item.qty) || 0),
              units: total.units || item.units,
            }),
            {}
          )
        )
      : energyToKcal(workout.activeEnergy);
    const distanceMeters =
      finiteNumber(workout.distance?.qty) ?? finiteNumber(workout.cyclingDistance?.qty);

    return {
      fingerprint: fingerprint(workout),
      name: workout.name?.trim() || '体能训练',
      startedAt: start?.toISOString() || null,
      endedAt: end?.toISOString() || null,
      durationSec: integerOrNull(workout.duration),
      activeEnergyKcal: activeEnergy,
      distanceKm: distanceMeters === null ? null : Number((distanceMeters / 1000).toFixed(3)),
      avgHeartRate: integerOrNull(workout.avgHeartRate?.qty),
      maxHeartRate: integerOrNull(workout.maxHeartRate?.qty),
      elevationGainM: finiteNumber(workout.elevationAscended?.qty),
      rawWorkout: workout,
    };
  });

async function insertMetrics(client: PoolClient, importId: string, rows: NormalizedMetric[]): Promise<void> {
  const batchSize = 400;
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const values: unknown[] = [];
    const placeholders = batch.map((row, index) => {
      const base = index * 9;
      values.push(
        importId,
        row.fingerprint,
        row.metricName,
        row.units,
        row.sourceName,
        row.recordedAt,
        row.localDate,
        row.value,
        JSON.stringify(row.rawPoint)
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}::jsonb)`;
    });

    await client.query(
      `INSERT INTO health_metric_points
        (import_id, fingerprint, metric_name, units, source_name, recorded_at, local_date, value, raw_point)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (fingerprint) DO NOTHING`,
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
    const values: unknown[] = [];
    const placeholders = batch.map((row, index) => {
      const base = index * 12;
      values.push(
        importId,
        row.fingerprint,
        row.name,
        row.startedAt,
        row.endedAt,
        row.durationSec,
        row.activeEnergyKcal,
        row.distanceKm,
        row.avgHeartRate,
        row.maxHeartRate,
        row.elevationGainM,
        JSON.stringify(row.rawWorkout)
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}::jsonb)`;
    });

    await client.query(
      `INSERT INTO health_workouts
        (import_id, fingerprint, name, started_at, ended_at, duration_sec, active_energy_kcal,
         distance_km, avg_heart_rate, max_heart_rate, elevation_gain_m, raw_workout)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (fingerprint) DO NOTHING`,
      values
    );
  }
}

export async function importHaePayload(
  payload: unknown,
  metadata: { payloadSizeBytes: number; sourceIp: string | null }
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
  try {
    await client.query('BEGIN');
    await registerArchive(
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
      }
    );
    const importRow = await client.query<{ id: string }>(
      `INSERT INTO hae_imports
        (payload_size_bytes, source_ip, date_from, date_to, metric_count, workout_count,
         daily_summary_count, raw_payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
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
      ]
    );
    const importId = importRow.rows[0].id;

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
        `INSERT INTO daily_summaries (day, summary, hae_import_id, updated_at)
         VALUES ($1, $2::jsonb, $3, NOW())
         ON CONFLICT (day) DO UPDATE SET
           summary = EXCLUDED.summary,
           hae_import_id = EXCLUDED.hae_import_id,
           updated_at = NOW()`,
        [day, JSON.stringify(finalSummary), importId]
      );
    }

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
