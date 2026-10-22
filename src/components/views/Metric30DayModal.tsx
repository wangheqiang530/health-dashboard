import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export interface Metric30DayModalData {
  title: string;
  unit: string;
  current: string;
  eval: string;
  standard: string;
  points: { date: string; value: number }[];
  periodLabel?: string;
}

interface Metric30DayModalProps {
  data: Metric30DayModalData | null;
  onClose: () => void;
}

const formatValue = (value: number, unit: string): string =>
  `${Number.isInteger(value) ? value : value.toFixed(unit === '%' ? 1 : 2)}${
    unit ? ` ${unit}` : ''
  }`;

export const Metric30DayModal: React.FC<Metric30DayModalProps> = ({ data, onClose }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(480);
  const [activeIndex, setActiveIndex] = useState(0);
  const points = data?.points || [];

  useEffect(() => {
    const element = chartContainerRef.current;
    if (!element) return;
    const updateWidth = () => {
      setChartWidth(Math.max(280, Math.round(element.clientWidth)));
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [data]);

  useEffect(() => {
    setActiveIndex(Math.max(points.length - 1, 0));
  }, [data, points.length]);

  if (!data || points.length === 0) return null;

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const minIndex = values.indexOf(min);
  const maxIndex = values.indexOf(max);
  const chartHeight = 170;
  const paddingTop = 26;
  const paddingBottom = 28;
  const paddingLeft = 42;
  const paddingRight = 24;
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;
  const range = max - min || 1;
  const xFor = (index: number) =>
    paddingLeft +
    (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const yFor = (value: number) =>
    chartHeight - paddingBottom - ((value - min) / range) * plotHeight;
  const coords = points.map((point, index) => ({
    ...point,
    x: xFor(index),
    y: yFor(point.value),
  }));
  const path = coords
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    )
    .join(' ');
  const areaPath = `${path} L ${coords[coords.length - 1].x.toFixed(1)} ${
    chartHeight - paddingBottom
  } L ${coords[0].x.toFixed(1)} ${chartHeight - paddingBottom} Z`;
  const averageY = yFor(average);
  const active = coords[Math.min(Math.max(activeIndex, 0), coords.length - 1)];
  const sameExtreme = minIndex === maxIndex;
  const extremeLabels = sameExtreme
    ? [
        {
          key: 'same',
          x: coords[minIndex].x,
          y: coords[minIndex].y,
          text: `最高/最低 ${formatValue(min, data.unit)}`,
          anchor: 'middle' as const,
        },
      ]
    : [
        {
          key: 'max',
          x:
            coords[maxIndex].x > chartWidth - 100
              ? coords[maxIndex].x - 4
              : coords[maxIndex].x < 100
                ? coords[maxIndex].x + 4
                : coords[maxIndex].x,
          y:
            coords[maxIndex].y < paddingTop + 20
              ? coords[maxIndex].y + 16
              : coords[maxIndex].y - 9,
          text: `最高 ${formatValue(max, data.unit)}`,
          anchor:
            coords[maxIndex].x > chartWidth - 100
              ? ('end' as const)
              : coords[maxIndex].x < 100
                ? ('start' as const)
                : ('middle' as const),
        },
        {
          key: 'min',
          x:
            coords[minIndex].x > chartWidth - 100
              ? coords[minIndex].x - 4
              : coords[minIndex].x < 100
                ? coords[minIndex].x + 4
                : coords[minIndex].x,
          y:
            coords[minIndex].y > chartHeight - paddingBottom - 20
              ? coords[minIndex].y - 10
              : coords[minIndex].y + 16,
          text: `最低 ${formatValue(min, data.unit)}`,
          anchor:
            coords[minIndex].x > chartWidth - 100
              ? ('end' as const)
              : coords[minIndex].x < 100
                ? ('start' as const)
                : ('middle' as const),
        },
      ];

  const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const pointerX = Math.min(
      chartWidth,
      Math.max(0, ((event.clientX - rect.left) / rect.width) * chartWidth)
    );
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    coords.forEach((point, index) => {
      const distance = Math.abs(point.x - pointerX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    setActiveIndex(nearestIndex);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`relative z-10 max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border p-6 shadow-2xl backdrop-blur-2xl md:p-8 ${
            isDark
              ? 'border-white/10 bg-[#11141b]/95 text-white'
              : 'border-black/10 bg-white/95 text-neutral-900'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`absolute right-5 top-5 rounded-full p-2 transition-all ${
              isDark
                ? 'bg-white/10 text-neutral-300 hover:bg-white/20 hover:text-white'
                : 'bg-black/5 text-neutral-500 hover:bg-black/10 hover:text-neutral-900'
            }`}
            aria-label="关闭趋势小窗"
          >
            <X className="h-5 w-5" />
          </button>

          <span className="text-xs font-semibold uppercase tracking-wider text-amber-500">
            体脂秤实测趋势
          </span>
          <h2 className="mb-1 mt-1 text-2xl font-bold tracking-tight">
            {data.title} · {data.periodLabel || '最近 30 日'}连续走势
          </h2>
          <div className="mb-4 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-black text-amber-500">
              {data.current}
            </span>
            <span className="text-xs text-neutral-400">{data.unit}</span>
            <span className="ml-2 text-xs text-neutral-400">({data.eval})</span>
          </div>

          <div
            ref={chartContainerRef}
            className={`relative mb-5 rounded-2xl border p-3 ${
              isDark
                ? 'border-white/10 bg-black/40'
                : 'border-black/5 bg-black/[0.03]'
            }`}
          >
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="h-auto w-full touch-none overflow-visible"
              onMouseMove={handleMove}
              onMouseLeave={() => setActiveIndex(coords.length - 1)}
              role="img"
              aria-label={`${data.title}${data.periodLabel || '最近 30 日'}趋势，共 ${points.length} 次实测`}
            >
              <defs>
                <linearGradient id="metricTrendArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 1, 2, 3].map((line) => {
                const y = paddingTop + (line / 3) * plotHeight;
                return (
                  <line
                    key={line}
                    x1={paddingLeft}
                    x2={chartWidth - paddingRight}
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity="0.07"
                    strokeDasharray="3 5"
                  />
                );
              })}
              <path d={areaPath} fill="url(#metricTrendArea)" />
              <path
                d={path}
                fill="none"
                stroke="#F59E0B"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <line
                x1={paddingLeft}
                x2={chartWidth - paddingRight}
                y1={averageY}
                y2={averageY}
                stroke="currentColor"
                strokeOpacity="0.45"
                strokeWidth="1"
                strokeDasharray="3 5"
              />
              <text
                x={chartWidth - paddingRight}
                y={averageY - 5}
                textAnchor="end"
                fill="currentColor"
                fillOpacity="0.48"
                fontSize="9"
                fontFamily="monospace"
              >
                均值 {formatValue(average, data.unit)}
              </text>
              {extremeLabels.map((label) => (
                <text
                  key={label.key}
                  x={label.x}
                  y={label.y}
                  textAnchor={label.anchor}
                  fill="#F59E0B"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="700"
                >
                  {label.text}
                </text>
              ))}
              <line
                x1={active.x}
                x2={active.x}
                y1={paddingTop}
                y2={chartHeight - paddingBottom}
                stroke="currentColor"
                strokeOpacity="0.38"
                strokeDasharray="3 3"
              />
              <line
                x1={paddingLeft}
                x2={chartWidth - paddingRight}
                y1={active.y}
                y2={active.y}
                stroke="currentColor"
                strokeOpacity="0.22"
                strokeDasharray="3 3"
              />
              <circle cx={active.x} cy={active.y} r="4" fill="#F59E0B" stroke="white" strokeWidth="2" />
              <text
                x={paddingLeft}
                y={chartHeight - 7}
                fill="currentColor"
                fillOpacity="0.42"
                fontSize="9"
                fontFamily="monospace"
              >
                {points[0]?.date || '—'}
              </text>
              <text
                x={chartWidth - paddingRight}
                y={chartHeight - 7}
                textAnchor="end"
                fill="currentColor"
                fillOpacity="0.42"
                fontSize="9"
                fontFamily="monospace"
              >
                {points[points.length - 1]?.date || '—'}
              </text>
            </svg>
            <div
              className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 whitespace-nowrap rounded-xl border border-black/10 bg-white/95 px-2.5 py-1.5 shadow-xl dark:border-white/15 dark:bg-neutral-950/95"
              style={{
                left: `${Math.min(88, Math.max(12, (active.x / chartWidth) * 100))}%`,
              }}
            >
              <div className="font-mono text-[9px] text-neutral-400">{active.date}</div>
              <div className="mt-0.5 font-mono text-[10px] font-bold text-amber-500">
                {formatValue(active.value, data.unit)}
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between px-2 font-mono text-[10px] text-neutral-400">
              <span>最早 ({points[0]?.date})</span>
              <span>共 {points.length} 次实测</span>
              <span>最新 ({points[points.length - 1]?.date})</span>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-3 text-xs">
            <div className="rounded-2xl border border-black/5 bg-black/[0.02] p-3 dark:border-white/[0.05] dark:bg-white/[0.03]">
              <span className="mb-1 block text-[10px] text-neutral-400">实测均值</span>
              <span className="font-mono text-base font-bold text-neutral-900 dark:text-white">
                {formatValue(average, data.unit)}
              </span>
            </div>
            <div className="rounded-2xl border border-black/5 bg-black/[0.02] p-3 dark:border-white/[0.05] dark:bg-white/[0.03]">
              <span className="mb-1 block text-[10px] text-neutral-400">最高记录</span>
              <span className="font-mono text-base font-bold text-neutral-900 dark:text-white">
                {formatValue(max, data.unit)}
              </span>
            </div>
            <div className="rounded-2xl border border-black/5 bg-black/[0.02] p-3 dark:border-white/[0.05] dark:bg-white/[0.03]">
              <span className="mb-1 block text-[10px] text-neutral-400">最低记录</span>
              <span className="font-mono text-base font-bold text-neutral-900 dark:text-white">
                {formatValue(min, data.unit)}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-black/5 bg-black/[0.02] p-3.5 text-[11px] text-neutral-600 dark:border-white/[0.05] dark:bg-white/[0.02] dark:text-neutral-300">
            <span className="mb-0.5 block font-semibold text-neutral-900 dark:text-white">
              数据说明
            </span>
            <span>{data.standard}。趋势仅来自体脂秤实测记录，不包含推断或补齐数据。</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
