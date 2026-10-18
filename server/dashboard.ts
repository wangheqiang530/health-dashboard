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
  skeletal_muscle_rate: string | null;
  muscle_rate: string | null;
  visceral_fat_level: string | null;
  water_rate: string | null;
  bone_mass_kg: string | null;
  bmr_kcal: string | null;
  protein_rate: string | null;
  body_age: number | null;
  score: string | null;
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
  avg_speed_kmh: string | null;
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
  const skeletalMuscleRate =
    numberOrNull(latest.skeletal_muscle_rate) ?? current.skeletalMusclePercent ?? 44.1;
  const skeletalMuscleKg = Number((weight * (skeletalMuscleRate / 100)).toFixed(2));
  const waterRate = numberOrNull(latest.water_rate) ?? current.waterPercent ?? 56.8;
  const visceralFat = numberOrNull(latest.visceral_fat_level) ?? current.visceralFatLevel ?? 7;
  const bmr = numberOrNull(latest.bmr_kcal) ?? current.bmrKcal ?? 1780;
  const boneMass = numberOrNull(latest.bone_mass_kg) ?? current.boneMassKg ?? 3.65;
  const proteinRate = numberOrNull(latest.protein_rate) ?? current.proteinPercent ?? 18.4;
  const bodyAge = latest.body_age ?? current.bodyAge ?? 28;
  const bodyScore = numberOrNull(latest.score) ?? current.bodyScore ?? 76;

  return {
    weightKg: Number(weight.toFixed(2)),
    bodyFatPercent: Number(bodyFat.toFixed(1)),
    leanMassKg: Number(leanMass.toFixed(2)),
    bmi: Number(bmi.toFixed(1)),
    fatMassKg: Number((weight * (bodyFat / 100)).toFixed(2)),
    skeletalMuscleKg,
    skeletalMusclePercent: Number(skeletalMuscleRate.toFixed(1)),
    waterPercent: Number(waterRate.toFixed(1)),
    visceralFatLevel: visceralFat,
    bmrKcal: Math.round(bmr),
    boneMassKg: Number(boneMass.toFixed(2)),
    proteinPercent: Number(proteinRate.toFixed(1)),
    bodyAge,
    bodyScore,
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
  const distanceKm = numberOrNull(row.distance_km) || undefined;
  const durationMinutes = Math.round(durationSeconds / 60);
  const avgSpeedKmh = numberOrNull(row.avg_speed_kmh);

  return {
    id: `igpsport-${row.external_id}`,
    name: row.title,
    category: 'cycling',
    date: row.local_date,
    startTime: row.local_start_time,
    durationMinutes,
    activeCalories,
    totalCalories: Math.round(activeCalories * 1.08),
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
    hrZones: { zone1: 15, zone2: 40, zone3: 30, zone4: 12, zone5: 3 },
  };
};

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
       measured_at, weight_kg, bmi, body_fat_rate, lean_body_mass_kg,
       skeletal_muscle_rate, muscle_rate, visceral_fat_level, water_rate,
       bone_mass_kg, bmr_kcal, protein_rate, body_age, score
     FROM body_measurements
     WHERE measured_date BETWEEN ($1::date - INTERVAL '45 days')::date AND $2::date
     ORDER BY measured_at ASC`,
    [firstDay, lastDay]
  );
  const cyclingRows = await pool.query<CyclingRow>(
    `SELECT
       external_id, title, device, started_at, ended_at, moving_time_sec, distance_km,
       avg_speed_kmh, avg_heart_rate, max_heart_rate, avg_cadence, avg_power, max_power, ascent_m,
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
      const duplicateIndex = summary.workouts.findIndex(
        (workout) =>
          workout.category === 'cycling' &&
          Math.abs(timeToMinutes(workout.startTime) - timeToMinutes(ride.startTime)) <= 10
      );
      if (duplicateIndex >= 0) {
        const existing = summary.workouts[duplicateIndex];
        summary.workouts[duplicateIndex] = {
          ...ride,
          ...existing,
          distanceKm: existing.distanceKm || ride.distanceKm,
          cadenceAvg: existing.cadenceAvg || ride.cadenceAvg,
          elevationGainM: existing.elevationGainM || ride.elevationGainM,
          avgHeartRate: existing.avgHeartRate || ride.avgHeartRate,
          maxHeartRate: existing.maxHeartRate || ride.maxHeartRate,
          paceAvg: existing.paceAvg || ride.paceAvg,
        };
      } else {
        summary.workouts.push(ride);
      }
    }
    for (const workout of summary.workouts) {
      if (!workout.date) {
        workout.date = row.day;
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
