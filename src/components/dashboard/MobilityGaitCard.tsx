import React from 'react';
import type { MobilityAndGait } from '../../types/health';
import { AppleCard } from '../ui/AppleCard';
import { Footprints, Gauge, ArrowUpDown, CheckCircle2 } from 'lucide-react';

interface MobilityGaitCardProps {
  mobility: MobilityAndGait;
}

export const MobilityGaitCard: React.FC<MobilityGaitCardProps> = ({ mobility }) => {
  return (
    <AppleCard className="overflow-hidden h-full flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex-shrink-0">
              <Footprints className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-wider text-neutral-500 dark:text-neutral-400 uppercase">
                步态健康
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-600 dark:text-teal-300 border border-teal-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>步态对称 · 跌倒风险极低</span>
          </div>
        </div>

        {/* Primary 2-Column: Walking Speed & Step Length (aligned with Weight & Fat) */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Walking Speed */}
          <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05]">
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              <span>步行速度</span>
              <span className="text-[10px] text-teal-500 dark:text-teal-400 font-semibold">步速轻快</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
                {mobility.walkingSpeedKmH}
              </span>
              <span className="text-xs text-neutral-400 font-semibold">km/h</span>
            </div>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-2 block">
              心肺适应良好
            </span>
          </div>

          {/* Step Length */}
          <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05]">
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              <span>平均步幅</span>
              <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-semibold">步态舒展</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
                {mobility.stepLengthCm}
              </span>
              <span className="text-xs text-neutral-400 font-semibold">cm</span>
            </div>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-2 block">
              下肢支撑稳健
            </span>
          </div>
        </div>

        {/* Middle Stability & Symmetry Bar / Grid (aligned with Lean Mass balance bar) */}
        <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] mb-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-neutral-600 dark:text-neutral-300">双足支撑率</span>
            <span className="font-mono font-bold text-neutral-900 dark:text-white">{mobility.doubleSupportPercent}%</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-neutral-600 dark:text-neutral-300">步态不对称率</span>
            <span className="font-mono font-bold text-emerald-500 dark:text-emerald-400">{mobility.asymmetryPercent}% (左右均衡)</span>
          </div>
        </div>
      </div>

      {/* Submetrics Footer Row (aligned with BMI / Muscle Level) */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.03] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
            <ArrowUpDown className="w-3.5 h-3.5 text-sky-400" />
            <span>楼梯速度</span>
          </div>
          <span className="font-mono font-bold text-neutral-900 dark:text-white">
            上 {mobility.stairSpeedUpMs} · 下 {mobility.stairSpeedDownMs} m/s
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.03] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
            <Gauge className="w-3.5 h-3.5 text-indigo-400" />
            <span>6分钟步行测试</span>
          </div>
          <span className="font-mono font-bold text-indigo-500 dark:text-indigo-400">
            {mobility.sixMinWalkDistanceM} 米 (优异)
          </span>
        </div>
      </div>
    </AppleCard>
  );
};