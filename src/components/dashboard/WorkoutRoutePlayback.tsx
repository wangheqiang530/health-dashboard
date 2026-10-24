import React, { useEffect, useMemo } from 'react';
import {
  Activity,
  Expand,
  Gauge,
  Heart,
  Mountain,
  Navigation,
  Zap,
} from 'lucide-react';
import type { WorkoutRecord } from '../../types/health';
import { WorkoutAmapRoute } from './WorkoutAmapRoute';
import { preloadAmap } from '../../utils/amapLoader';
import { useWorkoutPlayback } from '../../hooks/useWorkoutPlayback';
import { TELEMETRY_METRICS } from '../../utils/workoutTelemetry';
import { TelemetryChart } from './WorkoutTelemetryChart';

interface WorkoutRoutePlaybackProps {
  workout: WorkoutRecord;
}

export const WorkoutRoutePlayback: React.FC<WorkoutRoutePlaybackProps> = ({ workout }) => {
  const {
    isPlaying,
    progress,
    playbackSpeed,
    setPlaybackSpeed,
    setProgress,
    togglePlayback,
    reset,
  } = useWorkoutPlayback();

  const routeCoords = useMemo(
    () =>
      (workout.routeGpxPoints || [])
        .filter(
          (point) =>
            Number.isFinite(point.lat) &&
            Number.isFinite(point.lon) &&
            Math.abs(point.lat) <= 90 &&
            Math.abs(point.lon) <= 180
        )
        .map((point) => [point.lat, point.lon] as [number, number]),
    [workout.routeGpxPoints]
  );
  const telemetry = useMemo(
    () =>
      (workout.telemetry || []).filter(
        (point) =>
          Number.isFinite(point.heartRate) ||
          Number.isFinite(point.cadence) ||
          Number.isFinite(point.power) ||
          Number.isFinite(point.speedKmh)
      ),
    [workout.telemetry]
  );
  const currentTelemetryIndex = Math.min(
    Math.round(progress * Math.max(telemetry.length - 1, 0)),
    Math.max(telemetry.length - 1, 0)
  );
  const currentTelemetry = telemetry[currentTelemetryIndex];

  useEffect(() => {
    void preloadAmap()?.catch(() => undefined);
  }, []);

  const openFullscreenMap = () => {
    const anchor = document.createElement('a');
    anchor.href = `/workout-map?id=${encodeURIComponent(workout.id)}`;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  return (
    <div className="p-4 rounded-3xl bg-black/[0.02] dark:bg-black/60 border border-black/10 dark:border-white/10 space-y-4 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/5 dark:border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-[#00F5D4]" />
          <span className="text-sm font-bold text-neutral-900 dark:text-white tracking-wide">
            高德 3D 轨迹与遥测回放
          </span>
          <span className="hidden text-[10px] text-neutral-400 font-mono sm:inline">
            {routeCoords.length} 轨迹点 · {telemetry.length} 遥测帧
          </span>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[9px] font-semibold text-sky-600 dark:text-sky-300">
            高德地图 · 真实 FIT 轨迹
          </span>
          {routeCoords.length >= 2 && (
            <button
              type="button"
              onClick={openFullscreenMap}
              className="flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[9px] font-semibold text-neutral-700 transition hover:bg-white/20 dark:text-white"
              title="在新网页打开全屏地图与实时遥测"
            >
              <Expand className="h-3 w-3" />
              大地图模式
            </button>
          )}
        </div>
      </div>

      {routeCoords.length >= 2 ? (
        <WorkoutAmapRoute
          workout={workout}
          progress={progress}
          isPlaying={isPlaying}
          playbackSpeed={playbackSpeed}
          onProgressChange={(nextProgress) => {
            setProgress(nextProgress);
          }}
          onTogglePlayback={togglePlayback}
          onResetPlayback={reset}
          onPlaybackSpeedChange={setPlaybackSpeed}
        />
      ) : (
        <div className="p-5 rounded-3xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/10 text-center">
          <Navigation className="w-6 h-6 mx-auto text-neutral-400 mb-2" />
          <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            当前记录没有 GPS 轨迹点
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            仍可查看下方设备实际记录的遥测曲线。
          </p>
        </div>
      )}

      {telemetry.length > 1 ? (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TELEMETRY_METRICS.map((metric) => {
              const value = currentTelemetry?.[metric.key];
              const Icon = metric.icon;
              return (
                <div
                  key={metric.key}
                  className="p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/10"
                >
                  <span className="flex items-center gap-1 text-[9px] text-neutral-400">
                    <Icon className="w-3 h-3" />
                    {metric.label}
                  </span>
                  <span
                    className="font-bold font-mono text-sm block mt-0.5"
                    style={{ color: metric.color }}
                  >
                    {Number.isFinite(value)
                      ? `${Math.round(Number(value))} ${metric.unit}`
                      : '—'}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {TELEMETRY_METRICS.map((metric) => (
              <TelemetryChart
                key={metric.key}
                telemetry={telemetry}
                metricKey={metric.key}
                label={metric.label}
                unit={metric.unit}
                color={metric.color}
                icon={metric.icon}
                progress={progress}
                onScrub={setProgress}
              />
            ))}
          </div>
          <p className="text-[9px] text-neutral-400">
            悬停查看十字读数；在任一曲线图上按住并拖动，四条遥测曲线与地图光点才会同步到同一时刻。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          {[
            { label: '平均心率', value: workout.avgHeartRate > 0 ? `${workout.avgHeartRate} bpm` : '—', icon: Heart },
            {
              label: '平均速度',
              value:
                workout.distanceKm && workout.durationMinutes > 0
                  ? `${(workout.distanceKm / (workout.durationMinutes / 60)).toFixed(1)} km/h`
                  : '—',
              icon: Gauge,
            },
            { label: '踏频', value: workout.cadenceAvg ? `${workout.cadenceAvg} rpm` : '—', icon: Activity },
            { label: '平均功率', value: workout.avgPower ? `${workout.avgPower} W` : '—', icon: Zap },
            {
              label: '累计爬升',
              value: workout.elevationGainM ? `${workout.elevationGainM} m` : '—',
              icon: Mountain,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04]">
                <span className="flex items-center gap-1 text-[10px] text-neutral-400">
                  <Icon className="w-3 h-3" />
                  {item.label}
                </span>
                <span className="font-bold font-mono text-neutral-900 dark:text-white">
                  {item.value}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
