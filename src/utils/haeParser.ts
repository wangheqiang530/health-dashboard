import type {
  DailySummary,
  ActivityRings,
  VitalityScore,
  SleepAnalysis,
  VitalsData,
  WorkoutRecord,
  HeartRatePoint,
  BodyComposition,
  MobilityAndGait,
  EnvironmentAndHearing,
  GpxCoordinate,
  WorkoutTelemetryPoint,
} from '../types/health';

interface HAEDataPoint {
  date?: string;
  startDate?: string;
  endDate?: string;
  qty?: number;
  avg?: number;
  sum?: number;
  min?: number;
  max?: number;
  Avg?: number;
  Min?: number;
  Max?: number;
  value?: string;
  source?: string;
  inBedStart?: string;
  sleepStart?: string;
  inBedEnd?: string;
  sleepEnd?: string;
  totalSleep?: number;
  awake?: number;
  rem?: number;
  core?: number;
  deep?: number;
  asleep?: number;
}

interface HAEMetric {
  name: string;
  units?: string;
  data?: HAEDataPoint[];
}

interface HAEMeasurement {
  qty?: number;
  units?: string;
}

interface HAEWorkout {
  name?: string;
  start?: string;
  end?: string;
  duration?: number;
  activeEnergy?: HAEMeasurement | HAEMeasurement[];
  totalEnergy?: HAEMeasurement | HAEMeasurement[];
  distance?: HAEMeasurement;
  cyclingDistance?: HAEMeasurement;
  avgHeartRate?: HAEMeasurement;
  maxHeartRate?: HAEMeasurement;
  avgCadence?: HAEMeasurement;
  elevationAscended?: HAEMeasurement;
  heartRateData?: HAEDataPoint[];
  route?: unknown;
}

interface HAEPayload {
  data?:
    | {
        metrics?: HAEMetric[];
        workouts?: HAEWorkout[];
      }
    | Array<{
        metrics?: HAEMetric[];
        workouts?: HAEWorkout[];
      }>;
  metrics?: HAEMetric[];
  workouts?: HAEWorkout[];
}

export interface HaeDayPresence {
  rings: boolean;
  steps: boolean;
  vitals: boolean;
  sleep: boolean;
  body: boolean;
  mobility: boolean;
  environment: boolean;
  heartRate: boolean;
}

export interface HaeParseResult {
  days: Record<string, DailySummary>;
  dates: string[];
  totalWorkouts: number;
  totalDays: number;
  presence: Record<string, HaeDayPresence>;
}

const normalizeName = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]/g, '');

const parseDateTime = (value?: string): Date | null => {
  if (!value) return null;
  const normalized = value
    .replace(/^(\d{4}-\d{2}-\d{2})\s+/, '$1T')
    .replace(/\s+([+-]\d{2})(\d{2})$/, '$1:$2');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseDateStr = (value?: string): string => {
  if (!value) return '';
  const parsed = parseDateTime(value);
  if (parsed) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(parsed);
  }
  const match = value.match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
};

const formatLocalTime = (date: Date | null, fallback = '--:--'): string => {
  if (!date) return fallback;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

const getDayInfo = (dateStr: string) => {
  const date = new Date(`${dateStr}T12:00:00+08:00`);
  const dayIndex = date.getDay();
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const shortDays = ['日', '一', '二', '三', '四', '五', '六'];
  return {
    dayName: dayNames[dayIndex] || '未知',
    shortDay: shortDays[dayIndex] || '-',
  };
};

const todayInShanghai = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());

const finiteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const pointValue = (point: HAEDataPoint): number | null =>
  finiteNumber(point.qty) ??
  finiteNumber(point.avg) ??
  finiteNumber(point.sum) ??
  finiteNumber(point.Avg) ??
  finiteNumber(point.Min) ??
  finiteNumber(point.Max);

const heartRateTelemetry = (
  workout: HAEWorkout,
  startedAt: Date | null,
  durationMinutes: number
): WorkoutTelemetryPoint[] | undefined => {
  const rawPoints = workout.heartRateData || [];
  if (!startedAt || rawPoints.length === 0) return undefined;
  const points = rawPoints
    .map((point, index): WorkoutTelemetryPoint | null => {
      const heartRate = pointValue(point);
      if (heartRate === null || heartRate < 30 || heartRate > 230) return null;
      const timestamp = parseDateTime(point.date || point.startDate)?.getTime();
      const elapsedSec = Number.isFinite(timestamp)
        ? Math.max(0, Math.round((timestamp! - startedAt.getTime()) / 1000))
        : rawPoints.length <= 1
          ? 0
          : Math.round((index / (rawPoints.length - 1)) * Math.max(durationMinutes * 60, 1));
      return {
        elapsedSec,
        heartRate: Math.round(heartRate),
      };
    })
    .filter((point): point is WorkoutTelemetryPoint => point !== null);
  return points.length > 0 ? points : undefined;
};

