import type { WorkoutRecord, WorkoutTelemetryPoint } from '../src/types/health.ts';
import { config } from './config.ts';
import { pool } from './db.ts';

interface CyclingWorkoutRow {
  external_id: string;
  title: string;
  started_at: Date;
  ended_at: Date | null;
  moving_time_sec: number | null;
  distance_km: string | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  avg_cadence: number | null;
  avg_power: number | null;
  max_power: number | null;
  normalized_power: number | null;
  tss: string | null;
  avg_speed_kmh: string | null;
  ascent_m: string | null;
  calories: string | null;
  local_date: string;
  local_start_time: string;
  raw_record: {
    heartRateZones?: WorkoutRecord['hrZones'];
    routePoints?: Array<{ lat: number; lon: number }>;
    telemetry?: WorkoutTelemetryPoint[];
    pwrIF?: number;
    avgBalance?: number[];
  } | null;
}

interface HaeWorkoutRow {
  id: string;
  name: string;
  started_at: Date;
  ended_at: Date | null;
  duration_sec: number | null;
  active_energy_kcal: string | null;
  distance_km: string | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  elevation_gain_m: string | null;
  raw_workout: Record<string, unknown> | null;
  local_date: string;
  local_start_time: string;
}

interface HeartRateSampleRow {
  workout_id: string;
  elapsed_sec: number;
  heart_rate: number;
}

