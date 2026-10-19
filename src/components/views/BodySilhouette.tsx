import React, { useMemo, useState } from 'react';
import type {
  BodyMeasurement,
  BodySegmentKey,
  BodySegmentMeasurement,
} from '../../types/health';
import { AppleCard } from '../ui/AppleCard';
import { Activity, Dumbbell, Info, Scale, TrendingUp, Zap } from 'lucide-react';

interface BodySilhouetteProps {
  measurement?: BodyMeasurement | null;
  measurements?: BodyMeasurement[];
}

type BodyMode = 'muscle' | 'fat' | 'impedance';
type HistoryWindow = 7 | 30 | 0;

interface SegmentDefinition {
  key: BodySegmentKey;
  label: string;
  subtitle: string;
  path: string;
  labelX: number;
  labelY: number;
}

const SEGMENTS: SegmentDefinition[] = [
  {
    key: 'trunk',
    label: '躯干',
    subtitle: '胸背 · 核心',
    path:
      'M78 62 C89 56 131 56 142 62 C150 78 153 108 148 145 C146 161 132 169 110 169 C88 169 74 161 72 145 C67 108 70 78 78 62 Z',
    labelX: 110,
    labelY: 112,
  },
  {
    key: 'leftArm',
    label: '左上肢',
    subtitle: '肩 · 臂 · 前臂',
    path:
      'M75 65 C63 69 56 82 52 99 L39 145 C36 157 41 166 48 167 C55 168 59 163 61 155 L73 111 L83 82 Z',
    labelX: 45,
    labelY: 126,
  },
  {
    key: 'rightArm',
    label: '右上肢',
    subtitle: '肩 · 臂 · 前臂',
    path:
      'M145 65 C157 69 164 82 168 99 L181 145 C184 157 179 166 172 167 C165 168 161 163 159 155 L147 111 L137 82 Z',
    labelX: 179,
    labelY: 126,
  },
  {
    key: 'leftLeg',
    label: '左下肢',
    subtitle: '股四头 · 腓肠',
    path:
      'M75 165 C72 191 68 222 64 260 L60 316 C59 329 65 338 74 339 C83 340 88 333 89 321 L92 260 L99 168 Z',
    labelX: 71,
    labelY: 263,
  },
  {
    key: 'rightLeg',
    label: '右下肢',
    subtitle: '股四头 · 腓肠',
    path:
      'M145 165 C148 191 152 222 156 260 L160 316 C161 329 155 338 146 339 C137 340 132 333 131 321 L128 260 L121 168 Z',
    labelX: 149,
    labelY: 263,
  },
];

const numberValue = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const formatValue = (
  value: number | null | undefined,
  unit: string,
  decimals = 1
): string => {
  const number = numberValue(value);
  return number === null ? '—' : `${number.toFixed(decimals)} ${unit}`;
};

const segmentOf = (
  measurement: BodyMeasurement | null | undefined,
  key: BodySegmentKey
): BodySegmentMeasurement | null => measurement?.segments?.[key] || null;