const toKcal = (value: number, units?: string): number =>
  units?.toLowerCase().includes('kj') ? value / 4.184 : value;

const toKm = (value: number, units?: string): number => {
  const normalized = units?.toLowerCase() || '';
  if (normalized.includes('mile') || normalized === 'mi') return value * 1.609344;
  if (normalized === 'm' || normalized === 'meter' || normalized === 'meters') {
    return value / 1000;
  }
  return value;
};

const formatPace = (secondsPerKm: number): string | undefined => {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0 || secondsPerKm > 1800) {
    return undefined;
  }
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}'${seconds.toString().padStart(2, '0')}"`;
};

const parseRoutePoints = (route: unknown): GpxCoordinate[] | undefined => {
  if (!Array.isArray(route)) return undefined;
  const points: GpxCoordinate[] = [];
  for (const item of route) {
    if (!item || typeof item !== 'object') continue;
    const point = item as Record<string, unknown>;
    const lat = finiteNumber(point.lat ?? point.latitude);
    const lon = finiteNumber(point.lon ?? point.lng ?? point.longitude);
    if (lat === null || lon === null) continue;
    points.push({ lat, lon });
  }
  return points.length > 1 ? points : undefined;
};

const finiteMeasure = (value: HAEMeasurement | undefined): number | null =>
  finiteNumber(value?.qty);

const sumMeasure = (
  value: HAEMeasurement | HAEMeasurement[] | undefined
): { qty: number | null; units: string | undefined } => {
  if (Array.isArray(value)) {
    const defined = value.filter((item) => finiteNumber(item.qty) !== null);
    if (defined.length === 0) return { qty: null, units: undefined };
    return {
      qty: defined.reduce((sum, item) => sum + (finiteNumber(item.qty) || 0), 0),
      units: defined[0].units,
    };
  }
  return { qty: finiteMeasure(value), units: value?.units };
};

