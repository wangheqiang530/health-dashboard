import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Clock3,
  Flame,
  Gauge,
  Heart,
  LoaderCircle,
  Mountain,
  Route,
  Zap,
} from 'lucide-react';
import { fetchWorkoutDetail } from '../../api/healthApi';
import type { WorkoutRecord, WorkoutTelemetryPoint } from '../../types/health';
import { useWorkoutPlayback } from '../../hooks/useWorkoutPlayback';
import { preloadAmap } from '../../utils/amapLoader';
import { WorkoutAmapRoute } from './WorkoutAmapRoute';
import { RouteMinimap } from './RouteMinimap';
import {
  TELEMETRY_METRICS,
  type TelemetryMetricKey,
} from '../../utils/workoutTelemetry';

interface WorkoutMapPageProps {
  workoutId: string;
}

const formatDuration = (minutes: number): string => {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  const hours = Math.floor(minutes / 60);
  const remaining = Math.round(minutes % 60);
  return hours > 0 ? `${hours}h ${remaining}m` : `${remaining}m`;
};

const TelemetrySparkline: React.FC<{
  telemetry: WorkoutTelemetryPoint[];
  metricKey: TelemetryMetricKey;
  color: string;
  progress: number;
}> = ({ telemetry, metricKey, color, progress }) => {
  const width = 84;
  const height = 28;
  const values = telemetry
    .map((point) => point[metricKey])
    .filter((value): value is number => Number.isFinite(value));
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const path = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - 3 - ((value - min) / range) * (height - 6);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  const markerIndex = Math.min(
    values.length - 1,
    Math.max(0, Math.round(progress * (values.length - 1)))
  );
  const markerValue = values[markerIndex];
  const markerX = (markerIndex / Math.max(values.length - 1, 1)) * width;
  const markerY = height - 3 - ((markerValue - min) / range) * (height - 6);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-7 w-[84px]" aria-hidden="true">
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.72"
      />
      <circle cx={markerX} cy={markerY} r="3" fill={color} stroke="#020617" strokeWidth="1.5" />
    </svg>
  );
};

