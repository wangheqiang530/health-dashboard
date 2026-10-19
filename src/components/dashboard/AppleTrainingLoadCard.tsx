import React from 'react';
import { AppleCard } from '../ui/AppleCard';
import { Zap } from 'lucide-react';
import type { WorkoutRecord } from '../../types/health';

interface AppleTrainingLoadCardProps {
  workouts: WorkoutRecord[];
}

const loadForWorkout = (workout: WorkoutRecord): number => {
  if (workout.durationMinutes <= 0 || workout.avgHeartRate <= 0) return 0;
  return workout.durationMinutes * Math.pow(workout.avgHeartRate / 100, 1.8) * 1.4;
};

const dateOffset = (date: string, days: number): string => {
  const value = new Date(`${date}T12:00:00+08:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
};

export const AppleTrainingLoadCard: React.FC<AppleTrainingLoadCardProps> = ({ workouts }) => {
  const loadByDate = new Map<string, number>();
  workouts.forEach((workout) => {
    if (!workout.date) return;
    loadByDate.set(workout.date, (loadByDate.get(workout.date) || 0) + loadForWorkout(workout));
  });

  const loadDates = Array.from(loadByDate.keys()).sort();
  const latestDate = loadDates[loadDates.length - 1];
  const rollingPoints = latestDate
    ? Array.from({ length: 14 }, (_, index) => {
        const date = dateOffset(latestDate, index - 13);
        const sevenStart = dateOffset(date, -6);
        const twentyEightStart = dateOffset(date, -27);
        const acuteValues = loadDates
          .filter((day) => day >= sevenStart && day <= date)
          .map((day) => loadByDate.get(day) || 0);
        const chronicValues = loadDates
          .filter((day) => day >= twentyEightStart && day <= date)
          .map((day) => loadByDate.get(day) || 0);
        const acuteAverage =
          acuteValues.length > 0
            ? acuteValues.reduce((sum, value) => sum + value, 0) / 7
            : 0;
        const chronicAverage =
          chronicValues.length > 0
            ? chronicValues.reduce((sum, value) => sum + value, 0) / chronicValues.length
            : 0;
        return { date, acuteAverage, chronicAverage };
      })
    : [];

  const latestPoint = rollingPoints[rollingPoints.length - 1];
  const hasLoadData = Boolean(latestPoint && latestPoint.acuteAverage > 0);
  const ratio =
    hasLoadData && latestPoint.chronicAverage > 0
      ? Number((latestPoint.acuteAverage / latestPoint.chronicAverage).toFixed(2))
      : null;

  let statusText = '数据不足';
  let statusSubtext = '至少需要带平均心率的训练记录，才能计算训练负荷。';
  let statusBadge = '暂无评估';
  let badgeColor = 'bg-neutral-500/15 text-neutral-500 border-neutral-500/30';

  if (ratio !== null) {
    if (ratio > 1.6) {
      statusText = '负荷明显升高';
      statusSubtext = '最近 7 日平均负荷明显高于 28 日基线，请结合恢复情况安排训练。';
      statusBadge = '高于基线';
      badgeColor = 'bg-amber-500/15 text-amber-500 border-amber-500/30';
    } else if (ratio > 1.25) {
      statusText = '负荷增加';
      statusSubtext = '最近 7 日平均负荷高于 28 日基线。';
      statusBadge = '增加';
      badgeColor = 'bg-sky-500/15 text-sky-500 border-sky-500/30';
    } else if (ratio < 0.8) {
      statusText = '负荷下降';
      statusSubtext = '最近 7 日平均负荷低于 28 日基线。';
      statusBadge = '减量';
      badgeColor = 'bg-indigo-500/15 text-indigo-500 border-indigo-500/30';
    } else {
      statusText = '负荷稳定';
      statusSubtext = '最近 7 日平均负荷与 28 日基线接近。';
      statusBadge = '稳定';
      badgeColor = 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
    }
  }

  const chartW = 340;
  const chartH = 65;
  const maxValue = Math.max(
    ...rollingPoints.flatMap((point) => [point.acuteAverage, point.chronicAverage]),
    1
  );
  const acuteCoords = rollingPoints.map((point, index) => ({
    x: 10 + (index / Math.max(rollingPoints.length - 1, 1)) * (chartW - 20),
    y: chartH - 8 - (point.acuteAverage / maxValue) * (chartH - 16),
  }));
  const chronicCoords = rollingPoints.map((point, index) => ({
    x: 10 + (index / Math.max(rollingPoints.length - 1, 1)) * (chartW - 20),
    y: chartH - 8 - (point.chronicAverage / maxValue) * (chartH - 16),
  }));
  const pathFrom = (coords: Array<{ x: number; y: number }>) =>
    coords.reduce(
      (path, point, index) =>
        `${path} ${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
      ''
    );

  return (
    <AppleCard className="overflow-hidden border border-indigo-500/25">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-indigo-500 to-sky-400 text-white shadow-md shadow-indigo-500/20">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white m-0">
                训练负荷评估
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}>
                {statusBadge}
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              基于带平均心率的实际训练记录，对比最近 7 日与 28 日日均负荷
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block font-mono">
            负荷比率
          </span>
          <span className="text-2xl font-black font-mono text-neutral-900 dark:text-white">
            {ratio ?? '—'} <span className="text-xs font-normal text-neutral-400">× 基线</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        <div className="lg:col-span-7 space-y-3">
          <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed m-0 bg-black/[0.02] dark:bg-white/[0.03] p-3 rounded-2xl border border-black/5 dark:border-white/5">
            <span className="font-bold text-neutral-900 dark:text-white mr-1.5">{statusText}:</span>
            {statusSubtext}
          </p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block mb-0.5">7 日日均负荷</span>
              <span className="text-lg font-black font-mono text-neutral-900 dark:text-white block">
                {latestPoint?.acuteAverage ? Math.round(latestPoint.acuteAverage) : '—'}
                <span className="text-[10px] font-normal text-neutral-500 ml-1">pts</span>
              </span>
            </div>
            <div className="p-2.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block mb-0.5">28 日日均基线</span>
              <span className="text-lg font-black font-mono text-neutral-900 dark:text-white block">
                {latestPoint?.chronicAverage ? Math.round(latestPoint.chronicAverage) : '—'}
                <span className="text-[10px] font-normal text-neutral-500 ml-1">pts</span>
              </span>
            </div>
            <div className="p-2.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block mb-0.5">有效训练记录</span>
              <span className="text-lg font-black font-mono text-amber-500 block">
                {workouts.filter((workout) => loadForWorkout(workout) > 0).length}
                <span className="text-[10px] font-normal text-neutral-400 ml-1">场</span>
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 p-3 rounded-2xl bg-black/[0.03] dark:bg-black/40 border border-black/5 dark:border-white/5 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-1 rounded-full bg-cyan-400" /> 7 日日均
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-1 rounded-full bg-indigo-400" /> 28 日基线
            </span>
          </div>
          {hasLoadData ? (
            <div className="h-16 w-full">
              <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-full overflow-visible">
                <path d={pathFrom(chronicCoords)} fill="none" stroke="#818CF8" strokeWidth="2" strokeDasharray="3 3" />
                <path d={pathFrom(acuteCoords)} fill="none" stroke="#22D3EE" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          ) : (
            <div className="h-16 flex items-center justify-center text-[11px] text-neutral-400">
              暂无足够的带心率训练记录
            </div>
          )}
          <div className="flex justify-between text-[9px] text-neutral-400 font-mono px-1">
            <span>14 天前</span>
            <span>7 天前</span>
            <span>最近记录</span>
          </div>
        </div>
      </div>
    </AppleCard>
  );
};
