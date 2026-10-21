import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type {
  DailySummary,
  HeartRatePoint,
  HrvPoint,
  VitalsData,
} from '../../types/health';
import { AppleCard } from '../ui/AppleCard';
import {
  buildDailyMetricSeries,
  buildWeeklyMetricSeries,
  resolveMetricSnapshot,
  timeToMinutes,
  type DailyMetricPoint,
  type HeartRateMetric,
  type WeeklyMetricPoint,
} from '../../utils/heartRateSeries';
import { Flame, Footprints, Heart, Moon, Waves } from 'lucide-react';

type TimeSpan = 'hourly' | 'daily' | 'weekly';

interface HeartRateCardProps {
  timeline: HeartRatePoint[];
  vitals: VitalsData;
  days?: Record<string, DailySummary>;
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
}

interface ChartDatum {
  time: string;
  minutes: number;
  value: number;
  source?: HeartRatePoint | HrvPoint;
}

interface HoveredChartPoint {
  time: string;
  value: number;
  unit: 'BPM' | 'ms';
  label: string;
}

const CHART_WIDTH = 560;
const CHART_HEIGHT = 166;
const CHART_PADDING = { left: 34, right: 14, top: 16, bottom: 27 };
const FALLBACK_DATE = new Intl.DateTimeFormat('en-CA').format(new Date());

const METRIC_COLOR: Record<HeartRateMetric, string> = {
  latest: '#FA114F',
  resting: '#F43F5E',
  sleeping: '#818CF8',
  walking: '#14B8A6',
  hrv: '#A855F7',
  peak: '#F59E0B',
};

const METRIC_LABEL: Record<HeartRateMetric, string> = {
  latest: '最新心率',
  resting: '静息心率',
  sleeping: '睡眠心率',
  walking: '步行均值',
  hrv: 'HRV (SDNN)',
  peak: '运动峰值',
};

const METRIC_UNIT: Record<HeartRateMetric, string> = {
  latest: 'BPM',
  resting: 'BPM',
  sleeping: 'BPM',
  walking: 'BPM',
  hrv: 'ms',
  peak: 'BPM',
};

const formatDate = (date: string): string => date.slice(5);

