import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { BodyComposition, BodyMeasurement, DailySummary } from '../../types/health';
import { fetchBodyMeasurements } from '../../api/healthApi';
import { AppleCard } from '../ui/AppleCard';
import {
  Scale,
  Sparkles,
  Droplets,
  Dumbbell,
  ShieldCheck,
  Zap,
  Flame,
  Layers,
  Heart,
  Calendar,
  RefreshCw,
  Gauge,
  SlidersHorizontal,
  Activity,
} from 'lucide-react';
import { Metric30DayModal, type Metric30DayModalData } from './Metric30DayModal';
import { BodySilhouette } from './BodySilhouette';
import { ManageBodyModal, type BodySectionConfig } from './ManageBodyModal';
import { CalendarDatePickerModal } from '../ui/CalendarDatePickerModal';
import { BodyMetricCard } from './BodyMetricCard';
import {
  BODY_METRIC_DEFINITIONS,
  bodyMetricValue,
  type BodyMetricKey,
} from '../../utils/bodyMetrics';

interface BodyDetailsViewProps {
  currentDay: DailySummary;
  days?: Record<string, DailySummary>;
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
  isManageOpen?: boolean;
  onCloseManage?: () => void;
}

const DEFAULT_BODY_SECTIONS: BodySectionConfig[] = [
  {
    id: 'hero',
    name: '身体成分概览与平衡条',
    desc: '体重、体脂率、去脂净重与肌肉脂肪比例',
    visible: true,
    group: 'section',
  },
  {
    id: 'metrics',
    name: '体测指标卡片',
    desc: '逐项展示 Fitdays 返回的所有可读体测指标',
    visible: true,
    group: 'section',
  },
  {
    id: 'silhouette',
    name: '五部位肌脂与双频阻抗',
    desc: '躯干、左右上肢、左右下肢的肌肉量、脂肪量、20k/100k 阻抗与趋势',
    visible: true,
    group: 'section',
  },
  ...BODY_METRIC_DEFINITIONS.map((metric) => ({
    id: `metric:${metric.key}`,
    name: metric.title,
    desc: metric.description,
    visible: true,
    group: 'metric' as const,
  })),
];

const mergeBodySections = (saved: BodySectionConfig[]): BodySectionConfig[] => {
  const savedById = new Map(saved.map((section) => [section.id, section]));
  const known: BodySectionConfig[] = [];
  for (const section of saved) {
    const fallback = DEFAULT_BODY_SECTIONS.find((item) => item.id === section.id);
    if (fallback) {
      known.push({
        ...fallback,
        ...section,
        name: fallback.name,
        desc: fallback.desc,
        group: fallback.group,
      });
    }
  }
  const missing = DEFAULT_BODY_SECTIONS.filter((section) => !savedById.has(section.id));
  return [...known, ...missing];
};

const numberValue = (value: number | null | undefined): number =>
  Number.isFinite(value) ? Number(value) : 0;

const bodyStatusLabel = (weight: number, bodyFat: number): string => {
  if (weight <= 0 || bodyFat <= 0) return '等待体测数据';
  if (bodyFat < 20) return '体脂率较低';
  if (bodyFat <= 24) return '体脂率标准';
  return '体脂率偏高';
};

