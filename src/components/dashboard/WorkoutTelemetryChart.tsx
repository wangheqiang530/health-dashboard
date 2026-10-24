import React, { useRef, useState } from 'react';
import type { WorkoutTelemetryPoint } from '../../types/health';
import type { TelemetryMetricKey } from '../../utils/workoutTelemetry';

const formatChartTime = (seconds: number): string => {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`;
};

export const TelemetryChart: React.FC<{
  telemetry: WorkoutTelemetryPoint[];
  metricKey: TelemetryMetricKey;
  label: string;
  unit: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  progress: number;
  onScrub: (progress: number) => void;
}> = ({ telemetry, metricKey, label, unit, color, icon: Icon, progress, onScrub }) => {
  const [hover, setHover] = useState<{
    index: number;
    x: number;
    y: number;
    value: number;
  } | null>(null);
  const draggingRef = useRef(false);
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

  const pointerPosition = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const index = Math.min(
      telemetry.length - 1,
      Math.max(0, Math.round(ratio * Math.max(telemetry.length - 1, 0)))
    );
    const value = telemetry[index]?.[metricKey];
    if (!Number.isFinite(value)) return null;
    return {
      index,
      x: xFor(index),
      y: yFor(Number(value)),
      value: Number(value),
    };
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    const next = pointerPosition(event);
    if (!next) return;
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    setHover(next);
    onScrub(next.index / Math.max(telemetry.length - 1, 1));
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const next = pointerPosition(event);
    if (!next) return;
    setHover(next);
    if (draggingRef.current) {
      onScrub(next.index / Math.max(telemetry.length - 1, 1));
    }
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handlePointerLeave = () => {
    if (!draggingRef.current) setHover(null);
  };

  const hoverTime = hover ? telemetry[hover.index]?.elapsedSec || 0 : 0;
  const tooltipWidth = 118;
  const tooltipX = hover
    ? Math.min(width - tooltipWidth - 6, Math.max(6, hover.x - tooltipWidth / 2))
    : 0;
  const tooltipY = hover ? Math.max(4, hover.y - 31) : 0;

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
        className="w-full h-[102px] cursor-crosshair overflow-visible touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        role="img"
        aria-label={`${label}遥测曲线，悬停查看十字读数，按住拖动调整回放位置`}
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
        {hover && (
          <g pointerEvents="none">
            <line
              x1={hover.x}
              x2={hover.x}
              y1={padding}
              y2={height - padding}
              stroke="white"
              strokeOpacity="0.58"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            <line
              x1={padding}
              x2={width - padding}
              y1={hover.y}
              y2={hover.y}
              stroke="white"
              strokeOpacity="0.34"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            <circle
              cx={hover.x}
              cy={hover.y}
              r="4.5"
              fill={color}
              stroke="white"
              strokeWidth="2"
            />
            <rect
              x={tooltipX}
              y={tooltipY}
              width={tooltipWidth}
              height="23"
              rx="5"
              fill="#020617"
              fillOpacity="0.9"
              stroke={color}
              strokeOpacity="0.45"
            />
            <text
              x={tooltipX + 7}
              y={tooltipY + 15}
              fill="#e2e8f0"
              fontSize="9"
              fontFamily="monospace"
            >
              {formatChartTime(hoverTime)} · {Math.round(hover.value)} {unit}
            </text>
          </g>
        )}
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
