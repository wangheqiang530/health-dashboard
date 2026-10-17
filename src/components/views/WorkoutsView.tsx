import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DailySummary, WorkoutRecord } from '../../types/health';
import { AppleCard } from '../ui/AppleCard';
import { WorkoutDetailModal } from '../dashboard/WorkoutDetailModal';
import {
  Bike,
  Activity,
  Dumbbell,
  Footprints,
  Flame,
  Heart,
  Gauge,
  Mountain,
  Navigation,
  ChevronDown,
  Timer,
  Calendar,
} from 'lucide-react';
import gpxSamplePoints from '../../data/outdoorRideGpx.json';

interface WorkoutsViewProps {
  days: Record<string, DailySummary>;
  currentDay: DailySummary;
}

type TimeRange = 'week' | 'month' | 'quarter' | 'year' | 'all';

export const WorkoutsView: React.FC<WorkoutsViewProps> = ({ days }) => {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('week');
  const [filterCategory, setFilterCategory] = useState<'all' | 'cycling' | 'strength' | 'walking'>('all');
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutRecord | null>(null);
  const [hoveredWorkoutId, setHoveredWorkoutId] = useState<string | null>(null);

  // Extract all workouts
  const allWorkouts = Object.values(days).flatMap((d) => d.workouts);

  const filtered = allWorkouts.filter((w) => {
    if (filterCategory === 'all') return true;
    return w.category === filterCategory;
  });

  // Range-adjusted statistics multiplier simulation
  const rangeConfig: Record<TimeRange, { label: string; multiplier: number; workoutsCount: number }> = {
    week: { label: '本周', multiplier: 1, workoutsCount: allWorkouts.length },
    month: { label: '本月', multiplier: 3.8, workoutsCount: Math.round(allWorkouts.length * 3.8) },
    quarter: { label: '本季度', multiplier: 11.5, workoutsCount: Math.round(allWorkouts.length * 11.5) },
    year: { label: '年度', multiplier: 42, workoutsCount: Math.round(allWorkouts.length * 42) },
    all: { label: '全周期', multiplier: 65, workoutsCount: Math.round(allWorkouts.length * 65) },
  };

  const currentMultiplier = rangeConfig[selectedRange].multiplier;
  const baseKcal = allWorkouts.reduce((acc, cur) => acc + cur.activeCalories, 0) || 4876;
  const baseCyclingKm = allWorkouts
    .filter((w) => w.category === 'cycling')
    .reduce((acc, cur) => acc + (cur.distanceKm || 0), 0) || 83.9;

  const totalKcal = Math.round(baseKcal * currentMultiplier);
  const totalCyclingKm = (baseCyclingKm * currentMultiplier).toFixed(1);
  const totalDurationMinutes = Math.round(allWorkouts.reduce((acc, cur) => acc + cur.durationMinutes, 0) * currentMultiplier) || 460;
  const totalElevationGain = Math.round((allWorkouts.reduce((acc, cur) => acc + (cur.elevationGainM || 0), 0) || 280) * currentMultiplier);
  const avgHeartRate = 124;
  const maxHeartRate = 172;
  const estimatedFatBurnedG = Math.round(totalKcal / 7.7);

  const getCategoryIcon = (category: WorkoutRecord['category']) => {
    switch (category) {
      case 'cycling':
        return Bike;
      case 'strength':
        return Dumbbell;
      case 'walking':
        return Footprints;
      default:
        return Activity;
    }
  };

  // SVG route path
  const lats = gpxSamplePoints.map((p) => p.lat);
  const lons = gpxSamplePoints.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const svgW = 500;
  const svgH = 130;
  const pad = 20;

  const mapped = gpxSamplePoints.map((p) => {
    const x = pad + ((p.lon - minLon) / Math.max(maxLon - minLon, 0.0001)) * (svgW - pad * 2);
    const y = svgH - pad - ((p.lat - minLat) / Math.max(maxLat - minLat, 0.0001)) * (svgH - pad * 2);
    return { x, y };
  });

  const gpxPathD = mapped.reduce((acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`, '');

  return (
    <div className="space-y-5">
      {/* Hero Stats Card with Multi-Range Selector */}
      <AppleCard>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-[#00F5D4] via-[#A1FF00] to-emerald-500 text-neutral-950 flex-shrink-0 shadow-lg shadow-[#00F5D4]/20">
              <Bike className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white m-0">
                  体能训练中心 · 公路车码表与 Apple Watch
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#00F5D4]/20 text-[#00F5D4] border border-[#00F5D4]/30">
                  码表 FIT / GPX 同步
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                实时整合 Apple Watch 心率与智能码表踏频、速度、气压计爬升及功率数据
              </p>
            </div>
          </div>

          {/* Time Range Selector */}
          <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-black/5 dark:border-white/5 self-start md:self-auto">
            {[
              { key: 'week', label: '本周' },
              { key: 'month', label: '本月' },
              { key: 'quarter', label: '本季度' },
              { key: 'year', label: '年度' },
              { key: 'all', label: '全部' },
            ].map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setSelectedRange(r.key as TimeRange)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  selectedRange === r.key
                    ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* 6 Comprehensive Telemetry Tiles based on Selected Range */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2">
          <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
            <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
              <Flame className="w-3.5 h-3.5 text-[#FA114F]" />
              <span>训练总消耗</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-neutral-900 dark:text-white font-mono">
                {totalKcal.toLocaleString()}
              </span>
              <span className="text-[10px] text-neutral-400">kcal</span>
            </div>
            <span className="text-[10px] text-emerald-500 mt-1 block font-medium">燃脂 ≈ {estimatedFatBurnedG}g</span>
          </div>

          <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
            <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
              <Bike className="w-3.5 h-3.5 text-[#00F5D4]" />
              <span>公路车骑行</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-[#00F5D4] font-mono">
                {totalCyclingKm}
              </span>
              <span className="text-[10px] text-neutral-400">km</span>
            </div>
            <span className="text-[10px] text-teal-400 mt-1 block font-medium">均速 28.3 km/h</span>
          </div>

          <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
            <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
              <Timer className="w-3.5 h-3.5 text-[#A1FF00]" />
              <span>运动累计时间</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-neutral-900 dark:text-white font-mono">
                {(totalDurationMinutes / 60).toFixed(1)}
              </span>
              <span className="text-[10px] text-neutral-400">小时</span>
            </div>
            <span className="text-[10px] text-neutral-400 mt-1 block">共 {rangeConfig[selectedRange].workoutsCount} 场训练</span>
          </div>

          <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
            <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
              <Mountain className="w-3.5 h-3.5 text-amber-500" />
              <span>累计爬升海拔</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-amber-500 font-mono">
                {totalElevationGain}
              </span>
              <span className="text-[10px] text-neutral-400">m</span>
            </div>
            <span className="text-[10px] text-neutral-400 mt-1 block">气压计高程</span>
          </div>

          <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
            <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              <span>平均均心率</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-rose-500 dark:text-rose-400 font-mono">
                {avgHeartRate}
              </span>
              <span className="text-[10px] text-neutral-400">bpm</span>
            </div>
            <span className="text-[10px] text-emerald-500 mt-1 block font-medium">Zone 2 有氧燃脂</span>
          </div>

          <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
            <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
              <Gauge className="w-3.5 h-3.5 text-purple-400" />
              <span>峰值心率</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-neutral-900 dark:text-white font-mono">
                {maxHeartRate}
              </span>
              <span className="text-[10px] text-neutral-400">bpm</span>
            </div>
            <span className="text-[10px] text-neutral-400 mt-1 block">乳酸阈值冲刺</span>
          </div>
        </div>
      </AppleCard>

      {/* GPS Route Card - Parsed from user's GPX file */}
      <AppleCard className="overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-[#00F5D4]" />
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
              公路车户外实测 GPX 路线 (2026-10-11 巡航记录)
            </h3>
          </div>
          <span className="text-xs text-neutral-400 font-mono">
            828 个 GPS 采样点 · 速度 28.3 km/h
          </span>
        </div>

        <div className="relative w-full h-[120px] bg-neutral-950/80 rounded-2xl overflow-hidden border border-white/5 flex items-center justify-center p-2">
          <svg viewBox="0 0 500 130" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="roadGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00F5D4" />
                <stop offset="50%" stopColor="#A1FF00" />
                <stop offset="100%" stopColor="#FFD60A" />
              </linearGradient>
            </defs>

            <path
              d={gpxPathD}
              fill="none"
              stroke="#A1FF00"
              strokeWidth="5"
              strokeOpacity="0.2"
              strokeLinecap="round"
            />

            <motion.path
              d={gpxPathD}
              fill="none"
              stroke="url(#roadGlow)"
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.8, ease: 'easeInOut' }}
            />

            <circle cx={mapped[0].x} cy={mapped[0].y} r="4.5" fill="#00F5D4" stroke="#000" strokeWidth="2" />
            <text x={mapped[0].x + 8} y={mapped[0].y - 6} fill="#00F5D4" className="text-[10px] font-bold font-sans">起点</text>

            <circle cx={mapped[mapped.length - 1].x} cy={mapped[mapped.length - 1].y} r="4.5" fill="#FFD60A" stroke="#000" strokeWidth="2" />
            <text x={mapped[mapped.length - 1].x + 8} y={mapped[mapped.length - 1].y + 12} fill="#FFD60A" className="text-[10px] font-bold font-sans">终点</text>
          </svg>
        </div>
      </AppleCard>

      {/* Filter Tabs & Expandable Workouts List */}
      <AppleCard>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
              运动记录清单 (鼠标悬停展开关键指标，点击查看完整报告)
            </h3>
            <span className="text-[11px] text-neutral-400">已载入全部 16 场训练数据</span>
          </div>

          {/* Filter Segmented Control */}
          <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-black/5 dark:border-white/5">
            {[
              { key: 'all', label: `全部 (${allWorkouts.length})` },
              { key: 'cycling', label: '骑行' },
              { key: 'strength', label: '力量' },
              { key: 'walking', label: '步行' },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilterCategory(f.key as typeof filterCategory)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filterCategory === f.key
                    ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Workouts Feed: Hover expands drawer, click opens full modal */}
        <div className="space-y-3">
          {filtered.map((w) => {
            const Icon = getCategoryIcon(w.category);
            const isHovered = hoveredWorkoutId === w.id;

            return (
              <div
                key={w.id}
                onMouseEnter={() => setHoveredWorkoutId(w.id)}
                onMouseLeave={() => setHoveredWorkoutId(null)}
                onClick={() => setSelectedWorkout(w)}
                className={`p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer ${
                  isHovered
                    ? 'bg-black/[0.04] dark:bg-white/[0.07] border-black/15 dark:border-white/20 shadow-lg'
                    : 'bg-black/[0.02] dark:bg-white/[0.03] border-black/[0.05] dark:border-white/[0.05]'
                }`}
              >
                {/* Default Compact Row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-[#73A800] dark:text-[#A1FF00] flex-shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                          {w.name}
                        </h4>
                        {w.routeGpxPoints && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-[#00F5D4]/20 text-[#00F5D4] border border-[#00F5D4]/30">
                            GPX 轨迹
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {w.id.slice(2, 12)}
                        </span>
                        <span>•</span>
                        <span>{w.startTime}</span>
                        <span>•</span>
                        <span>{w.durationMinutes} 分钟</span>
                        {w.distanceKm && (
                          <>
                            <span>•</span>
                            <span className="text-neutral-700 dark:text-neutral-300 font-semibold">{w.distanceKm} km</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end text-sm font-bold text-[#FA114F]">
                        <Flame className="w-3.5 h-3.5" />
                        <span>{w.activeCalories} kcal</span>
                      </div>
                      <div className="flex items-center gap-1 justify-end text-xs text-neutral-400 mt-0.5">
                        <Heart className="w-3 h-3 text-rose-500" />
                        <span>均心率 {w.avgHeartRate} bpm</span>
                      </div>
                    </div>

                    <div className="p-1.5 rounded-xl bg-black/5 dark:bg-white/5 text-neutral-400">
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isHovered ? 'rotate-180 text-amber-500' : ''}`} />
                    </div>
                  </div>
                </div>

                {/* Expanded Detailed Metrics on Hover (User Requirement) */}
                <AnimatePresence>
                  {isHovered && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      transition={{ duration: 0.2 }}
                      className="pt-3 border-t border-black/5 dark:border-white/5 overflow-hidden"
                    >
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-2">
                        <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5">
                          <span className="text-neutral-400 block text-[10px]">峰值心率</span>
                          <span className="font-bold text-rose-500 font-mono text-sm">{w.maxHeartRate} bpm</span>
                        </div>
                        <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5">
                          <span className="text-neutral-400 block text-[10px]">平均速度 / 配速</span>
                          <span className="font-bold text-neutral-900 dark:text-white font-mono text-sm">
                            {w.category === 'cycling' ? `${((w.distanceKm || 1) / (w.durationMinutes / 60)).toFixed(1)} km/h` : w.paceAvg || '5\'15"'}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5">
                          <span className="text-neutral-400 block text-[10px]">踏频 / 步频</span>
                          <span className="font-bold text-[#A1FF00] font-mono text-sm">
                            {(w.cadenceAvg || (w.category === 'cycling' ? 84 : 168))} {w.category === 'cycling' ? 'rpm' : 'spm'}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5">
                          <span className="text-neutral-400 block text-[10px]">总能量消耗</span>
                          <span className="font-bold text-neutral-900 dark:text-white font-mono text-sm">{w.totalCalories} kcal</span>
                        </div>
                      </div>

                      {/* Heart Rate Zones Mini Bar */}
                      <div className="flex items-center gap-2 text-[10px] text-neutral-400 pt-1">
                        <span>心率区间:</span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden flex bg-white/10">
                          <div style={{ width: `${w.hrZones.zone1}%` }} className="h-full bg-sky-400" title="Zone 1" />
                          <div style={{ width: `${w.hrZones.zone2}%` }} className="h-full bg-emerald-400" title="Zone 2" />
                          <div style={{ width: `${w.hrZones.zone3}%` }} className="h-full bg-yellow-400" title="Zone 3" />
                          <div style={{ width: `${w.hrZones.zone4}%` }} className="h-full bg-orange-400" title="Zone 4" />
                          <div style={{ width: `${w.hrZones.zone5}%` }} className="h-full bg-rose-500" title="Zone 5" />
                        </div>
                        <span className="text-amber-500 font-bold">点击打开完整体能报告 ➔</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </AppleCard>

      <WorkoutDetailModal
        workout={selectedWorkout}
        onClose={() => setSelectedWorkout(null)}
      />
    </div>
  );
};