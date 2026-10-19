import { createHash } from 'node:crypto';
import path from 'node:path';
import { Decoder, Stream } from '@garmin/fitsdk';
import type { GpxCoordinate, WorkoutTelemetryPoint } from '../src/types/health.ts';
import { config } from './config.ts';
import { dateInTimeZone } from './time.ts';

const SEMICIRCLE_TO_DEGREES = 180 / 2 ** 31;

const finiteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const integerOrNull = (value: unknown): number | null => {
  const parsed = finiteNumber(value);
  return parsed === null ? null : Math.round(parsed);
};

const normalizeHrZones = (values: unknown): {
  zone1: number;
  zone2: number;
  zone3: number;
  zone4: number;
  zone5: number;
} => {
  if (!Array.isArray(values)) {
    return { zone1: 0, zone2: 0, zone3: 0, zone4: 0, zone5: 0 };
  }

  const zones = values.slice(0, 5).map((value) => Math.max(0, Number(value) || 0));
  const total = zones.reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return { zone1: 0, zone2: 0, zone3: 0, zone4: 0, zone5: 0 };
  }

  return {
    zone1: Math.round((zones[0] / total) * 100),
    zone2: Math.round((zones[1] / total) * 100),
    zone3: Math.round((zones[2] / total) * 100),
    zone4: Math.round((zones[3] / total) * 100),
    zone5: Math.round((zones[4] / total) * 100),
  };
};

export interface ParsedFitActivity {
  externalId: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
  measuredDate: string;
  localStartTime: string;
  durationSec: number;
  distanceKm: number | null;
  avgSpeedKmh: number | null;
  maxSpeedKmh: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  avgCadence: number | null;
  avgPower: number | null;
  maxPower: number | null;
  normalizedPower: number | null;
  intensityFactor: number | null;
  tss: number | null;
  ascentM: number | null;
  calories: number | null;
  heartRateZones: {
    zone1: number;
    zone2: number;
    zone3: number;
    zone4: number;
    zone5: number;
  };
  routePoints: GpxCoordinate[];
  telemetry: WorkoutTelemetryPoint[];
  rawSession: Record<string, unknown>;
}

const activityTitle = (sport: unknown, subSport: unknown): string => {
  if (sport === 'cycling') {
    if (subSport === 'indoor_cycling' || subSport === 'spin') return '室内骑行';
    if (subSport === 'mountain') return '山地骑行';
    return '公路骑行';
  }
  if (sport === 'running') return '跑步';
  if (sport === 'walking') return '步行';
  if (sport === 'swimming') return '游泳';
  return 'FIT 运动记录';
};

export const safeFitFilename = (filename: string): string => {
  const base = path.basename(filename || 'activity.fit').replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.toLowerCase().endsWith('.fit') ? base : `${base}.fit`;
};

