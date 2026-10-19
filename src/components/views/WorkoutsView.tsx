import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { WorkoutRecord } from '../../types/health';
import { AppleCard } from '../ui/AppleCard';
import { WorkoutDetailModal } from '../dashboard/WorkoutDetailModal';
import { AppleTrainingLoadCard } from '../dashboard/AppleTrainingLoadCard';
import { getCalorieFoodEquivalents } from '../../utils/calorieFoods';
import { fetchWorkouts, uploadFitFile } from '../../api/healthApi';
import {
  Bike,
  Activity,
  Dumbbell,
  Footprints,
  Flame,
  Heart,
  Gauge,
  Mountain,
  ChevronDown,
  Timer,
  Calendar,
  CalendarRange,
  UploadCloud,
  Check,
  LoaderCircle,
  X,
} from 'lucide-react';

interface WorkoutsViewProps {
  onRefreshData: () => void;
}

type DatePreset = 'week' | 'month' | '30d' | 'quarter' | 'year' | 'all' | 'custom';

const dateInShanghai = (date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

const shiftDate = (date: string, days: number): string => {
  const value = new Date(`${date}T12:00:00+08:00`);
  value.setDate(value.getDate() + days);
  return dateInShanghai(value);
};

export const WorkoutsView: React.FC<WorkoutsViewProps> = ({ onRefreshData }) => {
  const [allWorkouts, setAllWorkouts] = useState<WorkoutRecord[]>([]);
  const [loadingWorkouts, setLoadingWorkouts] = useState(true);
  const [workoutError, setWorkoutError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | 'cycling' | 'strength' | 'walking'>('all');
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutRecord | null>(null);
  const [hoveredWorkoutId, setHoveredWorkoutId] = useState<string | null>(null);
  const [uploadingFit, setUploadingFit] = useState(false);
  const [fitUploadMessage, setFitUploadMessage] = useState<string | null>(null);
  const fitInputRef = React.useRef<HTMLInputElement | null>(null);

  const loadWorkouts = useCallback(async () => {
    setLoadingWorkouts(true);
    setWorkoutError(null);
    try {
      const result = await fetchWorkouts({
        from: fromDate || undefined,
        to: toDate || undefined,
        limit: 10000,
      });
      setAllWorkouts(result.workouts);
    } catch (error) {
      setWorkoutError(error instanceof Error ? error.message : '读取训练记录失败。');
      setAllWorkouts([]);
    } finally {
      setLoadingWorkouts(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    void loadWorkouts();
  }, [loadWorkouts]);

  const handleFitUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFit(true);
    setFitUploadMessage(null);
    try {
      const res = await uploadFitFile(file);
      setFitUploadMessage(res.message);
      onRefreshData();
      await loadWorkouts();
      setTimeout(() => setFitUploadMessage(null), 4000);
    } catch (err) {
      setFitUploadMessage(`上传失败: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setFitUploadMessage(null), 4000);
    } finally {
      setUploadingFit(false);
      if (fitInputRef.current) fitInputRef.current.value = '';
    }
  };

  const filtered = allWorkouts.filter((w) => {
    if (filterCategory === 'all') return true;
    return w.category === filterCategory;
  });

  const rangeWorkouts = allWorkouts;

  const totalKcal = rangeWorkouts.reduce((acc, cur) => acc + (cur.activeCalories || 0), 0);
  const totalCyclingKm = rangeWorkouts
    .filter((w) => w.category === 'cycling')
    .reduce((acc, cur) => acc + (cur.distanceKm || 0), 0)
    .toFixed(1);
  const totalCyclingMinutes = rangeWorkouts
    .filter((w) => w.category === 'cycling')
    .reduce((acc, cur) => acc + (cur.durationMinutes || 0), 0);
  const totalDurationMinutes = rangeWorkouts.reduce((acc, cur) => acc + (cur.durationMinutes || 0), 0);
  const totalElevationGain = rangeWorkouts.reduce((acc, cur) => acc + (cur.elevationGainM || 0), 0);
  const heartRateWorkouts = rangeWorkouts.filter((w) => w.avgHeartRate > 0);
  const avgHeartRate =
    heartRateWorkouts.length > 0
      ? Math.round(
          heartRateWorkouts.reduce((acc, cur) => acc + cur.avgHeartRate, 0) /
            heartRateWorkouts.length
        )
      : 0;
  const maxHeartRate =
    rangeWorkouts.length > 0
      ? Math.max(...rangeWorkouts.map((w) => w.maxHeartRate || 0))
      : 0;
  const averageCyclingSpeed =
    totalCyclingMinutes > 0 && Number(totalCyclingKm) > 0
      ? (Number(totalCyclingKm) / (totalCyclingMinutes / 60)).toFixed(1)
      : null;
  const periodFood = getCalorieFoodEquivalents(totalKcal);

  const applyDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === 'custom') return;
    const today = dateInShanghai();
    if (preset === 'week') {
      setFromDate(shiftDate(today, -6));
      setToDate(today);
      return;
    }
    if (preset === 'month') {
      setFromDate(`${today.slice(0, 7)}-01`);
      setToDate(today);
      return;
    }
    if (preset === '30d') {
      setFromDate(shiftDate(today, -29));
      setToDate(today);
      return;
    }
    if (preset === 'quarter') {
      const month = Number(today.slice(5, 7));
      const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
      setFromDate(`${today.slice(0, 4)}-${String(quarterStartMonth).padStart(2, '0')}-01`);
      setToDate(today);
      return;
    }
    if (preset === 'year') {
      setFromDate(`${today.slice(0, 4)}-01-01`);
      setToDate(today);
      return;
    }
    setFromDate('');
    setToDate('');
  };

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

  const expandedMetricsFor = (
    workout: WorkoutRecord
  ): Array<{ label: string; value: string; color: string }> => {
    if (workout.category === 'cycling') {
      const speed =
        workout.distanceKm && workout.durationMinutes > 0
          ? `${(workout.distanceKm / (workout.durationMinutes / 60)).toFixed(1)} km/h`
          : '—';
      return [
        { label: '峰值心率', value: workout.maxHeartRate > 0 ? `${workout.maxHeartRate} bpm` : '—', color: 'text-rose-500' },
        { label: '平均速度', value: speed, color: 'text-neutral-900 dark:text-white' },
        {
          label: '踏频 / 平均功率',
          value: `${workout.cadenceAvg ? `${workout.cadenceAvg} rpm` : '—'} / ${
            workout.avgPower ? `${workout.avgPower} W` : '—'
          }`,
          color: 'text-[#73A800] dark:text-[#A1FF00]',
        },
        {
          label: 'NP / IF',
          value: `${workout.normalizedPower ? `${workout.normalizedPower} W` : '—'} / ${
            workout.intensityFactor ? workout.intensityFactor.toFixed(2) : '—'
          }`,
          color: 'text-amber-500',
        },
        { label: 'TSS', value: workout.tss ? workout.tss.toFixed(1) : '—', color: 'text-purple-500' },
        {
          label: '左右平衡',
          value: workout.leftRightBalance
            ? `${workout.leftRightBalance.left}/${workout.leftRightBalance.right}`
            : '—',
          color: 'text-cyan-500',
        },
      ];
    }
    if (workout.category === 'strength' || workout.category === 'hiit') {
      return [
        { label: '峰值心率', value: workout.maxHeartRate > 0 ? `${workout.maxHeartRate} bpm` : '—', color: 'text-rose-500' },
        { label: '平均心率', value: workout.avgHeartRate > 0 ? `${workout.avgHeartRate} bpm` : '—', color: 'text-rose-400' },
        { label: '训练时长', value: `${workout.durationMinutes} 分钟`, color: 'text-sky-500' },
        { label: '动态消耗', value: `${workout.activeCalories} kcal`, color: 'text-amber-500' },
      ];
    }
    return [
      { label: '峰值心率', value: workout.maxHeartRate > 0 ? `${workout.maxHeartRate} bpm` : '—', color: 'text-rose-500' },
      { label: '平均配速', value: workout.paceAvg || '—', color: 'text-neutral-900 dark:text-white' },
      { label: '步频', value: workout.cadenceAvg ? `${workout.cadenceAvg} spm` : '—', color: 'text-[#73A800] dark:text-[#A1FF00]' },
      { label: '距离', value: workout.distanceKm ? `${workout.distanceKm} km` : '—', color: 'text-cyan-500' },
    ];
  };

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

          <div className="flex flex-wrap bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-black/5 dark:border-white/5 self-start md:self-auto">
            {[
              { key: 'week', label: '最近一周' },
              { key: 'month', label: '本月' },
              { key: '30d', label: '最近 30 天' },
              { key: 'quarter', label: '本季度' },
              { key: 'year', label: '今年' },
              { key: 'all', label: '全部' },
            ].map((range) => (
              <button
                key={range.key}
                type="button"
                onClick={() => applyDatePreset(range.key as DatePreset)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
                  datePreset === range.key
                    ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <CalendarRange className="w-4 h-4 text-sky-500" />
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">日期区间</span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => {
                setDatePreset('custom');
                setFromDate(event.target.value);
              }}
              className="h-9 px-2.5 rounded-xl bg-white/70 dark:bg-black/30 border border-black/10 dark:border-white/10 text-xs text-neutral-800 dark:text-neutral-200 outline-none focus:border-sky-500/60"
            />
            <span>至</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => {
                setDatePreset('custom');
                setToDate(event.target.value);
              }}
              className="h-9 px-2.5 rounded-xl bg-white/70 dark:bg-black/30 border border-black/10 dark:border-white/10 text-xs text-neutral-800 dark:text-neutral-200 outline-none focus:border-sky-500/60"
            />
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={() => applyDatePreset('all')}
                className="h-8 px-2 rounded-lg text-[11px] text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                清除
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-neutral-400">
            {loadingWorkouts ? (
              <>
                <LoaderCircle className="w-3.5 h-3.5 animate-spin text-sky-500" />
                正在读取区间记录...
              </>
            ) : (
              <>
                <span className="font-mono text-neutral-700 dark:text-neutral-200">
                  {fromDate || '最早'} → {toDate || '今天'}
                </span>
                <span>·</span>
                <span>{allWorkouts.length} 条记录</span>
              </>
            )}
          </div>
        </div>

        {workoutError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500 flex items-center gap-2">
            <X className="w-4 h-4" />
            {workoutError}
          </div>
        )}

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
            <span className="text-[10px] text-neutral-400 mt-1 block font-medium">
              {rangeWorkouts.length > 0 ? `${rangeWorkouts.length} 场训练累计` : '当前周期无训练记录'}
            </span>
            <span className="text-[10px] text-amber-400 mt-0.5 truncate block font-sans" title={`等效食物: ≈ ${periodFood.description}`}>
              ≈ {periodFood.emojis} {periodFood.description}
            </span>
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
            <span className="text-[10px] text-teal-400 mt-1 block font-medium">
              {averageCyclingSpeed ? `均速 ${averageCyclingSpeed} km/h` : '暂无骑行速度数据'}
            </span>
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
            <span className="text-[10px] text-neutral-400 mt-1 block">共 {rangeWorkouts.length} 场训练</span>
          </div>

          <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
            <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
              <Mountain className="w-3.5 h-3.5 text-amber-500" />
              <span>累计爬升海拔</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-amber-500 font-mono">
                {totalElevationGain > 0 ? totalElevationGain : '—'}
              </span>
              <span className="text-[10px] text-neutral-400">m</span>
            </div>
            <span className="text-[10px] text-neutral-400 mt-1 block">气压计高程</span>
          </div>

          <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
            <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              <span>平均心率</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-rose-500 dark:text-rose-400 font-mono">
                {avgHeartRate > 0 ? avgHeartRate : '—'}
              </span>
              <span className="text-[10px] text-neutral-400">bpm</span>
            </div>
            <span className="text-[10px] text-neutral-400 mt-1 block font-medium">
              {avgHeartRate > 0 ? '训练平均心率实测' : '暂无心率数据'}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
            <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
              <Gauge className="w-3.5 h-3.5 text-purple-400" />
              <span>峰值心率</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-neutral-900 dark:text-white font-mono">
                {maxHeartRate > 0 ? maxHeartRate : '—'}
              </span>
              <span className="text-[10px] text-neutral-400">bpm</span>
            </div>
            <span className="text-[10px] text-neutral-400 mt-1 block">
              {maxHeartRate > 0 ? '训练峰值心率实测' : '暂无心率数据'}
            </span>
          </div>
        </div>
      </AppleCard>

      {/* iOS 18 Training Load Bento Module (User Requirement) */}
      <AppleTrainingLoadCard workouts={allWorkouts} />

      {/* Filter Tabs & Expandable Workouts List */}
      <AppleCard>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
              运动记录清单 (鼠标悬停展开关键指标，点击查看完整报告)
            </h3>
            <span className="text-[11px] text-neutral-400">已载入全部 {allWorkouts.length} 场训练数据</span>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {/* Upload single .fit file button */}
            <input
              ref={fitInputRef}
              type="file"
              accept=".fit"
              onChange={handleFitUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fitInputRef.current?.click()}
              disabled={uploadingFit}
              className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/25 hover:bg-sky-500/20 transition-all cursor-pointer flex items-center gap-1.5"
              title="上传单次码表原始 .fit 运动记录"
            >
              <UploadCloud className={`w-3.5 h-3.5 ${uploadingFit ? 'animate-bounce' : ''}`} />
              <span>{uploadingFit ? '解析中...' : '导入 .fit 文件'}</span>
            </button>

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
        </div>

        {fitUploadMessage && (
          <div className="mb-3 p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>{fitUploadMessage}</span>
          </div>
        )}

        {/* Workouts Feed: Hover expands drawer, click opens full modal */}
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="py-10 text-center text-sm text-neutral-400">
              当前筛选条件下暂无运动记录。
            </div>
          )}
          {filtered.map((w) => {
            const Icon = getCategoryIcon(w.category);
            const isHovered = hoveredWorkoutId === w.id;
            const isIgpsport = w.source === 'igpsport' || w.id.startsWith('igpsport');
            const food = getCalorieFoodEquivalents(w.activeCalories);

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
                        {/* Data Source Badge (User Requirement) */}
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${
                          isIgpsport
                            ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                            : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        }`}>
                          {isIgpsport ? (
                            <>
                              <Bike className="w-3 h-3 text-sky-400" />
                              <span>iGPSPORT</span>
                            </>
                          ) : (
                            <>
                              <Activity className="w-3 h-3 text-rose-400" />
                              <span>Apple Watch</span>
                            </>
                          )}
                        </span>
                        {w.routeGpxPoints && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-[#00F5D4]/20 text-[#00F5D4] border border-[#00F5D4]/30">
                            GPX 轨迹
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {w.date || '—'}
                        </span>
                        <span>•</span>
                        <span>{w.startTime}</span>
                        <span>•</span>
                        <span>{w.durationMinutes} 分钟</span>
                        {w.distanceKm &&
                          ['cycling', 'running', 'walking', 'swimming'].includes(w.category) && (
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
                        <span className="text-xs ml-0.5" title={`≈ ${food.description}`}>{food.emojis}</span>
                      </div>
                      <div className="flex items-center gap-1 justify-end text-xs text-neutral-400 mt-0.5">
                        <Heart className="w-3 h-3 text-rose-500" />
                        <span>均心率 {w.avgHeartRate > 0 ? `${w.avgHeartRate} bpm` : '—'}</span>
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
                      <div className={`grid grid-cols-2 gap-2 text-xs mb-2 ${
                        w.category === 'cycling' ? 'sm:grid-cols-3 xl:grid-cols-6' : 'sm:grid-cols-4'
                      }`}>
                        {expandedMetricsFor(w).map((metric) => (
                          <div key={metric.label} className="p-2 rounded-xl bg-black/5 dark:bg-white/5">
                            <span className="text-neutral-400 block text-[10px]">{metric.label}</span>
                            <span className={`font-bold font-mono text-sm ${metric.color}`}>
                              {metric.value}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Heart Rate Zones Mini Bar */}
                      <div className="flex items-center gap-2 text-[10px] text-neutral-400 pt-1">
                        <span>心率区间:</span>
                        {Object.values(w.hrZones).some((value) => value > 0) ? (
                          <div className="flex-1 h-2 rounded-full overflow-hidden flex bg-white/10">
                            <div style={{ width: `${w.hrZones.zone1}%` }} className="h-full bg-sky-400" title="Zone 1" />
                            <div style={{ width: `${w.hrZones.zone2}%` }} className="h-full bg-emerald-400" title="Zone 2" />
                            <div style={{ width: `${w.hrZones.zone3}%` }} className="h-full bg-yellow-400" title="Zone 3" />
                            <div style={{ width: `${w.hrZones.zone4}%` }} className="h-full bg-orange-400" title="Zone 4" />
                            <div style={{ width: `${w.hrZones.zone5}%` }} className="h-full bg-rose-500" title="Zone 5" />
                          </div>
                        ) : (
                          <span className="flex-1">未提供心率区间明细</span>
                        )}
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