const buildPath = (
  points: ChartDatum[],
  xFor: (point: ChartDatum) => number,
  yFor: (point: ChartDatum) => number
): string =>
  points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(point)} ${yFor(point)}`)
    .join(' ');

const splitIntoSegments = (points: ChartDatum[], maxGapMinutes = 120): ChartDatum[][] => {
  const segments: ChartDatum[][] = [];
  for (const point of points) {
    const current = segments[segments.length - 1];
    if (!current || point.minutes - current[current.length - 1].minutes > maxGapMinutes) {
      segments.push([point]);
    } else {
      current.push(point);
    }
  }
  return segments;
};

const formatRangeLabel = (startDate: string, endDate: string): string =>
  `${formatDate(startDate)}–${formatDate(endDate)}`;

const MetricIcon: React.FC<{ metric: HeartRateMetric; className?: string }> = ({
  metric,
  className,
}) => {
  switch (metric) {
    case 'sleeping':
      return <Moon className={className} />;
    case 'walking':
      return <Footprints className={className} />;
    case 'hrv':
      return <Waves className={className} />;
    case 'peak':
      return <Flame className={className} />;
    default:
      return <Heart className={className} />;
  }
};

const MetricTile: React.FC<{
  metric: HeartRateMetric;
  selected: boolean;
  value: number | null;
  sourceDate: string | null;
  selectedDate: string;
  onClick: () => void;
}> = ({ metric, selected, value, sourceDate, selectedDate, onClick }) => {
  const isSelectedDay = Boolean(sourceDate && sourceDate === selectedDate);
  const sourceLabel =
    value === null
      ? '暂无实测'
      : isSelectedDay
        ? metric === 'sleeping'
          ? '睡眠时段实测'
          : '当日实测'
        : `最近 ${sourceDate ? formatDate(sourceDate) : ''}`;
  const selectedClasses: Record<HeartRateMetric, string> = {
    latest: 'bg-rose-500/15 border-rose-500/50 ring-rose-500/25',
    resting: 'bg-rose-500/10 border-rose-400/40 ring-rose-400/20',
    sleeping: 'bg-indigo-500/15 border-indigo-500/50 ring-indigo-500/25',
    walking: 'bg-teal-500/15 border-teal-500/50 ring-teal-500/25',
    hrv: 'bg-purple-500/15 border-purple-500/50 ring-purple-500/25',
    peak: 'bg-amber-500/15 border-amber-500/50 ring-amber-500/25',
  };
  const valueClasses: Record<HeartRateMetric, string> = {
    latest: 'text-neutral-900 dark:text-white',
    resting: 'text-rose-500 dark:text-rose-400',
    sleeping: 'text-indigo-500 dark:text-indigo-400',
    walking: 'text-teal-600 dark:text-teal-400',
    hrv: 'text-purple-600 dark:text-purple-400',
    peak: 'text-amber-500 dark:text-amber-400',
  };
  const iconClasses: Record<HeartRateMetric, string> = {
    latest: 'text-rose-500',
    resting: 'text-rose-400',
    sleeping: 'text-indigo-400',
    walking: 'text-teal-400',
    hrv: 'text-purple-400',
    peak: 'text-amber-500',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-2.5 rounded-2xl text-left transition-all cursor-pointer border ${
        selected
          ? `${selectedClasses[metric]} ring-2 shadow-sm`
          : 'bg-black/[0.02] dark:bg-white/[0.03] border-black/[0.05] dark:border-white/[0.05] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
      }`}
    >
      <div className="flex items-center gap-1 text-[10px] text-neutral-400 mb-0.5">
        <MetricIcon metric={metric} className={`w-2.5 h-2.5 ${iconClasses[metric]}`} />
        <span className="truncate">{METRIC_LABEL[metric]}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-xl font-black tracking-tight ${valueClasses[metric]}`}>
          {value ?? '—'}
        </span>
        <span className="text-[10px] text-neutral-400 font-medium">{METRIC_UNIT[metric]}</span>
      </div>
      <span
        className={`text-[9px] mt-0.5 block truncate ${
          value === null ? 'text-neutral-400' : isSelectedDay ? 'text-emerald-500' : 'text-sky-500'
        }`}
      >
        {sourceLabel}
      </span>
    </button>
  );
};

const HourlyChart: React.FC<{
  metric: HeartRateMetric;
  timeline: HeartRatePoint[];
  hrvTimeline: HrvPoint[];
  vitals: VitalsData;
  selectedDate: string;
  selectedValue: number | null;
  selectedValueIsForDay: boolean;
  sleepStart: number | null;
  sleepEnd: number | null;
}> = ({
  metric,
  timeline,
  hrvTimeline,
  vitals,
  selectedDate,
  selectedValue,
  selectedValueIsForDay,
  sleepStart,
  sleepEnd,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<HoveredChartPoint | null>(null);
  const [hoveredCoords, setHoveredCoords] = useState<{ x: number; y: number } | null>(null);
  const isHrv = metric === 'hrv';
  const color = METRIC_COLOR[metric];
  const points = useMemo<ChartDatum[]>(() => {
    if (isHrv) {
      return (hrvTimeline || [])
        .map((point) => ({
          time: point.time,
          minutes: timeToMinutes(point.time),
          value: point.hrv,
          source: point,
        }))
        .filter(
          (point) =>
            Number.isFinite(point.minutes) &&
            point.value > 0 &&
            point.value <= 250
        )
        .sort((left, right) => left.minutes - right.minutes);
    }
    return (timeline || [])
      .map((point) => ({
        time: point.time,
        minutes: timeToMinutes(point.time),
        value: point.hr,
        source: point,
      }))
      .filter(
        (point) =>
          Number.isFinite(point.minutes) &&
          point.value >= 30 &&
          point.value <= 230
      )
      .sort((left, right) => left.minutes - right.minutes);
  }, [hrvTimeline, isHrv, timeline]);

  const yDomain = useMemo(() => {
    if (points.length === 0) return { min: isHrv ? 20 : 40, max: isHrv ? 120 : 160 };
    const values = points.map((point) => point.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const padding = Math.max(5, Math.round((rawMax - rawMin) * 0.18));
    const min = Math.max(0, rawMin - padding);
    const max = Math.max(min + 20, rawMax + padding);
    return { min, max };
  }, [isHrv, points]);

  const xFor = (point: ChartDatum): number =>
    CHART_PADDING.left +
    (point.minutes / (24 * 60)) *
      (CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right);
  const yFor = (point: ChartDatum): number =>
    CHART_HEIGHT -
    CHART_PADDING.bottom -
    ((point.value - yDomain.min) / (yDomain.max - yDomain.min)) *
      (CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom);

  const segments = splitIntoSegments(points);
  const yTicks = [yDomain.min, Math.round((yDomain.min + yDomain.max) / 2), yDomain.max];

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * CHART_WIDTH;
    let closest = points[0];
    let minDistance = Math.abs(xFor(points[0]) - mouseX);
    for (let index = 1; index < points.length; index += 1) {
      const distance = Math.abs(xFor(points[index]) - mouseX);
      if (distance < minDistance) {
        closest = points[index];
        minDistance = distance;
      }
    }
    setHoveredPoint({
      time: closest.time,
      value: closest.value,
      unit: isHrv ? 'ms' : 'BPM',
      label: isHrv ? 'HRV' : closest.value > 120 ? '高心率' : closest.value < 60 ? '静息缓释' : '日常采样',
    });
    setHoveredCoords({ x: xFor(closest), y: yFor(closest) });
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
    setHoveredCoords(null);
  };

  const selectedY =
    selectedValueIsForDay && selectedValue !== null && !isHrv
      ? CHART_HEIGHT -
        CHART_PADDING.bottom -
        ((selectedValue - yDomain.min) / (yDomain.max - yDomain.min)) *
          (CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom)
      : null;
  const baselineY =
    isHrv && vitals.hrvBaseline > 0
      ? CHART_HEIGHT -
        CHART_PADDING.bottom -
        ((vitals.hrvBaseline - yDomain.min) / (yDomain.max - yDomain.min)) *
          (CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom)
      : null;

  return (
    <div className="relative h-full w-full">
      {points.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 text-xs text-neutral-400 pointer-events-none">
          <span>{isHrv ? '当天暂无 HRV 时段采样' : '当天暂无原始心率采样点'}</span>
          <span className="text-[10px]">{formatDate(selectedDate)}</span>
        </div>
      )}
      <svg
        ref={svgRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="w-full h-full overflow-visible select-none cursor-crosshair"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`hr-area-${metric}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => {
          const y =
            CHART_HEIGHT -
            CHART_PADDING.bottom -
            ((tick - yDomain.min) / (yDomain.max - yDomain.min)) *
              (CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom);
          return (
            <g key={tick}>
              <line
                x1={CHART_PADDING.left}
                y1={y}
                x2={CHART_WIDTH - CHART_PADDING.right}
                y2={y}
                stroke="currentColor"
                className="text-neutral-300 dark:text-white/10"
                strokeDasharray="3 4"
              />
              <text
                x={CHART_PADDING.left - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-neutral-400 text-[8px] font-mono"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {[0, 360, 720, 1080, 1440].map((minutes) => {
          const x =
            CHART_PADDING.left +
            (minutes / (24 * 60)) *
              (CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right);
          const label =
            minutes === 1440 ? '24:00' : `${String(minutes / 60).padStart(2, '0')}:00`;
          return (
            <g key={minutes}>
              <line
                x1={x}
                y1={CHART_PADDING.top}
                x2={x}
                y2={CHART_HEIGHT - CHART_PADDING.bottom}
                stroke="currentColor"
                className="text-neutral-200/70 dark:text-white/[0.06]"
              />
              <text
                x={x}
                y={CHART_HEIGHT - 8}
                textAnchor={minutes === 0 ? 'start' : minutes === 1440 ? 'end' : 'middle'}
                className="fill-neutral-400 text-[8px] font-mono"
              >
                {label}
              </text>
            </g>
          );
        })}

        {metric === 'sleeping' && sleepStart !== null && sleepEnd !== null && (
          <>
            {sleepStart <= sleepEnd ? (
              <rect
                x={
                  CHART_PADDING.left +
                  (sleepStart / 1440) *
                    (CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right)
                }
                y={CHART_PADDING.top}
                width={
                  ((sleepEnd - sleepStart) / 1440) *
                  (CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right)
                }
                height={CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom}
                fill="#818CF8"
                fillOpacity="0.08"
              />
            ) : (
              <>
                <rect
                  x={
                    CHART_PADDING.left +
                    (sleepStart / 1440) *
                      (CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right)
                  }
                  y={CHART_PADDING.top}
                  width={
                    ((1440 - sleepStart) / 1440) *
                    (CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right)
                  }
                  height={CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom}
                  fill="#818CF8"
                  fillOpacity="0.08"
                />
                <rect
                  x={CHART_PADDING.left}
                  y={CHART_PADDING.top}
                  width={
                    (sleepEnd / 1440) *
                    (CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right)
                  }
                  height={CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom}
                  fill="#818CF8"
                  fillOpacity="0.08"
                />
              </>
            )}
          </>
        )}

        {segments.map((segment, index) => {
          if (segment.length < 2) return null;
          const line = buildPath(segment, xFor, yFor);
          const area = `${line} L ${xFor(segment[segment.length - 1])} ${
            CHART_HEIGHT - CHART_PADDING.bottom
          } L ${xFor(segment[0])} ${CHART_HEIGHT - CHART_PADDING.bottom} Z`;
          return (
            <g key={`segment-${index}`}>
              <path d={area} fill={`url(#hr-area-${metric})`} />
              <path
                d={line}
                fill="none"
                stroke={color}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        })}

        {points.length === 1 && (
          <circle cx={xFor(points[0])} cy={yFor(points[0])} r="4" fill={color} />
        )}

        {baselineY !== null && (
          <g>
            <line
              x1={CHART_PADDING.left}
              y1={baselineY}
              x2={CHART_WIDTH - CHART_PADDING.right}
              y2={baselineY}
              stroke={color}
              strokeWidth="1"
              strokeDasharray="4 3"
              strokeOpacity="0.6"
            />
            <text
              x={CHART_WIDTH - CHART_PADDING.right - 2}
              y={baselineY - 4}
              textAnchor="end"
              className="fill-purple-400 text-[8px] font-mono"
            >
              基线 {vitals.hrvBaseline}
            </text>
          </g>
        )}

        {selectedY !== null && (
          <g>
            <line
              x1={CHART_PADDING.left}
              y1={selectedY}
              x2={CHART_WIDTH - CHART_PADDING.right}
              y2={selectedY}
              stroke={color}
              strokeWidth="1.2"
              strokeDasharray="5 3"
              strokeOpacity="0.8"
            />
            <text
              x={CHART_PADDING.left + 4}
              y={selectedY - 4}
              className="fill-neutral-500 dark:fill-neutral-300 text-[8px] font-mono"
            >
              {METRIC_LABEL[metric]} {selectedValue}
            </text>
          </g>
        )}

        {metric === 'peak' && selectedValueIsForDay && selectedValue !== null && points.length > 0 && (
          <circle
            cx={xFor(points.find((point) => point.value === selectedValue) || points[0])}
            cy={yFor(points.find((point) => point.value === selectedValue) || points[0])}
            r="5"
            fill="#F59E0B"
            fillOpacity="0.35"
            stroke="#F59E0B"
            strokeWidth="2"
          />
        )}

        {hoveredCoords && (
          <g pointerEvents="none">
            <line
              x1={hoveredCoords.x}
              y1={CHART_PADDING.top}
              x2={hoveredCoords.x}
              y2={CHART_HEIGHT - CHART_PADDING.bottom}
              stroke={color}
              strokeWidth="1"
              strokeDasharray="3 3"
              strokeOpacity="0.75"
            />
            <circle
              cx={hoveredCoords.x}
              cy={hoveredCoords.y}
              r="8"
              fill={color}
              fillOpacity="0.2"
            />
            <circle
              cx={hoveredCoords.x}
              cy={hoveredCoords.y}
              r="3.5"
              fill={color}
              stroke="white"
              strokeWidth="1.5"
            />
          </g>
        )}
      </svg>

      <AnimatePresence>
        {hoveredPoint && hoveredCoords && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.1 }}
            style={{
              left: `${Math.min(Math.max((hoveredCoords.x / CHART_WIDTH) * 100, 14), 86)}%`,
              top: `${Math.max(6, (hoveredCoords.y / CHART_HEIGHT) * 100 - 18)}%`,
            }}
            className="absolute -translate-x-1/2 -translate-y-full px-3 py-1.5 rounded-xl bg-neutral-950/95 text-white border border-white/20 shadow-2xl backdrop-blur-2xl text-xs pointer-events-none z-30 whitespace-nowrap flex items-center gap-2.5 font-mono"
          >
            <span className="text-neutral-400 text-[10px]">{hoveredPoint.time}</span>
            <span className="font-bold text-sm" style={{ color }}>
              {hoveredPoint.value}{' '}
              <span className="text-[10px] font-normal text-neutral-400">
                {hoveredPoint.unit}
              </span>
            </span>
            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-sans font-semibold bg-white/10 text-neutral-200">
              {hoveredPoint.label}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DailyTrendChart: React.FC<{
  metric: HeartRateMetric;
  points: DailyMetricPoint[];
  selectedDate: string;
  onSelectDate?: (date: string) => void;
}> = ({ metric, points, selectedDate, onSelectDate }) => {
  const color = METRIC_COLOR[metric];
  const valid = points.filter(
    (point): point is DailyMetricPoint & { value: number } => point.value !== null
  );
  const values = valid.map((point) => point.value);
  const rawMin = values.length > 0 ? Math.min(...values) : 0;
  const rawMax = values.length > 0 ? Math.max(...values) : 0;
  const domainPadding = Math.max(3, Math.round((rawMax - rawMin) * 0.3));
  const min = Math.max(0, rawMin - domainPadding);
  const max = Math.max(min + 10, rawMax + domainPadding);
  const width = CHART_WIDTH;
  const height = CHART_HEIGHT;
  const left = 34;
  const right = 12;
  const top = 19;
  const bottom = 38;
  const xFor = (index: number): number =>
    left + (index / Math.max(points.length - 1, 1)) * (width - left - right);
  const yFor = (value: number): number =>
    height - bottom - ((value - min) / (max - min)) * (height - top - bottom);
  const pathParts: string[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (point.value === null) continue;
    const previous = index > 0 ? points[index - 1] : null;
    pathParts.push(
      `${!previous || previous.value === null ? 'M' : 'L'} ${xFor(index)} ${yFor(point.value)}`
    );
  }
  const yTicks = [min, Math.round((min + max) / 2), max];

  return (
    <svg
      className="w-full h-full overflow-visible"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={left}
            y1={yFor(tick)}
            x2={width - right}
            y2={yFor(tick)}
            stroke="currentColor"
            className="text-neutral-300 dark:text-white/10"
            strokeDasharray="3 4"
          />
          <text
            x={left - 6}
            y={yFor(tick) + 3}
            textAnchor="end"
            className="fill-neutral-400 text-[8px] font-mono"
          >
            {tick}
          </text>
        </g>
      ))}

      {metric === 'latest' &&
        points.map((point, index) =>
          point.minHr !== null && point.maxHr !== null ? (
            <line
              key={`range-${point.date}`}
              x1={xFor(index)}
              y1={yFor(point.minHr)}
              x2={xFor(index)}
              y2={yFor(point.maxHr)}
              stroke={color}
              strokeWidth="2"
              strokeOpacity="0.18"
              strokeLinecap="round"
            />
          ) : null
        )}

      <path
        d={pathParts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {valid.length === 0 && (
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          className="fill-neutral-400 text-[10px]"
        >
          该周期暂无实测记录
        </text>
      )}

      {points.map((point, index) => {
        const isSelected = point.date === selectedDate;
        return (
          <g
            key={point.date}
            onClick={() => onSelectDate?.(point.date)}
            className="cursor-pointer"
          >
            <rect
              x={xFor(index) - 27}
              y={top}
              width="54"
              height={height - top - bottom}
              fill="transparent"
            />
            {point.value !== null ? (
              <>
                <circle
                  cx={xFor(index)}
                  cy={yFor(point.value)}
                  r={isSelected ? 5 : 3.5}
                  fill={isSelected ? color : 'white'}
                  stroke={color}
                  strokeWidth={isSelected ? 2.5 : 2}
                />
                <text
                  x={xFor(index)}
                  y={yFor(point.value) - 8}
                  textAnchor="middle"
                  className="fill-neutral-600 dark:fill-neutral-200 text-[9px] font-mono font-semibold"
                >
                  {point.value}
                </text>
              </>
            ) : (
              <circle
                cx={xFor(index)}
                cy={height - bottom - 3}
                r="3"
                fill="none"
                stroke="currentColor"
                className="text-neutral-300 dark:text-white/20"
                strokeDasharray="2 2"
              />
            )}
            <text
              x={xFor(index)}
              y={height - 21}
              textAnchor="middle"
              className={`text-[9px] font-mono ${
                isSelected ? 'fill-neutral-900 dark:fill-white font-bold' : 'fill-neutral-400'
              }`}
            >
              {point.shortDate}
            </text>
            <text
              x={xFor(index)}
              y={height - 9}
              textAnchor="middle"
              className={`text-[8px] ${
                isSelected ? 'fill-rose-500 font-semibold' : 'fill-neutral-400'
              }`}
            >
              {point.weekday}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const WeeklyTrendChart: React.FC<{
  metric: HeartRateMetric;
  weeks: WeeklyMetricPoint[];
  onSelectDate?: (date: string) => void;
}> = ({ metric, weeks, onSelectDate }) => {
  const color = METRIC_COLOR[metric];
  const valid = weeks.filter(
    (week): week is WeeklyMetricPoint & { value: number } => week.value !== null
  );
  const values = valid.map((week) => week.value);
  const rawMin = values.length > 0 ? Math.min(...values) : 0;
  const rawMax = values.length > 0 ? Math.max(...values) : 0;
  const padding = Math.max(3, Math.round((rawMax - rawMin) * 0.35));
  const min = Math.max(0, rawMin - padding);
  const max = Math.max(min + 10, rawMax + padding);
  const width = CHART_WIDTH;
  const height = CHART_HEIGHT;
  const left = 34;
  const right = 12;
  const top = 20;
  const bottom = 35;
  const plotWidth = width - left - right;
  const slotWidth = plotWidth / 4;
  const barWidth = Math.min(54, slotWidth * 0.42);
  const yFor = (value: number): number =>
    height - bottom - ((value - min) / (max - min)) * (height - top - bottom);
  const yTicks = [min, Math.round((min + max) / 2), max];

  return (
    <svg
      className="w-full h-full overflow-visible"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={left}
            y1={yFor(tick)}
            x2={width - right}
            y2={yFor(tick)}
            stroke="currentColor"
            className="text-neutral-300 dark:text-white/10"
            strokeDasharray="3 4"
          />
          <text
            x={left - 6}
            y={yFor(tick) + 3}
            textAnchor="end"
            className="fill-neutral-400 text-[8px] font-mono"
          >
            {tick}
          </text>
        </g>
      ))}
      {weeks.map((week, index) => {
        const center = left + slotWidth * index + slotWidth / 2;
        const barTop = week.value !== null ? yFor(week.value) : height - bottom;
        return (
          <g
            key={week.endDate}
            onClick={() => onSelectDate?.(week.endDate)}
            className="cursor-pointer"
          >
            <rect
              x={left + slotWidth * index + 3}
              y={top}
              width={slotWidth - 6}
              height={height - top - bottom}
              rx="8"
              fill="currentColor"
              className="text-black/[0.015] dark:text-white/[0.025]"
            />
            {week.value !== null ? (
              <>
                <rect
                  x={center - barWidth / 2}
                  y={barTop}
                  width={barWidth}
                  height={height - bottom - barTop}
                  rx="7"
                  fill={color}
                  fillOpacity={index === weeks.length - 1 ? 0.9 : 0.55}
                />
                <text
                  x={center}
                  y={barTop - 7}
                  textAnchor="middle"
                  className="fill-neutral-700 dark:fill-neutral-200 text-[10px] font-mono font-bold"
                >
                  {week.value}
                </text>
              </>
            ) : (
              <text
                x={center}
                y={height - bottom - 8}
                textAnchor="middle"
                className="fill-neutral-400 text-[9px]"
              >
                无数据
              </text>
            )}
            <text
              x={center}
              y={height - 19}
              textAnchor="middle"
              className="fill-neutral-500 dark:fill-neutral-300 text-[9px] font-semibold"
            >
              {week.label}
            </text>
            <text
              x={center}
              y={height - 7}
              textAnchor="middle"
              className="fill-neutral-400 text-[8px] font-mono"
            >
              {formatRangeLabel(week.startDate, week.endDate)}
            </text>
            <text
              x={center}
              y={top + 9}
              textAnchor="middle"
              className="fill-neutral-400 text-[8px]"
            >
              {week.coverageDays}/7 天
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export const HeartRateCard: React.FC<HeartRateCardProps> = ({
  timeline,
  vitals,
  days = {},
  selectedDate = '',
  onSelectDate,
}) => {
  const [activeTab, setActiveTab] = useState<TimeSpan>('hourly');
  const [selectedMetric, setSelectedMetric] = useState<HeartRateMetric>('latest');
  const effectiveDate =
    selectedDate ||
    Object.keys(days).sort().at(-1) ||
    FALLBACK_DATE;
  const hrvTimeline = vitals.hrvTimeline || [];
  const latestHr =
    timeline.length > 0 ? timeline[timeline.length - 1].hr : vitals.latestHr;
  const peakHr =
    timeline.length > 0 ? Math.max(...timeline.map((point) => point.hr)) : null;
  const dailySeries = useMemo(
    () => buildDailyMetricSeries(days, effectiveDate, selectedMetric, 7),
    [days, effectiveDate, selectedMetric]
  );
  const weeklySeries = useMemo(
    () => buildWeeklyMetricSeries(days, effectiveDate, selectedMetric),
    [days, effectiveDate, selectedMetric]
  );
  const snapshots = useMemo(
    () => ({
      latest: {
        value: latestHr > 0 ? latestHr : null,
        date: latestHr > 0 ? effectiveDate : null,
        isSelectedDate: latestHr > 0,
      },
      resting: resolveMetricSnapshot(days, effectiveDate, 'resting'),
      sleeping: resolveMetricSnapshot(days, effectiveDate, 'sleeping'),
      walking: resolveMetricSnapshot(days, effectiveDate, 'walking'),
      hrv: resolveMetricSnapshot(days, effectiveDate, 'hrv'),
      peak: {
        value: peakHr,
        date: peakHr ? effectiveDate : null,
        isSelectedDate: Boolean(peakHr),
      },
    }),
    [days, effectiveDate, latestHr, peakHr]
  );

  const sleepWindow = useMemo(() => {
    const sleep = days[effectiveDate]?.sleep;
    if (!sleep || sleep.totalMinutes <= 0) return { start: null, end: null };
    const start = timeToMinutes(sleep.bedTime);
    const end = timeToMinutes(sleep.wakeTime);
    return {
      start: Number.isFinite(start) ? start : null,
      end: Number.isFinite(end) ? end : null,
    };
  }, [days, effectiveDate]);

  const handleSelectMetric = (metric: HeartRateMetric) => {
    setSelectedMetric(metric);
    setActiveTab(metric === 'latest' || metric === 'peak' ? 'hourly' : 'daily');
  };

  const metricSnapshot = snapshots[selectedMetric];
  const trendMetricLabel =
    selectedMetric === 'latest' && activeTab !== 'hourly' ? '日均心率' : METRIC_LABEL[selectedMetric];
  const chartTitle =
    activeTab === 'hourly'
      ? `${METRIC_LABEL[selectedMetric]} · 24H 真实采样`
      : activeTab === 'daily'
        ? `${trendMetricLabel} · 最近 7 日`
        : `${trendMetricLabel} · 最近 4 周`;
  const chartNote =
    activeTab === 'hourly'
      ? selectedMetric === 'hrv'
        ? '按真实测量时间定位'
        : '按真实采样时间定位'
      : activeTab === 'daily'
        ? selectedMetric === 'latest'
          ? '实线为日均值，竖线为当日范围'
          : '缺失日期保持空白'
        : '周均值为有效记录平均';
  const coverageText =
    activeTab === 'hourly'
      ? selectedMetric === 'hrv'
        ? `${hrvTimeline.length} 次测量`
        : `${timeline.length} 个采样点`
      : activeTab === 'daily'
        ? `${dailySeries.filter((point) => point.value !== null).length}/7 天有记录`
        : `${weeklySeries.reduce((sum, week) => sum + week.coverageDays, 0)}/28 天有记录`;
  const peakZoneLabel =
    metricSnapshot.value === null
      ? '暂无实测'
      : metricSnapshot.value >= 165
        ? '极限区间'
        : metricSnapshot.value >= 140
          ? '有氧区间'
          : '日常活动区间';
  const timeSpanOptions: Array<{ id: TimeSpan; label: string }> = [
    { id: 'hourly', label: '时段 24H' },
    { id: 'daily', label: '日 7D' },
    { id: 'weekly', label: '周 4W' },
  ];

  return (
    <AppleCard className="overflow-hidden h-full flex flex-col">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-rose-500/20 text-rose-500 border border-rose-500/30 flex-shrink-0">
              <Heart className="w-4 h-4 fill-rose-500 animate-heart-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-wider text-neutral-500 dark:text-neutral-400 uppercase">
                心率与自主神经 · 多周期趋势
              </h3>
            </div>
          </div>

          <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-black/5 dark:border-white/5 self-start sm:self-auto">
            {timeSpanOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setActiveTab(option.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === option.id
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
          {(
            ['latest', 'resting', 'sleeping', 'walking', 'hrv', 'peak'] as HeartRateMetric[]
          ).map((metric) => (
            <MetricTile
              key={metric}
              metric={metric}
              selected={selectedMetric === metric}
              value={snapshots[metric].value}
              sourceDate={snapshots[metric].date}
              selectedDate={effectiveDate}
              onClick={() => handleSelectMetric(metric)}
            />
          ))}
        </div>
      </div>

      <div className="relative w-full min-h-[210px] bg-black/[0.02] dark:bg-white/[0.02] rounded-2xl p-2.5 border border-black/[0.05] dark:border-white/[0.04] flex flex-col">
        <div className="flex items-start justify-between gap-3 px-1 pb-1">
          <div>
            <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 block">
              {chartTitle}
            </span>
            <span className="text-[9px] text-neutral-400 block mt-0.5">{chartNote}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {selectedMetric === 'peak' && (
              <span className="text-[9px] font-semibold text-amber-500">{peakZoneLabel}</span>
            )}
            <span className="text-[9px] font-mono text-neutral-400">{coverageText}</span>
          </div>
        </div>

        <div className="relative flex-1 min-h-[166px]">
          <AnimatePresence mode="wait">
            {activeTab === 'hourly' && (
              <motion.div
                key="hourly"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="absolute inset-0"
              >
                <HourlyChart
                  metric={selectedMetric}
                  timeline={timeline}
                  hrvTimeline={hrvTimeline}
                  vitals={vitals}
                  selectedDate={effectiveDate}
                  selectedValue={metricSnapshot.value}
                  selectedValueIsForDay={metricSnapshot.isSelectedDate}
                  sleepStart={sleepWindow.start}
                  sleepEnd={sleepWindow.end}
                />
              </motion.div>
            )}
            {activeTab === 'daily' && (
              <motion.div
                key="daily"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="absolute inset-0"
              >
                <DailyTrendChart
                  metric={selectedMetric}
                  points={dailySeries}
                  selectedDate={effectiveDate}
                  onSelectDate={onSelectDate}
                />
              </motion.div>
            )}
            {activeTab === 'weekly' && (
              <motion.div
                key="weekly"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="absolute inset-0"
              >
                <WeeklyTrendChart
                  metric={selectedMetric}
                  weeks={weeklySeries}
                  onSelectDate={onSelectDate}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppleCard>
  );
};
