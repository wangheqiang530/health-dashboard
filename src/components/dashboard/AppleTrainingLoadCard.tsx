import React, { useMemo, useState } from 'react';
import { AppleCard } from '../ui/AppleCard';
import { Activity, Flame, Gauge, Zap } from 'lucide-react';
import type { WorkoutRecord } from '../../types/health';

interface AppleTrainingLoadCardProps {
  workouts: WorkoutRecord[];
  endDate?: string;
}

const loadForWorkout = (workout: WorkoutRecord): number => {
  if (workout.tss && workout.tss > 0) return workout.tss;
  if (workout.durationMinutes <= 0 || workout.avgHeartRate <= 0) return 0;
  return workout.durationMinutes * Math.pow(workout.avgHeartRate / 100, 1.8);
};

const dateOffset = (date: string, days: number): string => {
  const value = new Date(`${date}T12:00:00+08:00`);
  value.setDate(value.getDate() + days);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
};

const todayInShanghai = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

export const AppleTrainingLoadCard: React.FC<AppleTrainingLoadCardProps> = ({
  workouts,
  endDate,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const loadByDate = useMemo(() => {
    const map = new Map<string, number>();
    workouts.forEach((workout) => {
      if (!workout.date) return;
      map.set(workout.date, (map.get(workout.date) || 0) + loadForWorkout(workout));
    });
    return map;
  }, [workouts]);

  const latestWorkoutDate = Array.from(loadByDate.keys()).sort().at(-1);
  const windowEndDate = endDate || latestWorkoutDate || todayInShanghai();
  const windowStartDate = dateOffset(windowEndDate, -27);
  const rollingPoints = useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => {
        const date = dateOffset(windowEndDate, index - 27);
        const sevenStart = dateOffset(date, -6);
        const twentyEightStart = dateOffset(date, -27);
        let acuteSum = 0;
        let chronicSum = 0;
        loadByDate.forEach((load, day) => {
          if (day >= sevenStart && day <= date) acuteSum += load;
          if (day >= twentyEightStart && day <= date) chronicSum += load;
        });
        return {
          date,
          acuteAverage: acuteSum / 7,
          chronicAverage: chronicSum / 28,
        };
      }),
    [loadByDate, windowEndDate]
  );

  const latestPoint = rollingPoints[rollingPoints.length - 1];
  const hasLoadData = rollingPoints.some(
    (point) => point.acuteAverage > 0 || point.chronicAverage > 0
  );
  const ratio =
    hasLoadData && latestPoint.chronicAverage > 0
      ? Number((latestPoint.acuteAverage / latestPoint.chronicAverage).toFixed(2))
      : null;

  let statusText = '数据不足';
  let statusSubtext = '至少需要带 TSS 或平均心率的训练记录，才能计算训练负荷。';
  let statusBadge = '暂无评估';
  let badgeColor = 'bg-neutral-500/15 text-neutral-500 border-neutral-500/30';
  let accent = '#64748B';

  if (ratio !== null) {
    if (ratio > 1.6) {
      statusText = '负荷明显升高';
      statusSubtext = '最近 7 日平均负荷明显高于 28 日基线，请结合恢复情况安排训练。';
      statusBadge = '高于基线';
      badgeColor = 'bg-amber-500/15 text-amber-500 border-amber-500/30';
      accent = '#F59E0B';
    } else if (ratio > 1.25) {
      statusText = '负荷增加';
      statusSubtext = '最近 7 日平均负荷高于 28 日基线。';
      statusBadge = '增加';
      badgeColor = 'bg-sky-500/15 text-sky-500 border-sky-500/30';
      accent = '#0EA5E9';
    } else if (ratio < 0.8) {
      statusText = '负荷下降';
      statusSubtext = '最近 7 日平均负荷低于 28 日基线。';
      statusBadge = '减量';
      badgeColor = 'bg-indigo-500/15 text-indigo-500 border-indigo-500/30';
      accent = '#6366F1';
    } else {
      statusText = '负荷稳定';
      statusSubtext = '最近 7 日平均负荷与 28 日基线接近。';
      statusBadge = '稳定';
      badgeColor = 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
      accent = '#10B981';
    }
  }

  const chartW = 640;
  const chartH = 205;
  const left = 38;
  const right = 16;
  const top = 18;
  const bottom = 28;
  const maxValue = Math.max(
    ...rollingPoints.flatMap((point) => [point.acuteAverage, point.chronicAverage]),
    1
  );
  const xFor = (index: number) =>
    left +
    (index / Math.max(rollingPoints.length - 1, 1)) * (chartW - left - right);
  const yFor = (value: number) =>
    chartH - bottom - (value / maxValue) * (chartH - top - bottom);
  const acutePoints = rollingPoints.map((point, index) => ({
    ...point,
    x: xFor(index),
    y: yFor(point.acuteAverage),
  }));
  const chronicPoints = rollingPoints.map((point, index) => ({
    ...point,
    x: xFor(index),
    y: yFor(point.chronicAverage),
  }));
  const pathFrom = (points: Array<{ x: number; y: number }>) =>
    points
      .map(
        (point, index) =>
          `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
      )
      .join(' ');
  const acuteArea =
    acutePoints.length > 0
      ? `${pathFrom(acutePoints)} L ${acutePoints[acutePoints.length - 1].x} ${
          chartH - bottom
        } L ${acutePoints[0].x} ${chartH - bottom} Z`
      : '';
  const activePoint =
    hoverIndex === null ? null : acutePoints[Math.min(hoverIndex, acutePoints.length - 1)];
  const activeChronic =
    hoverIndex === null ? null : chronicPoints[Math.min(hoverIndex, chronicPoints.length - 1)];
  const effectiveWorkoutCount = workouts.filter((workout) => {
    const date = workout.date;
    return Boolean(
      date &&
        date >= windowStartDate &&
        date <= windowEndDate &&
        loadForWorkout(workout) > 0
    );
  }).length;

  const handleChartMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (rollingPoints.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setHoverIndex(Math.round(ratio * (rollingPoints.length - 1)));
  };

  return (
    <AppleCard className="overflow-visible border border-indigo-500/20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
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
              近 7 日与近 28 日均截至所选结束日期，休息日按 0 计入；功率训练优先使用 TSS
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div className="text-right">
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block font-mono">
              负荷比率
            </span>
            <span className="text-2xl font-black font-mono" style={{ color: accent }}>
              {ratio ?? '—'} <span className="text-xs font-normal text-neutral-400">×</span>
            </span>
          </div>
          <div
            className="w-12 h-12 rounded-2xl border flex items-center justify-center"
            style={{ borderColor: `${accent}45`, backgroundColor: `${accent}14` }}
          >
            <Gauge className="w-5 h-5" style={{ color: accent }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.8fr)_minmax(460px,1.2fr)] gap-4 items-stretch">
        <div className="space-y-3">
          <div
            className="p-3.5 rounded-2xl border"
            style={{ borderColor: `${accent}30`, backgroundColor: `${accent}0D` }}
          >
            <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed m-0">
              <span className="font-bold text-neutral-900 dark:text-white mr-1.5">
                {statusText}:
              </span>
              {statusSubtext}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-2xl bg-cyan-500/[0.07] border border-cyan-500/15">
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                <Activity className="w-3 h-3 text-cyan-500" />
                7 日日均
              </span>
              <span className="text-xl font-black font-mono text-cyan-500 block mt-1">
                {latestPoint?.acuteAverage ? Math.round(latestPoint.acuteAverage) : '—'}
                <span className="text-[10px] font-normal text-neutral-400 ml-1">pts</span>
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-indigo-500/[0.07] border border-indigo-500/15">
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                <Gauge className="w-3 h-3 text-indigo-500" />
                28 日基线
              </span>
              <span className="text-xl font-black font-mono text-indigo-500 block mt-1">
                {latestPoint?.chronicAverage ? Math.round(latestPoint.chronicAverage) : '—'}
                <span className="text-[10px] font-normal text-neutral-400 ml-1">pts</span>
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-amber-500/[0.07] border border-amber-500/15">
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-500" />
                近 28 日有效
              </span>
              <span className="text-xl font-black font-mono text-amber-500 block mt-1">
                {effectiveWorkoutCount}
                <span className="text-[10px] font-normal text-neutral-400 ml-1">场</span>
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-500/[0.07] border border-emerald-500/15">
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                <Activity className="w-3 h-3 text-emerald-500" />
                统计窗口
              </span>
              <span className="text-xl font-black font-mono text-emerald-500 block mt-1">
                28<span className="text-[10px] font-normal text-neutral-400 ml-1">天</span>
              </span>
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-cyan-500/[0.055] to-indigo-500/[0.045] border border-black/5 dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-3 text-[10px] text-neutral-500 dark:text-neutral-400">
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-1 rounded-full bg-cyan-400" /> 7 日日均
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-1 rounded-full bg-indigo-400" /> 28 日基线
              </span>
            </div>
            <span className="text-[9px] text-neutral-400 font-mono">
              悬停查看每日明细
            </span>
          </div>

          {hasLoadData ? (
            <div className="relative">
              <svg
                viewBox={`0 0 ${chartW} ${chartH}`}
                className="w-full h-[205px] overflow-visible touch-none"
                onMouseMove={handleChartMove}
                onMouseLeave={() => setHoverIndex(null)}
              >
                <defs>
                  <linearGradient id="trainingLoadArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.26" />
                    <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[0, 1, 2, 3].map((line) => {
                  const y = top + (line / 3) * (chartH - top - bottom);
                  return (
                    <line
                      key={line}
                      x1={left}
                      x2={chartW - right}
                      y1={y}
                      y2={y}
                      stroke="currentColor"
                      strokeOpacity="0.08"
                      strokeDasharray="3 5"
                    />
                  );
                })}
                <path d={acuteArea} fill="url(#trainingLoadArea)" />
                <path
                  d={pathFrom(chronicPoints)}
                  fill="none"
                  stroke="#818CF8"
                  strokeWidth="2.2"
                  strokeDasharray="5 5"
                  strokeLinecap="round"
                />
                <path
                  d={pathFrom(acutePoints)}
                  fill="none"
                  stroke="#22D3EE"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {activePoint && (
                  <>
                    <line
                      x1={activePoint.x}
                      x2={activePoint.x}
                      y1={top}
                      y2={chartH - bottom}
                      stroke="currentColor"
                      strokeOpacity="0.35"
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx={activePoint.x}
                      cy={activePoint.y}
                      r="4.5"
                      fill="#22D3EE"
                      stroke="white"
                      strokeWidth="2"
                    />
                    {activeChronic && (
                      <circle
                        cx={activeChronic.x}
                        cy={activeChronic.y}
                        r="3.8"
                        fill="#818CF8"
                        stroke="white"
                        strokeWidth="1.8"
                      />
                    )}
                  </>
                )}
                <text
                  x={left - 7}
                  y={top}
                  textAnchor="end"
                  fill="currentColor"
                  fillOpacity="0.4"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {Math.round(maxValue)}
                </text>
                <text
                  x={left - 7}
                  y={chartH - bottom}
                  textAnchor="end"
                  fill="currentColor"
                  fillOpacity="0.4"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  0
                </text>
                {[0, 7, 14, 21, 27].map((index) => {
                  const point = rollingPoints[index];
                  if (!point) return null;
                  return (
                    <text
                      key={index}
                      x={xFor(index)}
                      y={chartH - 6}
                      textAnchor={index === 0 ? 'start' : index === 27 ? 'end' : 'middle'}
                      fill="currentColor"
                      fillOpacity="0.4"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {point.date.slice(5)}
                    </text>
                  );
                })}
              </svg>
              {activePoint && (
                <div
                  className="absolute top-1 z-10 -translate-x-1/2 rounded-xl border border-black/10 dark:border-white/15 bg-white/95 dark:bg-neutral-950/95 px-2.5 py-1.5 shadow-xl pointer-events-none whitespace-nowrap"
                  style={{
                    left: `${Math.min(88, Math.max(12, (activePoint.x / chartW) * 100))}%`,
                  }}
                >
                  <div className="text-[9px] text-neutral-400 font-mono">{activePoint.date}</div>
                  <div className="flex items-center gap-2 text-[10px] font-mono mt-0.5">
                    <span className="text-cyan-500">
                      7日 {Math.round(activePoint.acuteAverage)} pts
                    </span>
                    <span className="text-indigo-400">
                      28日 {Math.round(activeChronic?.chronicAverage || 0)} pts
                    </span>
                    <span className="text-neutral-400">
                      {activeChronic && activeChronic.chronicAverage > 0
                        ? `${(activePoint.acuteAverage / activeChronic.chronicAverage).toFixed(2)}×`
                        : '—'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-[205px] flex items-center justify-center text-xs text-neutral-400">
              暂无足够的带心率训练记录
            </div>
          )}
        </div>
      </div>
    </AppleCard>
  );
};
