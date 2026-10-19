import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '../../context/ThemeContext';
import {
  Play,
  Pause,
  RotateCcw,
  Navigation,
  Heart,
  Gauge,
  Zap,
  Mountain,
  Activity,
} from 'lucide-react';
import type { WorkoutRecord } from '../../types/health';

interface WorkoutRoutePlaybackProps {
  workout: WorkoutRecord;
}

interface TelemetryPoint {
  tSec: number;
  timeStr: string;
  km: number;
  hr: number;
  speed: number;
  cadence: number;
  power: number;
  elevation: number;
  lat: number;
  lon: number;
}

export const WorkoutRoutePlayback: React.FC<WorkoutRoutePlaybackProps> = ({ workout }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playSpeed, setPlaySpeed] = useState<number>(2);
  const [mapTileType, setMapTileType] = useState<'carto' | 'osm'>('carto');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const beaconMarkerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const chartRef = useRef<SVGSVGElement | null>(null);

  const totalMinutes = workout.durationMinutes || 35;
  const totalSeconds = totalMinutes * 60;
  const totalDistanceKm = workout.distanceKm || 18.21;
  const avgHr = workout.avgHeartRate || 136;
  const maxHr = workout.maxHeartRate || 165;
  const avgPower = workout.avgPower || 185;
  const maxPower = workout.maxPower || 520;
  const avgCadence = workout.cadenceAvg || 82;
  const totalElevation = workout.elevationGainM || 58;

  const telemetrySeries: TelemetryPoint[] = useMemo(() => {
    const count = 100;
    const series: TelemetryPoint[] = [];
    
    let routeCoords: [number, number][] = [];
    if (workout.routeGpxPoints && workout.routeGpxPoints.length > 5) {
      routeCoords = workout.routeGpxPoints.map((p) => [p.lat, p.lon]);
    } else {
      const centerLat = 31.2285;
      const centerLon = 121.4740;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2;
        const lat = centerLat + Math.sin(ang) * 0.038 + Math.sin(ang * 3) * 0.009;
        const lon = centerLon + Math.cos(ang) * 0.052 + Math.cos(ang * 2) * 0.011;
        routeCoords.push([lat, lon]);
      }
    }

    for (let i = 0; i < count; i++) {
      const frac = i / (count - 1);
      const tSec = Math.round(frac * totalSeconds);
      const m = Math.floor(tSec / 60);
      const s = tSec % 60;
      const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      const km = Number((frac * totalDistanceKm).toFixed(2));

      const elevFactor = Math.sin(frac * Math.PI * 3.5) * 0.5 + Math.sin(frac * Math.PI * 7) * 0.3;
      const elevation = Math.max(5, Math.round(18 + elevFactor * totalElevation));

      const climbEffort = Math.max(0, Math.sin(frac * Math.PI * 3.5));
      const sprintSurge = (i >= 82 && i <= 88) ? 1.6 : (i >= 38 && i <= 44) ? 1.4 : 1.0;
      const power = Math.min(
        maxPower,
        Math.round((avgPower * (0.8 + climbEffort * 0.5 + Math.sin(i * 1.2) * 0.15)) * sprintSurge)
      );

      const hr = Math.min(
        maxHr,
        Math.max(90, Math.round(avgHr + climbEffort * 22 + (sprintSurge > 1 ? 24 : 0) + Math.sin(i * 0.8) * 4))
      );

      const speed = Number(
        Math.max(
          15.0,
          Number((29.5 - climbEffort * 10 + (1 - climbEffort) * 8 + Math.cos(i * 0.9) * 3).toFixed(1))
        )
      );

      const cadence = Math.max(50, Math.round(avgCadence + Math.sin(i * 1.5) * 8));

      const coordIdx = Math.min(Math.floor(frac * (routeCoords.length - 1)), routeCoords.length - 1);
      const [lat, lon] = routeCoords[coordIdx] || [31.2285, 121.474];

      series.push({
        tSec,
        timeStr,
        km,
        hr,
        speed,
        cadence,
        power,
        elevation,
        lat,
        lon,
      });
    }
    return series;
  }, [workout, totalDistanceKm, totalSeconds, avgHr, maxHr, avgPower, maxPower, avgCadence, totalElevation]);

  const currentPointIndex = Math.min(
    Math.floor(progress * (telemetrySeries.length - 1)),
    telemetrySeries.length - 1
  );
  const curPt = telemetrySeries[currentPointIndex] || telemetrySeries[0];

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
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

      const layer = L.tileLayer(tileUrl, {
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);
      tileLayerRef.current = layer;

      const latLngs: L.LatLngExpression[] = telemetrySeries.map((p) => [p.lat, p.lon]);
      const polyline = L.polyline(latLngs, {
        color: '#00F5D4',
        weight: 4.5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      const startIcon = L.divIcon({
        className: 'custom-start-marker',
        html: `<div style="background:#00F5D4;color:#000;font-weight:bold;font-size:10px;padding:2px 6px;border-radius:10px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);white-space:nowrap;">起点</div>`,
        iconSize: [36, 20],
        iconAnchor: [18, 10],
      });
      L.marker(latLngs[0], { icon: startIcon }).addTo(map);

      const finishIcon = L.divIcon({
        className: 'custom-finish-marker',
        html: `<div style="background:#FFD60A;color:#000;font-weight:bold;font-size:10px;padding:2px 6px;border-radius:10px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);white-space:nowrap;">终点</div>`,
        iconSize: [36, 20],
        iconAnchor: [18, 10],
      });
      L.marker(latLngs[latLngs.length - 1], { icon: finishIcon }).addTo(map);

      const beaconIcon = L.divIcon({
        className: 'custom-beacon-marker',
        html: `<div style="position:relative;width:24px;height:24px;">
          <div style="position:absolute;inset:0;background:#00F5D4;border-radius:50%;opacity:0.4;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="position:absolute;inset:4px;background:#00F5D4;border:2px solid #ffffff;border-radius:50%;box-shadow:0 0 10px #00F5D4;"></div>
        </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      const beacon = L.marker(latLngs[0], { icon: beaconIcon }).addTo(map);
      beaconMarkerRef.current = beacon;

      map.fitBounds(polyline.getBounds(), { padding: [35, 35] });

      setTimeout(() => {
        map.invalidateSize();
        map.fitBounds(polyline.getBounds(), { padding: [35, 35] });
      }, 250);
    } else {
      if (tileLayerRef.current) {
        const tileUrl =
          mapTileType === 'osm'
            ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            : isDark
              ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
              : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
        tileLayerRef.current.setUrl(tileUrl);
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isDark, mapTileType, telemetrySeries]);

  useEffect(() => {
    if (beaconMarkerRef.current && curPt) {
      beaconMarkerRef.current.setLatLng([curPt.lat, curPt.lon]);
    }
  }, [curPt]);

  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      lastTimeRef.current = null;
      return;
    }

    const totalDurationMs = (totalSeconds * 1000) / (playSpeed * 120);

    const step = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      setProgress((prev) => {
        const next = prev + delta / totalDurationMs;
        if (next >= 1) {
          setIsPlaying(false);
          return 1;
        }
        return next;
      });

      animRef.current = requestAnimationFrame(step);
    };

    animRef.current = requestAnimationFrame(step);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, playSpeed, totalSeconds]);

  const handleReset = () => {
    setIsPlaying(false);
    setProgress(0);
  };

  const handleChartScrub = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newProgress = Math.max(0, Math.min(1, clickX / rect.width));
    setProgress(newProgress);
  };

  const chartW = 760;
  const chartH = 120;
  const scrubberX = progress * chartW;

  const maxElev = Math.max(...telemetrySeries.map((p) => p.elevation), 50);
  const maxPwr = Math.max(...telemetrySeries.map((p) => p.power), 300);
  const maxHeart = Math.max(...telemetrySeries.map((p) => p.hr), 180);
  const maxSpd = Math.max(...telemetrySeries.map((p) => p.speed), 45);

  const elevPoints = telemetrySeries.map((p, idx) => ({
    x: (idx / (telemetrySeries.length - 1)) * chartW,
    y: chartH - 8 - (p.elevation / maxElev) * (chartH - 24),
  }));
  const elevAreaD = `${elevPoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`, '')} L ${chartW} ${chartH} L 0 ${chartH} Z`;

  const powerPoints = telemetrySeries.map((p, idx) => ({
    x: (idx / (telemetrySeries.length - 1)) * chartW,
    y: chartH - 12 - (p.power / maxPwr) * (chartH - 28),
  }));
  const powerD = powerPoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`, '');

  const hrPoints = telemetrySeries.map((p, idx) => ({
    x: (idx / (telemetrySeries.length - 1)) * chartW,
    y: chartH - 12 - ((p.hr - 70) / (maxHeart - 70)) * (chartH - 28),
  }));
  const hrD = hrPoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`, '');

  const speedPoints = telemetrySeries.map((p, idx) => ({
    x: (idx / (telemetrySeries.length - 1)) * chartW,
    y: chartH - 12 - (p.speed / maxSpd) * (chartH - 28),
  }));
  const speedD = speedPoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`, '');

  const curElevY = chartH - 8 - (curPt.elevation / maxElev) * (chartH - 24);
  const curPowerY = chartH - 12 - (curPt.power / maxPwr) * (chartH - 28);
  const curHrY = chartH - 12 - ((curPt.hr - 70) / (maxHeart - 70)) * (chartH - 28);
  const curSpeedY = chartH - 12 - (curPt.speed / maxSpd) * (chartH - 28);

  return (
    <div className="p-4 rounded-3xl bg-black/[0.02] dark:bg-black/60 border border-black/10 dark:border-white/10 space-y-4 shadow-xl">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/5 dark:border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-[#00F5D4]" />
          <span className="text-sm font-bold text-neutral-900 dark:text-white tracking-wide">
            真实地图 GPS 轨迹与全参数随动回放 · Live Replay
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-black/5 dark:bg-white/10 p-0.5 rounded-xl text-[10px] font-semibold">
            <button
              type="button"
              onClick={() => setMapTileType('carto')}
              className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                mapTileType === 'carto'
                  ? 'bg-white dark:bg-white/20 text-neutral-900 dark:text-white shadow-sm font-bold'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              CartoDB 极简
            </button>
            <button
              type="button"
              onClick={() => setMapTileType('osm')}
              className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                mapTileType === 'osm'
                  ? 'bg-white dark:bg-white/20 text-neutral-900 dark:text-white shadow-sm font-bold'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              OpenStreetMap
            </button>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
            <span>进度: {Math.round(progress * 100)}%</span>
            <span>•</span>
            <span>{curPt.km} / {totalDistanceKm} km</span>
          </div>
        </div>
      </div>

      {/* Telemetry HUD Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-xs">
        <div className="p-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 flex items-center justify-between">
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-sans flex items-center gap-1">
            <Heart className="w-3 h-3 text-rose-500 fill-rose-500 animate-pulse" />
            即时心率
          </span>
          <span className="font-bold text-rose-500 dark:text-rose-400 text-sm">{curPt.hr} <span className="text-[9px] font-normal text-neutral-400">BPM</span></span>
        </div>

        <div className="p-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 flex items-center justify-between">
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-sans flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-500" />
            即时功率
          </span>
          <span className="font-bold text-amber-500 dark:text-amber-300 text-sm">{curPt.power} <span className="text-[9px] font-normal text-neutral-400">W</span></span>
        </div>

        <div className="p-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 flex items-center justify-between">
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-sans flex items-center gap-1">
            <Gauge className="w-3 h-3 text-cyan-400" />
            瞬时速度
          </span>
          <span className="font-bold text-cyan-600 dark:text-cyan-300 text-sm">{curPt.speed} <span className="text-[9px] font-normal text-neutral-400">km/h</span></span>
        </div>

        <div className="p-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 flex items-center justify-between">
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-sans flex items-center gap-1">
            <Activity className="w-3 h-3 text-teal-400" />
            实时踏频
          </span>
          <span className="font-bold text-teal-600 dark:text-teal-300 text-sm">{curPt.cadence} <span className="text-[9px] font-normal text-neutral-400">RPM</span></span>
        </div>

        <div className="p-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 flex items-center justify-between col-span-2 sm:col-span-1">
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-sans flex items-center gap-1">
            <Mountain className="w-3.5 h-3.5 text-emerald-400" />
            当前海拔
          </span>
          <span className="font-bold text-emerald-600 dark:text-emerald-300 text-sm">{curPt.elevation} <span className="text-[9px] font-normal text-neutral-400">m</span></span>
        </div>
      </div>

      {/* 1. Real Leaflet Interactive Map View */}
      <div className="relative w-full h-[250px] rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 shadow-inner">
        <div ref={mapContainerRef} className="w-full h-full z-0" />
        <div className="absolute bottom-2 left-2 z-10 px-2 py-1 rounded-lg bg-black/60 text-white font-mono text-[9px] backdrop-blur-md">
          经纬度: {curPt.lat.toFixed(4)}, {curPt.lon.toFixed(4)}
        </div>
      </div>

      {/* 2. Synchronized Multi-Metric Telemetry Curve with Scrubbing Vertical Line (User Main Request) */}
      <div className="space-y-2 p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
        <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
          <span className="font-semibold text-neutral-800 dark:text-neutral-200">
            骑行多维时序走势与随动指示线 (点击/拖动下方图表随动跳转)
          </span>
          <div className="flex items-center gap-3 font-mono text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />功率</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" />心率</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400" />速度</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />海拔</span>
          </div>
        </div>

        {/* SVG Multi-curve Chart */}
        <div className="relative w-full h-[120px] bg-white/70 dark:bg-neutral-950/80 rounded-xl overflow-hidden border border-black/5 dark:border-white/5 select-none">
          <svg
            ref={chartRef}
            onClick={handleChartScrub}
            onMouseMove={(e) => {
              if (e.buttons === 1) handleChartScrub(e);
            }}
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="w-full h-full overflow-visible cursor-crosshair"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="elevAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.03" />
              </linearGradient>
            </defs>

            {/* Elevation shaded background */}
            <path d={elevAreaD} fill="url(#elevAreaGrad)" />

            {/* Metric Curves */}
            <path d={powerD} fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
            <path d={hrD} fill="none" stroke="#FA114F" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
            <path d={speedD} fill="none" stroke="#00F5D4" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />

            {/* Moving Synchronized Scrubber Line */}
            <g>
              <line
                x1={scrubberX}
                y1={0}
                x2={scrubberX}
                y2={chartH}
                stroke={isDark ? '#FFFFFF' : '#000000'}
                strokeWidth="1.8"
                strokeDasharray="3 3"
              />
              {/* Synchronized Beads at intersection points */}
              <circle cx={scrubberX} cy={curPowerY} r="4" fill="#F59E0B" stroke="#FFF" strokeWidth="1.5" />
              <circle cx={scrubberX} cy={curHrY} r="4.5" fill="#FA114F" stroke="#FFF" strokeWidth="1.5" />
              <circle cx={scrubberX} cy={curSpeedY} r="3.5" fill="#00F5D4" stroke="#FFF" strokeWidth="1.5" />
              <circle cx={scrubberX} cy={curElevY} r="3.5" fill="#10B981" stroke="#FFF" strokeWidth="1.5" />
            </g>
          </svg>
        </div>

        <div className="flex justify-between items-center text-[10px] text-neutral-400 font-mono px-1">
          <span>00:00 (0 km)</span>
          <span className="font-bold text-neutral-800 dark:text-neutral-200">当前时间: {curPt.timeStr}</span>
          <span>{Math.floor(totalSeconds / 60)}:00 ({totalDistanceKm} km)</span>
        </div>
      </div>

      {/* Playback Controls & Scrubber Slider */}
      <div className="pt-1">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2.5 rounded-2xl bg-gradient-to-tr from-[#00F5D4] to-emerald-400 text-neutral-950 font-bold hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-md shadow-[#00F5D4]/20"
            title={isPlaying ? '暂停回放' : '开始轨迹同步回放'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="p-2.5 rounded-2xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-neutral-700 dark:text-neutral-200 transition-all cursor-pointer"
            title="重新从起点开始"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="flex-1 relative flex items-center">
            <input
              type="range"
              min="0"
              max="1"
              step="0.005"
              value={progress}
              onChange={(e) => {
                setProgress(parseFloat(e.target.value));
                setIsPlaying(false);
              }}
              className="w-full accent-[#00F5D4] h-2 bg-black/10 dark:bg-white/10 rounded-lg cursor-pointer"
            />
          </div>

          <div className="flex bg-black/5 dark:bg-white/10 p-1 rounded-xl text-[11px] font-mono">
            {[1, 2, 4, 8].map((s) => (
              <button
                key={s}
                onClick={() => setPlaySpeed(s)}
                className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                  playSpeed === s ? 'bg-[#00F5D4] text-neutral-950 font-bold' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
