import React from 'react';
import type { BodyComposition } from '../../types/health';
import { AppleCard } from '../ui/AppleCard';
import { Scale, TrendingDown, TrendingUp, ShieldCheck, Activity, Sparkles, ChevronRight } from 'lucide-react';

interface BodyCompositionCardProps {
  body: BodyComposition;
}

export const BodyCompositionCard: React.FC<BodyCompositionCardProps> = ({ body }) => {
  const leanPercent = Math.round((body.leanMassKg / Math.max(body.weightKg, 1)) * 100);
  const fatPercent = Math.round(body.bodyFatPercent);
  const boneMassEst = body.boneMassKg;

  const trendPoints = body.trend || [];
  const startWeight = trendPoints[0]?.weight;
  const weightDiff =
    startWeight !== undefined ? Number((body.weightKg - startWeight).toFixed(1)) : undefined;

  return (
    <AppleCard className="overflow-visible h-full flex flex-col justify-between relative">
      <div>
        {/* Header - 身体成分 (User Comment 6) */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 text-amber-500 border border-amber-500/30 flex-shrink-0">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-wider text-neutral-500 dark:text-neutral-400 uppercase">
                身体成分
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{body.statusLabel}</span>
          </div>
        </div>

        {/* Primary 2-Column: Weight & Body Fat Tiles */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* 1. Weight Tile (User Comment 1: No static line; hover shows 7-day trend with data values) */}
          <div className="relative group/weight p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.05] hover:border-amber-500/40 transition-all duration-200 cursor-pointer">
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              <span>当前体重</span>
              <span className="flex items-center text-[10px] text-emerald-500 dark:text-emerald-400 font-semibold">
                {weightDiff === undefined ? (
                  <span>暂无周初对比</span>
                ) : (
                  <>
                    {weightDiff <= 0 ? (
                      <TrendingDown className="w-3 h-3 mr-0.5" />
                    ) : (
                      <TrendingUp className="w-3 h-3 mr-0.5 text-amber-500" />
                    )}
                    {weightDiff > 0 ? `+${weightDiff}` : `${weightDiff}`} kg vs 周初
                  </>
                )}
              </span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
                {body.weightKg > 0 ? body.weightKg : '—'}
              </span>
              <span className="text-xs text-neutral-400 font-semibold">kg</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-amber-500 dark:text-amber-400 mt-2 font-medium">
              <span>悬停展示 7 日走势</span>
              <ChevronRight className="w-3 h-3 group-hover/weight:translate-x-0.5 transition-transform" />
            </div>

            {/* Hover Floating 7-Day Trend Popover */}
            <div className="absolute left-0 right-0 top-full mt-2 z-50 opacity-0 pointer-events-none group-hover/weight:opacity-100 group-hover/weight:pointer-events-auto transition-all duration-200 p-3 rounded-2xl bg-neutral-900/95 text-white border border-white/20 shadow-2xl backdrop-blur-2xl">
              <div className="flex items-center justify-between text-xs font-bold text-amber-400 pb-1.5 mb-2 border-b border-white/10">
                <span className="flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" />
                  <span>最近 7 日体重变化 (kg)</span>
                </span>
                <span className="text-[10px] text-neutral-400 font-normal">仅显示实测记录</span>
              </div>
              {trendPoints.length > 0 ? (
                <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                  {trendPoints.slice(-4).map((t, index) => (
                    <div key={`${t.date}-${index}`} className="p-1.5 rounded-xl bg-white/10 border border-white/5">
                      <span className="text-neutral-400 block">{t.date}</span>
                      <span className="font-bold text-white block mt-0.5 font-mono text-xs">{t.weight}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-[10px] text-neutral-400">暂无体重趋势记录</span>
              )}
            </div>
          </div>

          {/* 2. Body Fat Tile (User Comment 2: Hover shows trend) */}
          <div className="relative group/fat p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.05] hover:border-amber-500/40 transition-all duration-200 cursor-pointer">
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              <span>体脂率</span>
              <span className="text-[10px] text-amber-500 dark:text-amber-400 font-semibold">{body.statusLabel}</span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-black text-amber-500 dark:text-amber-400 tracking-tight">
                {body.bodyFatPercent > 0 ? body.bodyFatPercent : '—'}
              </span>
              <span className="text-xs text-neutral-400 font-semibold">%</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 mt-2">
              <span>脂肪量 {body.fatMassKg}kg</span>
              <ChevronRight className="w-3 h-3 group-hover/fat:translate-x-0.5 transition-transform" />
            </div>

            {/* Hover Floating 7-Day Fat Trend Popover */}
            <div className="absolute left-0 right-0 top-full mt-2 z-50 opacity-0 pointer-events-none group-hover/fat:opacity-100 group-hover/fat:pointer-events-auto transition-all duration-200 p-3 rounded-2xl bg-neutral-900/95 text-white border border-white/20 shadow-2xl backdrop-blur-2xl">
              <div className="flex items-center justify-between text-xs font-bold text-amber-400 pb-1.5 mb-2 border-b border-white/10">
                <span className="flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" />
                  <span>最近 7 日体脂率走势 (%)</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-normal">仅显示实测记录</span>
              </div>
              {trendPoints.length > 0 ? (
                <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                  {trendPoints.slice(-4).map((t, index) => (
                    <div key={`${t.date}-${index}`} className="p-1.5 rounded-xl bg-white/10 border border-white/5">
                      <span className="text-neutral-400 block">{t.date}</span>
                      <span className="font-bold text-amber-300 block mt-0.5 font-mono text-xs">{t.bodyFat}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-[10px] text-neutral-400">暂无体脂趋势记录</span>
              )}
            </div>
          </div>
        </div>

        {/* 3. Lean Mass Bar with Hover Trend Popovers */}
        <div className="relative p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] mb-3">
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span className="text-neutral-600 dark:text-neutral-300 font-medium">身体成分构成 (瘦体重 vs 脂肪)</span>
            <span className="font-bold text-neutral-900 dark:text-white font-mono">{body.leanMassKg} kg ({leanPercent}%) / {body.fatMassKg} kg ({fatPercent}%)</span>
          </div>

          {/* Interactive Dual-Segment Bar */}
          <div className="w-full h-3.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden flex relative">
            {/* Left Segment: Muscle / Lean Mass (Hover shows 7-day muscle trend) */}
            <div
              style={{ width: `${leanPercent}%` }}
              className="group/muscle-seg h-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:brightness-125 transition-all cursor-pointer relative"
            >
              {/* Floating 7-day Lean Mass Trend Popover */}
              <div className="absolute left-0 bottom-full mb-2 z-50 opacity-0 group-hover/muscle-seg:opacity-100 transition-opacity pointer-events-none p-2.5 rounded-2xl bg-neutral-950/95 text-white text-[11px] border border-indigo-500/40 shadow-2xl backdrop-blur-xl w-60">
                <div className="flex items-center justify-between text-indigo-300 font-bold mb-1.5 border-b border-white/10 pb-1">
                  <span>💪 去脂瘦体重 7 日趋势</span>
                  <span className="text-emerald-400 text-[10px]">占比 {leanPercent}%</span>
                </div>
                <div className="flex items-end justify-between h-9 gap-1 pt-1">
                  {trendPoints.slice(-5).map((t, index) => {
                    const leanVal = parseFloat((t.weight * (1 - t.bodyFat / 100)).toFixed(1));
                    return (
                      <div key={`${t.date}-${index}`} className="flex-1 flex flex-col items-center">
                        <span className="font-mono text-[9px] text-white font-bold">{leanVal}</span>
                        <div className="w-full bg-indigo-500/80 rounded-t h-4 mt-0.5" />
                        <span className="text-[8px] text-neutral-400 font-mono mt-0.5">{t.date}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Segment: Fat Mass / Bone (Hover shows 7-day fat mass trend) */}
            <div
              style={{ width: `${fatPercent}%` }}
              className="group/bone-seg h-full bg-gradient-to-r from-amber-400 to-orange-400 hover:brightness-125 transition-all cursor-pointer relative"
            >
              {/* Floating 7-day Fat Mass Trend Popover */}
              <div className="absolute right-0 bottom-full mb-2 z-50 opacity-0 group-hover/bone-seg:opacity-100 transition-opacity pointer-events-none p-2.5 rounded-2xl bg-neutral-950/95 text-white text-[11px] border border-amber-500/40 shadow-2xl backdrop-blur-xl w-60">
                <div className="flex items-center justify-between text-amber-300 font-bold mb-1.5 border-b border-white/10 pb-1">
                  <span>🧈 脂肪与骨量 7 日趋势</span>
                  <span className="text-amber-400 text-[10px]">{body.fatMassKg} kg ({fatPercent}%)</span>
                </div>
                <div className="flex items-end justify-between h-9 gap-1 pt-1">
                  {trendPoints.slice(-5).map((t, index) => {
                    const fatVal = parseFloat((t.weight * (t.bodyFat / 100)).toFixed(1));
                    return (
                      <div key={`${t.date}-${index}`} className="flex-1 flex flex-col items-center">
                        <span className="font-mono text-[9px] text-amber-300 font-bold">{fatVal}</span>
                        <div className="w-full bg-amber-500/80 rounded-t h-4 mt-0.5" />
                        <span className="text-[8px] text-neutral-400 font-mono mt-0.5">{t.date}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] text-neutral-500 dark:text-neutral-400 mt-1.5 px-0.5">
            <span className="flex items-center gap-1 font-medium text-indigo-500 dark:text-indigo-400">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              去脂瘦体重 {body.leanMassKg} kg
            </span>
            <span className="flex items-center gap-1 font-medium text-amber-500 dark:text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              脂肪量 {body.fatMassKg} kg{boneMassEst ? ` · 骨量 ${boneMassEst} kg` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Submetrics Footer Row (User Comment 4: Hover BMI to show trend) */}
      <div className="grid grid-cols-2 gap-2 text-xs relative">
        {/* BMI Tile with Hover Trend */}
        <div className="relative group/bmi p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.03] hover:border-amber-500/40 flex items-center justify-between cursor-pointer transition-all">
          <span className="text-neutral-500 dark:text-neutral-400">体质指数 (BMI)</span>
          <span className="font-bold text-neutral-900 dark:text-white font-mono">{body.bmi}</span>

          {/* Hover Popover for BMI */}
          <div className="absolute left-0 bottom-full mb-2 z-50 opacity-0 pointer-events-none group-hover/bmi:opacity-100 group-hover/bmi:pointer-events-auto transition-all duration-200 p-2.5 rounded-xl bg-neutral-950/95 text-white text-[10px] border border-white/20 shadow-2xl backdrop-blur-xl w-56">
            <div className="font-bold text-emerald-400 mb-1 flex items-center justify-between">
              <span>BMI 指数：{body.bmi}</span>
              <span className="text-neutral-400 font-normal">标准: 18.5~23.9</span>
            </div>
            <div className="text-neutral-300">
              {body.weightKg > 0 ? '仅展示本次体脂秤实测值。' : '暂无体测数据。'}
            </div>
          </div>
        </div>

        {/* Muscle Level */}
        <div className="p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.03] flex items-center justify-between">
          <span className="text-neutral-500 dark:text-neutral-400">肌肉量等级</span>
          <span className="font-bold text-indigo-500 dark:text-indigo-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            {body.skeletalMusclePercent ? `${body.skeletalMusclePercent}%` : '—'}
          </span>
        </div>
      </div>
    </AppleCard>
  );
};
