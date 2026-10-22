import React, { useMemo } from 'react';
import { Heart, Info } from 'lucide-react';
import type { WorkoutRecord } from '../../types/health';

interface WorkoutHeartRateChartProps {
  workout: WorkoutRecord;
}

const formatElapsed = (seconds: number): string => {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`;
};

export const WorkoutHeartRateChart: React.FC<WorkoutHeartRateChartProps> = ({
  workout,
}) => {
  const samples = useMemo(() => {
    const seen = new Set<number>();
    return (workout.telemetry || [])
      .filter(
        (point) =>
          Number.isFinite(point.elapsedSec) &&
          Number.isFinite(point.heartRate) &&
          Number(point.heartRate) >= 30 &&
          Number(point.heartRate) <= 230
      )
      .sort((left, right) => left.elapsedSec - right.elapsedSec)
      .filter((point) => {
        const elapsed = Math.round(point.elapsedSec);
        if (seen.has(elapsed)) return false;
        seen.add(elapsed);
        return true;
      });
  }, [workout.telemetry]);

  if (samples.length < 2) return null;

  const width = 640;
  const height = 154;
  const paddingLeft = 34;
  const paddingRight = 22;
  const paddingTop = 18;
  const paddingBottom = 24;
  const values = samples.map((sample) => Number(sample.heartRate));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const workoutDuration = Math.max(workout.durationMinutes * 60, 1);
  const duration = Math.max(
    workoutDuration,
    samples[samples.length - 1].elapsedSec,
    1
  );
  const points = samples.map((sample) => ({
    x:
      paddingLeft +
      (sample.elapsedSec / duration) * (width - paddingLeft - paddingRight),
    y:
      height -
      paddingBottom -
      ((Number(sample.heartRate) - min) / range) *
        (height - paddingTop - paddingBottom),
  }));
  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    )
    .join(' ');
  const area = `${path} L ${points[points.length - 1].x.toFixed(1)} ${
    height - paddingBottom
  } L ${points[0].x.toFixed(1)} ${height - paddingBottom} Z`;
  const average =
    workout.avgHeartRate > 0
      ? workout.avgHeartRate
      : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  const workoutEndX =
    paddingLeft +
    (workoutDuration / duration) * (width - paddingLeft - paddingRight);
  const hasRecoverySamples = duration > workoutDuration + 30;

  return (
    <div className="mb-6 rounded-2xl border border-rose-500/15 bg-gradient-to-br from-rose-500/[0.06] to-transparent p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            <Heart className="h-3.5 w-3.5 text-rose-500" />
            运动逐点心率
          </h4>
          <p className="mt-0.5 text-[10px] text-neutral-400">
            读取自 Apple 健康心率采样 · {samples.length.toLocaleString()} 个时间点
            {hasRecoverySamples ? ' · 含训练后恢复采样' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3 text-right font-mono">
          <span>
            <span className="block text-[9px] text-neutral-400">平均</span>
            <span className="text-sm font-black text-rose-500">{average} bpm</span>
          </span>
          <span>
            <span className="block text-[9px] text-neutral-400">最高</span>
            <span className="text-sm font-black text-amber-500">{max} bpm</span>
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label={`${workout.name}运动心率曲线，平均 ${average} bpm，最高 ${max} bpm`}
      >
        <defs>
          <linearGradient id={`workout-heart-${workout.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F43F5E" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#F43F5E" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((line) => {
          const y =
            paddingTop +
            (line / 3) * (height - paddingTop - paddingBottom);
          return (
            <line
              key={line}
              x1={paddingLeft}
              x2={width - paddingRight}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeOpacity="0.08"
              strokeDasharray="3 5"
            />
          );
        })}
        <path d={area} fill={`url(#workout-heart-${workout.id})`} />
        <path
          d={path}
          fill="none"
          stroke="#F43F5E"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {hasRecoverySamples && (
          <>
            <line
              x1={workoutEndX}
              x2={workoutEndX}
              y1={paddingTop}
              y2={height - paddingBottom}
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeDasharray="3 4"
            />
            <text
              x={workoutEndX - 4}
              y={paddingTop - 4}
              textAnchor="end"
              fill="currentColor"
              fillOpacity="0.45"
              fontSize="9"
              fontFamily="monospace"
            >
              训练结束
            </text>
          </>
        )}
        <text
          x={paddingLeft - 6}
          y={paddingTop + 3}
          textAnchor="end"
          fill="currentColor"
          fillOpacity="0.42"
          fontSize="9"
          fontFamily="monospace"
        >
          {max}
        </text>
        <text
          x={paddingLeft - 6}
          y={height - paddingBottom}
          textAnchor="end"
          fill="currentColor"
          fillOpacity="0.42"
          fontSize="9"
          fontFamily="monospace"
        >
          {min}
        </text>
        <text
          x={paddingLeft}
          y={height - 5}
          fill="currentColor"
          fillOpacity="0.42"
          fontSize="9"
          fontFamily="monospace"
        >
          0:00
        </text>
        <text
          x={width - paddingRight}
          y={height - 5}
          textAnchor="end"
          fill="currentColor"
          fillOpacity="0.42"
          fontSize="9"
          fontFamily="monospace"
        >
          {formatElapsed(duration)}
        </text>
      </svg>

      <div className="mt-2 flex items-start gap-1.5 text-[9px] leading-relaxed text-neutral-400">
        <Info className="mt-0.5 h-3 w-3 shrink-0 text-sky-500" />
        <span>
          Apple 健康可以导出逐点心率与训练后恢复采样，但不会单独导出 Fitness 中按区间汇总的停留时间，因此这里展示原始曲线，不伪造区间比例。
        </span>
      </div>
    </div>
  );
};
