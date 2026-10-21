import type {
  BodyComposition,
  DailySummary,
  VitalityScore,
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
  id: string;
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
  raw_record: {
    heartRateZones?: WorkoutRecord['hrZones'];
    routePoints?: Array<{ lat: number; lon: number }>;
  };
}

interface HaeStatusRow {
  received_at: Date | null;
  payload_size_bytes: string | null;
}

interface HrvTimelineRow {
  day: string;
  time: string;
  value: number;
}

const numberOrNull = (value: string | number | null): number | null =>
  value === null ? null : Number(value);

const positiveNumber = (value: unknown): boolean =>
  Number.isFinite(Number(value)) && Number(value) > 0;

const hasMeaningfulDailySummary = (summary: DailySummary): boolean => {
  const workouts = Array.isArray(summary.workouts) ? summary.workouts.length : 0;
  return (
    positiveNumber(summary.rings?.move?.current) ||
    positiveNumber(summary.rings?.exercise?.current) ||
    positiveNumber(summary.rings?.stand?.current) ||
    positiveNumber(summary.steps?.count) ||
    positiveNumber(summary.sleep?.totalMinutes) ||
    positiveNumber(summary.vitals?.latestHr) ||
    positiveNumber(summary.vitals?.restingHr) ||
    positiveNumber(summary.vitals?.hrvCurrent) ||
    positiveNumber(summary.vitals?.spo2) ||
    positiveNumber(summary.vitals?.respiratoryRate) ||
    positiveNumber(summary.vitals?.wristTemperatureAbs) ||
    positiveNumber(summary.vitals?.vo2Max) ||
    positiveNumber(summary.body?.weightKg) ||
    positiveNumber(summary.body?.bodyFatPercent) ||
    positiveNumber(summary.body?.leanMassKg) ||
    positiveNumber(summary.body?.skeletalMuscleKg) ||
    positiveNumber(summary.mobility?.walkingSpeedKmH) ||
    positiveNumber(summary.mobility?.stepLengthCm) ||
    positiveNumber(summary.mobility?.doubleSupportPercent) ||
    positiveNumber(summary.mobility?.asymmetryPercent) ||
    positiveNumber(summary.mobility?.stairSpeedUpMs) ||
    positiveNumber(summary.mobility?.stairSpeedDownMs) ||
    positiveNumber(summary.mobility?.sixMinWalkDistanceM) ||
    positiveNumber(summary.mobility?.walkingHrAvg) ||
    positiveNumber(summary.environment?.environmentalAudioDb) ||
    positiveNumber(summary.environment?.headphoneAudioDb) ||
    positiveNumber(summary.environment?.timeInDaylightMin) ||
    positiveNumber(summary.cyclingDistanceKm) ||
    positiveNumber(summary.basalEnergyKcal) ||
    positiveNumber(summary.totalBurnedKcal) ||
    positiveNumber(summary.mindfulMinutes) ||
    workouts > 0
  );
};