const linePath = (points: Array<{ x: number; y: number }>): string =>
  points
    .map(
      (point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    )
    .join(' ');

export const BodySilhouette: React.FC<BodySilhouetteProps> = ({
  measurement,
  measurements = [],
}) => {
  const [selectedPart, setSelectedPart] = useState<BodySegmentKey>('trunk');
  const [mode, setMode] = useState<BodyMode>('muscle');
  const [historyWindow, setHistoryWindow] = useState<HistoryWindow>(30);

  const activeMeasurement =
    measurement ||
    measurements[measurements.length - 1] ||
    null;
  const weight = numberValue(activeMeasurement?.weightKg);
  const measuredDate =
    activeMeasurement?.measuredDate || activeMeasurement?.measuredAt?.slice(0, 10) || '尚无体测';

  const history = useMemo(() => {
    if (!activeMeasurement) return [];
    return measurements
      .filter(
        (item) =>
          item.measuredAt <= activeMeasurement.measuredAt &&
          item.segments?.[selectedPart]
      )
      .sort((left, right) => left.measuredAt.localeCompare(right.measuredAt));
  }, [activeMeasurement, measurements, selectedPart]);

  const displayedHistory = useMemo(
    () => (historyWindow === 0 ? history : history.slice(-historyWindow)),
    [history, historyWindow]
  );

  const activeSegment = segmentOf(activeMeasurement, selectedPart);
  const activeDefinition = SEGMENTS.find((segment) => segment.key === selectedPart)!;

  const muscleSeries = displayedHistory
    .map((item) => ({
      date: item.measuredDate.slice(5),
      value: numberValue(segmentOf(item, selectedPart)?.muscleKg),
    }))
    .filter((item): item is { date: string; value: number } => item.value !== null);

  const fatSeries = displayedHistory
    .map((item) => ({
      date: item.measuredDate.slice(5),
      value: numberValue(segmentOf(item, selectedPart)?.fatKg),
    }))
    .filter((item): item is { date: string; value: number } => item.value !== null);

  const impedance20Series = displayedHistory
    .map((item) => ({
      date: item.measuredDate.slice(5),
      value: numberValue(segmentOf(item, selectedPart)?.impedance20kHz),
    }))
    .filter((item): item is { date: string; value: number } => item.value !== null);

  const impedance100Series = displayedHistory
    .map((item) => ({
      date: item.measuredDate.slice(5),
      value: numberValue(segmentOf(item, selectedPart)?.impedance100kHz),
    }))
    .filter((item): item is { date: string; value: number } => item.value !== null);

  const chartWidth = 520;
  const chartHeight = 178;
  const chartPadding = 22;
  const showImpedance = mode === 'impedance';
  const primaryValues = showImpedance ? impedance20Series : muscleSeries;
  const secondaryValues = showImpedance ? impedance100Series : fatSeries;
  const allChartValues = [...primaryValues, ...secondaryValues];

  const chartMinMax = (() => {
    if (allChartValues.length === 0) return { min: 0, max: 1 };
    const values = allChartValues.map((item) => item.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return {
      min,
      max: max === min ? min + 1 : max,
    };
  })();

  const scalePoints = (
    values: Array<{ value: number; date: string }>
  ): Array<{ x: number; y: number; value: number; date: string }> => {
    if (values.length === 0) return [];
    return values.map((item, index) => ({
      x:
        chartPadding +
        (values.length === 1
          ? (chartWidth - chartPadding * 2) / 2
          : (index / (values.length - 1)) * (chartWidth - chartPadding * 2)),
      y:
        chartHeight -
        chartPadding -
        ((item.value - chartMinMax.min) / (chartMinMax.max - chartMinMax.min)) *
          (chartHeight - chartPadding * 2),
      ...item,
    }));
  };

  const primaryPoints = scalePoints(primaryValues);
  const secondaryPoints = scalePoints(secondaryValues);
  const chartColors = showImpedance
    ? { primary: '#06B6D4', secondary: '#6366F1' }
    : { primary: '#6366F1', secondary: '#F59E0B' };

  const segmentCards = SEGMENTS.map((segment) => {
    const values = segmentOf(activeMeasurement, segment.key);
    return {
      ...segment,
      muscleKg: values?.muscleKg ?? null,
      fatKg: values?.fatKg ?? null,
      impedance20kHz: values?.impedance20kHz ?? null,
      impedance100kHz: values?.impedance100kHz ?? null,
    };
  });

  const modeGradient =
    mode === 'muscle'
      ? 'url(#segmentMuscleGradient)'
      : mode === 'fat'
        ? 'url(#segmentFatGradient)'
        : 'url(#segmentImpedanceGradient)';
  const modeColor =
    mode === 'muscle' ? '#6366F1' : mode === 'fat' ? '#F59E0B' : '#06B6D4';

  if (!activeMeasurement || weight === null) {
    return (
      <AppleCard>
        <div className="py-12 text-center">
          <Scale className="w-8 h-8 mx-auto text-neutral-300 dark:text-neutral-600 mb-3" />
          <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
            暂无体脂秤分段数据
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            完成一次 Fitdays 8 电极体测后，这里会显示五部位肌脂与双频阻抗。
          </p>
        </div>
      </AppleCard>
    );
  }

  return (
    <AppleCard>
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-500" />
          <div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white m-0">
              五部位身体成分与阻抗
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              点击人体任一部位查看肌肉量、脂肪量、20 kHz / 100 kHz 阻抗与历史趋势
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
          <span className="px-2 py-1 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10 font-mono">
            测量 {measuredDate}
          </span>
          <div className="flex bg-black/5 dark:bg-white/5 p-0.5 rounded-xl border border-black/5 dark:border-white/5">
            {[
              { key: 'muscle', label: '肌肉' },
              { key: 'fat', label: '脂肪' },
              { key: 'impedance', label: '阻抗' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setMode(item.key as BodyMode)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  mode === item.key
                    ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 mb-4">
        {SEGMENTS.map((segment) => (
          <button
            key={segment.key}
            type="button"
            onClick={() => setSelectedPart(segment.key)}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedPart === segment.key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            {segment.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-4 flex justify-center">
          <div className="relative w-full max-w-[280px] min-h-[390px] flex items-center justify-center rounded-3xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 p-3">
            <svg
              viewBox="0 0 220 390"
              className="w-full h-[350px] select-none overflow-visible"
              aria-label="可交互的人体五部位 SVG"
            >
              <defs>
                <linearGradient id="segmentMuscleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#818CF8" />
                  <stop offset="100%" stopColor="#4F46E5" />
                </linearGradient>
                <linearGradient id="segmentFatGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FBBF24" />
                  <stop offset="100%" stopColor="#D97706" />
                </linearGradient>
                <linearGradient id="segmentImpedanceGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38BDF8" />
                  <stop offset="100%" stopColor="#0891B2" />
                </linearGradient>
                <filter id="segmentGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              <ellipse
                cx="110"
                cy="31"
                rx="17"
                ry="21"
                fill="currentColor"
                fillOpacity="0.12"
                stroke="currentColor"
                strokeOpacity="0.3"
                strokeWidth="1.2"
                className="text-neutral-500"
              />
              <path
                d="M101 49 L101 61 C104 65 116 65 119 61 L119 49 Z"
                fill="currentColor"
                fillOpacity="0.12"
                stroke="currentColor"
                strokeOpacity="0.25"
                className="text-neutral-500"
              />

              {SEGMENTS.map((segment) => {
                const active = selectedPart === segment.key;
                return (
                  <g
                    key={segment.key}
                    onMouseEnter={() => setSelectedPart(segment.key)}
                    onClick={() => setSelectedPart(segment.key)}
                    className="cursor-pointer transition-all duration-200"
                  >
                    <path
                      d={segment.path}
                      fill={active ? modeGradient : 'currentColor'}
                      fillOpacity={active ? 0.9 : 0.18}
                      stroke={active ? modeColor : 'currentColor'}
                      strokeOpacity={active ? 0.9 : 0.22}
                      strokeWidth={active ? 2 : 1}
                      filter={active ? 'url(#segmentGlow)' : undefined}
                      className="text-neutral-500 transition-all duration-200"
                    />
                    <title>
                      {segment.label} · 肌肉{' '}
                      {formatValue(segmentOf(activeMeasurement, segment.key)?.muscleKg, 'kg', 2)} ·
                      脂肪 {formatValue(segmentOf(activeMeasurement, segment.key)?.fatKg, 'kg', 2)}
                    </title>
                  </g>
                );
              })}

              <path
                d="M110 74 L110 154 M92 95 C100 91 120 91 128 95 M86 121 C98 117 122 117 134 121"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.18"
                strokeWidth="1"
                strokeLinecap="round"
                pointerEvents="none"
                className="text-neutral-500"
              />
              <circle
                cx={activeDefinition.labelX}
                cy={activeDefinition.labelY}
                r="3.2"
                fill={modeColor}
                opacity="0.95"
              />
            </svg>
            <div className="absolute left-3 top-3 px-2 py-1 rounded-lg bg-neutral-950/85 text-white text-[10px] font-mono border border-white/15">
              {mode === 'impedance' ? 'BIA 双频' : mode === 'muscle' ? '肌肉视图' : '脂肪视图'}
            </div>
            <div className="absolute right-3 bottom-3 px-2 py-1 rounded-lg bg-white/85 dark:bg-neutral-950/85 text-neutral-700 dark:text-neutral-200 text-[10px] font-mono border border-black/10 dark:border-white/15">
              SVG · 5 部位
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-4">
          <div className="p-4 rounded-3xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/5 dark:border-white/5 pb-3">
              <div>
                <h4 className="text-base font-bold text-neutral-900 dark:text-white m-0">
                  {activeDefinition.label} · {activeDefinition.subtitle}
                </h4>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  {activeMeasurement.segmentMuscleEstimated
                    ? '分段肌肉/脂肪按全身骨骼肌与脂肪总量及人体比例估算；阻抗为 Fitdays 八电极实测。'
                    : 'Fitdays 实测分段与双频生物阻抗。'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-neutral-400 block">20k / 100k 阻抗</span>
                <span className="text-sm font-black text-cyan-500 font-mono">
                  {formatValue(activeSegment?.impedance20kHz, 'Ω', 1)} /{' '}
                  {formatValue(activeSegment?.impedance100kHz, 'Ω', 1)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
              <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                <span className="flex items-center gap-1 text-[10px] text-neutral-500 dark:text-neutral-400">
                  <Dumbbell className="w-3 h-3 text-indigo-500" />
                  肌肉量
                </span>
                <span className="text-lg font-black text-indigo-500 font-mono block mt-1">
                  {formatValue(activeSegment?.muscleKg, 'kg', 2)}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <span className="flex items-center gap-1 text-[10px] text-neutral-500 dark:text-neutral-400">
                  <TrendingUp className="w-3 h-3 text-amber-500" />
                  脂肪量
                </span>
                <span className="text-lg font-black text-amber-500 font-mono block mt-1">
                  {formatValue(activeSegment?.fatKg, 'kg', 2)}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
                <span className="flex items-center gap-1 text-[10px] text-neutral-500 dark:text-neutral-400">
                  <Zap className="w-3 h-3 text-cyan-500" />
                  20 kHz
                </span>
                <span className="text-lg font-black text-cyan-500 font-mono block mt-1">
                  {formatValue(activeSegment?.impedance20kHz, 'Ω', 1)}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-violet-500/10 border border-violet-500/20">
                <span className="flex items-center gap-1 text-[10px] text-neutral-500 dark:text-neutral-400">
                  <Zap className="w-3 h-3 text-violet-500" />
                  100 kHz
                </span>
                <span className="text-lg font-black text-violet-500 font-mono block mt-1">
                  {formatValue(activeSegment?.impedance100kHz, 'Ω', 1)}
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h4 className="text-xs font-bold text-neutral-900 dark:text-white m-0">
                  {showImpedance ? '双频阻抗趋势' : '分段肌脂趋势'}
                </h4>
                <span className="text-[10px] text-neutral-400">
                  {displayedHistory.length} 次有效测量 · 当前窗口
                </span>
              </div>
              <div className="flex bg-black/5 dark:bg-white/5 p-0.5 rounded-lg">
                {[
                  { value: 7 as HistoryWindow, label: '7 次' },
                  { value: 30 as HistoryWindow, label: '30 次' },
                  { value: 0 as HistoryWindow, label: '全部' },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setHistoryWindow(item.value)}
                    className={`px-2 py-1 rounded-md text-[10px] font-semibold cursor-pointer ${
                      historyWindow === item.value
                        ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                        : 'text-neutral-400'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {allChartValues.length > 0 ? (
              <>
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full h-44 overflow-visible"
                >
                  {[0, 1, 2, 3].map((line) => {
                    const y = chartPadding + (line / 3) * (chartHeight - chartPadding * 2);
                    return (
                      <line
                        key={line}
                        x1={chartPadding}
                        x2={chartWidth - chartPadding}
                        y1={y}
                        y2={y}
                        stroke="currentColor"
                        strokeOpacity="0.08"
                        strokeDasharray="3 5"
                      />
                    );
                  })}
                  {primaryPoints.length > 1 && (
                    <path
                      d={linePath(primaryPoints)}
                      fill="none"
                      stroke={chartColors.primary}
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  {secondaryPoints.length > 1 && (
                    <path
                      d={linePath(secondaryPoints)}
                      fill="none"
                      stroke={chartColors.secondary}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  {primaryPoints.map((point, index) => (
                    <circle
                      key={`primary-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r="2.8"
                      fill="white"
                      stroke={chartColors.primary}
                      strokeWidth="1.5"
                    />
                  ))}
                  {secondaryPoints.map((point, index) => (
                    <circle
                      key={`secondary-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r="2.4"
                      fill="white"
                      stroke={chartColors.secondary}
                      strokeWidth="1.3"
                    />
                  ))}
                  <text
                    x={chartPadding}
                    y="13"
                    fill="currentColor"
                    fillOpacity="0.45"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {chartMinMax.max.toFixed(showImpedance ? 1 : 2)}
                  </text>
                  <text
                    x={chartPadding}
                    y={chartHeight - 4}
                    fill="currentColor"
                    fillOpacity="0.45"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {chartMinMax.min.toFixed(showImpedance ? 1 : 2)}
                  </text>
                </svg>
                <div className="flex flex-wrap items-center gap-4 text-[10px] text-neutral-500 dark:text-neutral-400 mt-1">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: chartColors.primary }}
                    />
                    {showImpedance ? '20 kHz 阻抗 (Ω)' : '肌肉量 (kg)'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: chartColors.secondary }}
                    />
                    {showImpedance ? '100 kHz 阻抗 (Ω)' : '脂肪量 (kg)'}
                  </span>
                  {displayedHistory.length > 1 && (
                    <span className="ml-auto font-mono">
                      {displayedHistory[0].measuredDate} →{' '}
                      {displayedHistory[displayedHistory.length - 1].measuredDate}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <p className="py-10 text-center text-xs text-neutral-400">
                当前部位暂无连续趋势数据。
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2.5 mt-4">
        {segmentCards.map((segment) => (
          <button
            key={segment.key}
            type="button"
            onClick={() => setSelectedPart(segment.key)}
            className={`text-left p-3 rounded-2xl border transition-all cursor-pointer ${
              selectedPart === segment.key
                ? 'bg-indigo-500/10 border-indigo-500/35 shadow-sm'
                : 'bg-black/[0.02] dark:bg-white/[0.025] border-black/5 dark:border-white/5 hover:border-indigo-500/25'
            }`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-neutral-900 dark:text-white">
                {segment.label}
              </span>
              <span className="text-[9px] text-neutral-400">{segment.subtitle}</span>
            </span>
            <span className="grid grid-cols-2 gap-1.5 mt-2 text-[10px] font-mono">
              <span className="text-indigo-500">肌 {formatValue(segment.muscleKg, 'kg', 2)}</span>
              <span className="text-amber-500">脂 {formatValue(segment.fatKg, 'kg', 2)}</span>
              <span className="text-cyan-500">20k {formatValue(segment.impedance20kHz, 'Ω', 1)}</span>
              <span className="text-violet-500">
                100k {formatValue(segment.impedance100kHz, 'Ω', 1)}
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-3 p-3 rounded-2xl bg-sky-500/[0.06] border border-sky-500/15 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-sky-500 mt-0.5 flex-shrink-0" />
        <p className="text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400 m-0">
          Fitdays 云端返回的 `adc_list` 包含五个部位在 20 kHz 与 100 kHz 下的十项电阻抗实测值；
          分段肌肉量与脂肪量并非云端原始字段，本页按全身骨骼肌/脂肪总量和规范人体比例估算展示，
          避免把估算值误标为实测。
        </p>
      </div>
    </AppleCard>
  );
};
