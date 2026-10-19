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
import type { WorkoutRecord } from '../../types/health';

interface WorkoutRoutePlaybackProps {
  workout: WorkoutRecord;
}

export const WorkoutRoutePlayback: React.FC<WorkoutRoutePlaybackProps> = ({ workout }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playSpeed, setPlaySpeed] = useState(2);
  const [mapTileType, setMapTileType] = useState<'carto' | 'osm'>('carto');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
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
  const currentIndex = Math.min(
    Math.floor(progress * Math.max(routeCoords.length - 1, 0)),
    Math.max(routeCoords.length - 1, 0)
  );
  const currentPoint = routeCoords[currentIndex];

  useEffect(() => {
    if (!mapContainerRef.current || routeCoords.length < 2) return;
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
    });
    mapInstanceRef.current = map;

    const tileUrl =
      mapTileType === 'osm'
        ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        : isDark
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    tileLayerRef.current = L.tileLayer(tileUrl, {
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    const polyline = L.polyline(routeCoords, {
      color: '#00F5D4',
      weight: 4.5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    const markerIcon = (label: string, color: string) =>
      L.divIcon({
        className: 'route-marker',
        html: `<div style="background:${color};color:#000;font-weight:700;font-size:10px;padding:2px 6px;border-radius:10px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);white-space:nowrap;">${label}</div>`,
        iconSize: [36, 20],
        iconAnchor: [18, 10],
      });
    L.marker(routeCoords[0], { icon: markerIcon('起点', '#00F5D4') }).addTo(map);
    L.marker(routeCoords[routeCoords.length - 1], {
      icon: markerIcon('终点', '#FFD60A'),
    }).addTo(map);

    const beaconIcon = L.divIcon({
      className: 'route-beacon',
      html: '<div style="width:20px;height:20px;border-radius:50%;background:#00F5D4;border:3px solid #fff;box-shadow:0 0 16px #00F5D4;"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    beaconMarkerRef.current = L.marker(routeCoords[0], { icon: beaconIcon }).addTo(map);
    map.fitBounds(polyline.getBounds(), { padding: [35, 35] });

    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(polyline.getBounds(), { padding: [35, 35] });
    }, 250);

    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      beaconMarkerRef.current = null;
    };
  }, [isDark, mapTileType, routeCoords]);

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

  if (routeCoords.length < 2) {
    return (
      <div className="p-5 rounded-3xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/10 text-center">
        <Navigation className="w-6 h-6 mx-auto text-neutral-400 mb-2" />
        <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          当前记录没有 GPS 轨迹点
        </p>
        <p className="text-xs text-neutral-400 mt-1">
          仅展示设备实际提供的聚合指标，不生成模拟路线。
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-3xl bg-black/[0.02] dark:bg-black/60 border border-black/10 dark:border-white/10 space-y-4 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/5 dark:border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-[#00F5D4]" />
          <span className="text-sm font-bold text-neutral-900 dark:text-white tracking-wide">
            GPS 轨迹回放
          </span>
          <span className="text-[10px] text-neutral-400 font-mono">
            {routeCoords.length} 个轨迹点
          </span>
        </div>
        <div className="flex bg-black/5 dark:bg-white/10 p-0.5 rounded-xl text-[10px] font-semibold">
          <button
            type="button"
            onClick={() => setMapTileType('carto')}
            className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
              mapTileType === 'carto'
                ? 'bg-white dark:bg-white/20 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400'
            }`}
          >
            CartoDB
          </button>
          <button
            type="button"
            onClick={() => setMapTileType('osm')}
            className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
              mapTileType === 'osm'
                ? 'bg-white dark:bg-white/20 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400'
            }`}
          >
            OpenStreetMap
          </button>
        </div>
      </div>

      <div ref={mapContainerRef} className="w-full h-[280px] rounded-2xl overflow-hidden" />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setIsPlaying((value) => !value)}
          className="px-3 py-1.5 rounded-xl bg-[#00F5D4] text-neutral-950 text-xs font-bold flex items-center gap-1.5"
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
          className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 text-xs font-semibold text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5"
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
              className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
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
          {Math.round(progress * 100)}%
        </span>
      </div>

      <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <div
          className="h-full bg-[#00F5D4] transition-[width] duration-100"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04]">
          <span className="flex items-center gap-1 text-[10px] text-neutral-400">
            <Heart className="w-3 h-3 text-rose-400" /> 平均心率
          </span>
          <span className="font-bold font-mono text-neutral-900 dark:text-white">
            {workout.avgHeartRate > 0 ? `${workout.avgHeartRate} bpm` : '—'}
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04]">
          <span className="flex items-center gap-1 text-[10px] text-neutral-400">
            <Gauge className="w-3 h-3 text-sky-400" /> 平均速度
          </span>
          <span className="font-bold font-mono text-neutral-900 dark:text-white">
            {workout.distanceKm && workout.durationMinutes > 0
              ? `${(workout.distanceKm / (workout.durationMinutes / 60)).toFixed(1)} km/h`
              : '—'}
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04]">
          <span className="flex items-center gap-1 text-[10px] text-neutral-400">
            <Activity className="w-3 h-3 text-emerald-400" /> 踏频
          </span>
          <span className="font-bold font-mono text-neutral-900 dark:text-white">
            {workout.cadenceAvg ? `${workout.cadenceAvg} rpm` : '—'}
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04]">
          <span className="flex items-center gap-1 text-[10px] text-neutral-400">
            <Zap className="w-3 h-3 text-amber-400" /> 平均功率
          </span>
          <span className="font-bold font-mono text-neutral-900 dark:text-white">
            {workout.avgPower ? `${workout.avgPower} W` : '—'}
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04]">
          <span className="flex items-center gap-1 text-[10px] text-neutral-400">
            <Mountain className="w-3 h-3 text-orange-400" /> 累计爬升
          </span>
          <span className="font-bold font-mono text-neutral-900 dark:text-white">
            {workout.elevationGainM ? `${workout.elevationGainM} m` : '—'}
          </span>
        </div>
      </div>
    </div>
  );
};