const buildBodyComposition = (
  current: BodyComposition,
  latest: BodyRow | undefined,
  trendRows: BodyRow[]
): BodyComposition => {
  if (!latest) return current;
  const weight = numberOrNull(latest.weight_kg) ?? current.weightKg;

  // Find most recent valid row with actual body fat rate > 0
  const validRows = trendRows.filter(
    (row) => numberOrNull(row.body_fat_rate) !== null && Number(row.body_fat_rate) > 0
  );
  const lastValid = validRows[validRows.length - 1];

  const rawFat = numberOrNull(latest.body_fat_rate);
  const bodyFat =
    rawFat !== null && rawFat > 0
      ? rawFat
      : lastValid && Number(lastValid.body_fat_rate) > 0
        ? Number(lastValid.body_fat_rate)
        : current.bodyFatPercent;
  const leanMass = Number((weight * (1 - bodyFat / 100)).toFixed(2));
  const rawBmi = numberOrNull(latest.bmi);
  const bmi =
    rawBmi !== null && rawBmi > 0
      ? rawBmi
      : weight > 0
        ? Number((weight / (1.84 ** 2)).toFixed(1))
        : current.bmi;

  const rawSkeletal = numberOrNull(latest.skeletal_muscle_rate);
  const skeletalMuscleRate =
    rawSkeletal !== null && rawSkeletal > 0
      ? rawSkeletal
      : lastValid && Number(lastValid.skeletal_muscle_rate) > 0
        ? Number(lastValid.skeletal_muscle_rate)
        : current.skeletalMusclePercent ?? 0;
  const skeletalMuscleKg = Number((weight * (skeletalMuscleRate / 100)).toFixed(2));

  const rawWater = numberOrNull(latest.water_rate);
  const waterRate =
    rawWater !== null && rawWater > 0
      ? rawWater
      : lastValid && Number(lastValid.water_rate) > 0
        ? Number(lastValid.water_rate)
        : current.waterPercent ?? 0;

  const rawVisceral = numberOrNull(latest.visceral_fat_level);
  const visceralFat =
    rawVisceral !== null && rawVisceral > 0
      ? rawVisceral
      : lastValid && Number(lastValid.visceral_fat_level) > 0
        ? Number(lastValid.visceral_fat_level)
        : current.visceralFatLevel ?? 0;

  const rawBmr = numberOrNull(latest.bmr_kcal);
  const bmr =
    rawBmr !== null && rawBmr > 0
      ? rawBmr
      : lastValid && Number(lastValid.bmr_kcal) > 0
        ? Number(lastValid.bmr_kcal)
        : current.bmrKcal ?? 0;

  const rawBone = numberOrNull(latest.bone_mass_kg);
  const boneMass =
    rawBone !== null && rawBone > 0
      ? rawBone
      : lastValid && Number(lastValid.bone_mass_kg) > 0
        ? Number(lastValid.bone_mass_kg)
        : current.boneMassKg ?? 0;

  const rawProtein = numberOrNull(latest.protein_rate);
  const proteinRate =
    rawProtein !== null && rawProtein > 0
      ? rawProtein
      : lastValid && Number(lastValid.protein_rate) > 0
        ? Number(lastValid.protein_rate)
        : current.proteinPercent ?? 0;

  const bodyAge =
    latest.body_age && latest.body_age > 0
      ? latest.body_age
      : (lastValid?.body_age ?? current.bodyAge ?? 33);
  const rawScore = numberOrNull(latest.score);
  const bodyScore =
    rawScore !== null && rawScore > 0
      ? rawScore
      : lastValid && Number(lastValid.score) > 0
        ? Number(lastValid.score)
        : current.bodyScore ?? 0;

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
    measurementId: latest.id,
    measuredAt: latest.measured_at.toISOString(),
    measuredDate: latest.measured_date,
    statusLabel:
      weight <= 0 || bodyFat <= 0
        ? '等待体测数据'
        : bodyFat < 20
        ? '体型精壮 · 骨骼肌卓越'
        : bodyFat <= 24
          ? '健康标准 · 骨骼肌充沛'
          : '肌肉型超重',
    trend:
      trendRows.length > 0
        ? trendRows
            .filter((row) => row.weight_kg !== null && numberOrNull(row.weight_kg)! > 0)
            .map((row) => {
              const rowFat = numberOrNull(row.body_fat_rate);
              return {
                date: row.measured_date.slice(5),
                weight: numberOrNull(row.weight_kg) ?? 0,
                bodyFat: rowFat !== null && rowFat > 0 ? rowFat : bodyFat,
              };
            })
        : current.trend,
  };
};

const timeToMinutes = (value: string): number => {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const averageValue = (values: number[]): number => {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0);
  return valid.length > 0
    ? valid.reduce((sum, value) => sum + value, 0) / valid.length
    : 0;
};

const deriveSleepingHr = (summary: DailySummary): number => {
  if (summary.vitals.sleepingHr > 0) return summary.vitals.sleepingHr;
  if (!summary.sleep || summary.sleep.totalMinutes <= 0) return 0;

  const bedMinutes = timeToMinutes(summary.sleep.bedTime);
  const wakeMinutes = timeToMinutes(summary.sleep.wakeTime);
  const values = (summary.heartRateTimeline || [])
    .filter((point) => {
      const minutes = timeToMinutes(point.time);
      if (point.hr < 35 || point.hr > 120) return false;
      return bedMinutes <= wakeMinutes
        ? minutes >= bedMinutes && minutes <= wakeMinutes
        : minutes >= bedMinutes || minutes <= wakeMinutes;
    })
    .map((point) => point.hr);
  return Math.round(averageValue(values));
};