const measurementToBody = (
  measurement: BodyMeasurement,
  trend: BodyComposition['trend'],
  recentFallback?: BodyMeasurement | null
): BodyComposition => {
  const weight = numberValue(measurement.weightKg);
  const rawFat = numberValue(measurement.bodyFatPercent);
  const bodyFat =
    rawFat > 0
      ? rawFat
      : recentFallback && numberValue(recentFallback.bodyFatPercent) > 0
        ? numberValue(recentFallback.bodyFatPercent)
        : 0;
  const rawBmi = numberValue(measurement.bmi);
  const bmi =
    rawBmi > 0
      ? rawBmi
      : 0;
  const fatMass = Number((weight * (bodyFat / 100)).toFixed(2));
  const rawLean = numberValue(measurement.leanMassKg);
  const leanMass =
    rawLean > 0 && rawLean < weight
      ? rawLean
      : Number((weight - fatMass).toFixed(2));

  const rawSkeletal = numberValue(measurement.skeletalMusclePercent);
  const skeletalMusclePercent =
    rawSkeletal > 0
      ? rawSkeletal
      : recentFallback && numberValue(recentFallback.skeletalMusclePercent) > 0
        ? numberValue(recentFallback.skeletalMusclePercent)
        : 0;
  const skeletalMuscleKg =
    skeletalMusclePercent > 0
      ? Number((weight * (skeletalMusclePercent / 100)).toFixed(2))
      : 0;

  const rawWater = numberValue(measurement.waterPercent);
  const waterPercent =
    rawWater > 0
      ? rawWater
      : recentFallback && numberValue(recentFallback.waterPercent) > 0
        ? numberValue(recentFallback.waterPercent)
        : 0;

  const rawVisceral = numberValue(measurement.visceralFatLevel);
  const visceralFatLevel =
    rawVisceral > 0
      ? rawVisceral
      : recentFallback && numberValue(recentFallback.visceralFatLevel) > 0
        ? numberValue(recentFallback.visceralFatLevel)
        : 0;

  const rawBmr = numberValue(measurement.bmrKcal);
  const bmrKcal =
    rawBmr > 0
      ? rawBmr
      : recentFallback && numberValue(recentFallback.bmrKcal) > 0
        ? numberValue(recentFallback.bmrKcal)
        : 0;

  const rawBone = numberValue(measurement.boneMassKg);
  const boneMassKg =
    rawBone > 0
      ? rawBone
      : recentFallback && numberValue(recentFallback.boneMassKg) > 0
        ? numberValue(recentFallback.boneMassKg)
        : 0;

  const rawProtein = numberValue(measurement.proteinPercent);
  const proteinPercent =
    rawProtein > 0
      ? rawProtein
      : recentFallback && numberValue(recentFallback.proteinPercent) > 0
        ? numberValue(recentFallback.proteinPercent)
        : 0;

  const bodyAge =
    measurement.bodyAge && measurement.bodyAge > 0
      ? measurement.bodyAge
      : (recentFallback?.bodyAge || 0);
  const bodyScore =
    measurement.bodyScore && measurement.bodyScore > 0
      ? measurement.bodyScore
      : (recentFallback?.bodyScore || 0);

  return {
    weightKg: weight,
    bodyFatPercent: bodyFat,
    leanMassKg: leanMass,
    bmi,
    fatMassKg: fatMass,
    statusLabel: bodyStatusLabel(weight, bodyFat),
    trend,
    skeletalMuscleKg,
    skeletalMusclePercent,
    waterPercent,
    visceralFatLevel,
    bmrKcal,
    boneMassKg,
    proteinPercent,
    bodyAge,
    bodyScore,
    measurementId: measurement.id,
    measuredAt: measurement.measuredAt,
    measuredDate: measurement.measuredDate,
  };
};

const formatMeasurementTime = (value: string): string =>
  new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));

const formatMeasurementDate = (value: string): string =>
  new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));

interface HeroTrendPoint {
  date: string;
  value: number;
}

type BodyDateRange = '7d' | '30d' | '90d' | '180d';

const BODY_RANGE_LABELS: Record<BodyDateRange, string> = {
  '7d': '近 7 天',
  '30d': '近 30 天',
  '90d': '近一季',
  '180d': '近半年',
};

const BODY_RANGE_DAYS: Record<BodyDateRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '180d': 180,
};

const todayInShanghai = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const formatTrendValue = (value: number, unit: string): string =>
  `${Number.isInteger(value) ? value : value.toFixed(unit === '%' ? 1 : 2)} ${unit}`;

