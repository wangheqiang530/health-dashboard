import type { BodyMeasurement } from '../types/health';

export type BodyMetricKey =
  | 'weightKg'
  | 'bmi'
  | 'bodyFatPercent'
  | 'fatMassKg'
  | 'leanMassKg'
  | 'skeletalMuscleKg'
  | 'skeletalMusclePercent'
  | 'musclePercent'
  | 'waterPercent'
  | 'visceralFatLevel'
  | 'bmrKcal'
  | 'boneMassKg'
  | 'proteinPercent'
  | 'subcutaneousFatPercent'
  | 'bodyAge'
  | 'heartRate'
  | 'bodyScore'
  | 'smi'
  | 'whr';

export type BodyMetricDirection = 'higher' | 'lower' | 'target';

export interface BodyMetricDefinition {
  key: BodyMetricKey;
  title: string;
  unit: string;
  decimals: number;
  direction: BodyMetricDirection;
  target?: number;
  description: string;
}

export interface BodyMetricComparison {
  yesterdayValue: number | null;
  sevenDayAverage: number | null;
  yesterdayDelta: number | null;
  sevenDayDelta: number | null;
  yesterdayBetter: boolean | null;
  sevenDayBetter: boolean | null;
}

export const BODY_METRIC_DEFINITIONS: BodyMetricDefinition[] = [
  {
    key: 'weightKg',
    title: '体重',
    unit: 'kg',
    decimals: 2,
    direction: 'lower',
    description: 'Fitdays 实测体重，数值越低越有利于减重目标。',
  },
  {
    key: 'bmi',
    title: 'BMI',
    unit: '',
    decimals: 1,
    direction: 'lower',
    description: '身体质量指数，数值降低视为改善。',
  },
  {
    key: 'bodyFatPercent',
    title: '体脂率',
    unit: '%',
    decimals: 1,
    direction: 'lower',
    description: '全身脂肪占体重的比例，数值降低通常代表体脂改善。',
  },
  {
    key: 'fatMassKg',
    title: '脂肪量',
    unit: 'kg',
    decimals: 2,
    direction: 'lower',
    description: '由体重与体脂率计算得到的全身脂肪重量。',
  },
  {
    key: 'leanMassKg',
    title: '去脂体重',
    unit: 'kg',
    decimals: 2,
    direction: 'higher',
    description: '去除脂肪后的瘦体重，包含肌肉、骨骼与水分。',
  },
  {
    key: 'skeletalMuscleKg',
    title: '骨骼肌量',
    unit: 'kg',
    decimals: 2,
    direction: 'higher',
    description: '由骨骼肌率与体重计算，数值越高通常代表肌肉储备越好。',
  },
  {
    key: 'skeletalMusclePercent',
    title: '骨骼肌率',
    unit: '%',
    decimals: 1,
    direction: 'higher',
    description: '骨骼肌占体重的比例，数值越高越理想。',
  },
  {
    key: 'musclePercent',
    title: '肌肉率',
    unit: '%',
    decimals: 1,
    direction: 'higher',
    description: 'Fitdays 返回的全身肌肉比例。',
  },
  {
    key: 'waterPercent',
    title: '身体水分率',
    unit: '%',
    decimals: 1,
    direction: 'higher',
    description: '身体水分占体重比例，通常越高代表水合状态越好。',
  },
  {
    key: 'visceralFatLevel',
    title: '内脏脂肪等级',
    unit: '级',
    decimals: 1,
    direction: 'lower',
    description: '内脏脂肪风险等级，数值越低越理想。',
  },
  {
    key: 'bmrKcal',
    title: '基础代谢率',
    unit: 'kcal',
    decimals: 0,
    direction: 'higher',
    description: '静息状态下维持生命活动所需的能量，通常越高越好。',
  },
  {
    key: 'boneMassKg',
    title: '骨量',
    unit: 'kg',
    decimals: 2,
    direction: 'higher',
    description: 'Fitdays 估算的骨骼矿物质重量。',
  },
  {
    key: 'proteinPercent',
    title: '蛋白质率',
    unit: '%',
    decimals: 1,
    direction: 'higher',
    description: '身体蛋白质占比，通常越高代表营养与肌肉状态越好。',
  },
  {
    key: 'subcutaneousFatPercent',
    title: '皮下脂肪率',
    unit: '%',
    decimals: 1,
    direction: 'lower',
    description: '皮肤下方脂肪比例，数值降低通常代表体脂改善。',
  },
  {
    key: 'bodyAge',
    title: '身体年龄',
    unit: '岁',
    decimals: 0,
    direction: 'lower',
    description: '体脂秤根据身体成分估算的代谢年龄。',
  },
  {
    key: 'heartRate',
    title: '体测心率',
    unit: 'bpm',
    decimals: 0,
    direction: 'lower',
    description: '称重时 Fitdays 记录的心率，仅作为体测时点参考。',
  },
  {
    key: 'bodyScore',
    title: '身体评分',
    unit: '分',
    decimals: 0,
    direction: 'higher',
    description: 'Fitdays 根据身体成分给出的综合评分。',
  },
  {
    key: 'smi',
    title: '骨骼肌指数 SMI',
    unit: '',
    decimals: 2,
    direction: 'higher',
    description: 'Skeletal Muscle Index，用于观察骨骼肌相对身高水平。',
  },
  {
    key: 'whr',
    title: '腰臀比 WHR',
    unit: '',
    decimals: 3,
    direction: 'lower',
    description: 'Waist-to-Hip Ratio，腰围与臀围比例，数值越低通常风险越低。',
  },
];

const validNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const bodyMetricValue = (
  measurement: BodyMeasurement | null | undefined,
  key: BodyMetricKey
): number | null => {
  if (!measurement) return null;
  if (key === 'fatMassKg') {
    const weight = validNumber(measurement.weightKg);
    const bodyFat = validNumber(measurement.bodyFatPercent);
    return weight !== null && bodyFat !== null
      ? Number((weight * (bodyFat / 100)).toFixed(2))
      : null;
  }
  if (key === 'leanMassKg') {
    const raw = validNumber(measurement.leanMassKg);
    if (raw !== null) return raw;
    const weight = validNumber(measurement.weightKg);
    const bodyFat = validNumber(measurement.bodyFatPercent);
    return weight !== null && bodyFat !== null
      ? Number((weight * (1 - bodyFat / 100)).toFixed(2))
      : null;
  }
  return validNumber(measurement[key]);
};

const shiftDate = (date: string, days: number): string => {
  const value = new Date(`${date}T12:00:00+08:00`);
  value.setDate(value.getDate() + days);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
};

const betterThan = (
  definition: BodyMetricDefinition,
  current: number,
  reference: number
): boolean | null => {
  const epsilon = 10 ** -Math.max(definition.decimals, 1) / 2;
  if (Math.abs(current - reference) < epsilon) return null;
  if (definition.direction === 'higher') return current > reference;
  if (definition.direction === 'lower') return current < reference;
  const target = definition.target ?? reference;
  return Math.abs(current - target) < Math.abs(reference - target);
};

export const compareBodyMetric = (
  definition: BodyMetricDefinition,
  current: BodyMeasurement | null | undefined,
  measurements: BodyMeasurement[]
): BodyMetricComparison => {
  const currentValue = bodyMetricValue(current, definition.key);
  if (!current || currentValue === null) {
    return {
      yesterdayValue: null,
      sevenDayAverage: null,
      yesterdayDelta: null,
      sevenDayDelta: null,
      yesterdayBetter: null,
      sevenDayBetter: null,
    };
  }

  const currentTime = new Date(current.measuredAt).getTime();
  const eligible = measurements.filter(
    (measurement) =>
      measurement.measuredDate < current.measuredDate &&
      new Date(measurement.measuredAt).getTime() < currentTime
  );
  const latestByDate = new Map<string, BodyMeasurement>();
  for (const measurement of eligible) {
    const previous = latestByDate.get(measurement.measuredDate);
    if (
      !previous ||
      new Date(measurement.measuredAt).getTime() >
        new Date(previous.measuredAt).getTime()
    ) {
      latestByDate.set(measurement.measuredDate, measurement);
    }
  }

  const yesterdayDate = shiftDate(current.measuredDate, -1);
  const yesterdayValue = bodyMetricValue(
    latestByDate.get(yesterdayDate),
    definition.key
  );

  const sevenDayValues: number[] = [];
  for (let offset = 1; offset <= 7; offset += 1) {
    const value = bodyMetricValue(
      latestByDate.get(shiftDate(current.measuredDate, -offset)),
      definition.key
    );
    if (value !== null) sevenDayValues.push(value);
  }
  const sevenDayAverage =
    sevenDayValues.length > 0
      ? sevenDayValues.reduce((sum, value) => sum + value, 0) / sevenDayValues.length
      : null;

  return {
    yesterdayValue,
    sevenDayAverage,
    yesterdayDelta:
      yesterdayValue === null ? null : currentValue - yesterdayValue,
    sevenDayDelta:
      sevenDayAverage === null ? null : currentValue - sevenDayAverage,
    yesterdayBetter:
      yesterdayValue === null
        ? null
        : betterThan(definition, currentValue, yesterdayValue),
    sevenDayBetter:
      sevenDayAverage === null
        ? null
        : betterThan(definition, currentValue, sevenDayAverage),
  };
};

export const formatBodyMetricValue = (
  value: number | null,
  definition: BodyMetricDefinition
): string =>
  value === null
    ? '—'
    : `${value.toFixed(definition.decimals)}${definition.unit ? ` ${definition.unit}` : ''}`;