export const buildVitality = (
  summary: DailySummary,
  recentResting?: { value: number; date: string }
): VitalityScore => {
  const currentResting = summary.vitals.restingHr;
  const restingHrUsed = currentResting > 0 ? currentResting : recentResting?.value || 0;
  const restingSourceDate =
    currentResting > 0 ? summary.date : recentResting?.date;
  const restingBaseline = Math.round(averageValue(summary.vitals.restingHrTrend || []));
  const hrvCurrent = summary.vitals.hrvCurrent;
  const hrvBaseline = summary.vitals.hrvBaseline || hrvCurrent;
  const sleepScore =
    summary.sleep?.score > 0 ? summary.sleep.score : summary.sleep?.efficiency || 0;

  const hasResting = restingHrUsed > 0;
  const hasCurrentResting = currentResting > 0;
  const hasHrv = hrvCurrent > 0;
  const hasSleep = sleepScore > 0;
  const dataCoverage =
    Number(hasCurrentResting) + Number(hasHrv) + Number(hasSleep);
  const availableSignalCount = Number(hasResting) + Number(hasHrv) + Number(hasSleep);
  const missingSignals = [
    !hasCurrentResting ? '今日静息心率' : null,
    !hasHrv ? 'HRV' : null,
    !hasSleep ? '睡眠' : null,
  ].filter((value): value is string => value !== null);

  if (availableSignalCount < 2) {
    return {
      score: 0,
      label: '数据不足',
      statusDescription:
        dataCoverage === 1
          ? `当前仅收到${missingSignals.length === 2 ? missingSignals.join('与') : '1 项'}以外的单项数据，至少需要 2 项才能生成状态评分。`
          : '等待静息心率、HRV 与睡眠数据同步后再计算身体状态。',
      hrvStatus: '数据不足',
      restingHrDiff: 0,
      sleepContribution: summary.sleep?.efficiency || 0,
      stressLevel: '数据不足',
      dataCoverage,
      restingHrUsed: restingHrUsed || undefined,
      restingHrSourceDate: restingSourceDate,
      missingSignals,
    };
  }

  const effectiveRestingBaseline = restingBaseline || restingHrUsed;
  const restingScore = hasResting
    ? clamp(100 - Math.abs(restingHrUsed - effectiveRestingBaseline) * 4, 25, 100)
    : 0;
  const hrvRatio = hasHrv && hrvBaseline > 0 ? hrvCurrent / hrvBaseline : 1;
  const hrvScore = hasHrv ? clamp(50 + (hrvRatio - 1) * 50, 20, 100) : 0;
  const sleepComponent = clamp(sleepScore, 0, 100);

  const weighted = [
    { value: sleepComponent, weight: 0.4, available: hasSleep },
    { value: hrvScore, weight: 0.3, available: hasHrv },
    { value: restingScore, weight: 0.3, available: hasResting },
  ].filter((item) => item.available);
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  const score = Math.round(
    weighted.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight
  );
  const hrvDiffPct =
    hasHrv && hrvBaseline > 0
      ? Math.round(((hrvCurrent - hrvBaseline) / hrvBaseline) * 100)
      : 0;
  const restingHrDiff =
    hasResting && effectiveRestingBaseline > 0
      ? Math.round(restingHrUsed - effectiveRestingBaseline)
      : 0;
  const label: VitalityScore['label'] =
    score >= 90
      ? '优异'
      : score >= 80
        ? '充沛'
        : score >= 70
          ? '良好'
          : score >= 60
            ? '轻度疲倦'
            : '需休整';
  const hrvStatus: VitalityScore['hrvStatus'] = !hasHrv
    ? '数据不足'
    : hrvDiffPct > 5
      ? '高于基线'
      : hrvDiffPct < -5
        ? '低于基线'
        : '正常基线';
  const stressLevel: VitalityScore['stressLevel'] = !hasHrv
    ? '数据不足'
    : hrvRatio >= 1.05
      ? '低压力'
      : hrvRatio >= 0.9
        ? '适中'
        : '偏高';

  const usedSignals = [
    hasSleep ? `睡眠评分 ${Math.round(sleepComponent)}` : null,
    hasHrv ? `HRV ${hrvCurrent} ms` : null,
    hasResting ? `静息心率 ${restingHrUsed} bpm` : null,
  ].filter((value): value is string => value !== null);
  const fallbackNote =
    currentResting <= 0 && recentResting
      ? ` 静息心率采用 ${recentResting.date.slice(5)} 最近实测值。`
      : '';
  const descriptionMissingSignals = missingSignals.filter(
    (signal) => !(signal === '今日静息心率' && recentResting)
  );
  const missingNote =
    descriptionMissingSignals.length > 0
      ? ` ${descriptionMissingSignals.join('、')}尚未同步。`
      : '';

  return {
    score,
    label,
    statusDescription: `基于${usedSignals.join('、')} 计算参考评分。${fallbackNote}${missingNote}`.trim(),
    hrvStatus,
    restingHrDiff,
    sleepContribution: summary.sleep?.efficiency || 0,
    stressLevel,
    dataCoverage,
    restingHrUsed: restingHrUsed || undefined,
    restingHrSourceDate: restingSourceDate,
    missingSignals,
  };
};

