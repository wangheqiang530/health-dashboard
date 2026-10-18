import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { HeartRatePoint, VitalsData } from '../../types/health';
import { AppleCard } from '../ui/AppleCard';
import { Heart, Waves, Moon, Footprints, Flame } from 'lucide-react';

interface HeartRateCardProps {
  timeline: HeartRatePoint[];
  vitals: VitalsData;
}

export const HeartRateCard: React.FC<HeartRateCardProps> = ({ timeline, vitals }) => {
  const [hoveredPoint, setHoveredPoint] = useState<HeartRatePoint | null>(null);
  const [activeTab, setActiveTab] = useState<'hourly' | 'daily' | 'weekly' | 'hrv'>('hourly');

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

  // Daily 7-day range data
  const dailyRanges = vitals.dailyHrRanges || [
    { date: '10-11', dayName: '周日', minHr: 48, maxHr: 165, restingHr: 49, sleepingHr: 51, avgHr: 74 },
    { date: '10-12', dayName: '周一', minHr: 47, maxHr: 142, restingHr: 49, sleepingHr: 53, avgHr: 72 },
    { date: '10-13', dayName: '周二', minHr: 46, maxHr: 138, restingHr: 49, sleepingHr: 50, avgHr: 71 },
    { date: '10-14', dayName: '周三', minHr: 47, maxHr: 154, restingHr: 49, sleepingHr: 52, avgHr: 73 },
    { date: '10-15', dayName: '周四', minHr: 45, maxHr: 146, restingHr: 47, sleepingHr: 49, avgHr: 69 },
    { date: '10-16', dayName: '周五', minHr: 46, maxHr: 140, restingHr: 46, sleepingHr: 48, avgHr: 70 },
    { date: '10-17', dayName: '周六', minHr: 48, maxHr: 145, restingHr: 50, sleepingHr: 53, avgHr: 71 },
  ];

  // Weekly 4-week trend data
  const weeklyTrends = vitals.weeklyHrTrends || [
    { weekLabel: '第38周', avgResting: 51, avgSleeping: 54, minRange: 46, maxRange: 168 },
    { weekLabel: '第39周', avgResting: 49, avgSleeping: 52, minRange: 45, maxRange: 172 },
    { weekLabel: '第40周', avgResting: 48, avgSleeping: 50, minRange: 46, maxRange: 165 },
    { weekLabel: '本周', avgResting: 48, avgSleeping: 51, minRange: 45, maxRange: 165 },
  ];

  const sleepingHrValue = vitals.sleepingHr || 50;
  const walkingHrValue = vitals.walkingHrAvg || 78;
  const peakHr = timeline.length > 0 ? Math.max(...timeline.map((p) => p.hr)) : 140;
  const peakZoneLabel = peakHr >= 165 ? '极限无氧区' : peakHr >= 140 ? '有氧耐力区' : '日常燃脂区';

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
          <div className="p-2.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05]">
            <span className="text-[10px] text-neutral-400 block mb-0.5">最新心率</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
                {vitals.latestHr}
              </span>
              <span className="text-[10px] text-rose-500 font-semibold">BPM</span>
            </div>
            <span className="text-[9px] text-emerald-500 mt-0.5 block">即时监测</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05]">
            <span className="text-[10px] text-neutral-400 block mb-0.5">静息心率</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
                {vitals.restingHr}
              </span>
              <span className="text-[10px] text-neutral-400 font-medium">BPM</span>
            </div>
            <span className="text-[9px] text-emerald-500 mt-0.5 block">优秀水平</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05]">
            <div className="flex items-center gap-1 text-[10px] text-neutral-400 mb-0.5">
              <Moon className="w-2.5 h-2.5 text-indigo-400" />
              <span>睡眠心率</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-indigo-500 dark:text-indigo-400 tracking-tight">
                {sleepingHrValue}
              </span>
              <span className="text-[10px] text-neutral-400 font-medium">BPM</span>
            </div>
            <span className="text-[9px] text-indigo-400 mt-0.5 block">深层休整</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05]">
            <div className="flex items-center gap-1 text-[10px] text-neutral-400 mb-0.5">
              <Footprints className="w-2.5 h-2.5 text-teal-400" />
              <span>步行均值</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
                {walkingHrValue}
              </span>
              <span className="text-[10px] text-neutral-400 font-medium">BPM</span>
            </div>
            <span className="text-[9px] text-teal-500 mt-0.5 block">平稳舒缓</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05]">
            <div className="flex items-center gap-1 text-[10px] text-neutral-400 mb-0.5">
              <Waves className="w-2.5 h-2.5 text-purple-400" />
              <span>HRV (SDNN)</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-purple-500 dark:text-purple-400 tracking-tight">
                {vitals.hrvCurrent}
              </span>
              <span className="text-[10px] text-neutral-400">ms</span>
            </div>
            <span className="text-[9px] text-purple-400 mt-0.5 block">副交感活跃</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05]">
            <div className="flex items-center gap-1 text-[10px] text-neutral-400 mb-0.5">
              <Flame className="w-2.5 h-2.5 text-amber-500" />
              <span>运动峰值</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-amber-500 tracking-tight">
                {peakHr}
              </span>
              <span className="text-[10px] text-neutral-400">BPM</span>
            </div>
            <span className="text-[9px] text-amber-500 mt-0.5 block">{peakZoneLabel}</span>
          </div>
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
              <svg
                className="w-full h-full overflow-visible"
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

                {/* Points */}
                {points.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={p.x}
                    cy={p.y}
                    r={p.pt.isWorkout ? 4 : 2}
                    fill={p.pt.isWorkout ? '#FFD60A' : '#FA114F'}
                    stroke="#1c1c22"
                    strokeWidth="1"
                    className="cursor-pointer hover:r-5 transition-all"
                    onMouseEnter={() => setHoveredPoint(p.pt)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                ))}
              </svg>

              {/* Hover Tooltip */}
              {hoveredPoint && (
                <div className="absolute top-1 right-2 px-2.5 py-1 rounded-xl bg-neutral-900/95 border border-white/20 text-xs shadow-xl text-white backdrop-blur-md flex items-center gap-2 pointer-events-none">
                  <span className="text-neutral-400 font-mono text-[10px]">{hoveredPoint.time}</span>
                  <span className="font-bold text-rose-400">{hoveredPoint.hr} BPM</span>
                  {hoveredPoint.isWorkout && (
                    <span className="px-1 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300">
                      体能时段
                    </span>
                  )}
                </div>
              )}

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
                <span className="font-medium">每日心率范围 (最高 - 最低) 及 静息/睡眠锚点</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" />静息心率</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400" />睡眠心率</span>
                </div>
              </div>

              <div className="flex items-end justify-between h-[100px] gap-2 px-1">
                {dailyRanges.map((d, idx) => {
                  const bottomPct = ((d.minHr - 40) / 120) * 100;
                  const topPct = ((d.maxHr - 40) / 120) * 100;
                  const barHeight = Math.max(topPct - bottomPct, 15);
                  const isLatest = idx === dailyRanges.length - 1;

                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center h-full justify-end group">
                      <span className="text-[9px] text-neutral-400 font-mono mb-1">{d.maxHr}</span>
                      <div className="relative w-3 sm:w-4 h-[75px] bg-black/5 dark:bg-white/5 rounded-full overflow-hidden flex items-end">
                        <div
                          className={`w-full rounded-full transition-all duration-500 ${
                            isLatest
                              ? 'bg-gradient-to-t from-rose-500 via-rose-400 to-amber-400'
                              : 'bg-gradient-to-t from-rose-500/70 to-amber-400/70'
                          }`}
                          style={{
                            height: `${barHeight}%`,
                            marginBottom: `${bottomPct * 0.4}%`,
                          }}
                        />
                      </div>
                      <span className="text-[9px] text-neutral-400 font-mono mt-1">{d.dayName}</span>
                    </div>
                  );
                })}
              </div>
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
                <span>周度心肺负荷均值对比</span>
                <span className="text-emerald-500 font-semibold">静息均值 48 bpm · 心肌耐受极佳</span>
              </div>

              <div className="grid grid-cols-4 gap-3 h-[95px] items-center">
                {weeklyTrends.map((w, idx) => (
                  <div
                    key={w.weekLabel}
                    className={`p-2.5 rounded-xl border text-center ${
                      idx === weeklyTrends.length - 1
                        ? 'bg-rose-500/10 border-rose-500/30'
                        : 'bg-black/[0.02] dark:bg-white/[0.02] border-black/5 dark:border-white/5'
                    }`}
                  >
                    <span className="text-[10px] text-neutral-400 block">{w.weekLabel}</span>
                    <span className="text-base font-black text-neutral-900 dark:text-white block mt-0.5">
                      {w.avgResting} <span className="text-[10px] text-neutral-400 font-normal">bpm</span>
                    </span>
                    <span className="text-[9px] text-indigo-400 block mt-0.5">
                      睡 {w.avgSleeping} bpm
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
                  <span>7 日心率变异性 (SDNN 趋势)</span>
                </div>
                <span className="text-purple-400 font-semibold">个人基线 62 ms · 当前 72 ms</span>
              </div>

              <div className="flex items-end justify-between h-[95px] gap-3 px-2">
                {vitals.hrvTrend.map((item, idx) => {
                  const heightPercent = Math.min(Math.max(((item.hrv - 35) / 50) * 100, 15), 100);
                  const isLatest = idx === vitals.hrvTrend.length - 1;

                  return (
                    <div key={item.date} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] font-bold text-neutral-900 dark:text-white font-mono">
                        {item.hrv}
                      </span>
                      <div className="w-full h-14 bg-black/5 dark:bg-white/5 rounded-t-lg relative flex items-end overflow-hidden">
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