export const WorkoutMapPage: React.FC<WorkoutMapPageProps> = ({ workoutId }) => {
  const [workout, setWorkout] = useState<WorkoutRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const {
    isPlaying,
    progress,
    playbackSpeed,
    setPlaybackSpeed,
    setProgress,
    togglePlayback,
    reset,
  } = useWorkoutPlayback();

  useEffect(() => {
    void preloadAmap()?.catch(() => undefined);
  }, []);

  useEffect(() => {
    let active = true;
    // Loading state follows the standalone page's network request lifecycle.
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true);
    setError(null);
    if (!workoutId) {
      setLoading(false);
      setError('缺少训练记录 ID。');
      return;
    }
    void fetchWorkoutDetail(workoutId)
      .then((detail) => {
        if (!active) return;
        setWorkout(detail);
        document.title = `${detail.name} · 全屏骑行地图`;
      })
      .catch((fetchError: unknown) => {
        if (!active) return;
        setError(
          fetchError instanceof Error ? fetchError.message : '读取骑行详情失败。'
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workoutId]);

  const telemetry = useMemo(
    () =>
      (workout?.telemetry || []).filter(
        (point) =>
          Number.isFinite(point.elapsedSec) ||
          Number.isFinite(point.heartRate) ||
          Number.isFinite(point.cadence) ||
          Number.isFinite(point.power) ||
          Number.isFinite(point.speedKmh)
      ),
    [workout?.telemetry]
  );
  const telemetryIndex = Math.min(
    Math.round(progress * Math.max(telemetry.length - 1, 0)),
    Math.max(telemetry.length - 1, 0)
  );
  const currentTelemetry = telemetry[telemetryIndex];
  const avgSpeed =
    workout?.distanceKm && workout.durationMinutes > 0
      ? workout.distanceKm / (workout.durationMinutes / 60)
      : null;

  const closePage = () => {
    window.close();
    window.setTimeout(() => {
      window.location.href = '/#workouts';
    }, 120);
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#070b12] text-white">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm shadow-2xl backdrop-blur-xl">
          <LoaderCircle className="h-5 w-5 animate-spin text-sky-400" />
          正在读取轨迹、遥测与骑行概览
        </div>
      </div>
    );
  }

  if (error || !workout) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#070b12] p-5 text-white">
        <div className="w-full max-w-md rounded-3xl border border-rose-400/20 bg-rose-950/25 p-6 text-center shadow-2xl backdrop-blur-xl">
          <AlertTriangle className="mx-auto h-8 w-8 text-rose-300" />
          <h1 className="mt-3 text-lg font-bold">无法打开全屏地图</h1>
          <p className="mt-2 text-xs leading-relaxed text-rose-100/75">
            {error || '训练记录不存在。'}
          </p>
          <button
            type="button"
            onClick={closePage}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            返回训练页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#070b12] text-white">
      <WorkoutAmapRoute
        workout={workout}
        progress={progress}
        isPlaying={isPlaying}
        playbackSpeed={playbackSpeed}
        onProgressChange={setProgress}
        onTogglePlayback={togglePlayback}
        onResetPlayback={reset}
        onPlaybackSpeedChange={setPlaybackSpeed}
        fullscreen
        defaultMapMode="terrain"
        showMapBadge={false}
      />

      <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex justify-between gap-3">
        <div className="pointer-events-auto w-[min(470px,calc(100vw-1.5rem))] rounded-2xl border border-white/15 bg-slate-950/82 p-3.5 shadow-2xl backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-sky-300">
                全屏骑行回放
              </span>
              <h1 className="mt-0.5 truncate text-lg font-black tracking-tight text-white">
                {workout.name}
              </h1>
              <p className="mt-0.5 text-[10px] text-slate-400">
                {workout.date || '—'} · {workout.startTime} · {formatDuration(workout.durationMinutes)}
              </p>
            </div>
            <button
              type="button"
              onClick={closePage}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-slate-300 transition hover:bg-white/15 hover:text-white"
              title="关闭全屏地图"
              aria-label="关闭全屏地图"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {[
              {
                label: '距离',
                value: workout.distanceKm ? `${workout.distanceKm.toFixed(1)} km` : '—',
                icon: Route,
                color: 'text-cyan-300',
              },
              {
                label: '均速',
                value: avgSpeed ? `${avgSpeed.toFixed(1)} km/h` : '—',
                icon: Gauge,
                color: 'text-sky-300',
              },
              {
                label: '均心率',
                value: workout.avgHeartRate ? `${workout.avgHeartRate} bpm` : '—',
                icon: Heart,
                color: 'text-rose-300',
              },
              {
                label: '均功率',
                value: workout.avgPower ? `${workout.avgPower} W` : '—',
                icon: Zap,
                color: 'text-amber-300',
              },
              {
                label: '爬升',
                value: workout.elevationGainM ? `${workout.elevationGainM} m` : '—',
                icon: Mountain,
                color: 'text-emerald-300',
              },
              {
                label: '动态消耗',
                value: workout.activeCalories ? `${workout.activeCalories} kcal` : '—',
                icon: Flame,
                color: 'text-orange-300',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-xl border border-white/8 bg-white/[0.045] px-2 py-1.5"
                >
                  <span className="flex items-center gap-1 text-[8px] text-slate-500">
                    <Icon className={`h-2.5 w-2.5 ${item.color}`} />
                    {item.label}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[10px] font-bold text-slate-100">
                    {item.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute left-3 top-[164px] z-20 hidden w-[270px] flex-col gap-2 lg:flex">
        {TELEMETRY_METRICS.map((metric) => {
          const value = currentTelemetry?.[metric.key];
          const Icon = metric.icon;
          return (
            <div
              key={metric.key}
              className="pointer-events-auto rounded-2xl border border-white/12 bg-slate-950/78 p-3 shadow-xl backdrop-blur-xl"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
                  <Icon className="h-3.5 w-3.5" style={{ color: metric.color }} />
                  {metric.label}
                </span>
                <span
                  className="font-mono text-sm font-black"
                  style={{ color: metric.color }}
                >
                  {Number.isFinite(value) ? `${Math.round(Number(value))} ${metric.unit}` : '—'}
                </span>
              </div>
              <div className="mt-2 flex items-end justify-between gap-2">
                <TelemetrySparkline
                  telemetry={telemetry}
                  metricKey={metric.key}
                  color={metric.color}
                  progress={progress}
                />
                <span className="pb-0.5 font-mono text-[8px] text-slate-500">
                  {Math.round(progress * 100)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pointer-events-none absolute inset-x-3 bottom-[190px] z-20 grid grid-cols-2 gap-2 sm:bottom-[154px] lg:hidden">
        {TELEMETRY_METRICS.map((metric) => {
          const value = currentTelemetry?.[metric.key];
          const Icon = metric.icon;
          return (
            <div
              key={metric.key}
              className="pointer-events-auto rounded-xl border border-white/12 bg-slate-950/82 px-2.5 py-2 shadow-xl backdrop-blur-xl"
            >
              <span className="flex items-center gap-1 text-[8px] text-slate-400">
                <Icon className="h-3 w-3" style={{ color: metric.color }} />
                {metric.label}
              </span>
              <span
                className="mt-0.5 block truncate font-mono text-xs font-black"
                style={{ color: metric.color }}
              >
                {Number.isFinite(value) ? `${Math.round(Number(value))} ${metric.unit}` : '—'}
              </span>
            </div>
          );
        })}
      </div>

      <RouteMinimap
        route={workout.routeGpxPoints || []}
        progress={progress}
        onSeek={setProgress}
        className="absolute bottom-[282px] right-3 z-20 origin-bottom-right scale-75 sm:bottom-[154px] sm:scale-100"
      />

      <div className="pointer-events-none absolute right-3 top-[54px] z-10 hidden items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/70 px-2.5 py-1 text-[9px] text-slate-400 backdrop-blur-md xl:flex">
        <Clock3 className="h-3 w-3 text-sky-300" />
        42 秒完整回放 · 可切换 0.5× 至 4×
      </div>
    </div>
  );
};