const cyclingToWorkout = (row: CyclingRow): WorkoutRecord => {
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
    hrZones: row.raw_record?.heartRateZones || {
      zone1: 0,
      zone2: 0,
      zone3: 0,
      zone4: 0,
      zone5: 0,
    },
    routeGpxPoints: row.raw_record?.routePoints,
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
  conditions.push(`day >= DATE '2000-01-01'`);
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
  dailyRows.rows = dailyRows.rows.filter((row) => hasMeaningfulDailySummary(row.summary));
  if (dailyRows.rows.length === 0) {
    const status = await getSyncInfo(options.endpoint);
    return { days: {}, dates: [], selectedDate: null, syncInfo: status };
  }

  const firstDay = dailyRows.rows[0].day;
  const lastDay = dailyRows.rows[dailyRows.rows.length - 1].day;
  const bodyRows = await pool.query<BodyRow>(
    `SELECT
       id::text,
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
       raw_record,
       to_char((started_at AT TIME ZONE $3)::date, 'YYYY-MM-DD') AS local_date,
       to_char(started_at AT TIME ZONE $3, 'HH24:MI') AS local_start_time
     FROM cycling_activities
     WHERE (started_at AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
     ORDER BY started_at ASC`,
    [firstDay, lastDay, config.timezone]
  );
  const hrvTimelineRows = await pool.query<HrvTimelineRow>(
    `SELECT
       to_char(local_date, 'YYYY-MM-DD') AS day,
       to_char(COALESCE(start_at, end_at) AT TIME ZONE $3, 'HH24:MI') AS time,
       value_num::float8 AS value
     FROM health_samples
     WHERE source_id = 'hae'
       AND metric_name IN (
         'heart_rate_variability',
         'heartRateVariability',
         'heart_rate_variability_sdnn',
         'hrv'
       )
       AND local_date BETWEEN $1::date AND $2::date
       AND value_num IS NOT NULL
       AND value_num > 0
       AND COALESCE(start_at, end_at) IS NOT NULL
     ORDER BY local_date ASC, COALESCE(start_at, end_at) ASC`,
    [firstDay, lastDay, config.timezone]
  );
  const hrvTimelineByDay = new Map<string, Array<{ time: string; hrv: number }>>();
  for (const point of hrvTimelineRows.rows) {
    const values = hrvTimelineByDay.get(point.day) || [];
    values.push({ time: point.time, hrv: Math.round(Number(point.value)) });
    hrvTimelineByDay.set(point.day, values);
  }

  const days: Record<string, DailySummary> = {};
  let latestResting: { value: number; date: string } | undefined;
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

    summary.vitals.sleepingHr = deriveSleepingHr(summary);
    const hrvTimeline = hrvTimelineByDay.get(row.day);
    if (hrvTimeline && hrvTimeline.length > 0) {
      summary.vitals.hrvTimeline = hrvTimeline;
    }
    const recentResting =
      latestResting &&
      (new Date(`${row.day}T12:00:00`).getTime() -
        new Date(`${latestResting.date}T12:00:00`).getTime()) /
        (24 * 60 * 60 * 1000) <=
        7
        ? latestResting
        : undefined;
    summary.vitality = buildVitality(summary, recentResting);
    if (summary.vitals.restingHr > 0) {
      latestResting = {
        value: summary.vitals.restingHr,
        date: row.day,
      };
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
