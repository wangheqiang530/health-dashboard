import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Gauge,
  Heart,
  Mountain,
  Navigation,
  Zap,
} from 'lucide-react';
import type { WorkoutRecord, WorkoutTelemetryPoint } from '../../types/health';
import { WorkoutAmapRoute } from './WorkoutAmapRoute';

interface WorkoutRoutePlaybackProps {
  workout: WorkoutRecord;
}

type MetricKey = 'heartRate' | 'cadence' | 'power' | 'speedKmh';

const METRICS: Array<{
  key: MetricKey;
  label: string;
  unit: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: 'heartRate', label: '心率', unit: 'bpm', color: '#F43F5E', icon: Heart },
  { key: 'cadence', label: '踏频', unit: 'rpm', color: '#22C55E', icon: Activity },
  { key: 'power', label: '功率', unit: 'W', color: '#F59E0B', icon: Zap },
  { key: 'speedKmh', label: '速度', unit: 'km/h', color: '#0EA5E9', icon: Gauge },
];

const TelemetryChart: React.FC<{
  telemetry: WorkoutTelemetryPoint[];
  metricKey: MetricKey;
  label: string;
  unit: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  progress: number;
  onScrub: (progress: number) => void;
}> = ({ telemetry, metricKey, label, unit, color, icon: Icon, progress, onScrub }) => {
  const width = 520;
  const height = 102;
  const padding = 10;
  const values = telemetry
    .map((point, index) => ({
      index,
      value: point[metricKey],
    }))
    .filter((point): point is { index: number; value: number } => Number.isFinite(point.value));
  const min = values.length > 0 ? Math.min(...values.map((point) => point.value)) : 0;
  const max = values.length > 0 ? Math.max(...values.map((point) => point.value)) : 1;
  const range = max - min || 1;
  const xFor = (index: number) =>
    padding +
    (index / Math.max(telemetry.length - 1, 1)) * (width - padding * 2);
  const yFor = (value: number) =>
    height - padding - ((value - min) / range) * (height - padding * 2);
  const coords = values.map((point) => ({
    ...point,
    x: xFor(point.index),
    y: yFor(point.value),
  }));
  const path = coords
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    )
    .join(' ');
  const areaPath =
    coords.length > 0
      ? `${path} L ${coords[coords.length - 1].x} ${height - padding} L ${coords[0].x} ${
          height - padding
        } Z`
      : '';
  const currentIndex = Math.min(
    Math.max(Math.round(progress * Math.max(telemetry.length - 1, 0)), 0),
    Math.max(telemetry.length - 1, 0)
  );
  const currentValue = telemetry[currentIndex]?.[metricKey];
  const currentX = xFor(currentIndex);
  const gradientId = `telemetry-${metricKey}`;

  return (
    <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white/60 dark:bg-black/25 p-2.5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-neutral-500 dark:text-neutral-400">
          <Icon className="w-3 h-3" />
          {label}
        </span>
        <span className="text-xs font-black font-mono" style={{ color }}>
          {Number.isFinite(currentValue) ? `${Math.round(Number(currentValue))} ${unit}` : '—'}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[102px] overflow-visible touch-none"
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
          onScrub(ratio);
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2].map((line) => (
          <line
            key={line}
            x1={padding}
            x2={width - padding}
            y1={padding + (line / 2) * (height - padding * 2)}
            y2={padding + (line / 2) * (height - padding * 2)}
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeDasharray="3 5"
          />
        ))}
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1={currentX}
          x2={currentX}
          y1={padding}
          y2={height - padding}
          stroke={color}
          strokeOpacity="0.55"
          strokeWidth="1.3"
        />
        {Number.isFinite(currentValue) && (
          <circle
            cx={currentX}
            cy={yFor(Number(currentValue))}
            r="4"
            fill={color}
            stroke="white"
            strokeWidth="2"
          />
        )}
        <text
          x={width - padding}
          y="12"
          textAnchor="end"
          fill="currentColor"
          fillOpacity="0.38"
          fontSize="8"
          fontFamily="monospace"
        >
          {Math.round(max)}
        </text>
        <text
          x={width - padding}
          y={height - 2}
          textAnchor="end"
          fill="currentColor"
          fillOpacity="0.38"
          fontSize="8"
          fontFamily="monospace"
        >
          {Math.round(min)}
        </text>
      </svg>
    </div>
  );
};

export const WorkoutRoutePlayback: React.FC<WorkoutRoutePlaybackProps> = ({ workout }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

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
    if (!isPlaying) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      lastTimeRef.current = null;
      return;
    }

    const totalDurationMs = 42_000;
    const tick = (timestamp: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;
      setProgress((previous) => {
        const next = previous + (delta / totalDurationMs) * playbackSpeed;
        if (next >= 1) {
          setIsPlaying(false);
          return 1;
        }
        return next;
      });
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, playbackSpeed]);

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
        <span className="self-start rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[9px] font-semibold text-sky-600 dark:text-sky-300 sm:self-auto">
          高德地图 · 真实 FIT 轨迹
        </span>
      </div>

      {routeCoords.length >= 2 ? (
        <WorkoutAmapRoute
          workout={workout}
          progress={progress}
          isPlaying={isPlaying}
          playbackSpeed={playbackSpeed}
          onProgressChange={(nextProgress) => {
            setIsPlaying(false);
            setProgress(nextProgress);
          }}
          onTogglePlayback={() => {
            if (progress >= 1) setProgress(0);
            setIsPlaying((value) => !value);
          }}
          onResetPlayback={() => {
            setIsPlaying(false);
            setProgress(0);
          }}
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
            {METRICS.map((metric) => {
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
            {METRICS.map((metric) => (
              <TelemetryChart
                key={metric.key}
                telemetry={telemetry}
                metricKey={metric.key}
                label={metric.label}
                unit={metric.unit}
                color={metric.color}
                icon={metric.icon}
                progress={progress}
                onScrub={(nextProgress) => {
                  setIsPlaying(false);
                  setProgress(nextProgress);
                }}
              />
            ))}
          </div>
          <p className="text-[9px] text-neutral-400">
            拖动进度条或在任一曲线图上横向移动，四条遥测曲线与地图光点会同步到同一时刻。
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
