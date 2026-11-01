import type { WorkoutRecord, WorkoutTelemetryPoint } from '../src/types/health.ts';
import { mergeDuplicateWorkouts } from '../src/utils/workoutDedupe.ts';
import { parseRoutePoints } from '../src/utils/haeParser.ts';
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
  has_route?: boolean;
  has_telemetry?: boolean;
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
  source_name?: string | null;
  has_route?: boolean;
  has_telemetry?: boolean;
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
    hasRoute: row.has_route ?? Boolean(row.raw_record?.routePoints?.length),
    hasTelemetry: row.has_telemetry ?? Boolean(row.raw_record?.telemetry?.length),
    routeGpxPoints: row.raw_record?.routePoints,
    telemetry: row.raw_record?.telemetry,
  };
};

const haeToWorkout = (row: HaeWorkoutRow): WorkoutRecord => {
  const durationMinutes = Math.round((row.duration_sec || 0) / 60);
  const activeCalories = Math.round(
    numberOrNull(row.active_energy_kcal) || rawWorkoutEnergy(row.raw_workout) || 0
  );
  const raw = (row.raw_workout && typeof row.raw_workout === 'object' ? row.raw_workout : {}) as Record<string, any>;
  const category = categoryFor(row.name);
  const distanceKm = numberOrNull(row.distance_km) || undefined;

  const cadenceAvg = Math.round(
    numberOrNull(raw.avgCadence?.qty ?? raw.avgCadence ?? raw.cadence?.qty ?? raw.cadence ?? raw.stepCadence) || 0
  ) || undefined;

  const avgPower = Math.round(
    numberOrNull(raw.avgPower?.qty ?? raw.avgPower ?? raw.power?.qty ?? raw.power ?? raw.cyclingPower) || 0
  ) || undefined;
  const maxPower = Math.round(
    numberOrNull(raw.maxPower?.qty ?? raw.maxPower) || 0
  ) || undefined;

  const rawSpeed = numberOrNull(
    raw.avgSpeed?.qty ?? raw.avgSpeed ?? raw.speed?.qty ?? raw.speed ?? raw.measurements?.averageSpeed?.value
  );
  const speedKmh =
    rawSpeed !== null
      ? rawSpeed > 0 && category === 'cycling' && rawSpeed < 15
        ? Number((rawSpeed * 3.6).toFixed(1))
        : Number(rawSpeed.toFixed(1))
      : distanceKm && durationMinutes > 0
        ? Number((distanceKm / (durationMinutes / 60)).toFixed(1))
        : undefined;

  let paceAvg: string | undefined;
  if (category === 'cycling') {
    paceAvg = speedKmh ? `${speedKmh.toFixed(1)} km/h` : undefined;
  } else if (distanceKm && durationMinutes > 0) {
    const totalSeconds = row.duration_sec || durationMinutes * 60;
    const paceSeconds = Math.round(totalSeconds / distanceKm);
    const paceMins = Math.floor(paceSeconds / 60);
    const paceSecs = paceSeconds % 60;
    paceAvg = `${String(paceMins).padStart(2, '0')}'${String(paceSecs).padStart(2, '0')}"`;
  }

  const routeGpxPoints = parseRoutePoints(raw.route ?? raw.locations);
  const hasRoute = row.has_route ?? Boolean(routeGpxPoints?.length);

  return {
    id: `hae-${row.id}`,
    name: row.name,
    category,
    source: 'hae',
    date: row.local_date,
    startTime: row.local_start_time,
    durationMinutes,
    activeCalories,
    totalCalories: activeCalories,
    avgHeartRate: row.avg_heart_rate || 0,
    maxHeartRate: row.max_heart_rate || 0,
    distanceKm,
    paceAvg,
    cadenceAvg,
    avgPower,
    maxPower,
    elevationGainM: Math.round(numberOrNull(row.elevation_gain_m) || 0) || undefined,
    hrZones: {
      zone1: 0,
      zone2: 0,
      zone3: 0,
      zone4: 0,
      zone5: 0,
    },
    hasRoute,
    routeGpxPoints,
  };
};

