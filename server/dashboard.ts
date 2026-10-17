import type {
  BodyComposition,
  DailySummary,
  WorkoutRecord,
} from '../src/types/health.ts';
import { config } from './config.ts';
import { pool } from './db.ts';
import { isSourceRunning } from './sync.ts';

interface DailyRow {
  day: string;
  summary: DailySummary;
}

interface BodyRow {
  measured_date: string;
  measured_at: Date;
  weight_kg: string | null;
  bmi: string | null;
  body_fat_rate: string | null;
  lean_body_mass_kg: string | null;
}

interface CyclingRow {
  external_id: string;
  title: string;
  device: string | null;
  started_at: Date;
  ended_at: Date | null;
  moving_time_sec: number | null;
  distance_km: string | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  avg_cadence: number | null;
  avg_power: number | null;
  max_power: number | null;
  ascent_m: string | null;
  calories: string | null;
  local_date: string;
  local_start_time: string;
}

interface HaeStatusRow {
  received_at: Date | null;
  payload_size_bytes: string | null;
}

const numberOrNull = (value: string | number | null): number | null =>
  value === null ? null : Number(value);

const buildBodyComposition = (
  current: BodyComposition,
  latest: BodyRow | undefined,
  trendRows: BodyRow[]
): BodyComposition => {
  if (!latest) return current;
  const weight = numberOrNull(latest.weight_kg) ?? current.weightKg;
  const bodyFat = numberOrNull(latest.body_fat_rate) ?? current.bodyFatPercent;
  const leanMass = numberOrNull(latest.lean_body_mass_kg) ?? weight * (1 - bodyFat / 100);
  const bmi = numberOrNull(latest.bmi) ?? current.bmi;

  return {
    weightKg: Number(weight.toFixed(2)),
    bodyFatPercent: Number(bodyFat.toFixed(1)),
    leanMassKg: Number(leanMass.toFixed(2)),
    bmi: Number(bmi.toFixed(1)),
    fatMassKg: Number((weight * (bodyFat / 100)).toFixed(2)),
    statusLabel:
      bodyFat < 20
        ? '体型精壮 · 骨骼肌卓越'
        : bodyFat <= 24
          ? '健康标准 · 骨骼肌充沛'
          : '肌肉型超重',
    trend:
      trendRows.length > 0
        ? trendRows.map((row) => ({
            date: row.measured_date.slice(5),
            weight: numberOrNull(row.weight_kg) ?? 0,
            bodyFat: numberOrNull(row.body_fat_rate) ?? 0,
          }))
        : current.trend,
  };
};

