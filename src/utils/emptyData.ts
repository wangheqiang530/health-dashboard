import type { DailySummary } from '../types/health';

/**
 * Creates an initial zeroed DailySummary for when the database has no records yet.
 * Ensures that all UI cards and trends render safely with 0 values rather than crashing.
 */
export function createEmptyDailySummary(dateString?: string): DailySummary {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = dateString || `${year}-${month}-${day}`;

  const daysOfWeek = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const dayOfWeek = daysOfWeek[now.getDay()] || '周日';

  return {
    date: todayStr,
    dayName: dayOfWeek,
    shortDay: '今日',
    isToday: true,
    rings: {
      move: {
        current: 0,
        goal: 600,
        unit: 'kcal',
        color: '#FA114F',
        bgTrack: 'rgba(250, 17, 79, 0.2)',
      },
      exercise: {
        current: 0,
        goal: 30,
        unit: 'mins',
        color: '#A1FF00',
        bgTrack: 'rgba(161, 255, 0, 0.2)',
      },
      stand: {
        current: 0,
        goal: 12,
        unit: 'hrs',
        color: '#00F0FF',
        bgTrack: 'rgba(0, 240, 255, 0.2)',
      },
    },
    vitality: {
      score: 0,
      label: '需休整',
      statusDescription: '等待首次健康数据同步。配置数据源后，系统将自动汇总恢复与活力评分。',
      hrvStatus: '正常基线',
      restingHrDiff: 0,
      sleepContribution: 0,
      stressLevel: '低压力',
    },
    sleep: {
      score: 0,
      bedTime: '--:--',
      wakeTime: '--:--',
      totalMinutes: 0,
      inBedMinutes: 0,
      efficiency: 0,
      stages: {
        awake: 0,
        rem: 0,
        core: 0,
        deep: 0,
      },
      timeline: [],
      respiratoryRate: 0,
      hrvSleepAvg: 0,
      deepSleepPercent: 0,
      breathingDisturbances: 0,
    },
    vitals: {
      latestHr: 0,
      restingHr: 0,
      restingHrTrend: [],
      sleepingHr: 0,
      walkingHrAvg: 0,
      hrvCurrent: 0,
      hrvBaseline: 0,
      hrvTrend: [],
      spo2: 0,
      respiratoryRate: 0,
      wristTemperatureDiff: 0,
    },
    heartRateTimeline: [],
    workouts: [],
    steps: {
      count: 0,
      goal: 10000,
      distanceKm: 0,
      flightsClimbed: 0,
    },
    body: {
      weightKg: 0,
      bodyFatPercent: 0,
      leanMassKg: 0,
      bmi: 0,
      fatMassKg: 0,
      statusLabel: '等待体测数据',
      trend: [],
    },
    mobility: {
      walkingSpeedKmH: 0,
      stepLengthCm: 0,
      doubleSupportPercent: 0,
      asymmetryPercent: 0,
      stairSpeedUpMs: 0,
      stairSpeedDownMs: 0,
      sixMinWalkDistanceM: 0,
      walkingHrAvg: 0,
    },
    environment: {
      environmentalAudioDb: 0,
      headphoneAudioDb: 0,
      timeInDaylightMin: 0,
      audioHealthStatus: '良好',
    },
    cyclingDistanceKm: 0,
    basalEnergyKcal: 0,
    totalBurnedKcal: 0,
    physicalEffortAvg: 0,
    mindfulMinutes: 0,
  };
}