const haeSourceName = (row: HaeWorkoutRow): string => {
  if (row.source_name) return row.source_name;
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

const computeNormalizedPower = (telemetry: WorkoutTelemetryPoint[]): number | undefined => {
  const points = telemetry.filter((p) => typeof p.power === 'number');
  if (points.length < 30) return undefined;

  const powers = points.map((p) => p.power!);
  const rolling: number[] = [];
  let sum = 0;
  for (let i = 0; i < powers.length; i++) {
    sum += powers[i];
    if (i >= 29) {
      if (i > 29) sum -= powers[i - 30];
      rolling.push(sum / 30);
    }
  }
  if (rolling.length === 0) return undefined;
  const sumFourth = rolling.reduce((acc, val) => acc + Math.pow(val, 4), 0);
  const np = Math.pow(sumFourth / rolling.length, 0.25);
  return Number.isFinite(np) && np > 0 ? Math.round(np) : undefined;
};

interface TelemetrySampleRow {
  workout_id: string;
  elapsed_sec: number;
  metric_kind: 'hr' | 'power' | 'cadence' | 'speed';
  val: number;
}

const loadHaeWorkoutTelemetry = async (
  workouts: HaeWorkoutRow[]
): Promise<Map<string, {
  telemetry: WorkoutTelemetryPoint[];
  avgPower?: number;
  maxPower?: number;
  normalizedPower?: number;
  intensityFactor?: number;
  tss?: number;
  cadenceAvg?: number;
}>> => {
  const result = new Map();
  if (workouts.length === 0) return result;
  const workoutIds = workouts.map((w) => w.id);

  const sampleRows = await pool.query<TelemetrySampleRow>(
    `SELECT
       hw.id::text AS workout_id,
       GREATEST(
         0,
         EXTRACT(EPOCH FROM (hs.start_at - hw.started_at))
       )::int AS elapsed_sec,
       CASE
         WHEN LOWER(REPLACE(hs.metric_name, ' ', '_')) IN (
           'heart_rate', 'heartrate', 'hkquantitytypeidentifierheartrate'
         ) THEN 'hr'
         WHEN LOWER(REPLACE(hs.metric_name, ' ', '_')) IN (
           'cycling_power', 'cyclingpower', 'hkquantitytypeidentifiercyclingpower'
         ) THEN 'power'
         WHEN LOWER(REPLACE(hs.metric_name, ' ', '_')) IN (
           'cycling_cadence', 'cyclingcadence', 'step_cadence', 'stepcadence', 'hkquantitytypeidentifiercyclingcadence'
         ) THEN 'cadence'
         ELSE 'speed'
       END AS metric_kind,
       hs.value_num::float8 AS val
     FROM health_workouts hw
     JOIN health_samples hs
       ON hs.source_id = 'hae'
      AND LOWER(REPLACE(hs.metric_name, ' ', '_')) IN (
        'heart_rate', 'heartrate', 'hkquantitytypeidentifierheartrate',
        'cycling_power', 'cyclingpower', 'hkquantitytypeidentifiercyclingpower',
        'cycling_cadence', 'cyclingcadence', 'step_cadence', 'stepcadence', 'hkquantitytypeidentifiercyclingcadence',
        'cycling_speed', 'cyclingspeed', 'walking_speed', 'speed'
      )
      AND hs.start_at >= hw.started_at - INTERVAL '1 minute'
      AND hs.start_at <= COALESCE(
        hw.ended_at,
        hw.started_at + make_interval(secs => COALESCE(hw.duration_sec, 3600))
      ) + INTERVAL '5 minutes'
     WHERE hw.id = ANY($1::bigint[])
       AND hs.value_num >= 0
     ORDER BY hw.id, hs.start_at
     LIMIT 300000`,
    [workoutIds]
  );

  const samplesByWorkout = new Map<string, TelemetrySampleRow[]>();
  for (const row of sampleRows.rows) {
    const list = samplesByWorkout.get(row.workout_id) || [];
    list.push(row);
    samplesByWorkout.set(row.workout_id, list);
  }

  for (const row of workouts) {
    const rows = samplesByWorkout.get(row.id) || [];
    const directHr = rawHeartRateTelemetry(row);
    const pointMap = new Map<number, WorkoutTelemetryPoint>();

    for (const d of directHr) {
      pointMap.set(d.elapsedSec, { ...d });
    }

    for (const sample of rows) {
      let pt = pointMap.get(sample.elapsed_sec);
      if (!pt) {
        pt = { elapsedSec: sample.elapsed_sec };
        pointMap.set(sample.elapsed_sec, pt);
      }
      if (sample.metric_kind === 'hr' && sample.val >= 30 && sample.val <= 230) {
        if (!pt.heartRate) pt.heartRate = Math.round(sample.val);
      } else if (sample.metric_kind === 'power' && sample.val >= 0 && sample.val <= 2500) {
        pt.power = Math.round(sample.val);
      } else if (sample.metric_kind === 'cadence' && sample.val >= 0 && sample.val <= 250) {
        pt.cadence = Math.round(sample.val);
      } else if (sample.metric_kind === 'speed' && sample.val >= 0 && sample.val <= 150) {
        const speedVal = Number(sample.val.toFixed(1));
        pt.speedKmh = speedVal;
      }
    }

    const telemetry = Array.from(pointMap.values()).sort((a, b) => a.elapsedSec - b.elapsedSec);
    const powers = telemetry.map((p) => p.power).filter((p): p is number => typeof p === 'number' && p > 0);
    const cadences = telemetry.map((p) => p.cadence).filter((c): c is number => typeof c === 'number' && c > 0);

    let avgPower: number | undefined;
    let maxPower: number | undefined;
    let normalizedPower: number | undefined;
    let intensityFactor: number | undefined;
    let tss: number | undefined;
    let cadenceAvg: number | undefined;

    if (powers.length > 0) {
      avgPower = Math.round(powers.reduce((a, b) => a + b, 0) / powers.length);
      maxPower = Math.max(...powers);
      normalizedPower = computeNormalizedPower(telemetry);
      if (normalizedPower) {
        const ftp = 200;
        intensityFactor = Number((normalizedPower / ftp).toFixed(2));
        const durationSec = row.duration_sec || (telemetry[telemetry.length - 1]?.elapsedSec || 0);
        if (durationSec > 0) {
          tss = Number(((durationSec * normalizedPower * intensityFactor) / (ftp * 3600) * 100).toFixed(1));
        }
      }
    }

    if (cadences.length > 0) {
      cadenceAvg = Math.round(cadences.reduce((a, b) => a + b, 0) / cadences.length);
    }

    result.set(row.id, {
      telemetry,
      avgPower,
      maxPower,
      normalizedPower,
      intensityFactor,
      tss,
      cadenceAvg,
    });
  }
  return result;
};

export async function getWorkoutRecords(options: {
  from?: string;
  to?: string;
  limit?: number;
  includeDetails?: boolean;
}): Promise<{ workouts: WorkoutRecord[]; total: number; from: string | null; to: string | null }> {
  const limit = Math.min(Math.max(options.limit || 5000, 1), 10000);
  const includeDetails = options.includeDetails === true;
  const values = [options.from || null, options.to || null, config.timezone, limit];
  const cyclingRawRecord = includeDetails
    ? 'raw_record'
    : `jsonb_build_object(
         'heartRateZones', raw_record->'heartRateZones',
         'pwrIF', raw_record->'pwrIF',
         'avgBalance', raw_record->'avgBalance'
       ) AS raw_record`;
  const haeRawWorkout = includeDetails
    ? 'raw_workout'
    : `jsonb_build_object(
         'source', raw_workout->'source',
         'activeEnergyBurned', raw_workout->'activeEnergyBurned',
         'activeEnergy', raw_workout->'activeEnergy',
         'totalEnergyBurned', raw_workout->'totalEnergyBurned',
         'avgCadence', raw_workout->'avgCadence',
         'cadence', raw_workout->'cadence',
         'stepCadence', raw_workout->'stepCadence',
         'avgPower', raw_workout->'avgPower',
         'power', raw_workout->'power',
         'cyclingPower', raw_workout->'cyclingPower',
         'maxPower', raw_workout->'maxPower',
         'avgSpeed', raw_workout->'avgSpeed',
         'speed', raw_workout->'speed',
         'measurements', raw_workout->'measurements'
       ) AS raw_workout`;

  const [cyclingRows, haeRows] = await Promise.all([
    pool.query<CyclingWorkoutRow>(
      `SELECT
         external_id, title, started_at, ended_at, moving_time_sec, distance_km,
         avg_speed_kmh, avg_heart_rate, max_heart_rate, avg_cadence, avg_power,
         max_power, normalized_power, tss, ascent_m, calories, ${cyclingRawRecord},
         CASE
           WHEN jsonb_typeof(raw_record->'routePoints') = 'array'
             THEN jsonb_array_length(raw_record->'routePoints') > 0
           ELSE FALSE
         END AS has_route,
         CASE
           WHEN jsonb_typeof(raw_record->'telemetry') = 'array'
             THEN jsonb_array_length(raw_record->'telemetry') > 0
           ELSE FALSE
         END AS has_telemetry,
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
         distance_km, avg_heart_rate, max_heart_rate, elevation_gain_m, ${haeRawWorkout},
         COALESCE(raw_workout->'source'->>'name', '') AS source_name,
         CASE
           WHEN jsonb_typeof(raw_workout->'route') = 'array' AND jsonb_array_length(raw_workout->'route') > 0 THEN TRUE
           WHEN jsonb_typeof(raw_workout->'locations') = 'array' AND jsonb_array_length(raw_workout->'locations') > 0 THEN TRUE
           WHEN jsonb_typeof(raw_workout->'route'->'locations') = 'array' AND jsonb_array_length(raw_workout->'route'->'locations') > 0 THEN TRUE
           ELSE FALSE
         END AS has_route,
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

  const haeTelemetryMap = includeDetails
    ? await loadHaeWorkoutTelemetry(haeRows.rows)
    : new Map();

  const cyclingWorkouts = cyclingRows.rows.map(cyclingToWorkout);

  const haeWorkouts = haeRows.rows
    .filter((row) => !/igpsport/i.test(haeSourceName(row)))
    .map((row) => {
      const workout = haeToWorkout(row);
      const tel = haeTelemetryMap.get(row.id);
      if (tel) {
        return {
          ...workout,
          cadenceAvg: workout.cadenceAvg ?? tel.cadenceAvg,
          avgPower: workout.avgPower ?? tel.avgPower,
          maxPower: workout.maxPower ?? tel.maxPower,
          normalizedPower: tel.normalizedPower,
          intensityFactor: tel.intensityFactor,
          tss: tel.tss,
          hasTelemetry: tel.telemetry.length > 0,
          telemetry: tel.telemetry.length > 0 ? tel.telemetry : undefined,
        };
      }
      return workout;
    });

  const workouts = mergeDuplicateWorkouts([...cyclingWorkouts, ...haeWorkouts]).sort(
    (left, right) =>
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

export async function getWorkoutRecordById(id: string): Promise<WorkoutRecord | null> {
  if (id.startsWith('hae-')) {
    const databaseId = id.slice(4);
    if (!/^\d+$/.test(databaseId)) return null;
    const result = await pool.query<HaeWorkoutRow>(
      `SELECT
         id::text, name, started_at, ended_at, duration_sec, active_energy_kcal,
         distance_km, avg_heart_rate, max_heart_rate, elevation_gain_m, raw_workout,
         COALESCE(raw_workout->'source'->>'name', '') AS source_name,
         CASE
           WHEN jsonb_typeof(raw_workout->'route') = 'array' AND jsonb_array_length(raw_workout->'route') > 0 THEN TRUE
           WHEN jsonb_typeof(raw_workout->'locations') = 'array' AND jsonb_array_length(raw_workout->'locations') > 0 THEN TRUE
           WHEN jsonb_typeof(raw_workout->'route'->'locations') = 'array' AND jsonb_array_length(raw_workout->'route'->'locations') > 0 THEN TRUE
           ELSE FALSE
         END AS has_route,
         to_char((started_at AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS local_date,
         to_char(started_at AT TIME ZONE $2, 'HH24:MI') AS local_start_time
       FROM health_workouts
       WHERE id = $1::bigint
       LIMIT 1`,
      [databaseId, config.timezone]
    );
    const row = result.rows[0];
    if (!row) return null;
    const workout = haeToWorkout(row);
    const telMap = await loadHaeWorkoutTelemetry([row]);
    const tel = telMap.get(row.id);
    if (tel) {
      return {
        ...workout,
        cadenceAvg: workout.cadenceAvg ?? tel.cadenceAvg,
        avgPower: workout.avgPower ?? tel.avgPower,
        maxPower: workout.maxPower ?? tel.maxPower,
        normalizedPower: tel.normalizedPower,
        intensityFactor: tel.intensityFactor,
        tss: tel.tss,
        hasTelemetry: tel.telemetry.length > 0,
        telemetry: tel.telemetry.length > 0 ? tel.telemetry : undefined,
      };
    }
    return workout;
  }

  const externalId = id.startsWith('igpsport-')
    ? id.slice('igpsport-'.length)
    : id;
  const result = await pool.query<CyclingWorkoutRow>(
    `SELECT
       external_id, title, started_at, ended_at, moving_time_sec, distance_km,
       avg_speed_kmh, avg_heart_rate, max_heart_rate, avg_cadence, avg_power,
       max_power, normalized_power, tss, ascent_m, calories, raw_record,
       CASE
         WHEN jsonb_typeof(raw_record->'routePoints') = 'array'
           THEN jsonb_array_length(raw_record->'routePoints') > 0
         ELSE FALSE
       END AS has_route,
       CASE
         WHEN jsonb_typeof(raw_record->'telemetry') = 'array'
           THEN jsonb_array_length(raw_record->'telemetry') > 0
         ELSE FALSE
       END AS has_telemetry,
       to_char((started_at AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS local_date,
       to_char(started_at AT TIME ZONE $2, 'HH24:MI') AS local_start_time
     FROM cycling_activities
     WHERE external_id = $1
     LIMIT 1`,
    [externalId, config.timezone]
  );
  return result.rows[0] ? cyclingToWorkout(result.rows[0]) : null;
}