export function parseFitActivity(
  buffer: Buffer,
  originalFilename: string
): ParsedFitActivity {
  const stream = Stream.fromBuffer(buffer);
  if (!Decoder.isFIT(stream)) {
    throw new Error('文件不是有效的 FIT 格式。');
  }

  const decoded = new Decoder(Stream.fromBuffer(buffer)).read({
    convertTypesToStrings: true,
    convertDateTimesToDates: true,
    applyScaleAndOffset: true,
    expandSubFields: true,
    expandComponents: true,
  });
  if (decoded.errors.length > 0) {
    throw new Error(`FIT 解析失败：${decoded.errors[0].message}`);
  }

  const session = decoded.messages.sessionMesgs?.[0];
  if (!session) {
    throw new Error('FIT 文件中未找到有效运动会话。');
  }

  const startDate =
    session.startTime instanceof Date ? session.startTime : new Date(String(session.startTime || ''));
  if (Number.isNaN(startDate.getTime())) {
    throw new Error('FIT 运动会话缺少有效开始时间。');
  }

  const durationSec = Math.round(
    finiteNumber(session.totalTimerTime) ??
      finiteNumber(session.totalElapsedTime) ??
      0
  );
  if (durationSec <= 0) {
    throw new Error('FIT 运动会话缺少有效时长。');
  }

  const records = decoded.messages.recordMesgs || [];
  const routePoints: GpxCoordinate[] = [];
  const telemetry: WorkoutTelemetryPoint[] = [];
  const routeStep = Math.max(1, Math.floor(records.length / 800));
  for (let index = 0; index < records.length; index += routeStep) {
    const record = records[index];
    const timestamp = record.timestamp instanceof Date ? record.timestamp : null;
    const lat = finiteNumber(record.positionLat);
    const lon = finiteNumber(record.positionLong);
    const speed = finiteNumber(record.enhancedSpeed) ?? finiteNumber(record.speed);
    const altitude =
      finiteNumber(record.enhancedAltitude) ?? finiteNumber(record.altitude);
    const balanceRaw = finiteNumber(record.leftRightBalance);

    if (lat !== null && lon !== null) {
      routePoints.push({
        lat: Number((lat * SEMICIRCLE_TO_DEGREES).toFixed(7)),
        lon: Number((lon * SEMICIRCLE_TO_DEGREES).toFixed(7)),
        speedKmh: speed === null ? undefined : Number((speed * 3.6).toFixed(2)),
        elapsedSec: Math.max(
          0,
          Math.round(
            ((timestamp?.getTime() || startDate.getTime()) - startDate.getTime()) / 1000
          )
        ),
      });
    }

    if (
      timestamp ||
      speed !== null ||
      altitude !== null ||
      balanceRaw !== null ||
      finiteNumber(record.heartRate) !== null ||
      finiteNumber(record.cadence) !== null ||
      finiteNumber(record.power) !== null
    ) {
      telemetry.push({
        timestamp: timestamp?.toISOString(),
        elapsedSec: Math.max(
          0,
          Math.round(
            ((timestamp?.getTime() || startDate.getTime()) - startDate.getTime()) / 1000
          )
        ),
        heartRate: integerOrNull(record.heartRate) ?? undefined,
        cadence: integerOrNull(record.cadence) ?? undefined,
        power: integerOrNull(record.power) ?? undefined,
        speedKmh: speed === null ? undefined : Number((speed * 3.6).toFixed(2)),
        altitudeM: altitude === null ? undefined : Number(altitude.toFixed(1)),
        leftRightBalance:
          balanceRaw === null ? undefined : Math.round(balanceRaw & 0x7f),
      });
    }
  }

  const lastRecord = records[records.length - 1];
  const lastTimestamp =
    lastRecord?.timestamp instanceof Date
      ? lastRecord.timestamp
      : session.timestamp instanceof Date
        ? session.timestamp
        : null;

  const sport = typeof session.sport === 'string' ? session.sport : '';
  const subSport = typeof session.subSport === 'string' ? session.subSport : '';
  const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 20);
  const totalDistance = finiteNumber(session.totalDistance);
  const avgSpeed = finiteNumber(session.enhancedAvgSpeed) ?? finiteNumber(session.avgSpeed);
  const maxSpeed = finiteNumber(session.enhancedMaxSpeed) ?? finiteNumber(session.maxSpeed);
  const startLocal = new Intl.DateTimeFormat('en-GB', {
    timeZone: config.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(startDate);

  return {
    externalId: `fit-${hash}`,
    title: activityTitle(sport, subSport) || path.parse(safeFitFilename(originalFilename)).name,
    startedAt: startDate.toISOString(),
    endedAt: lastTimestamp?.toISOString() || null,
    measuredDate: dateInTimeZone(startDate, config.timezone),
    localStartTime: startLocal,
    durationSec,
    distanceKm: totalDistance === null ? null : Number((totalDistance / 1000).toFixed(3)),
    avgSpeedKmh: avgSpeed === null ? null : Number((avgSpeed * 3.6).toFixed(2)),
    maxSpeedKmh: maxSpeed === null ? null : Number((maxSpeed * 3.6).toFixed(2)),
    avgHeartRate: integerOrNull(session.avgHeartRate),
    maxHeartRate: integerOrNull(session.maxHeartRate),
    avgCadence: integerOrNull(session.avgCadence),
    avgPower: integerOrNull(session.avgPower),
    maxPower: integerOrNull(session.maxPower),
    normalizedPower: integerOrNull(session.normalizedPower),
    intensityFactor: finiteNumber(session.intensityFactor),
    tss: finiteNumber(session.trainingStressScore),
    ascentM: finiteNumber(session.totalAscent),
    calories: integerOrNull(session.totalCalories),
    heartRateZones: normalizeHrZones(session.timeInHrZone),
    routePoints,
    telemetry,
    rawSession: session as unknown as Record<string, unknown>,
  };
}
