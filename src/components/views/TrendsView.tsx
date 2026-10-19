import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DailySummary } from '../../types/health';
import { AppleCard } from '../ui/AppleCard';
import { ManageTrendsModal, type TrendMetricItemConfig } from './ManageTrendsModal';
import { CalendarDatePickerModal } from '../ui/CalendarDatePickerModal';
import {
  TrendingUp,
  Flame,
  Heart,
  Moon,
  Scale,
  Waves,
  Footprints,
  Wind,
  Sparkles,
  Calendar,
  ChevronDown,
} from 'lucide-react';

interface TrendsViewProps {
  days: Record<string, DailySummary>;
  currentDay: DailySummary;
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
  isManageOpen?: boolean;
  onCloseManage?: () => void;
}

type Granularity = 'day' | 'week' | 'month' | 'year';

interface MetricTrendConfig {
  id: string;
  name: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  currentValue: string;
  unit: string;
  statusText: string;
  targetLine?: number;
  targetLabel?: string;
  optimalBand?: { min: number; max: number; label: string };
  data: Record<Granularity, { label: string; value: number }[]>;
}

const DEFAULT_TREND_CONFIG: TrendMetricItemConfig[] = [
  { id: 'move', name: '动态能量消耗 (Move)', visible: true, chartType: 'line' },
  { id: 'restingHr', name: '静息心率 (Resting HR)', visible: true, chartType: 'line' },
  { id: 'sleep', name: '睡眠时长与规律性', visible: true, chartType: 'line' },
  { id: 'weight', name: '体重与体脂率走势', visible: true, chartType: 'line' },
  { id: 'hrv', name: '心率变异性 HRV (SDNN)', visible: true, chartType: 'line' },
  { id: 'steps', name: '每日步数与日常活动', visible: true, chartType: 'line' },
  { id: 'vo2Max', name: '最大摄氧量 (VO2 Max)', visible: true, chartType: 'line' },
  { id: 'breathing', name: '睡眠呼吸扰动指数', visible: true, chartType: 'line' },
];

