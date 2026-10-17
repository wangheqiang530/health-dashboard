export interface HealthRing {
  current: number;
  goal: number;
  unit: string;
  color: string;
  bgTrack: string;
}

export interface ActivityRings {
  move: HealthRing;      // Active Energy (kcal)
  exercise: HealthRing;  // Exercise Time (mins)
  stand: HealthRing;     // Stand Hours (hours)
}

export interface VitalityScore {
  score: number;         // 0 - 100
  label: '优异' | '良好' | '充沛' | '轻度疲倦' | '需休整';
  statusDescription: string;
  hrvStatus: '高于基线' | '正常基线' | '低于基线';
  restingHrDiff: number;
  sleepContribution: number;
  stressLevel: '低压力' | '适中' | '偏高';
}

export interface SleepStageSegment {
  stage: 'awake' | 'rem' | 'core' | 'deep';
  startMinutes: number;
  durationMinutes: number;
}

export interface SleepAnalysis {
  score: number;
  bedTime: string;
  wakeTime: string;
  totalMinutes: number;
  inBedMinutes: number;
  efficiency: number;
  stages: {
    awake: number;
    rem: number;
    core: number;
    deep: number;
  };
  timeline: SleepStageSegment[];
  respiratoryRate: number;
  hrvSleepAvg: number;
  deepSleepPercent: number;
  breathingDisturbances?: number;
}

export interface HeartRatePoint {
  time: string;
  hr: number;
  isWorkout?: boolean;
}

export interface DailyHrRange {
  date: string;
  dayName: string;
  minHr: number;
  maxHr: number;
  restingHr: number;
  sleepingHr: number;
  avgHr: number;
}

export interface WeeklyHrTrend {
  weekLabel: string;
  avgResting: number;
  avgSleeping: number;
  minRange: number;
  maxRange: number;
}

export interface VitalsData {
  latestHr: number;
  restingHr: number;
  restingHrTrend: number[];
  sleepingHr: number;       // e.g. 48 bpm (Apple Watch 睡眠心率)
  walkingHrAvg: number;     // e.g. 78-96 bpm (Apple Health 步行平均心率)
  hrvCurrent: number;       // ms (SDNN)
  hrvBaseline: number;
  hrvTrend: { date: string; hrv: number }[];
  dailyHrRanges?: DailyHrRange[];
  weeklyHrTrends?: WeeklyHrTrend[];
  spo2: number;
  respiratoryRate: number;
  wristTemperatureDiff: number;
  wristTemperatureAbs?: number;
  vo2Max?: number;
  bloodPressure?: { systolic: number; diastolic: number };
}

export interface GpxCoordinate {
  lat: number;
  lon: number;
}

export interface WorkoutRecord {
  id: string;
  name: string;
  category: 'running' | 'cycling' | 'strength' | 'hiit' | 'walking' | 'swimming';
  startTime: string;
  durationMinutes: number;
  activeCalories: number;
  totalCalories: number;
  avgHeartRate: number;
  maxHeartRate: number;
  distanceKm?: number;
  paceAvg?: string;
  cadenceAvg?: number;
  elevationGainM?: number;
  hrZones: {
    zone1: number;
    zone2: number;
    zone3: number;
    zone4: number;
    zone5: number;
  };
  splits?: { km: number; pace: string; hr: number }[];
  routeGpxPoints?: GpxCoordinate[];
}

export interface BodyComposition {
  weightKg: number;
  bodyFatPercent: number;
  leanMassKg: number;
  bmi: number;
  fatMassKg: number;
  statusLabel: string;
  trend: { date: string; weight: number; bodyFat: number }[];
}

export interface MobilityAndGait {
  walkingSpeedKmH: number;
  stepLengthCm: number;
  doubleSupportPercent: number;
  asymmetryPercent: number;
  stairSpeedUpMs: number;
  stairSpeedDownMs: number;
  sixMinWalkDistanceM: number;
  walkingHrAvg: number;
}

export interface EnvironmentAndHearing {
  environmentalAudioDb: number;
  headphoneAudioDb: number;
  timeInDaylightMin: number;
  audioHealthStatus: string;
}

export interface DailySummary {
  date: string;
  dayName: string;
  shortDay: string;
  isToday: boolean;
  rings: ActivityRings;
  vitality: VitalityScore;
  sleep: SleepAnalysis;
  vitals: VitalsData;
  heartRateTimeline: HeartRatePoint[];
  workouts: WorkoutRecord[];
  steps: {
    count: number;
    goal: number;
    distanceKm: number;
    flightsClimbed: number;
  };
  body: BodyComposition;
  mobility: MobilityAndGait;
  environment: EnvironmentAndHearing;
  cyclingDistanceKm: number;
  basalEnergyKcal: number;
  totalBurnedKcal: number;
  physicalEffortAvg: number;
  mindfulMinutes: number;
}

export interface AutoExportSyncInfo {
  lastSyncTime: string;
  status: 'online' | 'syncing' | 'offline';
  device: string;
  osVersion: string;
  watchModel: string;
  payloadSizeKb: number;
  pendingSyncCount: number;
  nasEndpoint: string;
}

export type DashboardModuleId = 
  | 'rings'
  | 'vitality'
  | 'body'
  | 'mobility'
  | 'sleep'
  | 'heartRate'
  | 'workouts'
  | 'environment'
  | 'quickMetrics';

export interface DashboardModuleConfig {
  id: DashboardModuleId;
  title: string;
  visible: boolean;
}