const timeToMinutes = (value: string): number => {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const cyclingToWorkout = (row: CyclingRow): WorkoutRecord => {
  const activeCalories = Math.round(numberOrNull(row.calories) || 0);
  const durationSeconds =
    row.moving_time_sec ||
    (row.ended_at ? Math.max(0, (row.ended_at.getTime() - row.started_at.getTime()) / 1000) : 0);

  return {
    id: `igpsport-${row.external_id}`,
    name: row.title,
    category: 'cycling',
    startTime: row.local_start_time,
    durationMinutes: Math.round(durationSeconds / 60),
    activeCalories,
    totalCalories: Math.round(activeCalories * 1.08),
    avgHeartRate: row.avg_heart_rate || 0,
    maxHeartRate: row.max_heart_rate || 0,
    distanceKm: numberOrNull(row.distance_km) || undefined,
    cadenceAvg: row.avg_cadence || undefined,
    elevationGainM: Math.round(numberOrNull(row.ascent_m) || 0) || undefined,
    hrZones: { zone1: 0, zone2: 0, zone3: 0, zone4: 0, zone5: 0 },
  };
};

const isDuplicateCyclingWorkout = (
  existingWorkouts: WorkoutRecord[],
  cyclingWorkout: WorkoutRecord
): boolean =>
  existingWorkouts.some(
    (workout) =>
      workout.category === 'cycling' &&
      Math.abs(timeToMinutes(workout.startTime) - timeToMinutes(cyclingWorkout.startTime)) <= 10
  );

export async function getDashboardData(options: {
  from?: string;
  to?: string;
  endpoint: string;
}): Promise<{
  days: Record<string, DailySummary>;
  dates: string[];
  selectedDate: string | null;
  syncInfo: {
    lastSyncTime: string;
    status: 'online' | 'syncing' | 'offline';
    device: string;
    osVersion: string;
    watchModel: string;
    payloadSizeKb: number;
    pendingSyncCount: number;
    nasEndpoint: string;
  };
}> {
  const conditions: string[] = [];
  const values: string[] = [];
  if (options.from) {
    values.push(options.from);
    conditions.push(`day >= $${values.length}`);
  }
  if (options.to) {
    values.push(options.to);
    conditions.push(`day <= $${values.length}`);
  }

  const dailyRows = await pool.query<DailyRow>(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day, summary
     FROM daily_summaries
     ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
     ORDER BY day ASC`,
    values
  );
  if (dailyRows.rows.length === 0) {
    const status = await getSyncInfo(options.endpoint);
    return { days: {}, dates: [], selectedDate: null, syncInfo: status };
  }

  const firstDay = dailyRows.rows[0].day;
  const lastDay = dailyRows.rows[dailyRows.rows.length - 1].day;
  const bodyRows = await pool.query<BodyRow>(
    `SELECT
       to_char(measured_date, 'YYYY-MM-DD') AS measured_date,
       measured_at, weight_kg, bmi, body_fat_rate, lean_body_mass_kg
     FROM body_measurements
     WHERE measured_date BETWEEN ($1::date - INTERVAL '45 days')::date AND $2::date
     ORDER BY measured_at ASC`,
    [firstDay, lastDay]
  );
  const cyclingRows = await pool.query<CyclingRow>(
    `SELECT
       external_id, title, device, started_at, ended_at, moving_time_sec, distance_km,
       avg_heart_rate, max_heart_rate, avg_cadence, avg_power, max_power, ascent_m,
       calories,
       to_char((started_at AT TIME ZONE $3)::date, 'YYYY-MM-DD') AS local_date,
       to_char(started_at AT TIME ZONE $3, 'HH24:MI') AS local_start_time
     FROM cycling_activities
     WHERE (started_at AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
     ORDER BY started_at ASC`,
    [firstDay, lastDay, config.timezone]
  );

  const days: Record<string, DailySummary> = {};
  for (const row of dailyRows.rows) {
    const summary = row.summary;
    const bodyBefore = bodyRows.rows.filter((body) => body.measured_date <= row.day);
    const latestBody = bodyBefore[bodyBefore.length - 1];
    const bodyTrend = bodyBefore.slice(-8);
    summary.body = buildBodyComposition(summary.body, latestBody, bodyTrend);

    const rides = cyclingRows.rows
      .filter((ride) => ride.local_date === row.day)
      .map(cyclingToWorkout);
    for (const ride of rides) {
      if (!isDuplicateCyclingWorkout(summary.workouts, ride)) {
        summary.workouts.push(ride);
      }
    }

    const cyclingDistance = rides.reduce(
      (total, ride) => total + (ride.distanceKm || 0),
      0
    );
    if (cyclingDistance > 0) {
      summary.cyclingDistanceKm = Number(cyclingDistance.toFixed(2));
    }
    days[row.day] = summary;
  }

  return {
    days,
    dates: dailyRows.rows.map((row) => row.day),
    selectedDate: lastDay,
    syncInfo: await getSyncInfo(options.endpoint),
  };
}

export async function getSyncInfo(endpoint: string): Promise<{
  lastSyncTime: string;
  status: 'online' | 'syncing' | 'offline';
  device: string;
  osVersion: string;
  watchModel: string;
  payloadSizeKb: number;
  pendingSyncCount: number;
  nasEndpoint: string;
}> {
  const [haeStatus, pending] = await Promise.all([
    pool.query<HaeStatusRow>(
      `SELECT received_at, payload_size_bytes
       FROM hae_imports
       ORDER BY received_at DESC
       LIMIT 1`
    ),
    pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM sync_runs WHERE status = 'running'`
    ),
  ]);
  const latest = haeStatus.rows[0];
  const pendingSyncCount =
    Number(pending.rows[0]?.count || 0) +
    (isSourceRunning('fitdays') ? 1 : 0) +
    (isSourceRunning('igpsport') ? 1 : 0);
  const ageMs = latest?.received_at ? Date.now() - latest.received_at.getTime() : Infinity;
  const status =
    pendingSyncCount > 0 ? 'syncing' : ageMs <= 48 * 60 * 60 * 1000 ? 'online' : 'offline';

  return {
    lastSyncTime: latest?.received_at
      ? new Intl.DateTimeFormat('zh-CN', {
          timeZone: config.timezone,
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(latest.received_at)
      : '尚未接收',
    status,
    device: latest ? 'Health Auto Export' : '等待首次推送',
    osVersion: 'iOS',
    watchModel: 'Apple Watch',
    payloadSizeKb: Math.round(Number(latest?.payload_size_bytes || 0) / 1024),
    pendingSyncCount,
    nasEndpoint: endpoint,
  };
}
