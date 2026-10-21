import type { DailySummary } from '../types/health';

export type HeartRateMetric = 'latest' | 'resting' | 'sleeping' | 'walking' | 'hrv' | 'peak';

export interface MetricSnapshot {
  value: number | null;
  date: string | null;
  isSelectedDate: boolean;
}

export interface DailyMetricPoint {
  date: string;
  shortDate: string;
  weekday: string;
  value: number | null;
  minHr: number | null;
  maxHr: number | null;
}

export interface WeeklyMetricPoint {
  startDate: string;
  endDate: string;
  label: string;
  value: number | null;
  coverageDays: number;
}

export const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return Number.NaN;
  return Math.min(24 * 60, Math.max(0, hours * 60 + minutes));
};

export const average = (values: number[]): number | null => {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
};

const parseDate = (date: string): Date => new Date(`${date}T12:00:00`);

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date: string, days: number): string => {
  const value = parseDate(date);
  value.setDate(value.getDate() + days);
  return formatDate(value);
};

const weekdayLabel = (date: string): string =>
  new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(parseDate(date));

const shortDateLabel = (date: string): string => date.slice(5);

export const deriveSleepingHr = (day: DailySummary | undefined): number | null => {
  if (!day) return null;
  if (day.vitals.sleepingHr > 0) return day.vitals.sleepingHr;
  if (!day.sleep || day.sleep.totalMinutes <= 0) return null;

  const bedMinutes = timeToMinutes(day.sleep.bedTime);
  const wakeMinutes = timeToMinutes(day.sleep.wakeTime);
  if (!Number.isFinite(bedMinutes) || !Number.isFinite(wakeMinutes)) return null;

  const values = (day.heartRateTimeline || [])
    .filter((point) => {
      const minutes = timeToMinutes(point.time);
      if (!Number.isFinite(minutes) || point.hr < 35 || point.hr > 120) return false;
      return bedMinutes <= wakeMinutes
        ? minutes >= bedMinutes && minutes <= wakeMinutes
        : minutes >= bedMinutes || minutes <= wakeMinutes;
    })
    .map((point) => point.hr);

  return average(values);
};

const heartRateStats = (day: DailySummary | undefined) => {
  const values = (day?.heartRateTimeline || [])
    .map((point) => point.hr)
    .filter((value) => value >= 30 && value <= 230);
  return {
    average: average(values),
    min: values.length > 0 ? Math.min(...values) : null,
    max: values.length > 0 ? Math.max(...values) : null,
  };
};

export const metricValueForDay = (
  day: DailySummary | undefined,
  metric: HeartRateMetric
): number | null => {
  if (!day) return null;
  switch (metric) {
    case 'resting':
      return day.vitals.restingHr > 0 ? day.vitals.restingHr : null;
    case 'sleeping':
      return deriveSleepingHr(day);
    case 'walking':
      return day.vitals.walkingHrAvg > 0
        ? day.vitals.walkingHrAvg
        : day.mobility.walkingHrAvg > 0
          ? day.mobility.walkingHrAvg
          : null;
    case 'hrv':
      return day.vitals.hrvCurrent > 0 ? day.vitals.hrvCurrent : null;
    case 'peak':
      return heartRateStats(day).max;
    case 'latest':
      return heartRateStats(day).average;
  }
};

export const resolveMetricSnapshot = (
  days: Record<string, DailySummary>,
  selectedDate: string,
  metric: HeartRateMetric
): MetricSnapshot => {
  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(selectedDate, -offset);
    const value = metricValueForDay(days[date], metric);
    if (value !== null && value > 0) {
      return {
        value,
        date,
        isSelectedDate: offset === 0,
      };
    }
  }
  return { value: null, date: null, isSelectedDate: false };
};

export const buildDailyMetricSeries = (
  days: Record<string, DailySummary>,
  selectedDate: string,
  metric: HeartRateMetric,
  count = 7
): DailyMetricPoint[] => {
  const points: DailyMetricPoint[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = addDays(selectedDate, -offset);
    const day = days[date];
    const stats = heartRateStats(day);
    points.push({
      date,
      shortDate: shortDateLabel(date),
      weekday: weekdayLabel(date),
      value: metricValueForDay(day, metric),
      minHr: stats.min,
      maxHr: stats.max,
    });
  }
  return points;
};

export const buildWeeklyMetricSeries = (
  days: Record<string, DailySummary>,
  selectedDate: string,
  metric: HeartRateMetric
): WeeklyMetricPoint[] => {
  const weeks: WeeklyMetricPoint[] = [];
  for (let week = 3; week >= 0; week -= 1) {
    const endDate = addDays(selectedDate, -week * 7);
    const startDate = addDays(endDate, -6);
    const values: number[] = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const date = addDays(startDate, offset);
      const value = metricValueForDay(days[date], metric);
      if (value !== null && value > 0) values.push(value);
    }
    weeks.push({
      startDate,
      endDate,
      label: week === 0 ? '本周' : `${week}周前`,
      value: average(values),
      coverageDays: values.length,
    });
  }
  return weeks;
};
