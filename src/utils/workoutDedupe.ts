import type { WorkoutRecord } from '../types/health';

const startMinuteOfDay = (time: string): number | null => {
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const zoneTotal = (zones: WorkoutRecord['hrZones']): number =>
  Object.values(zones).reduce((sum, value) => sum + (Number(value) || 0), 0);

const preferenceScore = (workout: WorkoutRecord): number => {
  const sourceScore =
    workout.source === 'igpsport'
      ? 4
      : workout.source === 'fit'
        ? 3
        : workout.source === 'hae'
          ? 2
          : 1;
  return (
    sourceScore * 1_000_000_000 +
    (workout.tss && workout.tss > 0 ? 100_000_000 : 0) +
    (workout.avgHeartRate > 0 ? 10_000_000 : 0) +
    (workout.activeCalories > 0 ? 1_000_000 : 0) +
    (workout.telemetry?.length || 0) * 100 +
    (workout.routeGpxPoints?.length || 0) * 10 +
    workout.durationMinutes
  );
};

const sameWorkoutWindow = (left: WorkoutRecord, right: WorkoutRecord): boolean => {
  if (left.date !== right.date || left.category !== right.category) return false;
  const leftStart = startMinuteOfDay(left.startTime);
  const rightStart = startMinuteOfDay(right.startTime);
  if (leftStart === null || rightStart === null) return false;
  if (Math.abs(leftStart - rightStart) > 2) return false;
  const tolerance = Math.max(
    5,
    Math.round(Math.min(left.durationMinutes, right.durationMinutes) * 0.15)
  );
  return Math.abs(left.durationMinutes - right.durationMinutes) <= tolerance;
};

const mergePair = (left: WorkoutRecord, right: WorkoutRecord): WorkoutRecord => {
  const preferred = preferenceScore(left) >= preferenceScore(right) ? left : right;
  const fallback = preferred === left ? right : left;
  const maxOptional = (a?: number, b?: number): number | undefined =>
    Math.max(a || 0, b || 0) || undefined;
  const longer = <T>(a?: T[], b?: T[]): T[] | undefined =>
    (a?.length || 0) >= (b?.length || 0) ? a : b;
  const routeGpxPoints = longer(preferred.routeGpxPoints, fallback.routeGpxPoints);
  const telemetry = longer(preferred.telemetry, fallback.telemetry);

  return {
    ...preferred,
    durationMinutes: Math.max(preferred.durationMinutes, fallback.durationMinutes),
    activeCalories: Math.max(preferred.activeCalories, fallback.activeCalories),
    totalCalories: Math.max(preferred.totalCalories, fallback.totalCalories),
    avgHeartRate: Math.max(preferred.avgHeartRate, fallback.avgHeartRate),
    maxHeartRate: Math.max(preferred.maxHeartRate, fallback.maxHeartRate),
    distanceKm: maxOptional(preferred.distanceKm, fallback.distanceKm),
    paceAvg: preferred.paceAvg || fallback.paceAvg,
    cadenceAvg: maxOptional(preferred.cadenceAvg, fallback.cadenceAvg),
    elevationGainM: maxOptional(preferred.elevationGainM, fallback.elevationGainM),
    avgPower: maxOptional(preferred.avgPower, fallback.avgPower),
    maxPower: maxOptional(preferred.maxPower, fallback.maxPower),
    normalizedPower: maxOptional(preferred.normalizedPower, fallback.normalizedPower),
    intensityFactor: maxOptional(preferred.intensityFactor, fallback.intensityFactor),
    tss: maxOptional(preferred.tss, fallback.tss),
    leftRightBalance: preferred.leftRightBalance || fallback.leftRightBalance,
    hrZones:
      zoneTotal(preferred.hrZones) >= zoneTotal(fallback.hrZones)
        ? preferred.hrZones
        : fallback.hrZones,
    splits: longer(preferred.splits, fallback.splits),
    hasRoute: Boolean(preferred.hasRoute || fallback.hasRoute || routeGpxPoints?.length),
    hasTelemetry: Boolean(
      preferred.hasTelemetry || fallback.hasTelemetry || telemetry?.length
    ),
    routeGpxPoints,
    telemetry,
  };
};

export const mergeDuplicateWorkouts = (
  workouts: WorkoutRecord[]
): WorkoutRecord[] => {
  const merged: WorkoutRecord[] = [];
  for (const workout of workouts) {
    const existingIndex = merged.findIndex((existing) =>
      sameWorkoutWindow(existing, workout)
    );
    if (existingIndex >= 0) {
      merged[existingIndex] = mergePair(merged[existingIndex], workout);
    } else {
      merged.push(workout);
    }
  }
  return merged;
};