const numberOrNull = (value: string | number | null): number | null => {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const energyToKcal = (value: unknown): number | null => {
  const source = Array.isArray(value) ? value : [value];
  let total = 0;
  let found = false;
  for (const item of source) {
    if (!item || typeof item !== 'object') continue;
    const quantity = Number((item as { qty?: unknown }).qty);
    if (!Number.isFinite(quantity)) continue;
    const units = String((item as { units?: unknown }).units || '').toLowerCase();
    total += units.includes('kj') ? quantity / 4.184 : quantity;
    found = true;
  }
  return found ? total : null;
};

const rawWorkoutEnergy = (rawWorkout: Record<string, unknown> | null): number | null =>
  energyToKcal(
    rawWorkout?.activeEnergyBurned ??
      rawWorkout?.activeEnergy ??
      rawWorkout?.totalEnergyBurned
  );

const categoryFor = (name: string): WorkoutRecord['category'] => {
  if (/骑行|单车|cycling|bike/i.test(name)) return 'cycling';
  if (/力量|strength|functional|core/i.test(name)) return 'strength';
  if (/步行|走路|walking/i.test(name)) return 'walking';
  if (/游泳|swim/i.test(name)) return 'swimming';
  if (/hiit|高强度|间歇/i.test(name)) return 'hiit';
  return 'running';
};

const cyclingToWorkout = (row: CyclingWorkoutRow): WorkoutRecord => {
  const isFitImport = row.external_id.startsWith('fit-');
  const activeCalories = Math.round(numberOrNull(row.calories) || 0);
  const durationSeconds =
    row.moving_time_sec ||
    (row.ended_at ? Math.max(0, (row.ended_at.getTime() - row.started_at.getTime()) / 1000) : 0);
  const distanceKm = numberOrNull(row.distance_km) || undefined;
  const durationMinutes = Math.round(durationSeconds / 60);
  const avgSpeedKmh = numberOrNull(row.avg_speed_kmh);

  return {
    id: isFitImport ? row.external_id : `igpsport-${row.external_id}`,
    name: row.title,
    category: 'cycling',
    source: isFitImport ? 'fit' : 'igpsport',
    date: row.local_date,
    startTime: row.local_start_time,
    durationMinutes,
    activeCalories,
    totalCalories: activeCalories,
    avgHeartRate: row.avg_heart_rate || 0,
    maxHeartRate: row.max_heart_rate || 0,
    distanceKm,
    paceAvg: avgSpeedKmh
      ? `${avgSpeedKmh.toFixed(1)} km/h`
      : distanceKm && durationMinutes > 0
        ? `${(distanceKm / (durationMinutes / 60)).toFixed(1)} km/h`
        : undefined,
    cadenceAvg: row.avg_cadence || undefined,
    elevationGainM: Math.round(numberOrNull(row.ascent_m) || 0) || undefined,
    avgPower: row.avg_power || undefined,
    maxPower: row.max_power || undefined,
    normalizedPower: row.normalized_power || undefined,
    intensityFactor: numberOrNull(row.raw_record?.pwrIF ?? null) || undefined,
    tss: numberOrNull(row.tss) || undefined,
    leftRightBalance:
      Array.isArray(row.raw_record?.avgBalance) &&
      row.raw_record.avgBalance.length >= 2
        ? {
            left: Math.round(Number(row.raw_record.avgBalance[0]) || 0),
            right: Math.round(Number(row.raw_record.avgBalance[1]) || 0),
          }
        : undefined,
    hrZones: row.raw_record?.heartRateZones || {
      zone1: 0,
      zone2: 0,
      zone3: 0,
      zone4: 0,
      zone5: 0,
    },
    routeGpxPoints: row.raw_record?.routePoints,
    telemetry: row.raw_record?.telemetry,
  };
};

const haeToWorkout = (row: HaeWorkoutRow): WorkoutRecord => {
  const durationMinutes = Math.round((row.duration_sec || 0) / 60);
  const activeCalories = Math.round(
    numberOrNull(row.active_energy_kcal) || rawWorkoutEnergy(row.raw_workout) || 0
  );
  return {
    id: `hae-${row.id}`,
    name: row.name,
    category: categoryFor(row.name),
    source: 'hae',
    date: row.local_date,
    startTime: row.local_start_time,
    durationMinutes,
    activeCalories,
    totalCalories: activeCalories,
    avgHeartRate: row.avg_heart_rate || 0,
    maxHeartRate: row.max_heart_rate || 0,
    distanceKm: numberOrNull(row.distance_km) || undefined,
    elevationGainM: Math.round(numberOrNull(row.elevation_gain_m) || 0) || undefined,
    hrZones: {
      zone1: 0,
      zone2: 0,
      zone3: 0,
      zone4: 0,
      zone5: 0,
    },
  };
};

const haeSourceName = (row: HaeWorkoutRow): string => {
  const source = row.raw_workout?.source;
  if (!source || typeof source !== 'object') return '';
  const name = (source as { name?: unknown }).name;
  return typeof name === 'string' ? name : '';
};

const rawHeartRateTelemetry = (row: HaeWorkoutRow): WorkoutTelemetryPoint[] => {
  const rawPoints = row.raw_workout?.heartRateData;
  if (!Array.isArray(rawPoints)) return [];

  const startedAt = row.started_at.getTime();
  const durationSec = row.duration_sec || 0;
  const points: WorkoutTelemetryPoint[] = [];
  for (let index = 0; index < rawPoints.length; index += 1) {
    const rawPoint = rawPoints[index];
    if (!rawPoint || typeof rawPoint !== 'object') continue;
    const point = rawPoint as Record<string, unknown>;
    const heartRate = numberOrNull(
      (point.Avg ?? point.avg ?? point.qty ?? point.Max ?? point.max) as
        | string
        | number
        | null
    );
    if (heartRate === null || heartRate < 30 || heartRate > 230) continue;

    const timestamp = new Date(String(point.date || point.startDate || '')).getTime();
    const elapsedSec = Number.isFinite(timestamp)
      ? Math.max(0, Math.round((timestamp - startedAt) / 1000))
      : rawPoints.length <= 1
        ? 0
        : Math.round((index / (rawPoints.length - 1)) * Math.max(durationSec, 1));
    points.push({
      elapsedSec,
      heartRate: Math.round(heartRate),
    });
  }
  return points;
};

const mergeHeartRateTelemetry = (
  direct: WorkoutTelemetryPoint[],
  sampled: WorkoutTelemetryPoint[]
): WorkoutTelemetryPoint[] => {
  const merged = new Map<number, WorkoutTelemetryPoint>();
  for (const point of [...sampled, ...direct]) {
    if (!Number.isFinite(point.elapsedSec) || !Number.isFinite(point.heartRate)) continue;
    merged.set(Math.round(point.elapsedSec), point);
  }
  return [...merged.values()].sort((left, right) => left.elapsedSec - right.elapsedSec);
};

export async function getWorkoutRecords(options: {
  from?: string;
  to?: string;
  limit?: number;
}): Promise<{ workouts: WorkoutRecord[]; total: number; from: string | null; to: string | null }> {
  const limit = Math.min(Math.max(options.limit || 5000, 1), 10000);
  const values = [options.from || null, options.to || null, config.timezone, limit];

  const [cyclingRows, haeRows] = await Promise.all([
    pool.query<CyclingWorkoutRow>(
      `SELECT
         external_id, title, started_at, ended_at, moving_time_sec, distance_km,
         avg_speed_kmh, avg_heart_rate, max_heart_rate, avg_cadence, avg_power,
         max_power, normalized_power, tss, ascent_m, calories, raw_record,
         to_char((started_at AT TIME ZONE $3)::date, 'YYYY-MM-DD') AS local_date,
         to_char(started_at AT TIME ZONE $3, 'HH24:MI') AS local_start_time
       FROM cycling_activities
       WHERE ($1::date IS NULL OR (started_at AT TIME ZONE $3)::date >= $1::date)
         AND ($2::date IS NULL OR (started_at AT TIME ZONE $3)::date <= $2::date)
       ORDER BY started_at DESC
       LIMIT $4`,
      values
    ),
    pool.query<HaeWorkoutRow>(
      `SELECT
         id::text, name, started_at, ended_at, duration_sec, active_energy_kcal,
         distance_km, avg_heart_rate, max_heart_rate, elevation_gain_m, raw_workout,
         to_char((started_at AT TIME ZONE $3)::date, 'YYYY-MM-DD') AS local_date,
         to_char(started_at AT TIME ZONE $3, 'HH24:MI') AS local_start_time
       FROM health_workouts
       WHERE started_at IS NOT NULL
         AND ($1::date IS NULL OR (started_at AT TIME ZONE $3)::date >= $1::date)
         AND ($2::date IS NULL OR (started_at AT TIME ZONE $3)::date <= $2::date)
       ORDER BY started_at DESC
       LIMIT $4`,
      values
    ),
  ]);

  const heartRateSamples = new Map<string, WorkoutTelemetryPoint[]>();
  if (haeRows.rows.length > 0) {
    const heartRateRows = await pool.query<HeartRateSampleRow>(
      `SELECT
         hw.id::text AS workout_id,
         GREATEST(
           0,
           EXTRACT(EPOCH FROM (hs.start_at - hw.started_at))
         )::int AS elapsed_sec,
         hs.value_num::float8 AS heart_rate
       FROM health_workouts hw
       JOIN health_samples hs
         ON hs.source_id = 'hae'
        AND hs.metric_name IN (
          'heart_rate',
          'heartRate',
          'HKQuantityTypeIdentifierHeartRate'
        )
        AND hs.start_at >= hw.started_at - INTERVAL '1 minute'
        AND hs.start_at <= COALESCE(
          hw.ended_at,
          hw.started_at + make_interval(secs => COALESCE(hw.duration_sec, 3600))
        ) + INTERVAL '5 minutes'
       WHERE hw.id = ANY($1::bigint[])
         AND hs.value_num BETWEEN 30 AND 230
       ORDER BY hw.id, hs.start_at
       LIMIT 200000`,
      [haeRows.rows.map((row) => row.id)]
    );
    for (const sample of heartRateRows.rows) {
      const points = heartRateSamples.get(sample.workout_id) || [];
      const elapsedSec = Math.max(0, Math.round(sample.elapsed_sec));
      if (points.some((point) => point.elapsedSec === elapsedSec)) continue;
      points.push({
        elapsedSec,
        heartRate: Math.round(sample.heart_rate),
      });
      heartRateSamples.set(sample.workout_id, points);
    }
  }

  const cyclingWorkouts = cyclingRows.rows.map(cyclingToWorkout);
  const cyclingStarts = cyclingWorkouts.map((workout) => {
    const start = new Date(`${workout.date}T${workout.startTime}:00+08:00`).getTime();
    return Number.isFinite(start) ? start : null;
  });

  const haeWorkouts = haeRows.rows
    .filter((row) => !/igpsport/i.test(haeSourceName(row)))
    .map((row) => {
      const workout = haeToWorkout(row);
      const telemetry = mergeHeartRateTelemetry(
        rawHeartRateTelemetry(row),
        heartRateSamples.get(row.id) || []
      );
      return telemetry.length > 0 ? { ...workout, telemetry } : workout;
    })
    .filter((workout) => {
      const start = new Date(`${workout.date}T${workout.startTime}:00+08:00`).getTime();
      if (!Number.isFinite(start)) return true;
      return !cyclingStarts.some(
        (cyclingStart) =>
          cyclingStart !== null && Math.abs(cyclingStart - start) <= 2 * 60 * 1000
      );
    });

  const workouts = [...cyclingWorkouts, ...haeWorkouts].sort((left, right) =>
    `${right.date || ''} ${right.startTime}`.localeCompare(
      `${left.date || ''} ${left.startTime}`
    )
  );

  return {
    workouts: workouts.slice(0, limit),
    total: workouts.length,
    from: options.from || null,
    to: options.to || null,
  };
}
