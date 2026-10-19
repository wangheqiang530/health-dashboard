import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '../../context/ThemeContext';
import {
  Activity,
  Gauge,
  Heart,
  Mountain,
  Navigation,
  Pause,
  Play,
  RotateCcw,
  Zap,
} from 'lucide-react';
import type { WorkoutRecord, WorkoutTelemetryPoint } from '../../types/health';

interface WorkoutRoutePlaybackProps {
  workout: WorkoutRecord;
}

type MetricKey = 'heartRate' | 'cadence' | 'power' | 'speedKmh';
type MapTileType = 'osm' | 'topo' | 'none';

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

const formatElapsed = (seconds: number): string => {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`;
};

const speedColor = (speedKmh: number | null): string => {
  if (speedKmh === null || speedKmh <= 0.8) return '#FFD60A';
  const ratio = Math.min(1, Math.max(0, (speedKmh - 1) / 34));
  const hue = 120 * (1 - ratio);
  return `hsl(${hue.toFixed(0)} 88% 52%)`;
};

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
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playSpeed, setPlaySpeed] = useState(2);
  const [mapTileType, setMapTileType] = useState<MapTileType>('osm');
  const [tileStatus, setTileStatus] = useState<'loading' | 'ready' | 'error' | 'disabled'>(
    'loading'
  );

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const beaconMarkerRef = useRef<L.Marker | null>(null);
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
          Number.isFinite(point.elapsedSec) ||
          Number.isFinite(point.heartRate) ||
          Number.isFinite(point.power)
      ),
    [workout.telemetry]
  );
  const routeSpeeds = useMemo(
    () =>
      routeCoords.map((_, index) => {
        const directSpeed = workout.routeGpxPoints?.[index]?.speedKmh;
        if (Number.isFinite(directSpeed)) return Number(directSpeed);
        const telemetryIndex =
          routeCoords.length <= 1
            ? 0
            : Math.round((index / (routeCoords.length - 1)) * Math.max(telemetry.length - 1, 0));
        const matchedSpeed = telemetry[telemetryIndex]?.speedKmh;
        return Number.isFinite(matchedSpeed) ? Number(matchedSpeed) : null;
      }),
    [routeCoords, telemetry, workout.routeGpxPoints]
  );
  const currentTelemetryIndex = Math.min(
    Math.round(progress * Math.max(telemetry.length - 1, 0)),
    Math.max(telemetry.length - 1, 0)
  );
  const currentTelemetry = telemetry[currentTelemetryIndex];
  const currentRouteIndex = Math.min(
    Math.floor(progress * Math.max(routeCoords.length - 1, 0)),
    Math.max(routeCoords.length - 1, 0)
  );
  const currentPoint = routeCoords[currentRouteIndex];
  const currentElapsed = currentTelemetry?.elapsedSec ??
    progress * Math.max(workout.durationMinutes * 60, 1);

  useEffect(() => {
    if (!mapContainerRef.current || routeCoords.length < 2) return;
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
    });
    mapInstanceRef.current = map;

    if (mapTileType === 'none') {
      setTileStatus('disabled');
    } else {
      setTileStatus('loading');
      let tileErrors = 0;
      const tileLayer = L.tileLayer(
        mapTileType === 'topo'
          ? 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
          : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        mapTileType === 'topo'
          ? { maxZoom: 17, keepBuffer: 3, subdomains: 'abc' }
          : { maxZoom: 19, keepBuffer: 3 }
      );
      tileLayer.on('tileload', () => setTileStatus('ready'));
      tileLayer.on('tileerror', () => {
        tileErrors += 1;
        if (tileErrors >= 3) setTileStatus('error');
      });
      tileLayer.addTo(map);
    }

    L.polyline(routeCoords, {
      color: isDark ? '#F8FAFC' : '#0F172A',
      weight: 7,
      opacity: 0.22,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);
    for (let index = 1; index < routeCoords.length; index += 1) {
      const speed = routeSpeeds[index] ?? routeSpeeds[index - 1] ?? null;
      L.polyline([routeCoords[index - 1], routeCoords[index]], {
        color: speedColor(speed),
        weight: 4.8,
        opacity: 0.98,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
    }

    const markerIcon = (label: string, color: string) =>
      L.divIcon({
        className: 'route-marker',
        html: `<div style="background:${color};color:#000;font-weight:700;font-size:10px;padding:2px 6px;border-radius:10px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);white-space:nowrap;">${label}</div>`,
        iconSize: [40, 20],
        iconAnchor: [20, 10],
      });
    L.marker(routeCoords[0], { icon: markerIcon('起点', '#22C55E') }).addTo(map);
    L.marker(routeCoords[routeCoords.length - 1], {
      icon: markerIcon('终点', '#EF4444'),
    }).addTo(map);

    const beaconIcon = L.divIcon({
      className: 'route-beacon',
      html: '<div style="width:20px;height:20px;border-radius:50%;background:#00F5D4;border:3px solid #fff;box-shadow:0 0 16px #00F5D4;"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    beaconMarkerRef.current = L.marker(routeCoords[0], { icon: beaconIcon }).addTo(map);
    const routeBounds = L.latLngBounds(routeCoords);
    map.fitBounds(routeBounds, { padding: [35, 35] });

    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(routeBounds, { padding: [35, 35] });
    }, 250);

    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
      mapInstanceRef.current = null;
      beaconMarkerRef.current = null;
    };
  }, [isDark, mapTileType, routeCoords, routeSpeeds]);

  useEffect(() => {
    if (beaconMarkerRef.current && currentPoint) {
      beaconMarkerRef.current.setLatLng(currentPoint);
    }
  }, [currentPoint]);

  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      lastTimeRef.current = null;
      return;
    }

    const totalDurationMs =
      (Math.max(workout.durationMinutes, 1) * 60 * 1000) / Math.max(playSpeed * 120, 1);
    const tick = (timestamp: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;
      setProgress((previous) => {
        const next = previous + delta / totalDurationMs;
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
  }, [isPlaying, playSpeed, workout.durationMinutes]);

  return (
    <div className="p-4 rounded-3xl bg-black/[0.02] dark:bg-black/60 border border-black/10 dark:border-white/10 space-y-4 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/5 dark:border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-[#00F5D4]" />
          <span className="text-sm font-bold text-neutral-900 dark:text-white tracking-wide">
            GPS 轨迹与遥测回放
          </span>
          <span className="text-[10px] text-neutral-400 font-mono">
            {routeCoords.length} 轨迹点 · {telemetry.length} 遥测帧
          </span>
        </div>
        <div className="flex bg-black/5 dark:bg-white/10 p-0.5 rounded-xl text-[10px] font-semibold">
          {[
            { key: 'osm' as const, label: '街道' },
            { key: 'topo' as const, label: '地形' },
            { key: 'none' as const, label: '纯轨迹' },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setMapTileType(option.key)}
              className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                mapTileType === option.key
                  ? 'bg-white dark:bg-white/20 text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {routeCoords.length >= 2 ? (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/5 bg-white/55 px-3 py-2 text-[10px] text-neutral-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-400">
            <span className="font-semibold text-neutral-700 dark:text-neutral-200">轨迹颜色 · 速度</span>
            <span className="flex items-center gap-1.5 font-mono">
              <span className="h-2 w-2 rounded-full bg-[#FFD60A]" />
              静止
              <span className="ml-2 h-2 w-12 rounded-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-red-500" />
              慢 → 快
            </span>
          </div>
          <div
            ref={mapContainerRef}
            className="w-full h-[300px] rounded-2xl overflow-hidden border border-black/5 dark:border-white/10"
            style={
              mapTileType === 'none'
                ? {
                    backgroundImage:
                      'linear-gradient(rgba(127,127,127,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(127,127,127,.08) 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                  }
                : undefined
            }
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-neutral-400">
            <span>
              地图由浏览器直连免费公共瓦片，无需 API Key · © OpenStreetMap contributors
              {mapTileType === 'topo' ? ' / OpenTopoMap' : ''}
            </span>
            <span
              className={
                tileStatus === 'error'
                  ? 'text-amber-500 font-semibold'
                  : tileStatus === 'ready'
                    ? 'text-emerald-500'
                    : ''
              }
            >
              {tileStatus === 'loading'
                ? '底图加载中'
                : tileStatus === 'ready'
                  ? '底图已加载'
                  : tileStatus === 'error'
                    ? '底图加载受限，轨迹仍可查看'
                    : '纯轨迹模式'}
            </span>
          </div>
        </div>
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

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setIsPlaying((value) => !value)}
          className="px-3 py-1.5 rounded-xl bg-[#00F5D4] text-neutral-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {isPlaying ? '暂停' : '播放'}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsPlaying(false);
            setProgress(0);
          }}
          className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 text-xs font-semibold text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          重置
        </button>
        <div className="flex bg-black/5 dark:bg-white/10 p-0.5 rounded-xl">
          {[1, 2, 4].map((speed) => (
            <button
              key={speed}
              type="button"
              onClick={() => setPlaySpeed(speed)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                playSpeed === speed
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
        <span className="text-[11px] text-neutral-400 font-mono ml-auto">
          {formatElapsed(currentElapsed)} / {formatElapsed(workout.durationMinutes * 60)}
        </span>
      </div>

      <div className="space-y-1">
        <input
          type="range"
          min="0"
          max="1000"
          step="1"
          value={Math.round(progress * 1000)}
          onChange={(event) => setProgress(Number(event.target.value) / 1000)}
          className="w-full accent-[#00F5D4] cursor-pointer"
          aria-label="拖动播放进度"
        />
        <div className="flex justify-between text-[9px] text-neutral-400 font-mono">
          <span>0:00</span>
          <span>{Math.round(progress * 100)}%</span>
          <span>{formatElapsed(workout.durationMinutes * 60)}</span>
        </div>
      </div>

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
