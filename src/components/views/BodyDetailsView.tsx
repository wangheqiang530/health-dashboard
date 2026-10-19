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
  Clock3,
  RefreshCw,
} from 'lucide-react';
import { Metric30DayModal, type Metric30DayModalData } from './Metric30DayModal';
import { BodySilhouette } from './BodySilhouette';
import { ManageBodyModal, type BodySectionConfig } from './ManageBodyModal';
import { CalendarDatePickerModal } from '../ui/CalendarDatePickerModal';

interface BodyDetailsViewProps {
  currentDay: DailySummary;
  days?: Record<string, DailySummary>;
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
  isManageOpen?: boolean;
  onCloseManage?: () => void;
}

type MeasurementKey =
  | 'skeletalMuscleKg'
  | 'waterPercent'
  | 'visceralFatLevel'
  | 'bmrKcal'
  | 'boneMassKg'
  | 'proteinPercent'
  | 'bodyAge'
  | 'leanMassKg';

const DEFAULT_BODY_SECTIONS: BodySectionConfig[] = [
  {
    id: 'hero',
    name: '身体成分概览与平衡条',
    desc: '体重、体脂率、去脂净重与肌肉脂肪比例',
    visible: true,
  },
  {
    id: 'metrics',
    name: '体脂秤核心指标',
    desc: '骨骼肌、水分率、内脏脂肪、基础代谢、骨量等实际记录',
    visible: true,
  },
  {
    id: 'silhouette',
    name: '五部位肌脂与双频阻抗',
    desc: '躯干、左右上肢、左右下肢的肌肉量、脂肪量、20k/100k 阻抗与趋势',
    visible: true,
  },
];

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
  trend: BodyComposition['trend']
): BodyComposition => {
  const weight = numberValue(measurement.weightKg);
  const bodyFat = numberValue(measurement.bodyFatPercent);
  return {
    weightKg: weight,
    bodyFatPercent: bodyFat,
    leanMassKg: numberValue(measurement.leanMassKg),
    bmi: numberValue(measurement.bmi),
    fatMassKg:
      weight > 0 && bodyFat > 0 ? Number((weight * (bodyFat / 100)).toFixed(2)) : 0,
    statusLabel: bodyStatusLabel(weight, bodyFat),
    trend,
    skeletalMuscleKg: measurement.skeletalMuscleKg ?? undefined,
    skeletalMusclePercent: measurement.skeletalMusclePercent ?? undefined,
    waterPercent: measurement.waterPercent ?? undefined,
    visceralFatLevel: measurement.visceralFatLevel ?? undefined,
    bmrKcal: measurement.bmrKcal ?? undefined,
    boneMassKg: measurement.boneMassKg ?? undefined,
    proteinPercent: measurement.proteinPercent ?? undefined,
    bodyAge: measurement.bodyAge ?? undefined,
    bodyScore: measurement.bodyScore ?? undefined,
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

export const BodyDetailsView: React.FC<BodyDetailsViewProps> = ({
  currentDay,
  days = {},
  selectedDate,
  onSelectDate,
  isManageOpen = false,
  onCloseManage,
}) => {
  const [sectionsConfig, setSectionsConfig] = useState<BodySectionConfig[]>(() => {
    try {
      const saved = localStorage.getItem('apple_health_body_sections_v3');
      if (saved) return JSON.parse(saved) as BodySectionConfig[];
    } catch {
      // Use defaults when local preferences are unavailable.
    }
    return DEFAULT_BODY_SECTIONS;
  });
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [measurementsLoading, setMeasurementsLoading] = useState(true);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null);
  const [modalData, setModalData] = useState<Metric30DayModalData | null>(null);
  const [activeDateRange, setActiveDateRange] = useState<'today' | '7d' | '30d' | '90d' | '180d'>('today');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [focusedDate, setFocusedDate] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('apple_health_body_sections_v3', JSON.stringify(sectionsConfig));
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
  }, []);

  const allDates = Array.from(
    new Set([
      ...Object.keys(days),
      ...measurements.map((measurement) => measurement.measuredDate),
    ])
  ).sort();
  const latestMeasurementDate = measurements[measurements.length - 1]?.measuredDate;
  const currentDate =
    focusedDate || latestMeasurementDate || selectedDate || currentDay.date;
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

  const bodyTrend = useMemo(
    () =>
      measurementsUpToDate
        .filter(
          (measurement) =>
            measurement.weightKg !== null && measurement.bodyFatPercent !== null
        )
        .slice(-8)
        .map((measurement) => ({
          date: measurement.measuredDate.slice(5),
          weight: numberValue(measurement.weightKg),
          bodyFat: numberValue(measurement.bodyFatPercent),
        })),
    [measurementsUpToDate]
  );

  const selectedMeasurement =
    measurementsForDate.find((measurement) => measurement.id === selectedMeasurementId) || null;
  const body = selectedMeasurement
    ? measurementToBody(selectedMeasurement, bodyTrend)
    : currentDay.body;

  const historyPoints = (key: MeasurementKey) =>
    measurementsUpToDate
      .filter((measurement) => measurement[key] !== null)
      .slice(-30)
      .map((measurement) => ({
        date: measurement.measuredDate.slice(5),
        value: numberValue(measurement[key]),
        measuredAt: measurement.measuredAt,
      }));

  const latestMeasurement = selectedMeasurement ||
    measurements.find((measurement) => measurement.id === body.measurementId) ||
    measurementsUpToDate[measurementsUpToDate.length - 1] ||
    null;

  const handleQuickRange = (rangeKey: typeof activeDateRange) => {
    setActiveDateRange(rangeKey);
    if (!onSelectDate || allDates.length === 0) return;
    if (rangeKey === 'today') {
      const latestDate = allDates[allDates.length - 1];
      setFocusedDate(latestDate);
      onSelectDate(latestDate);
      return;
    }
    const daysBack =
      rangeKey === '7d' ? 7 : rangeKey === '30d' ? 30 : rangeKey === '90d' ? 90 : 180;
    const anchor = new Date(`${allDates[allDates.length - 1]}T12:00:00+08:00`);
    anchor.setDate(anchor.getDate() - daysBack);
    const target = anchor.toISOString().slice(0, 10);
    const closest = allDates.filter((date) => date <= target).slice(-1)[0] || allDates[0];
    if (closest) {
      setFocusedDate(closest);
      onSelectDate(closest);
    }
  };

  const isVisible = (id: string) =>
    sectionsConfig.find((section) => section.id === id)?.visible !== false;

  const leanPercent =
    body.weightKg > 0 ? Math.round((body.leanMassKg / body.weightKg) * 100) : 0;
  const fatPercent = Math.round(body.bodyFatPercent);

  const metrics: Array<{
    title: string;
    key: MeasurementKey;
    unit: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    reference: string;
  }> = [
    {
      title: '骨骼肌量',
      key: 'skeletalMuscleKg',
      unit: 'kg',
      icon: Dumbbell,
      color: '#6366F1',
      reference: '由体脂秤骨骼肌率与体重计算',
    },
    {
      title: '身体水分率',
      key: 'waterPercent',
      unit: '%',
      icon: Droplets,
      color: '#0EA5E9',
      reference: 'Fitdays 实测水分率',
    },
    {
      title: '内脏脂肪等级',
      key: 'visceralFatLevel',
      unit: '级',
      icon: ShieldCheck,
      color: '#10B981',
      reference: 'Fitdays 实测等级',
    },
    {
      title: '基础代谢率',
      key: 'bmrKcal',
      unit: 'kcal',
      icon: Flame,
      color: '#FA114F',
      reference: 'Fitdays 实测基础代谢',
    },
    {
      title: '骨量',
      key: 'boneMassKg',
      unit: 'kg',
      icon: Layers,
      color: '#F59E0B',
      reference: 'Fitdays 实测骨量',
    },
    {
      title: '蛋白质率',
      key: 'proteinPercent',
      unit: '%',
      icon: Sparkles,
      color: '#14B8A6',
      reference: 'Fitdays 实测蛋白质率',
    },
    {
      title: '身体年龄',
      key: 'bodyAge',
      unit: '岁',
      icon: Heart,
      color: '#A855F7',
      reference: 'Fitdays 体脂秤估算值',
    },
    {
      title: '去脂体重',
      key: 'leanMassKg',
      unit: 'kg',
      icon: Zap,
      color: '#3B82F6',
      reference: 'Fitdays 实测去脂体重',
    },
  ];

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
              <span className="text-[10px] text-neutral-400">
                当前日期 {currentDate} · 当日 {measurementsForDate.length} 次测量 · 共收录 {allDates.length} 天
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-black/5 dark:bg-white/5 p-0.5 rounded-xl border border-black/5 dark:border-white/5">
              {[
                { key: 'today', label: '今日' },
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
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/5">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 mb-2">
            <Clock3 className="w-3.5 h-3.5 text-amber-500" />
            <span>当日测量明细</span>
            {measurementsLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
          </div>
          {measurementsForDate.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {measurementsForDate.map((measurement) => {
                const selected = measurement.id === selectedMeasurement?.id;
                return (
                  <button
                    key={measurement.id}
                    type="button"
                    onClick={() => setSelectedMeasurementId(measurement.id)}
                    className={`flex-shrink-0 min-w-[128px] text-left px-3 py-2 rounded-xl border transition-all ${
                      selected
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300'
                        : 'bg-black/[0.02] dark:bg-white/[0.03] border-black/5 dark:border-white/5 text-neutral-600 dark:text-neutral-300 hover:border-amber-500/25'
                    }`}
                  >
                    <span className="block text-[10px] font-mono opacity-70">
                      {formatMeasurementTime(measurement.measuredAt)}
                    </span>
                    <span className="block text-sm font-bold font-mono mt-0.5">
                      {measurement.weightKg === null ? '—' : measurement.weightKg} kg
                    </span>
                    <span className="block text-[10px] mt-0.5">
                      体脂 {measurement.bodyFatPercent === null ? '—' : `${measurement.bodyFatPercent}%`}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-neutral-400">
              {measurementsLoading
                ? '正在读取体脂秤历史记录...'
                : latestMeasurement
                ? `当日没有新的体测记录，当前显示 ${formatMeasurementDate(latestMeasurement.measuredAt)} 的最近一次测量。`
                : '尚未收到体脂秤测量记录。'}
            </p>
          )}
        </div>
      </AppleCard>

      {isVisible('hero') && (
        <AppleCard>
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

            <div className="flex flex-wrap items-center gap-6 self-start md:self-auto">
              <div className="text-right">
                <span className="text-[11px] text-neutral-400 block">当前体重</span>
                <span className="text-2xl font-black text-neutral-900 dark:text-white font-mono">
                  {body.weightKg > 0 ? body.weightKg : '—'}{' '}
                  <span className="text-xs font-normal text-neutral-400">kg</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-neutral-400 block">体脂率</span>
                <span className="text-2xl font-black text-amber-500 font-mono">
                  {body.bodyFatPercent > 0 ? body.bodyFatPercent : '—'}{' '}
                  <span className="text-xs font-normal text-neutral-400">%</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-neutral-400 block">去脂瘦体重</span>
                <span className="text-2xl font-black text-indigo-500 font-mono">
                  {body.leanMassKg > 0 ? body.leanMassKg : '—'}{' '}
                  <span className="text-xs font-normal text-neutral-400">kg</span>
                </span>
              </div>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            const points = historyPoints(metric.key);
            const currentValue = body[metric.key];
            const isHovered = hoveredCardIndex === index;
            const recent = points.slice(-7);
            return (
              <div key={metric.key} className="relative">
                <AppleCard
                  onClick={() => {
                    if (points.length === 0) return;
                    setModalData({
                      title: metric.title,
                      unit: metric.unit,
                      current:
                        currentValue === undefined || currentValue === null
                          ? '—'
                          : String(currentValue),
                      eval: `${points.length} 次实测记录`,
                      standard: metric.reference,
                      points: points.map((point) => ({
                        date: point.date,
                        value: point.value,
                      })),
                    });
                  }}
                  className="p-4 flex flex-col justify-between h-full cursor-pointer hover:border-amber-500/40 transition-all"
                >
                  <div
                    onMouseEnter={() => setHoveredCardIndex(index)}
                    onMouseLeave={() => setHoveredCardIndex(null)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className="p-1.5 rounded-xl border flex-shrink-0"
                        style={{
                          backgroundColor: `${metric.color}15`,
                          borderColor: `${metric.color}30`,
                          color: metric.color,
                        }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] text-neutral-400">
                        {recent.length > 0 ? `${recent.length} 次记录` : '暂无数据'}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 block mb-1">
                      {metric.title}
                    </span>
                    <div className="flex items-baseline gap-1 my-1">
                      <span className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight font-mono">
                        {currentValue === undefined || currentValue === null ? '—' : currentValue}
                      </span>
                      <span className="text-xs text-neutral-400 font-semibold">{metric.unit}</span>
                    </div>
                  </div>
                  <div className="pt-2 mt-2 border-t border-black/5 dark:border-white/5 text-[10px]">
                    <span className="text-neutral-500 dark:text-neutral-400 block truncate">
                      {metric.reference}
                    </span>
                    <div className="flex items-center justify-between mt-1 text-neutral-400">
                      <span>{points.length > 0 ? '点击查看实测趋势' : '等待体脂秤同步'}</span>
                      {points.length > 0 && <span className="text-amber-500 font-medium">查看</span>}
                    </div>
                  </div>
                </AppleCard>

                {isHovered && recent.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="absolute left-0 right-0 bottom-full mb-2 z-40 p-3 rounded-2xl bg-white/95 dark:bg-neutral-950/95 text-neutral-900 dark:text-white border border-black/15 dark:border-white/25 shadow-2xl backdrop-blur-2xl pointer-events-none"
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1.5 font-bold text-amber-500">
                      <span>最近 {recent.length} 次实测</span>
                      <span>最新 {recent[recent.length - 1].value}</span>
                    </div>
                    <div className="h-10 w-full">
                      {recent.length >= 2 ? (
                        <svg viewBox="0 0 180 32" className="w-full h-full overflow-visible">
                          {(() => {
                            const values = recent.map((point) => point.value);
                            const min = Math.min(...values);
                            const max = Math.max(...values);
                            const range = max - min || 1;
                            const coords = recent.map((point, pointIndex) => ({
                              x: 10 + (pointIndex / (recent.length - 1)) * 160,
                              y: 26 - ((point.value - min) / range) * 18,
                            }));
                            const path = coords
                              .map(
                                (point, pointIndex) =>
                                  `${pointIndex === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
                              )
                              .join(' ');
                            return (
                              <>
                                <path d={path} fill="none" stroke={metric.color} strokeWidth="2.2" />
                                {coords.map((point, pointIndex) => (
                                  <circle
                                    key={pointIndex}
                                    cx={point.x}
                                    cy={point.y}
                                    r="2.2"
                                    fill="#FFF"
                                    stroke={metric.color}
                                    strokeWidth="1.2"
                                  />
                                ))}
                              </>
                            );
                          })()}
                        </svg>
                      ) : (
                        <div className="h-full flex items-center text-[10px] text-neutral-400">
                          至少需要两次测量才能绘制趋势线。
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isVisible('silhouette') && (
        <BodySilhouette
          measurement={selectedMeasurement || latestMeasurement}
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
      />

      {isManageOpen && (
        <ManageBodyModal
          isOpen={isManageOpen}
          onClose={onCloseManage || (() => undefined)}
          sections={sectionsConfig}
          onChange={setSectionsConfig}
          onReset={() => setSectionsConfig(DEFAULT_BODY_SECTIONS)}
        />
      )}
    </div>
  );
};
