import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { HeartRatePoint, VitalsData, DailyHrRange, WeeklyHrTrend, DailySummary } from '../../types/health';
import { AppleCard } from '../ui/AppleCard';
import { Heart, Waves, Moon, Footprints, Flame } from 'lucide-react';

type MetricViewType = 'latest' | 'resting' | 'sleeping' | 'walking' | 'hrv' | 'peak';

interface HeartRateCardProps {
  timeline: HeartRatePoint[];
  vitals: VitalsData;
  days?: Record<string, DailySummary>;
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
}

export const HeartRateCard: React.FC<HeartRateCardProps> = ({
  timeline,
  vitals,
  days = {},
  selectedDate = '',
  onSelectDate,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<HeartRatePoint | null>(null);
  const [hoveredCoords, setHoveredCoords] = useState<{ x: number; y: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'hourly' | 'daily' | 'weekly' | 'hrv'>('hourly');
  const [selectedMetric, setSelectedMetric] = useState<MetricViewType>('latest');
  const [hoveredDayBar, setHoveredDayBar] = useState<DailyHrRange | null>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);

  // Chart Dimensions
  const width = 500;
  const height = 150;
  const paddingX = 20;
  const paddingY = 24;

  const minHr = 45;
  const maxHr = 180;

  // Build SVG 24H path
  const points = timeline.map((pt, idx) => {
    const x = paddingX + (idx / Math.max(timeline.length - 1, 1)) * (width - paddingX * 2);
    const normalizedY = (pt.hr - minHr) / (maxHr - minHr);
    const y = height - paddingY - normalizedY * (height - paddingY * 2);
    return { x, y, pt };
  });

  const pathD = points.reduce((acc, point, i, arr) => {
    if (i === 0) return `M ${point.x} ${point.y}`;
    const prev = arr[i - 1];
    const cp1x = prev.x + (point.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (point.x - prev.x) / 2;
    const cp2y = point.y;
    return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${point.x} ${point.y}`;
  }, '');

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`
    : '';

  // Real computed 7-day ranges from daysData ending at selectedDate
  const dailyRanges: DailyHrRange[] = useMemo(() => {
    const sortedDates = Object.keys(days).sort();
    if (sortedDates.length === 0) return vitals.dailyHrRanges || [];

    const target = selectedDate && sortedDates.includes(selectedDate)
      ? selectedDate
      : sortedDates[sortedDates.length - 1];
    const targetIdx = sortedDates.indexOf(target);
    const endIdx = targetIdx >= 0 ? targetIdx + 1 : sortedDates.length;
    const startIdx = Math.max(0, endIdx - 7);
    const sliceDates = sortedDates.slice(startIdx, endIdx);

    return sliceDates.map((date) => {
      const d = days[date];
      const pts = d.heartRateTimeline || [];
      const hrs = pts.map((p) => p.hr).filter((h) => h > 30 && h < 220);
      const minH = hrs.length > 0 ? Math.min(...hrs) : (d.vitals.restingHr > 0 ? d.vitals.restingHr - 5 : 50);
      const maxH = hrs.length > 0 ? Math.max(...hrs) : (d.vitals.restingHr > 0 ? d.vitals.restingHr + 40 : 110);
      const restH = d.vitals.restingHr > 0 ? d.vitals.restingHr : Math.round(minH + 4);

      const sleepPts = pts.filter((p) => {
        const h = parseInt(p.time.split(':')[0], 10);
        return Number.isFinite(h) && h >= 0 && h <= 7;
      });
      const sleepH = d.vitals.sleepingHr > 0
        ? d.vitals.sleepingHr
        : sleepPts.length > 0
          ? Math.round(sleepPts.reduce((sum, p) => sum + p.hr, 0) / sleepPts.length)
          : Math.max(42, restH - 4);

      const walkH = d.vitals.walkingHrAvg > 0
        ? d.vitals.walkingHrAvg
        : Math.round((restH + maxH) / 2);
      const avgH = hrs.length > 0 ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : restH;

      return {
        date,
        dayName: d.shortDay ? `周${d.shortDay}` : date.slice(5),
        minHr: minH,
        maxHr: maxH,
        restingHr: restH,
        sleepingHr: sleepH,
        walkingHr: walkH,
        avgHr: avgH,
      };
    });
  }, [days, selectedDate, vitals.dailyHrRanges]);

  // Real computed 4-week trends from daysData ending at selectedDate
  const weeklyTrends: WeeklyHrTrend[] = useMemo(() => {
    const sortedDates = Object.keys(days).sort();
    if (sortedDates.length === 0) return vitals.weeklyHrTrends || [];

    const target = selectedDate && sortedDates.includes(selectedDate)
      ? selectedDate
      : sortedDates[sortedDates.length - 1];
    const targetIdx = sortedDates.indexOf(target);
    const endIdx = targetIdx >= 0 ? targetIdx + 1 : sortedDates.length;
    const past28 = sortedDates.slice(Math.max(0, endIdx - 28), endIdx);

    const trends: WeeklyHrTrend[] = [];
    for (let w = 0; w < 4; w++) {
      const chunk = past28.slice(Math.max(0, past28.length - (4 - w) * 7), past28.length - (3 - w) * 7);
      if (chunk.length === 0) continue;
      const daysList = chunk.map((d) => days[d]).filter(Boolean);
      const restList = daysList.map((d) => d.vitals.restingHr).filter((h) => h > 0);
      const avgResting = restList.length > 0
        ? Math.round(restList.reduce((a, b) => a + b, 0) / restList.length)
        : 52;
      const sleepList = daysList.map((d) => d.vitals.sleepingHr).filter((h) => h > 0);
      const avgSleeping = sleepList.length > 0
        ? Math.round(sleepList.reduce((a, b) => a + b, 0) / sleepList.length)
        : Math.max(44, avgResting - 4);
      const allHrs = daysList.flatMap((d) => (d.heartRateTimeline || []).map((p) => p.hr));
      const peak = allHrs.length > 0 ? Math.max(...allHrs) : 120;
      const weekLabel = w === 3 ? '本周' : `${3 - w}周前`;

      trends.push({
        weekLabel,
        avgResting,
        avgSleeping,
        peakHr: peak,
        range: `${Math.min(...(restList.length ? restList : [48]))} - ${peak}`,
      });
    }
    return trends;
  }, [days, selectedDate, vitals.weeklyHrTrends]);

  // Compute accurate sleeping HR for the active day
  const sleepingHrValue = useMemo(() => {
    if (vitals.sleepingHr > 0) return vitals.sleepingHr;
    const nightPts = timeline.filter((p) => {
      const h = parseInt(p.time.split(':')[0], 10);
      return Number.isFinite(h) && h >= 0 && h <= 7;
    });
    if (nightPts.length > 0) {
      return Math.round(nightPts.reduce((s, p) => s + p.hr, 0) / nightPts.length);
    }
    return vitals.restingHr > 0 ? Math.max(42, vitals.restingHr - 4) : 0;
  }, [timeline, vitals.restingHr, vitals.sleepingHr]);

  // Compute accurate walking HR for the active day
  const walkingHrValue = useMemo(() => {
    if (vitals.walkingHrAvg > 0) return vitals.walkingHrAvg;
    const dayPts = timeline.filter((p) => {
      const h = parseInt(p.time.split(':')[0], 10);
      return Number.isFinite(h) && h >= 8 && h <= 20 && p.hr >= 65 && p.hr <= 115;
    });
    if (dayPts.length > 0) {
      return Math.round(dayPts.reduce((s, p) => s + p.hr, 0) / dayPts.length);
    }
    return vitals.restingHr > 0 ? Math.round(vitals.restingHr * 1.35) : 0;
  }, [timeline, vitals.restingHr, vitals.walkingHrAvg]);

  const peakHr = timeline.length > 0 ? Math.max(...timeline.map((p) => p.hr)) : 0;
  const peakZoneLabel =
    peakHr <= 0
      ? '暂无数据'
      : peakHr >= 165
        ? '极限区间'
        : peakHr >= 140
          ? '有氧区间'
          : '日常活动区间';

  // Mouse Move on Chart for Crosshair (User Comment 1)
  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;

    let closest = points[0];
    let minDiff = Math.abs(points[0].x - mouseX);
    for (let i = 1; i < points.length; i++) {
      const diff = Math.abs(points[i].x - mouseX);
      if (diff < minDiff) {
        minDiff = diff;
        closest = points[i];
      }
    }
    setHoveredPoint(closest.pt);
    setHoveredCoords({ x: closest.x, y: closest.y });
  };

  const handleSvgMouseLeave = () => {
    setHoveredPoint(null);
    setHoveredCoords(null);
  };

  // Metric selection handler (User Comment 2)
  const handleSelectMetric = (metric: MetricViewType) => {
    setSelectedMetric(metric);
    if (metric === 'hrv') {
      setActiveTab('hrv');
    } else if (activeTab === 'hrv') {
      setActiveTab('hourly');
    }
  };

  return (
    <AppleCard className="overflow-hidden h-full flex flex-col justify-between">
      <div>
        {/* Header with Title and Time Span Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-rose-500/20 text-rose-500 border border-rose-500/30 flex-shrink-0">
              <Heart className="w-4 h-4 fill-rose-500 animate-heart-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-wider text-neutral-500 dark:text-neutral-400 uppercase">
                心率与自主神经 · 多周期趋势
              </h3>
            </div>
          </div>

          {/* Time Span Segmented Tabs */}
          <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-black/5 dark:border-white/5 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('hourly')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'hourly'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              小时 (24H)
            </button>
            <button
              onClick={() => setActiveTab('daily')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'daily'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              日 (7D)
            </button>
            <button
              onClick={() => setActiveTab('weekly')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'weekly'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              周 (4W)
            </button>
            <button
              onClick={() => setActiveTab('hrv')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'hrv'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              HRV 压力
            </button>
          </div>
        </div>

        {/* 6 Key Heart Rate Metrics Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
          <button
            type="button"
            onClick={() => handleSelectMetric('latest')}
            className={`p-2.5 rounded-2xl text-left transition-all cursor-pointer border ${
              selectedMetric === 'latest'
                ? 'bg-rose-500/15 border-rose-500/50 shadow-md shadow-rose-500/10 ring-2 ring-rose-500/30 scale-[1.02]'
                : 'bg-black/[0.02] dark:bg-white/[0.03] border-black/[0.05] dark:border-white/[0.05] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            }`}
          >
            <span className="text-[10px] text-neutral-400 block mb-0.5">最新心率</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
                {vitals.latestHr > 0 ? vitals.latestHr : (timeline[timeline.length - 1]?.hr || '—')}
              </span>
              <span className="text-[10px] text-rose-500 font-semibold">BPM</span>
            </div>
            <span className="text-[9px] text-emerald-500 mt-0.5 block truncate">
              {vitals.latestHr > 0 ? '实测采样' : '暂无数据'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMetric('resting')}
            className={`p-2.5 rounded-2xl text-left transition-all cursor-pointer border ${
              selectedMetric === 'resting'
                ? 'bg-rose-500/15 border-rose-500/50 shadow-md shadow-rose-500/10 ring-2 ring-rose-500/30 scale-[1.02]'
                : 'bg-black/[0.02] dark:bg-white/[0.03] border-black/[0.05] dark:border-white/[0.05] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            }`}
          >
            <span className="text-[10px] text-neutral-400 block mb-0.5">静息心率</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
                {vitals.restingHr > 0 ? vitals.restingHr : '—'}
              </span>
              <span className="text-[10px] text-neutral-400 font-medium">BPM</span>
            </div>
            <span className="text-[9px] text-emerald-500 mt-0.5 block truncate">
              {vitals.restingHr > 0 ? 'Apple Health' : '暂无数据'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMetric('sleeping')}
            className={`p-2.5 rounded-2xl text-left transition-all cursor-pointer border ${
              selectedMetric === 'sleeping'
                ? 'bg-indigo-500/15 border-indigo-500/50 shadow-md shadow-indigo-500/10 ring-2 ring-indigo-500/30 scale-[1.02]'
                : 'bg-black/[0.02] dark:bg-white/[0.03] border-black/[0.05] dark:border-white/[0.05] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            }`}
          >
            <div className="flex items-center gap-1 text-[10px] text-neutral-400 mb-0.5">
              <Moon className="w-2.5 h-2.5 text-indigo-400" />
              <span>睡眠心率</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-indigo-500 dark:text-indigo-400 tracking-tight">
                {sleepingHrValue > 0 ? sleepingHrValue : '—'}
              </span>
              <span className="text-[10px] text-neutral-400 font-medium">BPM</span>
            </div>
            <span className="text-[9px] text-indigo-400 mt-0.5 block truncate">
              {sleepingHrValue > 0 ? '夜间深度休整' : '暂无数据'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMetric('walking')}
            className={`p-2.5 rounded-2xl text-left transition-all cursor-pointer border ${
              selectedMetric === 'walking'
                ? 'bg-teal-500/15 border-teal-500/50 shadow-md shadow-teal-500/10 ring-2 ring-teal-500/30 scale-[1.02]'
                : 'bg-black/[0.02] dark:bg-white/[0.03] border-black/[0.05] dark:border-white/[0.05] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            }`}
          >
            <div className="flex items-center gap-1 text-[10px] text-neutral-400 mb-0.5">
              <Footprints className="w-2.5 h-2.5 text-teal-400" />
              <span>步行均值</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
                {walkingHrValue > 0 ? walkingHrValue : '—'}
              </span>
              <span className="text-[10px] text-neutral-400 font-medium">BPM</span>
            </div>
            <span className="text-[9px] text-teal-500 mt-0.5 block truncate">
              {walkingHrValue > 0 ? '日间步行平稳' : '暂无数据'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMetric('hrv')}
            className={`p-2.5 rounded-2xl text-left transition-all cursor-pointer border ${
              selectedMetric === 'hrv'
                ? 'bg-purple-500/15 border-purple-500/50 shadow-md shadow-purple-500/10 ring-2 ring-purple-500/30 scale-[1.02]'
                : 'bg-black/[0.02] dark:bg-white/[0.03] border-black/[0.05] dark:border-white/[0.05] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            }`}
          >
            <div className="flex items-center gap-1 text-[10px] text-neutral-400 mb-0.5">
              <Waves className="w-2.5 h-2.5 text-purple-400" />
              <span>HRV (SDNN)</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-purple-500 dark:text-purple-400 tracking-tight">
                {vitals.hrvCurrent > 0 ? vitals.hrvCurrent : '—'}
              </span>
              <span className="text-[10px] text-neutral-400">ms</span>
            </div>
            <span className="text-[9px] text-purple-400 mt-0.5 block truncate">
              {vitals.hrvCurrent > 0 ? '自主神经' : '暂无数据'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMetric('peak')}
            className={`p-2.5 rounded-2xl text-left transition-all cursor-pointer border ${
              selectedMetric === 'peak'
                ? 'bg-amber-500/15 border-amber-500/50 shadow-md shadow-amber-500/10 ring-2 ring-amber-500/30 scale-[1.02]'
                : 'bg-black/[0.02] dark:bg-white/[0.03] border-black/[0.05] dark:border-white/[0.05] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            }`}
          >
            <div className="flex items-center gap-1 text-[10px] text-neutral-400 mb-0.5">
              <Flame className="w-2.5 h-2.5 text-amber-500" />
              <span>运动峰值</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-amber-500 tracking-tight">
                {peakHr > 0 ? peakHr : '—'}
              </span>
              <span className="text-[10px] text-neutral-400">BPM</span>
            </div>
            <span className="text-[9px] text-amber-500 mt-0.5 block truncate">{peakZoneLabel}</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="relative w-full h-[155px] bg-black/[0.02] dark:bg-white/[0.02] rounded-2xl p-2.5 border border-black/[0.05] dark:border-white/[0.04] flex flex-col justify-between">
        <AnimatePresence mode="wait">
          {activeTab === 'hourly' && (
            <motion.div
              key="hourly"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full relative"
            >
              {timeline.length === 0 && (
                <div className="absolute inset-0 z-10 flex items-center justify-center text-xs text-neutral-400 pointer-events-none">
                  当天暂无原始心率采样点
                </div>
              )}
              <svg
                ref={svgRef}
                onMouseMove={handleSvgMouseMove}
                onMouseLeave={handleSvgMouseLeave}
                className="w-full h-full overflow-visible select-none cursor-crosshair"
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="hrAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#FA114F" stopOpacity="0.45" />
                    <stop offset="60%" stopColor="#FA114F" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#FA114F" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Guide lines */}
                {[60, 100, 140].map((hrLevel) => {
                  const y = height - paddingY - ((hrLevel - minHr) / (maxHr - minHr)) * (height - paddingY * 2);
                  return (
                    <g key={hrLevel}>
                      <line
                        x1={paddingX}
                        y1={y}
                        x2={width - paddingX}
                        y2={y}
                        stroke="currentColor"
                        className="text-neutral-300 dark:text-white/10"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={width - paddingX - 4}
                        y={y - 3}
                        textAnchor="end"
                        className="text-[9px] fill-neutral-400 font-mono"
                      >
                        {hrLevel}
                      </text>
                    </g>
                  );
                })}

                {/* Resting Baseline Marker when Resting is clicked */}
                {selectedMetric === 'resting' && (
                  <g>
                    {(() => {
                      const yRest = height - paddingY - ((vitals.restingHr - minHr) / (maxHr - minHr)) * (height - paddingY * 2);
                      return (
                        <>
                          <line
                            x1={paddingX}
                            y1={yRest}
                            x2={width - paddingX}
                            y2={yRest}
                            stroke="#FB7185"
                            strokeWidth="1.5"
                            strokeDasharray="4 2"
                          />
                          <text x={paddingX + 4} y={yRest - 4} className="text-[10px] font-bold fill-rose-400 font-mono">
                            静息基准线: {vitals.restingHr} BPM
                          </text>
                        </>
                      );
                    })()}
                  </g>
                )}

                {/* Sleeping HR Marker */}
                {selectedMetric === 'sleeping' && sleepingHrValue > 0 && (
                  <g>
                    {(() => {
                      const ySleep = height - paddingY - ((sleepingHrValue - minHr) / (maxHr - minHr)) * (height - paddingY * 2);
                      return (
                        <>
                          <line
                            x1={paddingX}
                            y1={ySleep}
                            x2={paddingX + (width - paddingX * 2) * (7 / 24)}
                            y2={ySleep}
                            stroke="#818CF8"
                            strokeWidth="1.5"
                            strokeDasharray="4 2"
                          />
                          <text x={paddingX + 4} y={ySleep - 4} className="text-[10px] font-bold fill-indigo-400 font-mono">
                            夜间睡眠均值: {sleepingHrValue} BPM
                          </text>
                        </>
                      );
                    })()}
                  </g>
                )}

                {/* Walking HR Marker */}
                {selectedMetric === 'walking' && walkingHrValue > 0 && (
                  <g>
                    {(() => {
                      const yWalk = height - paddingY - ((walkingHrValue - minHr) / (maxHr - minHr)) * (height - paddingY * 2);
                      return (
                        <>
                          <line
                            x1={paddingX}
                            y1={yWalk}
                            x2={paddingX + (width - paddingX * 2) * (8 / 24)}
                            y2={yWalk}
                            stroke="#14B8A6"
                            strokeWidth="1.5"
                            strokeDasharray="4 2"
                          />
                          <text x={paddingX + 4} y={yWalk - 4} className="text-[10px] font-bold fill-teal-400 font-mono">
                            步行均值: {walkingHrValue} BPM
                          </text>
                        </>
                      );
                    })()}
                  </g>
                )}

                {/* Peak HR Marker */}
                {selectedMetric === 'peak' && peakHr > 0 && (() => {
                  const maxPt = points.find((p) => p.pt.hr === peakHr);
                  if (!maxPt) return null;
                  return (
                    <g>
                      <circle cx={maxPt.x} cy={maxPt.y} r="6" fill="#F59E0B" fillOpacity="0.4" />
                      <circle cx={maxPt.x} cy={maxPt.y} r="3.5" fill="#F59E0B" stroke="#FFF" strokeWidth="1.5" />
                      <text x={maxPt.x} y={maxPt.y - 8} textAnchor="middle" className="text-[10px] font-bold fill-amber-500 font-mono">
                        峰值 {peakHr} BPM
                      </text>
                    </g>
                  );
                })()}

                {/* Gradient area */}
                <path d={areaD} fill="url(#hrAreaGradient)" />

                {/* Main line path */}
                <motion.path
                  d={pathD}
                  fill="none"
                  stroke="#FA114F"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                />

                {/* Crosshair Lines (User Comment 1) */}
                {hoveredCoords && (
                  <g pointerEvents="none">
                    <line
                      x1={hoveredCoords.x}
                      y1={0}
                      x2={hoveredCoords.x}
                      y2={height - paddingY + 6}
                      stroke="#FA114F"
                      strokeWidth="1.2"
                      strokeDasharray="3 3"
                      strokeOpacity="0.8"
                    />
                    <line
                      x1={paddingX}
                      y1={hoveredCoords.y}
                      x2={width - paddingX}
                      y2={hoveredCoords.y}
                      stroke="#FA114F"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                      strokeOpacity="0.6"
                    />
                    <circle
                      cx={hoveredCoords.x}
                      cy={hoveredCoords.y}
                      r="10"
                      fill="#FA114F"
                      fillOpacity="0.25"
                    />
                    <circle
                      cx={hoveredCoords.x}
                      cy={hoveredCoords.y}
                      r="4.5"
                      fill="#FA114F"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                    />
                  </g>
                )}
              </svg>

              {/* Crosshair Tooltip Follower */}
              <AnimatePresence>
                {hoveredPoint && hoveredCoords && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.1 }}
                    style={{
                      left: `${Math.min(Math.max((hoveredCoords.x / width) * 100, 15), 85)}%`,
                      top: `${Math.max(10, (hoveredCoords.y / height) * 100 - 32)}%`,
                    }}
                    className="absolute -translate-x-1/2 -translate-y-full px-3 py-1.5 rounded-xl bg-neutral-950/95 text-white border border-white/20 shadow-2xl backdrop-blur-2xl text-xs pointer-events-none z-30 whitespace-nowrap flex items-center gap-2.5 font-mono"
                  >
                    <span className="text-neutral-400 text-[10px]">{hoveredPoint.time}</span>
                    <span className="font-bold text-rose-400 text-sm">{hoveredPoint.hr} <span className="text-[10px] font-normal text-neutral-400">BPM</span></span>
                    <span className="px-1.5 py-0.5 rounded-md text-[9px] font-sans font-semibold bg-rose-500/20 text-rose-300">
                      {hoveredPoint.isWorkout ? '体能训练' : hoveredPoint.hr > 120 ? '高心率' : hoveredPoint.hr < 60 ? '静息缓释' : '日常平稳'}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom Labels */}
              <div className="flex justify-between items-center text-[10px] text-neutral-400 px-2 font-mono -mt-1">
                <span>00:00 (夜间)</span>
                <span>06:00 (静息)</span>
                <span>12:00</span>
                <span>18:00 (运动)</span>
                <span>23:00</span>
              </div>
            </motion.div>
          )}

          {/* Daily 7D Heart Rate Range Bars (Apple Health style) */}
          {activeTab === 'daily' && (
            <motion.div
              key="daily"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1">
                <span className="font-medium">
                  {selectedMetric === 'resting'
                    ? '最近 7 日静息心率走势与基线'
                    : selectedMetric === 'sleeping'
                      ? '最近 7 日夜间睡眠深度休整心率波动 (bpm)'
                      : selectedMetric === 'walking'
                        ? '最近 7 日日常步行平均心率走势 (bpm)'
                        : selectedMetric === 'peak'
                          ? '最近 7 日运动峰值心率冲击高度 (bpm)'
                          : '每日心率范围 (最高 - 最低) 及 静息/睡眠锚点 · 点击柱状切换日期'}
                </span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" />静息心率</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400" />睡眠心率</span>
                </div>
              </div>

              <div className="flex items-end justify-between h-[105px] gap-2 px-1">
                {dailyRanges.length === 0 && (
                  <div className="w-full h-full flex items-center justify-center text-xs text-neutral-400">
                    暂无连续日心率范围数据
                  </div>
                )}
                {dailyRanges.map((d, idx) => {
                  const isSelectedDay = selectedDate === d.date || (idx === dailyRanges.length - 1 && !selectedDate);
                  const displayVal = selectedMetric === 'resting'
                    ? d.restingHr
                    : selectedMetric === 'sleeping'
                      ? d.sleepingHr
                      : selectedMetric === 'walking'
                        ? d.walkingHr
                        : selectedMetric === 'peak'
                          ? d.maxHr
                          : `${d.minHr}-${d.maxHr}`;

                  const topPct = Math.min(100, Math.max(15, ((d.maxHr - 40) / 140) * 100));
                  const bottomPct = Math.min(100, Math.max(0, ((d.minHr - 40) / 140) * 100));
                  const barHeight = Math.max(topPct - bottomPct, 18);

                  return (
                    <div
                      key={d.date}
                      onClick={() => onSelectDate?.(d.date)}
                      onMouseEnter={() => setHoveredDayBar(d)}
                      onMouseLeave={() => setHoveredDayBar(null)}
                      className={`flex-1 flex flex-col items-center h-full justify-end group cursor-pointer p-1 rounded-xl transition-all ${
                        isSelectedDay
                          ? 'bg-rose-500/10 ring-1 ring-rose-500/40'
                          : 'hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <span className="text-[9px] text-neutral-400 font-mono mb-1">{displayVal}</span>
                      <div className="relative w-3.5 sm:w-4 h-[75px] bg-black/5 dark:bg-white/5 rounded-full overflow-hidden flex items-end">
                        <div
                          className={`w-full rounded-full transition-all duration-500 ${
                            isSelectedDay
                              ? selectedMetric === 'sleeping'
                                ? 'bg-gradient-to-t from-indigo-500 to-sky-400'
                                : selectedMetric === 'walking'
                                  ? 'bg-gradient-to-t from-teal-500 to-emerald-400'
                                  : selectedMetric === 'peak'
                                    ? 'bg-gradient-to-t from-amber-500 to-orange-500'
                                    : 'bg-gradient-to-t from-rose-500 via-rose-400 to-amber-400'
                              : selectedMetric === 'sleeping'
                                ? 'bg-indigo-500/70'
                                : selectedMetric === 'walking'
                                  ? 'bg-teal-500/70'
                                  : selectedMetric === 'peak'
                                    ? 'bg-amber-500/70'
                                    : 'bg-gradient-to-t from-rose-500/70 to-amber-400/70'
                          }`}
                          style={{
                            height: `${barHeight}%`,
                            marginBottom: `${bottomPct * 0.7}%`,
                          }}
                        />
                      </div>
                      <span className="text-[9px] text-neutral-400 font-mono mt-1">{d.dayName}</span>
                    </div>
                  );
                })}
              </div>

              {/* Hover Tooltip for Day Bar */}
              {hoveredDayBar && (
                <div className="mt-1 p-2 rounded-xl bg-black/5 dark:bg-white/5 text-[11px] text-neutral-600 dark:text-neutral-300 flex items-center justify-between border border-black/5 dark:border-white/5">
                  <span className="font-bold text-rose-500">{hoveredDayBar.date} ({hoveredDayBar.dayName}) 心率走势:</span>
                  <span>范围 {hoveredDayBar.minHr} - {hoveredDayBar.maxHr} BPM</span>
                  <span>静息 {hoveredDayBar.restingHr} BPM · 睡眠 {hoveredDayBar.sleepingHr} BPM</span>
                  <span className="text-rose-500 font-semibold">👉 点击切换至此日</span>
                </div>
              )}
            </motion.div>
          )}

          {/* Weekly 4-Week Trend Comparison */}
          {activeTab === 'weekly' && (
            <motion.div
              key="weekly"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1">
                <span>周度心肺负荷均值对比 · 4 周全周期</span>
                <span className="text-emerald-500 font-semibold">
                  {weeklyTrends.length > 0
                    ? `最近静息均值 ${weeklyTrends[weeklyTrends.length - 1].avgResting} bpm`
                    : '暂无周度数据'}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-3 h-[100px] items-center">
                {weeklyTrends.length === 0 && (
                  <div className="col-span-4 text-center text-xs text-neutral-400">
                    暂无周度心率趋势数据
                  </div>
                )}
                {weeklyTrends.map((w, idx) => (
                  <div
                    key={w.weekLabel}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      idx === weeklyTrends.length - 1
                        ? 'bg-rose-500/10 border-rose-500/30 ring-1 ring-rose-500/20'
                        : 'bg-black/[0.02] dark:bg-white/[0.02] border-black/5 dark:border-white/5 hover:bg-black/[0.04]'
                    }`}
                  >
                    <span className="text-[10px] text-neutral-400 block font-semibold">{w.weekLabel}</span>
                    <span className="text-base font-black text-neutral-900 dark:text-white block mt-0.5 font-mono">
                      {w.avgResting} <span className="text-[10px] text-neutral-400 font-normal">bpm</span>
                    </span>
                    <span className="text-[9px] text-indigo-400 block mt-0.5">
                      睡 {w.avgSleeping} bpm
                    </span>
                    <span className="text-[9px] text-amber-500 block">
                      峰值 {w.peakHr} bpm
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* HRV SDNN Trend */}
          {activeTab === 'hrv' && (
            <motion.div
              key="hrv"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
                <div className="flex items-center gap-1.5">
                  <Waves className="w-3.5 h-3.5 text-purple-400" />
                  <span>心率变异性 SDNN 压力趋势</span>
                </div>
                <span className="text-purple-400 font-semibold">
                  {vitals.hrvBaseline > 0 && vitals.hrvCurrent > 0
                    ? `基线 ${vitals.hrvBaseline} ms · 当前 ${vitals.hrvCurrent} ms`
                    : '暂无 HRV 数据'}
                </span>
              </div>

              <div className="flex items-end justify-between h-[100px] gap-2 px-1">
                {vitals.hrvTrend.length === 0 && (
                  <div className="w-full h-full flex items-center justify-center text-xs text-neutral-400">
                    暂无 HRV 连续记录
                  </div>
                )}
                {vitals.hrvTrend.slice(-7).map((item, idx, arr) => {
                  const heightPercent = Math.min(Math.max(((item.hrv - 20) / 70) * 100, 15), 100);
                  const isLatest = idx === arr.length - 1;

                  return (
                    <div key={item.date} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] font-bold text-neutral-900 dark:text-white font-mono">
                        {item.hrv}
                      </span>
                      <div className="w-full h-16 bg-black/5 dark:bg-white/5 rounded-t-lg relative flex items-end overflow-hidden">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${heightPercent}%` }}
                          transition={{ duration: 0.8, delay: idx * 0.05 }}
                          className={`w-full rounded-t-lg ${
                            isLatest
                              ? 'bg-gradient-to-t from-purple-600 to-pink-500'
                              : 'bg-gradient-to-t from-purple-800/60 to-purple-500/60'
                          }`}
                        />
                      </div>
                      <span className="text-[9px] text-neutral-400 font-mono">
                        {item.date}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppleCard>
  );
};