export const TrendsView: React.FC<TrendsViewProps> = ({
  days,
  currentDay,
  selectedDate,
  onSelectDate,
  isManageOpen = false,
  onCloseManage,
}) => {
  const [trendsConfig, setTrendsConfig] = useState<TrendMetricItemConfig[]>(() => {
    try {
      const saved = localStorage.getItem('apple_health_trends_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_TREND_CONFIG;
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('apple_health_trends_v2', JSON.stringify(trendsConfig));
    } catch {}
  }, [trendsConfig]);
  const dates = Object.keys(days).sort();
  const recentDates = dates.length > 21 ? dates.slice(-21) : dates;

  const groupByWeek = (getter: (d: DailySummary) => number, mode: 'sum' | 'avg') => {
    const weeks: Record<string, number[]> = {};
    for (const d of dates) {
      const dateObj = new Date(d + 'T12:00:00+08:00');
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;
      const dayOfMonth = dateObj.getDate();
      const weekNum = Math.ceil(dayOfMonth / 7);
      const key = `${year}年${month}月第${weekNum}周`;
      if (!weeks[key]) weeks[key] = [];
      const val = getter(days[d]);
      if (val !== undefined && !isNaN(val) && val > 0) weeks[key].push(val);
    }
    const res = Object.entries(weeks).slice(-6).map(([label, vals]) => ({
      label,
      value: mode === 'sum' ? Math.round(vals.reduce((a, b) => a + b, 0)) : parseFloat((vals.reduce((a, b) => a + b, 0) / (vals.length || 1)).toFixed(1)),
    }));
    return res;
  };

  const groupByMonth = (getter: (d: DailySummary) => number, mode: 'sum' | 'avg') => {
    const months: Record<string, number[]> = {};
    for (const d of dates) {
      const monthStr = `${d.slice(0, 4)}年${parseInt(d.slice(5, 7), 10)}月`;
      if (!months[monthStr]) months[monthStr] = [];
      const val = getter(days[d]);
      if (val !== undefined && !isNaN(val) && val > 0) months[monthStr].push(val);
    }
    const res = Object.entries(months).map(([label, vals]) => ({
      label,
      value: mode === 'sum' ? Math.round(vals.reduce((a, b) => a + b, 0)) : parseFloat((vals.reduce((a, b) => a + b, 0) / (vals.length || 1)).toFixed(1)),
    }));
    return res;
  };

  const groupByYear = (getter: (d: DailySummary) => number, mode: 'sum' | 'avg') => {
    const years: Record<string, number[]> = {};
    for (const date of dates) {
      const value = getter(days[date]);
      if (!Number.isFinite(value) || value <= 0) continue;
      const year = date.slice(0, 4);
      if (!years[year]) years[year] = [];
      years[year].push(value);
    }
    return Object.entries(years).map(([label, values]) => ({
      label: `${label}年`,
      value:
        mode === 'sum'
          ? Math.round(values.reduce((sum, value) => sum + value, 0))
          : Number(
              (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)
            ),
    }));
  };

  // Independent granularity state for each metric card
  const [granularities, setGranularities] = useState<Record<string, Granularity>>({
    move: 'day',
    restingHr: 'day',
    sleep: 'day',
    weight: 'day',
    hrv: 'day',
    steps: 'day',
    vo2Max: 'month',
    breathing: 'day',
  });

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [hoveredPoints, setHoveredPoints] = useState<Record<string, { label: string; value: number; x: number; y: number } | null>>({});
  const svgRefs = useRef<Record<string, SVGSVGElement | null>>({});

  const setCardGranularity = (metricId: string, gran: Granularity) => {
    setGranularities((prev) => ({ ...prev, [metricId]: gran }));
    setHoveredPoints((prev) => ({ ...prev, [metricId]: null }));
  };

  // Build real daily values from days
  const dailyMove = recentDates.map((d) => ({
    label: d.slice(5),
    value: days[d].rings.move.current,
  }));
  const dailyRestingHr = recentDates.map((d) => ({
    label: d.slice(5),
    value: days[d].vitals.restingHr,
  }));
  const dailySleep = recentDates.map((d) => ({
    label: d.slice(5),
    value: parseFloat((days[d].sleep.totalMinutes / 60).toFixed(1)),
  }));
  const dailyWeight = currentDay.body.trend.map((t) => ({
    label: t.date,
    value: t.weight,
  }));
  const dailyHrv = recentDates.map((d) => ({
    label: d.slice(5),
    value: days[d].vitals.hrvCurrent,
  }));
  const dailySteps = recentDates.map((d) => ({
    label: d.slice(5),
    value: days[d].steps.count,
  }));
  const dailyBreathing = recentDates.map((d) => ({
    label: d.slice(5),
    value: days[d].sleep.breathingDisturbances || 0,
  })).filter((point) => point.value > 0);
  const dailyVo2 = recentDates
    .map((date) => ({
      label: date.slice(5),
      value: days[date].vitals.vo2Max || 0,
    }))
    .filter((point) => point.value > 0);

  const averagePoints = (points: { value: number }[]): number | null => {
    const values = points.map((point) => point.value).filter((value) => value > 0);
    return values.length > 0
      ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1))
      : null;
  };

  const metrics: MetricTrendConfig[] = [
    {
      id: 'move',
      name: '动态能量消耗 (Move)',
      category: '体能活动',
      icon: Flame,
      color: '#FA114F',
      currentValue:
        currentDay.rings.move.current > 0 ? `${currentDay.rings.move.current}` : '—',
      unit: 'kcal',
      statusText:
        averagePoints(dailyMove) === null
          ? '当天暂无动态能量记录'
          : `最近记录日均 ${averagePoints(dailyMove)} kcal`,
      targetLine: currentDay.rings.move.goal || 600,
      targetLabel: `目标 ${currentDay.rings.move.goal || 600}`,
      data: {
        day: dailyMove,
        week: groupByWeek((d) => d.rings.move.current, 'sum'),
        month: groupByMonth((d) => d.rings.move.current, 'sum'),
        year: groupByYear((d) => d.rings.move.current, 'sum'),
      },
    },
    {
      id: 'restingHr',
      name: '静息心率 (Resting HR)',
      category: '心肺机能',
      icon: Heart,
      color: '#FB7185',
      currentValue: currentDay.vitals.restingHr > 0 ? `${currentDay.vitals.restingHr}` : '—',
      unit: 'bpm',
      statusText:
        averagePoints(dailyRestingHr) === null
          ? '当天暂无静息心率记录'
          : `最近记录均值 ${averagePoints(dailyRestingHr)} bpm`,
      data: {
        day: dailyRestingHr,
        week: groupByWeek((d) => d.vitals.restingHr, 'avg'),
        month: groupByMonth((d) => d.vitals.restingHr, 'avg'),
        year: groupByYear((d) => d.vitals.restingHr, 'avg'),
      },
    },
    {
      id: 'sleep',
      name: '睡眠时长与规律性',
      category: '精力恢复',
      icon: Moon,
      color: '#818CF8',
      currentValue:
        currentDay.sleep.totalMinutes > 0
          ? `${(currentDay.sleep.totalMinutes / 60).toFixed(1)}`
          : '—',
      unit: '小时',
      statusText:
        currentDay.sleep.totalMinutes > 0
          ? `睡眠效率 ${currentDay.sleep.efficiency}% · 深睡占比 ${currentDay.sleep.deepSleepPercent}%`
          : '当天暂无睡眠分期记录',
      targetLine: 7.5,
      targetLabel: '参考 7.5h',
      data: {
        day: dailySleep,
        week: groupByWeek((d) => parseFloat((d.sleep.totalMinutes / 60).toFixed(1)), 'avg'),
        month: groupByMonth((d) => parseFloat((d.sleep.totalMinutes / 60).toFixed(1)), 'avg'),
        year: groupByYear((d) => parseFloat((d.sleep.totalMinutes / 60).toFixed(1)), 'avg'),
      },
    },
    {
      id: 'weight',
      name: '体重与体脂率走势',
      category: '体态管理',
      icon: Scale,
      color: '#F59E0B',
      currentValue: currentDay.body.weightKg > 0 ? `${currentDay.body.weightKg}` : '—',
      unit: 'kg',
      statusText:
        currentDay.body.weightKg > 0
          ? `体脂率 ${currentDay.body.bodyFatPercent}% · 数据来自体脂秤实测`
          : '当天暂无体脂秤记录',
      data: {
        day: dailyWeight,
        week: groupByWeek((d) => d.body.weightKg, 'avg'),
        month: groupByMonth((d) => d.body.weightKg, 'avg'),
        year: groupByYear((d) => d.body.weightKg, 'avg'),
      },
    },
    {
      id: 'hrv',
      name: '心率变异性 HRV (SDNN)',
      category: '自主神经',
      icon: Waves,
      color: '#A855F7',
      currentValue: currentDay.vitals.hrvCurrent > 0 ? `${currentDay.vitals.hrvCurrent}` : '—',
      unit: 'ms',
      statusText:
        currentDay.vitals.hrvCurrent > 0
          ? currentDay.vitals.hrvBaseline > 0
            ? `当前 ${currentDay.vitals.hrvCurrent} ms · 数据均值 ${currentDay.vitals.hrvBaseline} ms`
            : `当前 ${currentDay.vitals.hrvCurrent} ms`
          : '当天暂无 HRV 记录',
      targetLine: currentDay.vitals.hrvBaseline || undefined,
      targetLabel:
        currentDay.vitals.hrvBaseline > 0 ? `均值 ${currentDay.vitals.hrvBaseline} ms` : undefined,
      data: {
        day: dailyHrv,
        week: groupByWeek((d) => d.vitals.hrvCurrent, 'avg'),
        month: groupByMonth((d) => d.vitals.hrvCurrent, 'avg'),
        year: groupByYear((d) => d.vitals.hrvCurrent, 'avg'),
      },
    },
    {
      id: 'steps',
      name: '每日步数与日常活动',
      category: '日常步数',
      icon: Footprints,
      color: '#10B981',
      currentValue: currentDay.steps.count > 0 ? currentDay.steps.count.toLocaleString() : '—',
      unit: '步',
      statusText:
        averagePoints(dailySteps) === null
          ? '当天暂无步数记录'
          : `最近记录日均 ${Math.round(averagePoints(dailySteps) || 0).toLocaleString()} 步`,
      targetLine: currentDay.steps.goal,
      targetLabel: `目标 ${currentDay.steps.goal.toLocaleString()}`,
      data: {
        day: dailySteps,
        week: groupByWeek((d) => d.steps.count, 'sum'),
        month: groupByMonth((d) => d.steps.count, 'sum'),
        year: groupByYear((d) => d.steps.count, 'sum'),
      },
    },
    {
      id: 'vo2Max',
      name: '最大摄氧量 (VO2 Max)',
      category: '心肺耐力',
      icon: Wind,
      color: '#06B6D4',
      currentValue: currentDay.vitals.vo2Max ? `${currentDay.vitals.vo2Max}` : '—',
      unit: 'ml/kg/min',
      statusText:
        dailyVo2.length > 0
          ? `最近 ${dailyVo2.length} 次 Apple Health 实测记录`
          : '当天暂无 VO2 Max 记录',
      data: {
        day: dailyVo2,
        week: groupByWeek((d) => d.vitals.vo2Max || 0, 'avg'),
        month: groupByMonth((d) => d.vitals.vo2Max || 0, 'avg'),
        year: groupByYear((d) => d.vitals.vo2Max || 0, 'avg'),
      },
    },
    {
      id: 'breathing',
      name: '睡眠呼吸扰动指数',
      category: '夜间呼吸',
      icon: Sparkles,
      color: '#14B8A6',
      currentValue: currentDay.sleep.breathingDisturbances
        ? `${currentDay.sleep.breathingDisturbances}`
        : '—',
      unit: '次/小时',
      statusText:
        currentDay.sleep.breathingDisturbances
          ? 'Apple Health 睡眠呼吸扰动实测值'
          : '当天暂无呼吸扰动记录',
      targetLine: 5,
      targetLabel: '参考上限 5',
      data: {
        day: dailyBreathing,
        week: groupByWeek((d) => d.sleep.breathingDisturbances || 0, 'avg'),
        month: groupByMonth((d) => d.sleep.breathingDisturbances || 0, 'avg'),
        year: groupByYear((d) => d.sleep.breathingDisturbances || 0, 'avg'),
      },
    },
  ];

  return (
    <div className="space-y-5">
      {/* Trends Hero Header */}
      <AppleCard>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex-shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white m-0">
                健康趋势 · 连续折线平滑与多级跨度
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                各生理指标支持「日、周、月、年」独立时间跨度平滑折线图，包含极值高光、悬停探针与参考基线。
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCalendarOpen(true)}
            className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-neutral-800 dark:text-white border-black/5 dark:border-white/10 shadow-sm"
            title="打开日历选择任意历史日期查看并联动全页"
          >
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-mono">{selectedDate || currentDay.date || '选择日期'}</span>
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          </button>
        </div>
      </AppleCard>

      {/* Grid of Curve Line Trend Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {trendsConfig
          .filter((cfg) => cfg.visible)
          .map((cfg) => {
            const m = metrics.find((item) => item.id === cfg.id);
            if (!m) return null;
            const currentChartType = cfg.chartType;
          const Icon = m.icon;
          const currentGran = granularities[m.id] || 'day';
          const pointsData = m.data[currentGran] || m.data.day;
          const values = pointsData.map((p) => p.value);
          const rawMin = values.length > 0 ? Math.min(...values) : 0;
          const rawMax = values.length > 0 ? Math.max(...values) : 100;

          // Expand range slightly for pleasing chart margins
          const margin = (rawMax - rawMin) * 0.18 || (rawMax * 0.1) || 5;
          const minVal = Math.max(0, rawMin - margin);
          const maxVal = rawMax + margin;

          const avgVal = values.length > 0 ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : '-';

          // Chart Dimensions
          const svgW = 460;
          const svgH = 130;
          const padX = 25;
          const padY = 20;

          // Calculate coordinates
          const coords = pointsData.map((p, idx) => {
            const x = padX + (idx / Math.max(pointsData.length - 1, 1)) * (svgW - padX * 2);
            const normY = (p.value - minVal) / Math.max(maxVal - minVal, 0.001);
            const y = svgH - padY - normY * (svgH - padY * 2);
            return { x, y, pt: p };
          });

          // Generate smooth Bezier curve
          const splinePathD = coords.reduce((acc, point, i, arr) => {
            if (i === 0) return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
            const prev = arr[i - 1];
            const cp1x = prev.x + (point.x - prev.x) / 2;
            const cp1y = prev.y;
            const cp2x = prev.x + (point.x - prev.x) / 2;
            const cp2y = point.y;
            return `${acc} C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
          }, '');

          const areaD = coords.length > 0
            ? `${splinePathD} L ${coords[coords.length - 1].x.toFixed(1)} ${svgH} L ${coords[0].x.toFixed(1)} ${svgH} Z`
            : '';

          // Target line Y coordinate
          let targetY: number | null = null;
          if (m.targetLine !== undefined && m.targetLine >= minVal && m.targetLine <= maxVal) {
            targetY = svgH - padY - ((m.targetLine - minVal) / Math.max(maxVal - minVal, 0.001)) * (svgH - padY * 2);
          }

          const activeHover = hoveredPoints[m.id];

          return (
            <AppleCard key={m.id} className="h-full flex flex-col justify-between overflow-hidden">
              <div>
                {/* Metric Header & Granularity Buttons */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="p-1.5 rounded-xl border flex-shrink-0"
                      style={{
                        backgroundColor: `${m.color}20`,
                        borderColor: `${m.color}35`,
                        color: m.color,
                      }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                      {m.name}
                    </span>
                  </div>

                  {/* Day / Week / Month / Year Switcher */}
                  <div className="flex bg-black/5 dark:bg-white/5 p-0.5 rounded-xl border border-black/5 dark:border-white/5 flex-shrink-0">
                    {(['day', 'week', 'month', 'year'] as Granularity[]).map((gran) => {
                      const labels = { day: '日', week: '周', month: '月', year: '年' };
                      const isActive = currentGran === gran;

                      return (
                        <button
                          key={gran}
                          type="button"
                          onClick={() => setCardGranularity(m.id, gran)}
                          className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            isActive
                              ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm'
                              : 'text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                          }`}
                        >
                          {labels[gran]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Primary Metric Number & Status Text */}
                <div className="flex items-baseline justify-between mb-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight font-mono">
                      {m.currentValue}
                    </span>
                    <span className="text-xs text-neutral-400 font-semibold">{m.unit}</span>
                  </div>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate max-w-[240px]">
                    {m.statusText}
                  </span>
                </div>

                {/* Interactive Smooth Curve SVG Chart */}
                <div className="relative min-h-[145px] w-full bg-black/[0.02] dark:bg-white/[0.02] rounded-2xl p-2 border border-black/[0.04] dark:border-white/[0.03] flex flex-col justify-between">
                  {pointsData.length === 0 ? (
                    <div className="w-full h-full min-h-[105px] flex items-center justify-center text-xs text-neutral-400">
                      当前时间跨度暂无实测数据
                    </div>
                  ) : currentChartType === 'bar' ? (
                    <div className="w-full h-full flex items-end justify-between gap-2 px-1">
                      {pointsData.map((p, idx) => {
                        const range = maxVal - minVal || 1;
                        const heightPercent = Math.max(Math.min(((p.value - minVal) / range) * 80 + 20, 100), 15);
                        const isLatest = idx === pointsData.length - 1;

                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                            <span className="text-[9px] font-mono text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity mb-0.5">
                              {p.value}
                            </span>
                            <div className="w-full bg-black/5 dark:bg-white/5 rounded-t-lg overflow-hidden flex items-end h-[75px]">
                              <div
                                className="w-full rounded-t-lg transition-all duration-500"
                                style={{
                                  height: `${heightPercent}%`,
                                  backgroundColor: m.color,
                                  opacity: isLatest ? 1 : 0.75,
                                  boxShadow: isLatest ? `0 0 10px ${m.color}80` : undefined,
                                }}
                              />
                            </div>
                            <span className="text-[10px] text-neutral-400 font-mono mt-1">
                              {p.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                  <><div
                    className="relative w-full h-[105px]"
                    onMouseLeave={() =>
                      setHoveredPoints((prev) => ({
                        ...prev,
                        [m.id]: null,
                      }))
                    }
                  >
                  <svg
                    ref={(el) => {
                      svgRefs.current[m.id] = el;
                    }}
                    viewBox={`0 0 ${svgW} ${svgH}`}
                    className="w-full h-full overflow-visible cursor-crosshair"
                    preserveAspectRatio="none"
                    onMouseMove={(e) => {
                      const svgEl = svgRefs.current[m.id];
                      if (!svgEl || coords.length === 0) return;
                      const rect = svgEl.getBoundingClientRect();
                      const mouseX = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * svgW;
                      let closest = coords[0];
                      let minDist = Infinity;
                      for (const c of coords) {
                        const dist = Math.abs(c.x - mouseX);
                        if (dist < minDist) {
                          minDist = dist;
                          closest = c;
                        }
                      }
                      setHoveredPoints((prev) => ({
                        ...prev,
                        [m.id]: { label: closest.pt.label, value: closest.pt.value, x: closest.x, y: closest.y },
                      }));
                    }}
                  >
                    <defs>
                      <linearGradient id={`gradient-${m.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={m.color} stopOpacity="0.4" />
                        <stop offset="70%" stopColor={m.color} stopOpacity="0.06" />
                        <stop offset="100%" stopColor={m.color} stopOpacity="0" />
                      </linearGradient>
                      <filter id={`glow-${m.id}`} x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={m.color} floodOpacity="0.45" />
                      </filter>
                    </defs>

                    {/* Target reference dashed line if applicable */}
                    {targetY !== null && (
                      <g>
                        <line
                          x1={padX}
                          y1={targetY}
                          x2={svgW - padX}
                          y2={targetY}
                          stroke={m.color}
                          strokeOpacity="0.4"
                          strokeDasharray="4 4"
                          strokeWidth="1.2"
                        />
                        <text
                          x={svgW - padX}
                          y={targetY - 3}
                          textAnchor="end"
                          className="text-[9px] font-mono"
                          fill={m.color}
                          opacity="0.8"
                        >
                          {m.targetLabel}
                        </text>
                      </g>
                    )}

                    {/* Semi-transparent smooth area under curve */}
                    <path d={areaD} fill={`url(#gradient-${m.id})`} />

                    {/* Animated primary spline curve path */}
                    <AnimatePresence mode="wait">
                      <motion.path
                        key={`${m.id}-${currentGran}`}
                        d={splinePathD}
                        fill="none"
                        stroke={m.color}
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter={`url(#glow-${m.id})`}
                        initial={{ pathLength: 0, opacity: 0.2 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </AnimatePresence>

                    {/* Interactive Vertical Crosshair Line (竖线与高光锚点) */}
                    {activeHover && (
                      <g>
                        <line
                          x1={activeHover.x}
                          y1={0}
                          x2={activeHover.x}
                          y2={svgH}
                          stroke={m.color}
                          strokeWidth="1.6"
                          strokeDasharray="4 3"
                          opacity="0.9"
                        />
                        <circle
                          cx={activeHover.x}
                          cy={activeHover.y}
                          r="6.5"
                          fill="#FFF"
                          stroke={m.color}
                          strokeWidth="3"
                          filter={`url(#glow-${m.id})`}
                        />
                      </g>
                    )}

                    {/* Data Points on curve with hover trigger */}
                    {coords.map((c, idx) => {
                      const isHovered = activeHover && activeHover.label === c.pt.label;
                      const isLast = idx === coords.length - 1;

                      return (
                        <g key={idx}>
                          <circle
                            cx={c.x}
                            cy={c.y}
                            r={isHovered ? 5.5 : isLast ? 4 : 2.5}
                            fill={isHovered || isLast ? '#FFF' : m.color}
                            stroke={m.color}
                            strokeWidth="2"
                            className="cursor-pointer transition-all duration-150"
                          />
                        </g>
                      );
                    })}
                  </svg>
                  </div>

                  {/* Floating Scrubber Tooltip (悬停竖线伴随数据标注与日期) */}
                  {activeHover && (
                    <motion.div
                      initial={{ opacity: 0, y: 3, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="absolute z-30 px-3 py-1.5 rounded-2xl bg-neutral-950/95 text-white border border-white/25 shadow-2xl backdrop-blur-md pointer-events-none flex flex-col items-center gap-0.5"
                      style={{
                        left: `${Math.min(Math.max((activeHover.x / svgW) * 100, 16), 84)}%`,
                        top: '-8px',
                        transform: 'translateX(-50%)',
                      }}
                    >
                      <span className="text-[10px] text-neutral-400 font-mono font-medium">{activeHover.label}</span>
                      <span className="font-black font-mono text-xs leading-none" style={{ color: m.color }}>
                        {activeHover.value} {m.unit}
                      </span>
                    </motion.div>
                  )}

                  {/* Horizontal X-Axis Labels */}
                  <div className="flex justify-between items-center text-[10px] text-neutral-400 font-mono px-3 mt-1">
                    {(() => {
                      const total = pointsData.length;
                      if (total <= 7) {
                        return pointsData.map((p, i) => (
                          <span key={i} className="truncate">
                            {p.label}
                          </span>
                        ));
                      }
                      const step = Math.ceil(total / 6);
                      return pointsData
                        .filter((_, i) => i === 0 || i === total - 1 || i % step === 0)
                        .map((p, i) => (
                          <span key={i} className="truncate">
                            {p.label}
                          </span>
                        ));
                    })()}
                  </div>
                  </>
                  )}
                </div>
              </div>

              {/* Footer Benchmark Stats */}
              <div className="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-black/[0.05] dark:border-white/[0.05] text-[11px]">
                <div>
                  <span className="text-neutral-400 block text-[10px]">周期均值</span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200 font-mono">{avgVal} {values.length > 0 ? m.unit : ''}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[10px]">峰值</span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200 font-mono">{values.length > 0 ? `${rawMax} ${m.unit}` : '—'}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[10px]">谷值</span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200 font-mono">{values.length > 0 ? `${rawMin} ${m.unit}` : '—'}</span>
                </div>
              </div>
            </AppleCard>
          );
        })}
      </div>

      {/* Reorder & Chart Type Customization Modal */}
      {isManageOpen && (
        <ManageTrendsModal
          isOpen={isManageOpen}
          onClose={onCloseManage || (() => {})}
          config={trendsConfig}
          onChange={setTrendsConfig}
          onReset={() => setTrendsConfig(DEFAULT_TREND_CONFIG)}
        />
      )}

      {/* Unoccluded Date Picker Modal */}
      <CalendarDatePickerModal
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        selectedDate={selectedDate || currentDay.date}
        availableDates={dates}
        onSelectDate={(d) => {
          if (onSelectDate) onSelectDate(d);
        }}
        title="健康趋势 · 历史日期切换与全页联动"
      />
    </div>
  );
};
