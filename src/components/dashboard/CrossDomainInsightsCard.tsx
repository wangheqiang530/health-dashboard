import React from 'react';
import { AppleCard } from '../ui/AppleCard';
import { Sparkles, Bike, Moon, Zap, Droplet, ShieldCheck, HeartPulse } from 'lucide-react';
import type { DailySummary } from '../../types/health';

interface CrossDomainInsightsCardProps {
  currentDay: DailySummary;
}

export const CrossDomainInsightsCard: React.FC<CrossDomainInsightsCardProps> = ({ currentDay }) => {
  const deepMins = currentDay.sleep.stages.deep;
  const deepHours = (deepMins / 60).toFixed(1);
  const hrv = currentDay.vitals.hrvCurrent;
  const restingHr = currentDay.vitals.restingHr;
  const muscleKg = currentDay.body.skeletalMuscleKg;
  const waterPct = currentDay.body.waterPercent;

  // Cycling or workout intensity
  const cyclingWorkout = currentDay.workouts.find((w) => w.category === 'cycling');
  const activeKcal = currentDay.rings.move.current;
  const cyclingKm = cyclingWorkout?.distanceKm ?? currentDay.cyclingDistanceKm;
  const availableSources = [
    activeKcal > 0 || cyclingKm > 0,
    deepMins > 0,
    hrv > 0 || restingHr > 0,
    (muscleKg || 0) > 0 || (waterPct || 0) > 0,
  ].filter(Boolean).length;

  return (
    <AppleCard className="overflow-hidden border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.04] via-emerald-500/[0.01] to-transparent dark:from-emerald-950/20 dark:via-black/40 dark:to-black/60">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-500 text-neutral-950 shadow-md shadow-emerald-500/20">
            <HeartPulse className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white m-0">
                三方跨域生理联动分析 · Cross-Domain Insights
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {availableSources}/4 类数据已同步
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Apple Watch 动态体征 × Fitdays 17维体成分 × iGPSPORT 码表骑行深度交叉验证
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 self-start sm:self-auto font-mono">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{availableSources === 4 ? '跨域数据完整' : '部分数据缺失'}</span>
        </div>
      </div>

      {/* Narrative Synthesis Banner */}
      <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 mb-4 space-y-1.5 text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
        <p className="m-0 font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            {availableSources === 4
              ? 'Apple Watch、Fitdays 与骑行数据已汇总'
              : '部分数据源当天没有记录'}
          </span>
        </p>
        <p className="m-0 text-neutral-500 dark:text-neutral-400 text-[11px] leading-relaxed">
          当天动态消耗 {activeKcal > 0 ? `${activeKcal} kcal` : '暂无记录'}
          {cyclingKm > 0 ? `，骑行 ${cyclingKm} km` : ''}。
          深度睡眠 {deepMins > 0 ? `${deepHours} 小时` : '暂无记录'}，HRV {hrv > 0 ? `${hrv} ms` : '暂无记录'}，
          静息心率 {restingHr > 0 ? `${restingHr} bpm` : '暂无记录'}。
          {muscleKg ? `体脂秤骨骼肌 ${muscleKg} kg，` : ''}
          {waterPct ? `身体水分率 ${waterPct}%。` : ''}
          此处只汇总已同步的实测数据，不生成医学结论。
        </p>
      </div>

      {/* 4 Multi-Source Physiological Pillars */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs font-mono">
        {/* Pillar 1: Workout Load */}
        <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 space-y-1">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-[10px] font-sans">
            <span className="flex items-center gap-1">
              <Bike className="w-3.5 h-3.5 text-sky-400" />
              码表骑行刺激
            </span>
            <span className="text-sky-400 font-bold">iGPSPORT</span>
          </div>
          <div className="text-lg font-black text-neutral-900 dark:text-white">
            {cyclingKm > 0 ? cyclingKm : '—'} <span className="text-[10px] font-normal text-neutral-500 dark:text-neutral-400">km</span>
          </div>
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-sans block">
            动态消耗 {activeKcal > 0 ? `${activeKcal} kcal` : '暂无'}
          </span>
        </div>

        {/* Pillar 2: Deep Sleep */}
        <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 space-y-1">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-[10px] font-sans">
            <span className="flex items-center gap-1">
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
              深睡糖原重构
            </span>
            <span className="text-indigo-400 font-bold">Watch</span>
          </div>
          <div className="text-lg font-black text-indigo-400">
            {deepMins > 0 ? deepHours : '—'} <span className="text-[10px] font-normal text-neutral-500 dark:text-neutral-400">小时</span>
          </div>
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-sans block">
            深睡占比 {deepMins > 0 && currentDay.sleep.totalMinutes > 0
              ? `${Math.round((deepMins / currentDay.sleep.totalMinutes) * 100)}%`
              : '—'}
          </span>
        </div>

        {/* Pillar 3: HRV Readiness */}
        <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 space-y-1">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-[10px] font-sans">
            <span className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              自主神经恢复
            </span>
            <span className="text-purple-400 font-bold">SDNN</span>
          </div>
          <div className="text-lg font-black text-purple-600 dark:text-purple-400">
            {hrv > 0 ? hrv : '—'} <span className="text-[10px] font-normal text-neutral-500 dark:text-neutral-400">ms</span>
          </div>
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-sans block">
            静息心率 {restingHr > 0 ? `${restingHr} bpm` : '暂无'}
          </span>
        </div>

        {/* Pillar 4: BIA Muscle & Hydration */}
        <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 space-y-1">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-[10px] font-sans">
            <span className="flex items-center gap-1">
              <Droplet className="w-3.5 h-3.5 text-teal-400" />
              体液水合与骨骼肌
            </span>
            <span className="text-teal-400 font-bold">Fitdays</span>
          </div>
          <div className="text-lg font-black text-teal-600 dark:text-teal-300">
            {muscleKg ?? '—'} <span className="text-[10px] font-normal text-neutral-500 dark:text-neutral-400">kg</span>
          </div>
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-sans block">
            水分率 {waterPct ? `${waterPct}%` : '暂无'}
          </span>
        </div>
      </div>
    </AppleCard>
  );
};
