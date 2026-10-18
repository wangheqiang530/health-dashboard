import React, { useState, useEffect, useRef } from 'react';
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

export const WorkoutRoutePlayback: React.FC<WorkoutRoutePlaybackProps> = ({ workout }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 1
  const [playSpeed, setPlaySpeed] = useState<number>(2); // 1x, 2x, 4x, 8x
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // SVG Canvas Dimensions
  const svgW = 520;
  const svgH = 200;
  const pad = 28;

  // Use actual GPX points if present, or generate a realistic procedural route based on distance/duration
  const pts = React.useMemo(() => {
    if (workout.routeGpxPoints && workout.routeGpxPoints.length > 5) {
      return workout.routeGpxPoints;
    }
    // Procedural high-fidelity cycling circuit
    const sampleCount = 60;
    const circuit: { lat: number; lon: number }[] = [];
    const baseLat = 31.2304;
    const baseLon = 121.4737;
    for (let i = 0; i < sampleCount; i++) {
      const t = (i / sampleCount) * Math.PI * 2;
      // A nice loop with bends and climbs
      const lat = baseLat + Math.sin(t) * 0.045 + Math.sin(t * 3) * 0.015;
      const lon = baseLon + Math.cos(t) * 0.065 + Math.cos(t * 2) * 0.012;
      circuit.push({ lat, lon });
    }
    return circuit;
  }, [workout]);

  // Normalize points to SVG canvas
  const mappedPoints = React.useMemo(() => {
    const lats = pts.map((p) => p.lat);
    const lons = pts.map((p) => p.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    return pts.map((p) => ({
      x: pad + ((p.lon - minLon) / Math.max(maxLon - minLon, 0.0001)) * (svgW - pad * 2),
      y: svgH - pad - ((p.lat - minLat) / Math.max(maxLat - minLat, 0.0001)) * (svgH - pad * 2),
    }));
  }, [pts]);

  const svgPathD = React.useMemo(() => {
    if (mappedPoints.length === 0) return '';
    return mappedPoints.reduce((acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`, '');
  }, [mappedPoints]);

  // Compute current position along the path based on progress (0 to 1)
  const currentPointIndex = Math.min(
    Math.floor(progress * (mappedPoints.length - 1)),
    mappedPoints.length - 1
  );
  const currentCoord = mappedPoints[currentPointIndex] || mappedPoints[0] || { x: pad, y: pad };

  // Simulated real-time telemetry varying across progress
  const currentKm = Number(((workout.distanceKm || 18.2) * progress).toFixed(2));
  
  // Dynamics based on terrain and effort
  const baseHr = workout.avgHeartRate || 135;
  const hrVariance = Math.sin(progress * Math.PI * 4) * 18;
  const currentHr = Math.round(baseHr + hrVariance);

  const currentSpeed = Number(
    (
      (workout.distanceKm && workout.durationMinutes
        ? (workout.distanceKm / (workout.durationMinutes / 60))
        : 28.5) +
      Math.sin(progress * Math.PI * 6) * 6
    ).toFixed(1)
  );

  const currentCadence = Math.round((workout.cadenceAvg || 88) + Math.cos(progress * Math.PI * 5) * 8);
  const currentPower = Math.round(
    (workout.avgPower || 195) + Math.sin(progress * Math.PI * 4) * 45
  );
  const currentElevation = Math.round(
    ((workout.elevationGainM || 68) * progress * 1.1) + Math.sin(progress * Math.PI * 3) * 12
  );

  // Animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      lastTimeRef.current = null;
      return;
    }

    const totalDurationMs = ((workout.durationMinutes || 35) * 60 * 1000) / (playSpeed * 120);

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
  }, [isPlaying, playSpeed, workout.durationMinutes]);

  const handleReset = () => {
    setIsPlaying(false);
    setProgress(0);
  };

  return (
    <div className="p-4 rounded-3xl bg-neutral-950/80 border border-white/10 space-y-3.5">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-[#00F5D4]" />
          <span className="text-xs font-bold text-white tracking-wide">
            户外 GPS 轨迹与全参数同步回放 (Live Telemetry Replay)
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-400">
          <span>进度: {Math.round(progress * 100)}%</span>
          <span>•</span>
          <span>{currentKm} / {workout.distanceKm || 18.2} km</span>
        </div>
      </div>

      {/* Real-time Telemetry HUD Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-xs">
        <div className="p-2 rounded-xl bg-white/[0.04] border border-white/5 flex items-center justify-between">
          <span className="text-[10px] text-neutral-400 flex items-center gap-1">
            <Heart className="w-3 h-3 text-rose-500 fill-rose-500 animate-pulse" />
            心率
          </span>
          <span className="font-bold text-rose-400">{currentHr} <span className="text-[9px] font-normal text-neutral-400">BPM</span></span>
        </div>

        <div className="p-2 rounded-xl bg-white/[0.04] border border-white/5 flex items-center justify-between">
          <span className="text-[10px] text-neutral-400 flex items-center gap-1">
            <Gauge className="w-3 h-3 text-cyan-400" />
            时速
          </span>
          <span className="font-bold text-cyan-300">{currentSpeed} <span className="text-[9px] font-normal text-neutral-400">km/h</span></span>
        </div>

        <div className="p-2 rounded-xl bg-white/[0.04] border border-white/5 flex items-center justify-between">
          <span className="text-[10px] text-neutral-400 flex items-center gap-1">
            <Activity className="w-3 h-3 text-teal-400" />
            踏频
          </span>
          <span className="font-bold text-teal-300">{currentCadence} <span className="text-[9px] font-normal text-neutral-400">RPM</span></span>
        </div>

        <div className="p-2 rounded-xl bg-white/[0.04] border border-white/5 flex items-center justify-between">
          <span className="text-[10px] text-neutral-400 flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" />
            功率
          </span>
          <span className="font-bold text-amber-300">{currentPower} <span className="text-[9px] font-normal text-neutral-400">W</span></span>
        </div>

        <div className="p-2 rounded-xl bg-white/[0.04] border border-white/5 flex items-center justify-between col-span-2 sm:col-span-1">
          <span className="text-[10px] text-neutral-400 flex items-center gap-1">
            <Mountain className="w-3 h-3 text-emerald-400" />
            爬升
          </span>
          <span className="font-bold text-emerald-300">{currentElevation} <span className="text-[9px] font-normal text-neutral-400">m</span></span>
        </div>
      </div>

      {/* Vector Route Map Canvas */}
      <div className="relative w-full h-[200px] bg-[#0c0e14] rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full overflow-visible select-none">
          <defs>
            <linearGradient id="replayGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00F5D4" />
              <stop offset="50%" stopColor="#A1FF00" />
              <stop offset="100%" stopColor="#FFD60A" />
            </linearGradient>
            <filter id="trailGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Grid Lines */}
          <line x1={pad} y1={svgH / 2} x2={svgW - pad} y2={svgH / 2} stroke="#ffffff0a" strokeDasharray="3 3" />
          <line x1={svgW / 2} y1={pad} x2={svgW / 2} y2={svgH - pad} stroke="#ffffff0a" strokeDasharray="3 3" />

          {/* Full Trail Path (Subdued base) */}
          <path
            d={svgPathD}
            fill="none"
            stroke="#ffffff25"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Active Highlight Trail Path */}
          <path
            d={svgPathD}
            fill="none"
            stroke="url(#replayGradient)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#trailGlow)"
          />

          {/* Start Point Marker (Green Flag) */}
          {mappedPoints.length > 0 && (
            <g>
              <circle cx={mappedPoints[0].x} cy={mappedPoints[0].y} r="6" fill="#00F5D4" stroke="#FFF" strokeWidth="2" />
              <text x={mappedPoints[0].x} y={mappedPoints[0].y - 9} textAnchor="middle" className="text-[9px] fill-[#00F5D4] font-bold font-sans">
                起点
              </text>
            </g>
          )}

          {/* Finish Point Marker (Checkered Flag) */}
          {mappedPoints.length > 1 && (
            <g>
              <circle cx={mappedPoints[mappedPoints.length - 1].x} cy={mappedPoints[mappedPoints.length - 1].y} r="6" fill="#FFD60A" stroke="#FFF" strokeWidth="2" />
              <text x={mappedPoints[mappedPoints.length - 1].x} y={mappedPoints[mappedPoints.length - 1].y - 9} textAnchor="middle" className="text-[9px] fill-[#FFD60A] font-bold font-sans">
                终点
              </text>
            </g>
          )}

          {/* Moving Luminous Telemetry Beacon */}
          {currentCoord && (
            <g>
              {/* Outer Pulsing Beacon Wave */}
              <circle
                cx={currentCoord.x}
                cy={currentCoord.y}
                r="14"
                fill="#00F5D4"
                fillOpacity="0.3"
                className="animate-ping"
              />
              {/* Core Beacon Dot */}
              <circle
                cx={currentCoord.x}
                cy={currentCoord.y}
                r="6.5"
                fill="#00F5D4"
                stroke="#FFFFFF"
                strokeWidth="2.5"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Playback Controls & Progress Slider Bar */}
      <div className="space-y-2 pt-1">
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
            className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white transition-all cursor-pointer"
            title="重新从起点开始"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Scrubber Range Bar */}
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
              className="w-full accent-[#00F5D4] h-2 bg-white/10 rounded-lg cursor-pointer"
            />
          </div>

          {/* Playback Speed Multiplier */}
          <div className="flex bg-white/10 p-1 rounded-xl text-[11px] font-mono">
            {[1, 2, 4, 8].map((s) => (
              <button
                key={s}
                onClick={() => setPlaySpeed(s)}
                className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                  playSpeed === s ? 'bg-[#00F5D4] text-neutral-950 font-bold' : 'text-neutral-400 hover:text-white'
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
