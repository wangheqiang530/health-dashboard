import React from 'react';
import { AppleCard } from '../ui/AppleCard';
import { Zap } from 'lucide-react';
import type { WorkoutRecord } from '../../types/health';

interface PowerDurationCurveCardProps {
  workouts: WorkoutRecord[];
}

export const PowerDurationCurveCard: React.FC<PowerDurationCurveCardProps> = ({ workouts }) => {
  const withPower = workouts.filter(
    (workout) =>
      (workout.avgPower || 0) > 0 ||
      (workout.maxPower || 0) > 0 ||
      (workout.normalizedPower || 0) > 0
  );
  const workout = withPower[0];

  return (
    <AppleCard className="overflow-hidden border border-amber-500/20">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-neutral-950 shadow-md shadow-amber-500/20">
          <Zap className="w-5 h-5 fill-black" />
        </div>
        <div>
          <h3 className="text-base font-bold text-neutral-900 dark:text-white m-0">
            骑行功率记录
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            仅显示设备或 FIT 文件实际提供的功率字段
          </p>
        </div>
      </div>

      {!workout ? (
        <div className="py-8 text-center text-xs text-neutral-400">
          当前记录没有平均功率、最大功率或标准化功率数据。
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
            <span className="text-[10px] text-neutral-400 block">平均功率</span>
            <span className="text-lg font-black text-neutral-900 dark:text-white font-mono">
              {workout.avgPower ?? '—'}
              <span className="text-[10px] text-neutral-400 ml-1 font-normal">W</span>
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
            <span className="text-[10px] text-neutral-400 block">最大功率</span>
            <span className="text-lg font-black text-rose-500 font-mono">
              {workout.maxPower ?? '—'}
              <span className="text-[10px] text-neutral-400 ml-1 font-normal">W</span>
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
            <span className="text-[10px] text-neutral-400 block">标准化功率</span>
            <span className="text-lg font-black text-amber-500 font-mono">
              {workout.normalizedPower ?? '—'}
              <span className="text-[10px] text-neutral-400 ml-1 font-normal">W</span>
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
            <span className="text-[10px] text-neutral-400 block">TSS</span>
            <span className="text-lg font-black text-neutral-900 dark:text-white font-mono">
              {workout.tss ?? '—'}
            </span>
          </div>
        </div>
      )}
    </AppleCard>
  );
};