const HeroTrendPopover: React.FC<{
  title: string;
  unit: string;
  color: string;
  points: HeroTrendPoint[];
  periodLabel: string;
  className?: string;
}> = ({ title, unit, color, points, periodLabel, className }) => {
  const [activeIndex, setActiveIndex] = useState(points.length - 1);
  const width = 300;
  const height = 92;
  const padding = 12;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const minPoint = points[values.indexOf(min)];
  const maxPoint = points[values.indexOf(max)];
  const extrema =
    min === max
      ? [{ point: minPoint, label: '最高 / 最低', yOffset: -5 }]
      : [
          { point: minPoint, label: '最低', yOffset: 12 },
          { point: maxPoint, label: '最高', yOffset: -5 },
        ];
  const range = max - min || 1;
  const coords = points.map((point, index) => ({
    ...point,
    x:
      padding +
      (points.length === 1
        ? (width - padding * 2) / 2
        : (index / (points.length - 1)) * (width - padding * 2)),
    y: height - padding - ((point.value - min) / range) * (height - padding * 2),
  }));
  const path = coords
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    )
    .join(' ');
  const active = coords[Math.min(Math.max(activeIndex, 0), coords.length - 1)];

  const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setActiveIndex(Math.round(ratio * Math.max(points.length - 1, 0)));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={
        className ||
        'absolute right-0 top-full z-[100] mt-2 w-[330px] max-w-[calc(100vw-2rem)] p-3.5 rounded-2xl bg-white/95 dark:bg-neutral-950/95 border border-black/10 dark:border-white/20 shadow-2xl backdrop-blur-2xl'
      }
    >
      <div className="flex items-start justify-between gap-3 text-[10px] mb-2">
        <span className="font-bold text-neutral-800 dark:text-neutral-100">
          {title} · {periodLabel}
          <span className="block mt-0.5 font-normal text-neutral-400">
            周期内 {points.length} 次实测
          </span>
        </span>
        <span className="text-right font-mono font-bold" style={{ color }}>
          {active ? formatTrendValue(active.value, unit) : '—'}
          <span className="block mt-0.5 text-[9px] font-normal text-neutral-400">
            {active?.date || '—'}
          </span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[92px] overflow-visible"
        onMouseMove={handleMove}
        onMouseLeave={() => setActiveIndex(points.length - 1)}
      >
        {[0, 1, 2].map((line) => (
          <line
            key={line}
            x1={padding}
            x2={width - padding}
            y1={padding + (line / 2) * (height - padding * 2)}
            y2={padding + (line / 2) * (height - padding * 2)}
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeDasharray="3 4"
          />
        ))}
        <path
          d={`${path} L ${coords[coords.length - 1].x.toFixed(1)} ${height - padding} L ${coords[0].x.toFixed(1)} ${height - padding} Z`}
          fill={color}
          fillOpacity="0.08"
        />
        <path d={path} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        {(points.length <= 30 ? coords : []).map((point, index) => (
          <circle
            key={`${point.date}-${index}`}
            cx={point.x}
            cy={point.y}
            r={index === activeIndex ? 3.6 : 2.3}
            fill="white"
            stroke={color}
            strokeWidth={index === activeIndex ? 2 : 1.2}
          />
        ))}
        {minPoint && maxPoint && (
          <>
            {extrema.map(({ point, label, yOffset }) => {
              const pointIndex = points.indexOf(point);
              const coord = coords[pointIndex];
              return (
                <g key={label}>
                  <circle cx={coord.x} cy={coord.y} r="3.4" fill={color} />
                  <text
                    x={Math.min(Math.max(coord.x, 22), width - 22)}
                    y={coord.y + yOffset}
                    textAnchor="middle"
                    className="fill-neutral-500 text-[8px] font-mono"
                  >
                    {label} {formatTrendValue(point.value, unit)}
                  </text>
                </g>
              );
            })}
          </>
        )}
        {active && (
          <>
            <line
              x1={active.x}
              x2={active.x}
              y1={padding}
              y2={height - padding}
              stroke={color}
              strokeOpacity="0.35"
              strokeDasharray="3 3"
            />
            <circle cx={active.x} cy={active.y} r="4" fill={color} />
          </>
        )}
      </svg>
      <div className="grid grid-cols-3 gap-1.5 mt-2 text-[9px] font-mono">
        <div className="rounded-lg bg-black/[0.03] dark:bg-white/[0.05] px-2 py-1.5">
          <span className="block text-neutral-400">明细</span>
          <span className="block mt-0.5 text-neutral-500 dark:text-neutral-400">
            {active?.date || '—'}
          </span>
          <span className="block font-bold text-neutral-800 dark:text-neutral-100">
            {active ? formatTrendValue(active.value, unit) : '—'}
          </span>
        </div>
        <div className="rounded-lg bg-black/[0.03] dark:bg-white/[0.05] px-2 py-1.5">
          <span className="block text-neutral-400">最高</span>
          <span className="block mt-0.5 text-neutral-500 dark:text-neutral-400">
            {maxPoint?.date || '—'}
          </span>
          <span className="block font-bold text-neutral-800 dark:text-neutral-100">
            {maxPoint ? formatTrendValue(maxPoint.value, unit) : '—'}
          </span>
        </div>
        <div className="rounded-lg bg-black/[0.03] dark:bg-white/[0.05] px-2 py-1.5">
          <span className="block text-neutral-400">最低</span>
          <span className="block mt-0.5 text-neutral-500 dark:text-neutral-400">
            {minPoint?.date || '—'}
          </span>
          <span className="block font-bold text-neutral-800 dark:text-neutral-100">
            {minPoint ? formatTrendValue(minPoint.value, unit) : '—'}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export const BodyDetailsView: React.FC<BodyDetailsViewProps> = ({
  currentDay,
  days: _days = {},
  selectedDate: _selectedDate,
  onSelectDate,
  isManageOpen = false,
  onCloseManage,
}) => {
  const [sectionsConfig, setSectionsConfig] = useState<BodySectionConfig[]>(() => {
    try {
      const saved = localStorage.getItem('apple_health_body_sections_v4');
      if (saved) {
        return mergeBodySections(JSON.parse(saved) as BodySectionConfig[]);
      }
      const legacy = localStorage.getItem('apple_health_body_sections_v3');
      if (legacy) {
        return mergeBodySections(JSON.parse(legacy) as BodySectionConfig[]);
      }
    } catch {
      // Use defaults when local preferences are unavailable.
    }
    return DEFAULT_BODY_SECTIONS;
  });
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [measurementsLoading, setMeasurementsLoading] = useState(true);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const [modalData, setModalData] = useState<Metric30DayModalData | null>(null);
  const [activeDateRange, setActiveDateRange] = useState<BodyDateRange>('7d');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [focusedDate, setFocusedDate] = useState<string | null>(() => todayInShanghai());
  const [hoveredHeroMetric, setHoveredHeroMetric] = useState<
    'weight' | 'bodyFat' | 'lean' | null
  >(null);
  const [isBodyEditorOpen, setIsBodyEditorOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('apple_health_body_sections_v4', JSON.stringify(sectionsConfig));
    } catch {
      // Local preferences are optional.
    }
  }, [sectionsConfig]);

  useEffect(() => {
    let active = true;
    void fetchBodyMeasurements()
      .then((result) => {
        if (!active) return;
        setMeasurements(
          [...result.measurements].sort((left, right) =>
            left.measuredAt.localeCompare(right.measuredAt)
          )
        );
      })
      .catch(() => {
        if (active) setMeasurements([]);
      })
      .finally(() => {
        if (active) setMeasurementsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentDay.body.measurementId]);

  const allDates = useMemo(
    () =>
      Array.from(
        new Set(
          measurements
            .filter((measurement) => Boolean(measurement.measuredDate))
            .map((measurement) => measurement.measuredDate)
        )
      ).sort(),
    [measurements]
  );
  const currentDate = focusedDate || todayInShanghai();
  const measurementsForDate = useMemo(
    () =>
      measurements
        .filter((measurement) => measurement.measuredDate === currentDate)
        .sort((left, right) => right.measuredAt.localeCompare(left.measuredAt)),
    [currentDate, measurements]
  );

  useEffect(() => {
    if (measurementsForDate.some((measurement) => measurement.id === selectedMeasurementId)) {
      return;
    }
    const fallbackId =
      currentDay.body.measurementId &&
      measurementsForDate.some((measurement) => measurement.id === currentDay.body.measurementId)
        ? currentDay.body.measurementId
        : measurementsForDate[0]?.id || null;
    setSelectedMeasurementId(fallbackId);
  }, [currentDay.body.measurementId, measurementsForDate, selectedMeasurementId]);

  const measurementsUpToDate = useMemo(
    () => measurements.filter((measurement) => measurement.measuredDate <= currentDate),
    [currentDate, measurements]
  );

  const rangeStartDate = useMemo(() => {
    const anchor = new Date(`${currentDate}T12:00:00+08:00`);
    anchor.setDate(anchor.getDate() - (BODY_RANGE_DAYS[activeDateRange] - 1));
    return anchor.toISOString().slice(0, 10);
  }, [activeDateRange, currentDate]);

  const rangeMeasurements = useMemo(
    () =>
      measurements.filter(
        (measurement) =>
          measurement.measuredDate >= rangeStartDate &&
          measurement.measuredDate <= currentDate
      ),
    [currentDate, measurements, rangeStartDate]
  );

  const bodyTrend = useMemo(
    () =>
      measurementsUpToDate
        .filter(
          (measurement) =>
            measurement.weightKg !== null && numberValue(measurement.weightKg) > 0
        )
        .slice(-8)
        .map((measurement) => {
          const rawF = numberValue(measurement.bodyFatPercent);
          return {
            date: measurement.measuredDate.slice(5),
            weight: numberValue(measurement.weightKg),
            bodyFat: rawF > 0 ? rawF : 0,
          };
        }),
    [measurementsUpToDate]
  );

  const recentValidMeasurement = useMemo(
    () =>
      measurementsUpToDate
        .filter((m) => m.bodyFatPercent !== null && numberValue(m.bodyFatPercent) > 0)
        .slice(-1)[0] || null,
    [measurementsUpToDate]
  );

  const selectedMeasurement =
    measurementsForDate.find((measurement) => measurement.id === selectedMeasurementId) || null;
  const rawBody = selectedMeasurement
    ? measurementToBody(selectedMeasurement, bodyTrend, recentValidMeasurement)
    : currentDay.body;

  const body = rawBody;

  const historyPoints = (key: BodyMetricKey) =>
    rangeMeasurements
      .map((measurement) => {
        return {
          date: measurement.measuredDate.slice(5),
          value: bodyMetricValue(measurement, key),
          measuredAt: measurement.measuredAt,
        };
      })
      .filter(
        (point): point is { date: string; value: number; measuredAt: string } =>
          point.value !== null && point.value > 0
      );

  const heroSeries = (key: 'weightKg' | 'bodyFatPercent' | 'leanMassKg'): HeroTrendPoint[] =>
    rangeMeasurements
      .filter((measurement) => measurement[key] !== null)
      .map((measurement) => {
        let val = numberValue(measurement[key]);
        if (key === 'leanMassKg' && val <= 0 && measurement.weightKg) {
          const fat = numberValue(measurement.bodyFatPercent);
          val =
            fat > 0
              ? Number((measurement.weightKg * (1 - fat / 100)).toFixed(2))
              : 0;
        }
        return {
          date: measurement.measuredDate.slice(5),
          value: val,
        };
      })
      .filter((p) => p.value > 0);

  const latestMeasurement = selectedMeasurement ||
    measurements.find((measurement) => measurement.id === body.measurementId) ||
    measurementsUpToDate[measurementsUpToDate.length - 1] ||
    null;

  const handleQuickRange = (rangeKey: typeof activeDateRange) => {
    setActiveDateRange(rangeKey);
  };

  const isVisible = (id: string) =>
    sectionsConfig.find((section) => section.id === id)?.visible !== false;

  const leanPercent =
    body.weightKg > 0 ? Math.round((body.leanMassKg / body.weightKg) * 100) : 0;
  const fatPercent = Math.round(body.bodyFatPercent);

  const metricVisuals: Record<
    BodyMetricKey,
    {
      icon: React.ComponentType<{ className?: string }>;
      color: string;
    }
  > = {
    weightKg: { icon: Scale, color: '#64748B' },
    bmi: { icon: Gauge, color: '#0EA5E9' },
    bodyFatPercent: { icon: Activity, color: '#F59E0B' },
    fatMassKg: { icon: Layers, color: '#F97316' },
    leanMassKg: { icon: Zap, color: '#3B82F6' },
    skeletalMuscleKg: { icon: Dumbbell, color: '#6366F1' },
    skeletalMusclePercent: { icon: Dumbbell, color: '#818CF8' },
    musclePercent: { icon: Dumbbell, color: '#8B5CF6' },
    waterPercent: { icon: Droplets, color: '#0EA5E9' },
    visceralFatLevel: { icon: ShieldCheck, color: '#10B981' },
    bmrKcal: { icon: Flame, color: '#FA114F' },
    boneMassKg: { icon: Layers, color: '#F59E0B' },
    proteinPercent: { icon: Sparkles, color: '#14B8A6' },
    subcutaneousFatPercent: { icon: Layers, color: '#FB7185' },
    bodyAge: { icon: Heart, color: '#A855F7' },
    heartRate: { icon: Heart, color: '#F43F5E' },
    bodyScore: { icon: Sparkles, color: '#22C55E' },
    smi: { icon: Activity, color: '#06B6D4' },
    whr: { icon: Gauge, color: '#F97316' },
  };
  const metricOrder = new Map(
    sectionsConfig
      .filter((section) => section.id.startsWith('metric:'))
      .map((section, index) => [section.id.slice('metric:'.length), index])
  );
  const visibleMetricDefinitions = BODY_METRIC_DEFINITIONS.filter(
    (metric) => isVisible(`metric:${metric.key}`)
  ).sort(
    (left, right) =>
      (metricOrder.get(left.key) ?? Number.MAX_SAFE_INTEGER) -
      (metricOrder.get(right.key) ?? Number.MAX_SAFE_INTEGER)
  );
  const activeMeasurement = selectedMeasurement;

  return (
    <div className="space-y-5">
      <AppleCard className="p-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/30 flex-shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-neutral-900 dark:text-white block">
                体脂秤数据跨度查阅
              </span>
              <span className="text-[10px] text-neutral-400 inline-flex items-center gap-1.5">
                当前日期 {currentDate} · 当日 {measurementsForDate.length} 次测量 · 共收录 {allDates.length} 天
                {measurementsLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-black/5 dark:bg-white/5 p-0.5 rounded-xl border border-black/5 dark:border-white/5">
              {[
                { key: '7d', label: '近7天' },
                { key: '30d', label: '近30天' },
                { key: '90d', label: '近一季' },
                { key: '180d', label: '近半年' },
              ].map((range) => (
                <button
                  key={range.key}
                  type="button"
                  onClick={() => handleQuickRange(range.key as typeof activeDateRange)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeDateRange === range.key
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsCalendarOpen(true)}
              className="px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-neutral-800 dark:text-neutral-200 border-black/5 dark:border-white/10 shadow-sm"
            >
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
              <span>{currentDate}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsBodyEditorOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-500/15 dark:text-indigo-300"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>编辑卡片</span>
            </button>
          </div>
        </div>
      </AppleCard>

      {isVisible('hero') && (
        <AppleCard className="relative z-20 overflow-visible">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 to-orange-500 p-0.5 shadow-xl shadow-amber-500/20 flex-shrink-0">
                <div className="w-full h-full rounded-[22px] bg-white dark:bg-neutral-950 flex items-center justify-center">
                  <Scale className="w-10 h-10 text-amber-500" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight m-0">
                    身体详情 · 智能体脂秤深度分析
                  </h2>
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20">
                    {body.statusLabel}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {latestMeasurement
                    ? `最近测量：${formatMeasurementDate(latestMeasurement.measuredAt)}`
                    : '暂无体测时间'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-start gap-3 self-start md:self-auto">
              {[
                {
                  key: 'weight' as const,
                  label: '当前体重',
                  value: body.weightKg > 0 ? body.weightKg : '—',
                  unit: 'kg',
                  color: '#64748B',
                  seriesKey: 'weightKg' as const,
                },
                {
                  key: 'bodyFat' as const,
                  label: '体脂率',
                  value: body.bodyFatPercent > 0 ? body.bodyFatPercent : '—',
                  unit: '%',
                  color: '#F59E0B',
                  seriesKey: 'bodyFatPercent' as const,
                },
                {
                  key: 'lean' as const,
                  label: '去脂瘦体重',
                  value: body.leanMassKg > 0 ? body.leanMassKg : '—',
                  unit: 'kg',
                  color: '#6366F1',
                  seriesKey: 'leanMassKg' as const,
                },
              ].map((metric) => {
                const series = heroSeries(metric.seriesKey);
                return (
                  <div
                    key={metric.key}
                    className="relative min-w-[108px] rounded-2xl border border-transparent hover:border-black/10 dark:hover:border-white/10 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] px-2.5 py-1.5 transition-all cursor-default"
                    onMouseEnter={() => setHoveredHeroMetric(metric.key)}
                    onMouseLeave={() => setHoveredHeroMetric(null)}
                  >
                    <span className="text-[11px] text-neutral-400 block">{metric.label}</span>
                    <span
                      className="text-2xl font-black font-mono"
                      style={{ color: metric.color }}
                    >
                      {metric.value}{' '}
                      <span className="text-xs font-normal text-neutral-400">{metric.unit}</span>
                    </span>
                    <span className="block text-[9px] text-neutral-400 mt-0.5">
                      悬停查看{BODY_RANGE_LABELS[activeDateRange]}趋势 · {series.length} 次
                    </span>
                    {hoveredHeroMetric === metric.key && series.length > 0 && (
                      <HeroTrendPopover
                        title={metric.label}
                        unit={metric.unit}
                        color={metric.color}
                        points={series}
                        periodLabel={BODY_RANGE_LABELS[activeDateRange]}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-black/5 dark:border-white/5">
            {body.weightKg > 0 && body.leanMassKg > 0 ? (
              <>
                <div className="flex justify-between items-center text-xs mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                      去脂瘦体重: {body.leanMassKg} kg ({leanPercent}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                      脂肪总量: {body.fatMassKg} kg ({fatPercent}%)
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  </div>
                </div>
                <div className="w-full h-3 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden flex">
                  <div
                    style={{ width: `${leanPercent}%` }}
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                  />
                  <div
                    style={{ width: `${fatPercent}%` }}
                    className="h-full bg-gradient-to-r from-amber-400 to-orange-400"
                  />
                </div>
              </>
            ) : (
              <div className="py-4 text-center text-xs text-neutral-400">
                尚无体重与体脂数据，暂不绘制身体成分比例。
              </div>
            )}
          </div>
        </AppleCard>
      )}

      {isVisible('metrics') && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {visibleMetricDefinitions.map((metric) => {
            const visual = metricVisuals[metric.key];
            const points = historyPoints(metric.key);
            const currentValue = bodyMetricValue(activeMeasurement, metric.key);
            return (
              <BodyMetricCard
                key={metric.key}
                definition={metric}
                measurement={activeMeasurement}
                measurements={measurementsUpToDate}
                color={visual.color}
                icon={visual.icon}
                dateLabel={currentDate}
                onClick={() => {
                  if (points.length === 0) return;
                  setModalData({
                    title: metric.title,
                    unit: metric.unit,
                    current:
                      currentValue === null
                        ? '—'
                        : currentValue.toFixed(metric.decimals),
                    eval: `${points.length} 次实测记录`,
                    standard: metric.description,
                    points: points.map((point) => ({
                      date: point.date,
                      value: point.value,
                    })),
                    periodLabel: BODY_RANGE_LABELS[activeDateRange],
                  });
                }}
              />
            );
          })}
        </div>
      )}

      {isVisible('silhouette') && (
        <BodySilhouette
          measurement={selectedMeasurement}
          measurements={measurementsUpToDate}
        />
      )}

      <Metric30DayModal data={modalData} onClose={() => setModalData(null)} />

      <CalendarDatePickerModal
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        selectedDate={currentDate}
        availableDates={allDates}
        onSelectDate={(date) => {
          setFocusedDate(date);
          onSelectDate?.(date);
        }}
        title="身体详情 · 历史体测数据日期选择"
        closeOnSelect={false}
        footer={
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-200">
                当日测量明细
              </span>
              <span className="text-[10px] text-neutral-400 font-mono">
                {currentDate} · {measurementsForDate.length} 次
              </span>
            </div>
            {measurementsForDate.length > 0 ? (
              <div className="space-y-1.5">
                {measurementsForDate.map((measurement) => (
                  <div
                    key={measurement.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white/70 dark:bg-black/25 border border-black/5 dark:border-white/10 px-2.5 py-1.5 text-[10px] font-mono"
                  >
                    <span className="text-neutral-500 dark:text-neutral-400">
                      {formatMeasurementTime(measurement.measuredAt)}
                    </span>
                    <span className="text-neutral-900 dark:text-white font-bold">
                      {measurement.weightKg === null ? '—' : `${measurement.weightKg} kg`}
                    </span>
                    <span className="text-amber-500">
                      体脂 {measurement.bodyFatPercent && measurement.bodyFatPercent > 0 ? `${measurement.bodyFatPercent}%` : '—'}
                    </span>
                    <span className="text-indigo-500">
                      去脂 {measurement.leanMassKg && measurement.leanMassKg > 0 && measurement.leanMassKg < measurement.weightKg! ? `${measurement.leanMassKg} kg` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-neutral-400 py-1">
                该日期没有体脂秤测量记录，可选择带绿点的日期。
              </p>
            )}
          </div>
        }
      />

      {(isManageOpen || isBodyEditorOpen) && (
        <ManageBodyModal
          isOpen
          onClose={() => {
            setIsBodyEditorOpen(false);
            onCloseManage?.();
          }}
          sections={sectionsConfig}
          onChange={setSectionsConfig}
          onReset={() => setSectionsConfig(DEFAULT_BODY_SECTIONS)}
        />
      )}
    </div>
  );
};
