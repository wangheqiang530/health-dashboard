import React, { useMemo, useRef } from 'react';
import { Route } from 'lucide-react';
import type { GpxCoordinate } from '../../types/health';

interface RouteMinimapProps {
  route: GpxCoordinate[];
  progress: number;
  onSeek: (progress: number) => void;
  className?: string;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const RouteMinimap: React.FC<RouteMinimapProps> = ({
  route,
  progress,
  onSeek,
  className = '',
}) => {
  const draggingRef = useRef(false);
  const width = 190;
  const height = 116;
  const padding = 13;
  const points = useMemo(
    () =>
      route.filter(
        (point) =>
          Number.isFinite(point.lat) &&
          Number.isFinite(point.lon) &&
          Math.abs(point.lat) <= 90 &&
          Math.abs(point.lon) <= 180
      ),
    [route]
  );
  const projected = useMemo(() => {
    if (points.length === 0) return [];
    const lats = points.map((point) => point.lat);
    const lons = points.map((point) => point.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const latRange = Math.max(maxLat - minLat, 0.00001);
    const lonRange = Math.max(maxLon - minLon, 0.00001);
    return points.map((point) => ({
      x:
        padding +
        ((point.lon - minLon) / lonRange) * (width - padding * 2),
      y:
        height -
        padding -
        ((point.lat - minLat) / latRange) * (height - padding * 2),
    }));
  }, [points]);

  if (projected.length < 2) return null;

  const path = projected
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    )
    .join(' ');
  const markerIndex = Math.min(
    projected.length - 1,
    Math.max(0, Math.round(clamp(progress, 0, 1) * (projected.length - 1)))
  );
  const marker = projected[markerIndex];
  const start = projected[0];
  const end = projected[projected.length - 1];

  const seekFromPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const y = ((event.clientY - rect.top) / rect.height) * height;
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    projected.forEach((point, index) => {
      const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    onSeek(nearestIndex / Math.max(projected.length - 1, 1));
  };

  return (
    <div
      className={`rounded-2xl border border-white/15 bg-slate-950/82 p-2.5 shadow-2xl backdrop-blur-xl ${className}`}
    >
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <span className="flex items-center gap-1 text-[9px] font-semibold text-slate-300">
          <Route className="h-3 w-3 text-sky-300" />
          总路线
        </span>
        <span className="font-mono text-[8px] text-slate-500">
          {Math.round(clamp(progress, 0, 1) * 100)}%
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block w-[190px] cursor-crosshair touch-none select-none"
        role="img"
        aria-label="本次骑行总路线俯视图，点击可跳转回放位置"
        onPointerDown={(event) => {
          draggingRef.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          seekFromPointer(event);
        }}
        onPointerMove={(event) => {
          if (draggingRef.current) seekFromPointer(event);
        }}
        onPointerUp={(event) => {
          draggingRef.current = false;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
        }}
      >
        <rect width={width} height={height} rx="10" fill="rgba(2,6,23,.55)" />
        <path
          d={path}
          fill="none"
          stroke="#0f172a"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={path}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={start.x} cy={start.y} r="4" fill="#34d399" stroke="#052e16" strokeWidth="2" />
        <circle cx={end.x} cy={end.y} r="4" fill="#fb7185" stroke="#4c0519" strokeWidth="2" />
        <circle
          cx={marker.x}
          cy={marker.y}
          r="6"
          fill="#f8fafc"
          stroke="#0ea5e9"
          strokeWidth="3"
        />
      </svg>
    </div>
  );
};