export function parseHealthAutoExportJSON(rawJson: unknown): HaeParseResult {
  const payload = rawJson as HAEPayload;
  let metricsList: HAEMetric[] = [];
  let workoutsList: HAEWorkout[] = [];

  if (payload.data) {
    if (Array.isArray(payload.data)) {
      payload.data.forEach((item) => {
        if (item.metrics) metricsList.push(...item.metrics);
        if (item.workouts) workoutsList.push(...item.workouts);
      });
    } else {
      metricsList = payload.data.metrics || [];
      workoutsList = payload.data.workouts || [];
    }
  } else {
    metricsList = payload.metrics || [];
    workoutsList = payload.workouts || [];
  }

  const datesSet = new Set<string>();
  metricsList.forEach((metric) => {
    (metric.data || []).forEach((point) => {
      const date = parseDateStr(point.date || point.startDate || point.inBedStart);
      if (date) datesSet.add(date);
    });
  });
  workoutsList.forEach((workout) => {
    const date = parseDateStr(workout.start);
    if (date) datesSet.add(date);
  });

  const sortedDates = Array.from(datesSet).sort();
  if (sortedDates.length === 0) {
    throw new Error('未在导入的文件中识别到有效日期或健康数据点，请确认是否为 Health Auto Export V2 JSON 格式。');
  }

  const metricsByName: Record<string, HAEMetric> = {};
  metricsList.forEach((metric) => {
    metricsByName[normalizeName(metric.name)] = metric;
  });

  const metricFor = (names: string[]): HAEMetric | undefined => {
    for (const name of names) {
      const metric = metricsByName[normalizeName(name)];
      if (metric) return metric;
    }
    return undefined;
  };

  const pointsForDay = (metric: HAEMetric | undefined, date: string): HAEDataPoint[] =>
    (metric?.data || []).filter(
      (point) => parseDateStr(point.date || point.startDate || point.inBedStart) === date
    );

  const metricAverageForDay = (names: string[], date: string): number => {
    const metric = metricFor(names);
    const values = pointsForDay(metric, date)
      .map(pointValue)
      .filter((value): value is number => value !== null);
    return values.length === 0
      ? 0
      : values.reduce((sum, value) => sum + value, 0) / values.length;
  };

  const metricSumForDay = (
    names: string[],
    date: string,
    target: 'kcal' | 'count' | 'min' | 'distance' = 'count'
  ): number => {
    const metric = metricFor(names);
    return pointsForDay(metric, date).reduce((sum, point) => {
      const value = pointValue(point);
      if (value === null) return sum;
      if (target === 'kcal') return sum + toKcal(value, metric?.units);
      if (target === 'distance') return sum + toKm(value, metric?.units);
      return sum + value;
    }, 0);
  };

  const hasMetricForDay = (names: string[], date: string): boolean =>
    pointsForDay(metricFor(names), date).some((point) => pointValue(point) !== null);

  const restingHrByDate = new Map<string, number>();
  const hrvByDate = new Map<string, number>();
  sortedDates.forEach((date) => {
    const resting = metricAverageForDay(['resting_heart_rate', 'restingHeartRate'], date);
    const hrv = metricAverageForDay(
      ['heart_rate_variability', 'heartRateVariability', 'heart_rate_variability_sdnn', 'hrv'],
      date
    );
    if (resting > 0) restingHrByDate.set(date, Math.round(resting));
    if (hrv > 0) hrvByDate.set(date, Math.round(hrv));
  });

  const actualRestingValues = Array.from(restingHrByDate.values());
  const actualHrvValues = Array.from(hrvByDate.values());
  const restingBaseline =
    actualRestingValues.length > 0
      ? actualRestingValues.reduce((sum, value) => sum + value, 0) / actualRestingValues.length
      : 0;
  const hrvBaseline =
    actualHrvValues.length > 0
      ? actualHrvValues.reduce((sum, value) => sum + value, 0) / actualHrvValues.length
      : 0;

  const weightMetric = metricFor(['weight_body_mass', 'body_mass']);
  const bodyFatMetric = metricFor(['body_fat_percentage', 'body_fat']);
  const bodyTrendData = sortedDates
    .map((date) => {
      const weightPoints = pointsForDay(weightMetric, date);
      const fatPoints = pointsForDay(bodyFatMetric, date);
      const weight = weightPoints.length > 0 ? pointValue(weightPoints[weightPoints.length - 1]) : null;
      const bodyFat = fatPoints.length > 0 ? pointValue(fatPoints[fatPoints.length - 1]) : null;
      if (weight === null || bodyFat === null) return null;
      return {
        date,
        weight: Number(weight.toFixed(2)),
        bodyFat: Number(bodyFat.toFixed(1)),
      };
    })
    .filter((point): point is { date: string; weight: number; bodyFat: number } => point !== null)
    .map((point) => ({ ...point }));

  const daysResult: Record<string, DailySummary> = {};
  const presence: Record<string, HaeDayPresence> = {};
  const today = todayInShanghai();

  sortedDates.forEach((dateStr) => {
    const dayInfo = getDayInfo(dateStr);

    const moveCalories = Math.round(
      metricSumForDay(['active_energy', 'activeEnergy'], dateStr, 'kcal')
    );
    const exerciseMinutes = Math.round(
      metricSumForDay(['apple_exercise_time', 'appleExerciseTime', 'exercise_time'], dateStr, 'min')
    );
    const standHours = Math.round(
      metricSumForDay(['apple_stand_hour', 'appleStandHour', 'stand_hour'], dateStr)
    );
    const moveGoal =
      Math.round(metricAverageForDay(['active_energy_goal', 'move_goal'], dateStr)) || 600;
    const exerciseGoal =
      Math.round(metricAverageForDay(['apple_exercise_time_goal', 'exercise_goal'], dateStr)) || 30;
    const standGoal =
      Math.round(metricAverageForDay(['apple_stand_hour_goal', 'stand_goal'], dateStr)) || 12;

    const rings: ActivityRings = {
      move: {
        current: moveCalories,
        goal: moveGoal,
        unit: '千卡',
        color: '#FA114F',
        bgTrack: 'rgba(250, 17, 79, 0.2)',
      },
      exercise: {
        current: exerciseMinutes,
        goal: exerciseGoal,
        unit: '分钟',
        color: '#A1FF00',
        bgTrack: 'rgba(161, 255, 0, 0.2)',
      },
      stand: {
        current: standHours,
        goal: standGoal,
        unit: '小时',
        color: '#00F5D4',
        bgTrack: 'rgba(0, 245, 212, 0.2)',
      },
    };

    const stepCount = Math.round(
      metricSumForDay(['step_count', 'stepCount', 'steps'], dateStr)
    );
    const distanceKm = Number(
      metricSumForDay(
        ['walking_running_distance', 'walkingRunningDistance'],
        dateStr,
        'distance'
      ).toFixed(2)
    );
    const flightsClimbed = Math.round(
      metricSumForDay(['flights_climbed', 'flightsClimbed'], dateStr)
    );
    const cyclingDistanceKm = Number(
      metricSumForDay(['cycling_distance', 'cyclingDistance'], dateStr, 'distance').toFixed(2)
    );
    const basalKcal = Math.round(
      metricSumForDay(['basal_energy_burned', 'basalEnergyBurned'], dateStr, 'kcal')
    );
    const physicalEffortAvg = Number(
      metricAverageForDay(['physical_effort', 'physicalEffort'], dateStr).toFixed(1)
    );

    const hrMetric = metricFor(['heart_rate', 'heartRate']);
    const rawDayHrPoints: Array<HeartRatePoint & { sortKey: number }> = [];
    pointsForDay(hrMetric, dateStr).forEach((point) => {
      const value = pointValue(point);
      const pointDate = parseDateTime(point.date || point.startDate);
      if (value === null || !pointDate || value < 30 || value > 230) return;
      rawDayHrPoints.push({
        time: formatLocalTime(pointDate),
        hr: Math.round(value),
        isWorkout: false,
        sortKey: pointDate.getHours() * 60 + pointDate.getMinutes(),
      });
    });
    rawDayHrPoints.sort((left, right) => left.sortKey - right.sortKey);
    const heartRateTimeline: HeartRatePoint[] = [];
    const heartRateStep = Math.max(1, Math.floor(rawDayHrPoints.length / 240));
    for (let index = 0; index < rawDayHrPoints.length; index += heartRateStep) {
      const point = rawDayHrPoints[index];
      heartRateTimeline.push({
        time: point.time,
        hr: point.hr,
        isWorkout: point.hr > 130,
      });
    }

    const restingHr = restingHrByDate.get(dateStr) || 0;
    const hrvCurrent = hrvByDate.get(dateStr) || 0;
    const spo2Raw = metricAverageForDay(
      ['blood_oxygen_saturation', 'oxygen_saturation', 'spo2'],
      dateStr
    );
    const spo2 = spo2Raw > 0 ? Math.round(spo2Raw > 1 ? spo2Raw : spo2Raw * 100) : 0;
    const wristTemperatureAbs = Number(
      metricAverageForDay(
        ['apple_sleeping_wrist_temperature', 'wrist_temperature'],
        dateStr
      ).toFixed(2)
    );
    const vo2MaxRaw = metricAverageForDay(['vo2_max', 'vo2Max', 'vo2max'], dateStr);
    const vo2Max = vo2MaxRaw > 0 ? Number(vo2MaxRaw.toFixed(1)) : undefined;
    const walkingHrAvg = Math.round(
      metricAverageForDay(
        ['walking_heart_rate_average', 'walkingHeartRateAverage'],
        dateStr
      )
    );
    const respiratoryRate = Number(
      metricAverageForDay(['respiratory_rate', 'respiratoryRate'], dateStr).toFixed(1)
    );

    const vitals: VitalsData = {
      latestHr: heartRateTimeline[heartRateTimeline.length - 1]?.hr || 0,
      restingHr,
      restingHrTrend: sortedDates
        .filter((date) => date <= dateStr)
        .map((date) => restingHrByDate.get(date) || 0)
        .filter((value) => value > 0)
        .slice(-7),
      sleepingHr: 0,
      walkingHrAvg,
      hrvCurrent,
      hrvBaseline: Math.round(hrvBaseline),
      hrvTrend: sortedDates
        .filter((date) => date <= dateStr && (hrvByDate.get(date) || 0) > 0)
        .map((date) => ({
          date: date.slice(5),
          hrv: hrvByDate.get(date) || 0,
        }))
        .slice(-14),
      spo2,
      respiratoryRate,
      wristTemperatureDiff: 0,
      wristTemperatureAbs: wristTemperatureAbs > 0 ? wristTemperatureAbs : undefined,
      vo2Max,
    };

    const sleepMetric = metricFor(['sleep_analysis', 'sleepAnalysis']);
    let awakeMins = 0;
    let remMins = 0;
    let coreMins = 0;
    let deepMins = 0;
    let bedDate: Date | null = null;
    let wakeDate: Date | null = null;
    const timeline: Array<{
      stage: SleepAnalysis['timeline'][number]['stage'];
      startMinutes: number;
      durationMinutes: number;
      segmentStart?: Date;
    }> = [];
    let firstStageStartMs: number | null = null;

    const toMinutes = (value: number): number => (value <= 24 ? value * 60 : value);

    pointsForDay(sleepMetric, dateStr).forEach((point) => {
      if (point.deep !== undefined || point.rem !== undefined || point.core !== undefined) {
        deepMins += Math.round(toMinutes(point.deep || 0));
        remMins += Math.round(toMinutes(point.rem || 0));
        coreMins += Math.round(toMinutes(point.core || 0));
        awakeMins += Math.round(toMinutes(point.awake || 0));
      }

      const segmentStart = parseDateTime(point.startDate || point.sleepStart || point.inBedStart);
      const segmentEnd = parseDateTime(point.endDate || point.sleepEnd || point.inBedEnd);
      if (!segmentStart || !segmentEnd || segmentEnd <= segmentStart) return;
      if (!point.value) {
        if (!bedDate || segmentStart < bedDate) bedDate = segmentStart;
        if (!wakeDate || segmentEnd > wakeDate) wakeDate = segmentEnd;
        return;
      }

      const value = point.value.toLowerCase();
      const stage = value.includes('deep')
        ? 'deep'
        : value.includes('rem')
          ? 'rem'
          : value.includes('awake')
            ? 'awake'
            : 'core';
      if (value.includes('inbed')) {
        if (!bedDate || segmentStart < bedDate) bedDate = segmentStart;
        if (!wakeDate || segmentEnd > wakeDate) wakeDate = segmentEnd;
        return;
      }

      const durationMinutes = Math.max(1, Math.round((segmentEnd.getTime() - segmentStart.getTime()) / 60000));
      if (stage === 'deep') deepMins += durationMinutes;
      else if (stage === 'rem') remMins += durationMinutes;
      else if (stage === 'awake') awakeMins += durationMinutes;
      else coreMins += durationMinutes;
      firstStageStartMs =
        firstStageStartMs === null
          ? segmentStart.getTime()
          : Math.min(firstStageStartMs, segmentStart.getTime());
      if (!bedDate || segmentStart < bedDate) bedDate = segmentStart;
      if (!wakeDate || segmentEnd > wakeDate) wakeDate = segmentEnd;
      timeline.push({ stage, startMinutes: 0, durationMinutes, segmentStart });
    });

    if (firstStageStartMs !== null) {
      const baseStartMs = firstStageStartMs;
      timeline.sort(
        (left, right) =>
          (left.segmentStart?.getTime() || 0) - (right.segmentStart?.getTime() || 0)
      );
      timeline.forEach((segment) => {
        const segmentStart = segment.segmentStart;
        if (!segmentStart) return;
        segment.startMinutes = Math.max(
          0,
          Math.round((segmentStart.getTime() - baseStartMs) / 60000)
        );
        delete segment.segmentStart;
      });
    }

    const totalSleepMinutes = deepMins + remMins + coreMins;
    const inBedMinutes = totalSleepMinutes + awakeMins;
    const deepSleepPercent =
      totalSleepMinutes > 0
        ? Number(((deepMins / totalSleepMinutes) * 100).toFixed(1))
        : 0;
    const sleepEfficiency =
      inBedMinutes > 0 ? Math.round((totalSleepMinutes / inBedMinutes) * 100) : 0;
    const breathingDisturbances = Number(
      metricAverageForDay(
        ['breathing_disturbances', 'breathingDisturbances'],
        dateStr
      ).toFixed(2)
    );
    const sleepScore =
      totalSleepMinutes > 0
        ? Math.min(
            99,
            Math.max(
              0,
              Math.round(
                sleepEfficiency * 0.55 +
                  Math.min(deepSleepPercent / 20, 1) * 25 +
                  Math.min(totalSleepMinutes / 480, 1) * 20
              )
            )
          )
        : 0;

    const sleep: SleepAnalysis = {
      score: sleepScore,
      bedTime: formatLocalTime(bedDate),
      wakeTime: formatLocalTime(wakeDate),
      totalMinutes: totalSleepMinutes,
      inBedMinutes,
      efficiency: sleepEfficiency,
      stages: {
        awake: awakeMins,
        rem: remMins,
        core: coreMins,
        deep: deepMins,
      },
      timeline: totalSleepMinutes > 0 ? timeline : [],
      respiratoryRate,
      hrvSleepAvg: 0,
      deepSleepPercent,
      breathingDisturbances,
    };

    const weightKg = Number(
      metricAverageForDay(['weight_body_mass', 'body_mass'], dateStr).toFixed(2)
    );
    const bodyFatPercent = Number(
      metricAverageForDay(['body_fat_percentage', 'body_fat'], dateStr).toFixed(1)
    );
    const leanMassKgRaw = metricAverageForDay(['lean_body_mass', 'lean_mass'], dateStr);
    const bmiRaw = metricAverageForDay(['body_mass_index', 'bmi'], dateStr);
    const skeletalMusclePercent = Number(
      metricAverageForDay(
        ['skeletal_muscle_percentage', 'skeletal_muscle_rate'],
        dateStr
      ).toFixed(1)
    );
    const leanMassKg =
      leanMassKgRaw > 0
        ? Number(leanMassKgRaw.toFixed(2))
        : weightKg > 0 && bodyFatPercent > 0
          ? Number((weightKg * (1 - bodyFatPercent / 100)).toFixed(2))
          : 0;
    const bmi =
      bmiRaw > 0
        ? Number(bmiRaw.toFixed(1))
        : 0;

    const body: BodyComposition = {
      weightKg,
      bodyFatPercent,
      leanMassKg,
      bmi,
      fatMassKg:
        weightKg > 0 && bodyFatPercent > 0
          ? Number((weightKg * (bodyFatPercent / 100)).toFixed(2))
          : 0,
      statusLabel:
        weightKg <= 0 || bodyFatPercent <= 0
          ? '等待体测数据'
          : bodyFatPercent < 20
            ? '体型精壮 · 骨骼肌卓越'
            : bodyFatPercent <= 24
              ? '健康标准 · 骨骼肌充沛'
              : '肌肉型超重',
      trend: bodyTrendData
        .filter((point) => point.date <= dateStr)
        .slice(-8)
        .map((point) => ({ ...point, date: point.date.slice(5) })),
      skeletalMuscleKg:
        weightKg > 0 && skeletalMusclePercent > 0
          ? Number((weightKg * (skeletalMusclePercent / 100)).toFixed(2))
          : undefined,
      skeletalMusclePercent: skeletalMusclePercent > 0 ? skeletalMusclePercent : undefined,
      waterPercent:
        metricAverageForDay(['water_percentage', 'water_rate'], dateStr) > 0
          ? Number(metricAverageForDay(['water_percentage', 'water_rate'], dateStr).toFixed(1))
          : undefined,
      visceralFatLevel:
        metricAverageForDay(['visceral_fat_level'], dateStr) > 0
          ? Number(metricAverageForDay(['visceral_fat_level'], dateStr).toFixed(1))
          : undefined,
      bmrKcal:
        metricAverageForDay(['basal_metabolic_rate', 'bmr'], dateStr) > 0
          ? Math.round(metricAverageForDay(['basal_metabolic_rate', 'bmr'], dateStr))
          : undefined,
      boneMassKg:
        metricAverageForDay(['bone_mass'], dateStr) > 0
          ? Number(metricAverageForDay(['bone_mass'], dateStr).toFixed(2))
          : undefined,
      proteinPercent:
        metricAverageForDay(['protein_percentage'], dateStr) > 0
          ? Number(metricAverageForDay(['protein_percentage'], dateStr).toFixed(1))
          : undefined,
      bodyAge:
        metricAverageForDay(['body_age'], dateStr) > 0
          ? Math.round(metricAverageForDay(['body_age'], dateStr))
          : undefined,
    };

    const mobility: MobilityAndGait = {
      walkingSpeedKmH: Number(
        metricAverageForDay(['walking_speed'], dateStr).toFixed(2)
      ),
      stepLengthCm: Number(
        metricAverageForDay(['walking_step_length'], dateStr).toFixed(1)
      ),
      doubleSupportPercent: Number(
        metricAverageForDay(['walking_double_support_percentage'], dateStr).toFixed(1)
      ),
      asymmetryPercent: Number(
        metricAverageForDay(['walking_asymmetry_percentage'], dateStr).toFixed(1)
      ),
      stairSpeedUpMs: Number(
        metricAverageForDay(['stair_speed_up'], dateStr).toFixed(2)
      ),
      stairSpeedDownMs: Number(
        metricAverageForDay(['stair_speed_down'], dateStr).toFixed(2)
      ),
      sixMinWalkDistanceM: Math.round(
        metricAverageForDay(['six_minute_walking_test_distance'], dateStr)
      ),
      walkingHrAvg,
    };

    const environmentalAudioDb = Number(
      metricAverageForDay(['environmental_audio_exposure'], dateStr).toFixed(1)
    );
    const headphoneAudioDb = Number(
      metricAverageForDay(['headphone_audio_exposure'], dateStr).toFixed(1)
    );
    const timeInDaylightMin = Math.round(
      metricSumForDay(['time_in_daylight'], dateStr, 'min')
    );
    const environment: EnvironmentAndHearing = {
      environmentalAudioDb,
      headphoneAudioDb,
      timeInDaylightMin,
      audioHealthStatus:
        environmentalAudioDb > 0 && environmentalAudioDb < 65
          ? '声级处于日常安全范围'
          : environmentalAudioDb > 0
            ? '环境声级偏高'
            : '暂无环境数据',
    };

    const dayWorkouts: WorkoutRecord[] = [];
    workoutsList.forEach((workout, index) => {
      if (parseDateStr(workout.start) !== dateStr) return;
      const startDate = parseDateTime(workout.start);
      const endDate = parseDateTime(workout.end);
      const durationMinutes =
        (finiteNumber(workout.duration) || 0) > 0
          ? Math.round((finiteNumber(workout.duration) || 0) / 60)
          : startDate && endDate
            ? Math.round((endDate.getTime() - startDate.getTime()) / 60000)
            : 0;
      const activeEnergy = sumMeasure(workout.activeEnergy);
      const totalEnergy = sumMeasure(workout.totalEnergy);
      const distance = workout.distance || workout.cyclingDistance;
      const distanceQty = finiteNumber(distance?.qty);
      const distanceKm =
        distanceQty !== null
          ? Number(toKm(distanceQty, distance?.units).toFixed(2))
          : undefined;
      const avgHeartRate = Math.round(finiteMeasure(workout.avgHeartRate) || 0);
      const maxHeartRate = Math.round(finiteMeasure(workout.maxHeartRate) || 0);
      const cadence = finiteMeasure(workout.avgCadence);
      const elevation = finiteMeasure(workout.elevationAscended);
      const nameLower = (workout.name || '').toLowerCase();
      let category: WorkoutRecord['category'] = 'running';
      if (nameLower.includes('骑行') || nameLower.includes('cycling') || nameLower.includes('bike')) {
        category = 'cycling';
      } else if (nameLower.includes('力量') || nameLower.includes('strength')) {
        category = 'strength';
      } else if (nameLower.includes('步行') || nameLower.includes('walk')) {
        category = 'walking';
      } else if (nameLower.includes('hiit')) {
        category = 'hiit';
      } else if (nameLower.includes('游泳') || nameLower.includes('swim')) {
        category = 'swimming';
      }

      const heartRatePoints = (workout.heartRateData || [])
        .map(pointValue)
        .filter((value): value is number => value !== null && value >= 30 && value <= 230);
      const measuredMaxHr =
        maxHeartRate > 0
          ? maxHeartRate
          : heartRatePoints.length > 0
            ? Math.max(...heartRatePoints)
            : 0;
      const measuredAvgHr =
        avgHeartRate > 0
          ? avgHeartRate
          : heartRatePoints.length > 0
            ? Math.round(
                heartRatePoints.reduce((sum, value) => sum + value, 0) /
                  heartRatePoints.length
              )
            : 0;

      dayWorkouts.push({
        id: `hae-${dateStr}-${index}`,
        name: workout.name || '体能训练',
        category,
        source: 'hae',
        date: dateStr,
        startTime: formatLocalTime(startDate),
        durationMinutes,
        activeCalories: Math.round(
          activeEnergy.qty === null ? 0 : toKcal(activeEnergy.qty, activeEnergy.units)
        ),
        totalCalories: Math.round(
          totalEnergy.qty === null
            ? activeEnergy.qty === null
              ? 0
              : toKcal(activeEnergy.qty, activeEnergy.units)
            : toKcal(totalEnergy.qty, totalEnergy.units)
        ),
        avgHeartRate: measuredAvgHr,
        maxHeartRate: measuredMaxHr,
        distanceKm,
        paceAvg:
          distanceKm && durationMinutes > 0
            ? formatPace((durationMinutes * 60) / distanceKm)
            : undefined,
        cadenceAvg: cadence === null ? undefined : Math.round(cadence),
        elevationGainM: elevation === null ? undefined : Math.round(elevation),
        hrZones: { zone1: 0, zone2: 0, zone3: 0, zone4: 0, zone5: 0 },
        routeGpxPoints: parseRoutePoints(workout.route),
        telemetry: heartRateTelemetry(workout, startDate, durationMinutes),
      });
    });

    const hasCompleteVitalityInputs = hrvCurrent > 0 && restingHr > 0 && sleepScore > 0;
    const hrvDiffPct =
      hasCompleteVitalityInputs && hrvBaseline > 0
        ? Math.round(((hrvCurrent - hrvBaseline) / hrvBaseline) * 100)
        : 0;
    const restingHrDiff =
      hasCompleteVitalityInputs && restingBaseline > 0
        ? Math.round(restingHr - restingBaseline)
        : 0;
    const vitalityScore = hasCompleteVitalityInputs
      ? Math.min(
          99,
          Math.max(
            0,
            Math.round(
              72 -
                restingHrDiff * 1.5 +
                hrvDiffPct * 0.3 +
                (sleepEfficiency - 85) * 0.35
            )
          )
        )
      : 0;
    const vitalityLabel: VitalityScore['label'] =
      !hasCompleteVitalityInputs
        ? '数据不足'
        : vitalityScore >= 90
          ? '优异'
          : vitalityScore >= 80
            ? '充沛'
            : vitalityScore >= 70
              ? '良好'
              : vitalityScore >= 60
                ? '轻度疲倦'
                : '需休整';
    const vitality: VitalityScore = {
      score: vitalityScore,
      label: vitalityLabel,
      statusDescription: hasCompleteVitalityInputs
        ? `基于当日静息心率 ${restingHr} bpm、HRV ${hrvCurrent} ms 与睡眠效率 ${sleepEfficiency}% 计算，仅用于趋势参考。`
        : '当天缺少完整的静息心率、HRV 或睡眠数据，暂不生成状态评分。',
      hrvStatus:
        !hasCompleteVitalityInputs
          ? '数据不足'
          : hrvDiffPct > 5
            ? '高于基线'
            : hrvDiffPct < -5
              ? '低于基线'
              : '正常基线',
      restingHrDiff,
      sleepContribution: sleepEfficiency,
      stressLevel: !hasCompleteVitalityInputs
        ? '数据不足'
        : hrvCurrent >= Math.max(hrvBaseline * 1.05, hrvBaseline)
          ? '低压力'
          : '适中',
    };

    const heartRatePresence = hasMetricForDay(['heart_rate', 'heartRate'], dateStr);
    const vitalsPresence =
      heartRatePresence ||
      hasMetricForDay(
        [
          'resting_heart_rate',
          'restingHeartRate',
          'heart_rate_variability',
          'heart_rate_variability_sdnn',
          'blood_oxygen_saturation',
          'respiratory_rate',
          'walking_heart_rate_average',
        ],
        dateStr
      );
    const ringsPresence =
      hasMetricForDay(['active_energy', 'activeEnergy'], dateStr) ||
      hasMetricForDay(['apple_exercise_time', 'appleExerciseTime'], dateStr) ||
      hasMetricForDay(['apple_stand_hour', 'appleStandHour'], dateStr);
    const stepsPresence = hasMetricForDay(
      [
        'step_count',
        'stepCount',
        'steps',
        'walking_running_distance',
        'flights_climbed',
      ],
      dateStr
    );
    const sleepPresence = pointsForDay(
      metricFor(['sleep_analysis', 'sleepAnalysis']),
      dateStr
    ).some(
      (point) =>
        point.deep !== undefined ||
        point.rem !== undefined ||
        point.core !== undefined ||
        point.awake !== undefined ||
        Boolean(point.value) ||
        Boolean(point.startDate || point.sleepStart || point.inBedStart)
    );
    const bodyPresence =
      hasMetricForDay(['weight_body_mass', 'body_mass', 'body_fat_percentage'], dateStr) ||
      skeletalMusclePercent > 0;
    const mobilityPresence = hasMetricForDay(
      [
        'walking_speed',
        'walking_step_length',
        'walking_double_support_percentage',
        'walking_asymmetry_percentage',
      ],
      dateStr
    );
    const environmentPresence = hasMetricForDay(
      ['environmental_audio_exposure', 'headphone_audio_exposure', 'time_in_daylight'],
      dateStr
    );

    daysResult[dateStr] = {
      date: dateStr,
      dayName: dayInfo.dayName,
      shortDay: dayInfo.shortDay,
      isToday: dateStr === today,
      rings,
      vitality,
      sleep,
      vitals,
      heartRateTimeline,
      workouts: dayWorkouts,
      steps: {
        count: stepCount,
        goal: Math.round(metricAverageForDay(['step_goal'], dateStr)) || 10000,
        distanceKm,
        flightsClimbed,
      },
      body,
      mobility,
      environment,
      cyclingDistanceKm,
      basalEnergyKcal: basalKcal,
      totalBurnedKcal: moveCalories + basalKcal,
      physicalEffortAvg,
      mindfulMinutes: Math.round(
        metricSumForDay(['mindful_minutes', 'mindfulMinutes'], dateStr)
      ),
    };

    presence[dateStr] = {
      rings: ringsPresence,
      steps: stepsPresence,
      vitals: vitalsPresence,
      sleep: sleepPresence,
      body: bodyPresence,
      mobility: mobilityPresence,
      environment: environmentPresence,
      heartRate: heartRatePresence,
    };
  });

  return {
    days: daysResult,
    dates: sortedDates,
    totalWorkouts: workoutsList.length,
    totalDays: sortedDates.length,
    presence,
  };
}
