import React from 'react';
import type { BodyComposition } from '../../types/health';
import { AppleCard } from '../ui/AppleCard';
import { Scale, TrendingDown, TrendingUp, ShieldCheck, Activity, Sparkles, ChevronRight } from 'lucide-react';

interface BodyCompositionCardProps {
  body: BodyComposition;
}

type TrendPoint = BodyComposition['trend'][number];
type TrendKey = 'weight' | 'bodyFat';

const formatTrendNumber = (value: number, unit: string): string =>
  `${Number.isInteger(value) ? value : value.toFixed(unit === '%' ? 1 : 2)}${unit}`;

const MiniLineChart: React.FC<{
  points: TrendPoint[];
  valueKey: TrendKey;
  unit: string;
  color: string;
}> = ({ points, valueKey, unit, color }) => {
  const data = points.slice(-7);
  const values = data.map((point) => point[valueKey]).filter((value) => value > 0);
  if (values.length === 0) {
    return <span className="text-[10px] text-neutral-400">暂无最近 7 日记录</span>;
  }

  const width = 260;
  const height = 86;
  const padding = 10;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const coords = data
    .map((point, index) => ({
      point,
      index,
      value: point[valueKey],
      x:
        padding +
        (data.length <= 1
          ? (width - padding * 2) / 2
          : (index / (data.length - 1)) * (width - padding * 2)),
      y: height - padding - ((point[valueKey] - min) / range) * (height - padding * 2),
    }))
    .filter((item) => item.value > 0);
  const line = coords
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    )
    .join(' ');
  const area =
    coords.length > 0
      ? `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${height - padding} L ${coords[0].x.toFixed(1)} ${height - padding} Z`
      : '';

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[86px] w-full overflow-visible">
        {[0, 1, 2].map((lineIndex) => (
          <line
            key={lineIndex}
            x1={padding}
            x2={width - padding}
            y1={padding + (lineIndex / 2) * (height - padding * 2)}
            y2={padding + (lineIndex / 2) * (height - padding * 2)}
            stroke="currentColor"
            strokeOpacity="0.1"
            strokeDasharray="3 4"
          />
        ))}
        <path d={area} fill={color} fillOpacity="0.12" />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((point) => (
          <circle
            key={`${point.point.date}-${point.index}`}
            cx={point.x}
            cy={point.y}
            r="2.7"
            fill="white"
            stroke={color}
            strokeWidth="1.6"
          />
        ))}
      </svg>
      <div className="mt-1 flex items-center justify-between font-mono text-[9px] text-neutral-400">
        <span>{data[0]?.date || '—'}</span>
        <span className="font-bold" style={{ color }}>
          {formatTrendNumber(data[data.length - 1]?.[valueKey] || 0, unit)}
        </span>
        <span>{data[data.length - 1]?.date || '—'}</span>
      </div>
    </div>
  );
};

const MiniSevenDayBars: React.FC<{
  points: TrendPoint[];
  color: string;
  mode: 'lean' | 'fat';
}> = ({ points, color, mode }) => {
  const data = points.slice(-7).map((point) => {
    const value =
      mode === 'lean'
        ? point.weight * (1 - point.bodyFat / 100)
        : point.weight * (point.bodyFat / 100);
    return { ...point, value: Number(value.toFixed(2)) };
  });
  const values = data.map((point) => point.value).filter((value) => value > 0);
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 1;
  const range = max - min || 1;

  return (
    <div className="flex h-[92px] items-end justify-between gap-1.5 pt-2">
      {data.map((point, index) => {
        const height = point.value > 0 ? 24 + ((point.value - min) / range) * 46 : 6;
        return (
          <div key={`${point.date}-${index}`} className="flex min-w-0 flex-1 flex-col items-center">
            <span className="mb-1 font-mono text-[9px] font-bold text-white">
              {point.value > 0 ? point.value : '—'}
            </span>
            <div
              className="w-full rounded-t-md transition-all duration-200"
              style={{
                height,
                backgroundColor: point.value > 0 ? color : 'rgba(255,255,255,0.08)',
              }}
            />
            <span className="mt-1 font-mono text-[8px] text-neutral-400">{point.date}</span>
          </div>
        );
      })}
    </div>
  );
};

export const BodyCompositionCard: React.FC<BodyCompositionCardProps> = ({ body }) => {
  const leanPercent = Math.round((body.leanMassKg / Math.max(body.weightKg, 1)) * 100);
  const fatPercent = Math.round(body.bodyFatPercent);
  const boneMassEst = body.boneMassKg;

  const trendPoints = body.trend || [];
  const startWeight = trendPoints[0]?.weight;
  const weightDiff =
    startWeight !== undefined ? Number((body.weightKg - startWeight).toFixed(1)) : undefined;

  return (
    <AppleCard className="overflow-visible h-full flex flex-col justify-between relative">
      <div>
        {/* Header - 身体成分 (User Comment 6) */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 text-amber-500 border border-amber-500/30 flex-shrink-0">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-wider text-neutral-500 dark:text-neutral-400 uppercase">
                身体成分
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{body.statusLabel}</span>
          </div>
        </div>

        {/* Primary 2-Column: Weight & Body Fat Tiles */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* 1. Weight Tile (User Comment 1: No static line; hover shows 7-day trend with data values) */}
          <div className="relative group/weight p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.05] hover:border-amber-500/40 transition-all duration-200 cursor-pointer">
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              <span>当前体重</span>
              <span className="flex items-center text-[10px] text-emerald-500 dark:text-emerald-400 font-semibold">
                {weightDiff === undefined ? (
                  <span>暂无周初对比</span>
                ) : (
                  <>
                    {weightDiff <= 0 ? (
                      <TrendingDown className="w-3 h-3 mr-0.5" />
                    ) : (
                      <TrendingUp className="w-3 h-3 mr-0.5 text-amber-500" />
                    )}
                    {weightDiff > 0 ? `+${weightDiff}` : `${weightDiff}`} kg vs 周初
                  </>
                )}
              </span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
                {body.weightKg > 0 ? body.weightKg : '—'}
              </span>
              <span className="text-xs text-neutral-400 font-semibold">kg</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-amber-500 dark:text-amber-400 mt-2 font-medium">
              <span>悬停展示 7 日走势</span>
              <ChevronRight className="w-3 h-3 group-hover/weight:translate-x-0.5 transition-transform" />
            </div>

            {/* Hover Floating 7-Day Trend Popover */}
            <div className="absolute left-0 right-0 top-full mt-2 z-50 opacity-0 pointer-events-none group-hover/weight:opacity-100 group-hover/weight:pointer-events-auto transition-all duration-200 p-3 rounded-2xl bg-neutral-900/95 text-white border border-white/20 shadow-2xl backdrop-blur-2xl">
              <div className="flex items-center justify-between text-xs font-bold text-amber-400 pb-1.5 mb-2 border-b border-white/10">
                <span className="flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" />
                  <span>最近 7 日体重变化 (kg)</span>
                </span>
                <span className="text-[10px] text-neutral-400 font-normal">仅显示实测记录</span>
              </div>
              {trendPoints.length > 0 ? (
                <MiniLineChart
                  points={trendPoints}
                  valueKey="weight"
                  unit="kg"
                  color="#FBBF24"
                />
              ) : (
                <span className="text-[10px] text-neutral-400">暂无体重趋势记录</span>
              )}
            </div>
          </div>

          {/* 2. Body Fat Tile (User Comment 2: Hover shows trend) */}
          <div className="relative group/fat p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.05] hover:border-amber-500/40 transition-all duration-200 cursor-pointer">
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              <span>体脂率</span>
              <span className="text-[10px] text-amber-500 dark:text-amber-400 font-semibold">{body.statusLabel}</span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-black text-amber-500 dark:text-amber-400 tracking-tight">
                {body.bodyFatPercent > 0 ? body.bodyFatPercent : '—'}
              </span>
              <span className="text-xs text-neutral-400 font-semibold">%</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 mt-2">
              <span>脂肪量 {body.fatMassKg}kg</span>
              <ChevronRight className="w-3 h-3 group-hover/fat:translate-x-0.5 transition-transform" />
            </div>

            {/* Hover Floating 7-Day Fat Trend Popover */}
            <div className="absolute left-0 right-0 top-full mt-2 z-50 opacity-0 pointer-events-none group-hover/fat:opacity-100 group-hover/fat:pointer-events-auto transition-all duration-200 p-3 rounded-2xl bg-neutral-900/95 text-white border border-white/20 shadow-2xl backdrop-blur-2xl">
              <div className="flex items-center justify-between text-xs font-bold text-amber-400 pb-1.5 mb-2 border-b border-white/10">
                <span className="flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" />
                  <span>最近 7 日体脂率走势 (%)</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-normal">仅显示实测记录</span>
              </div>
              {trendPoints.length > 0 ? (
                <MiniLineChart
                  points={trendPoints}
                  valueKey="bodyFat"
                  unit="%"
                  color="#F59E0B"
                />
              ) : (
                <span className="text-[10px] text-neutral-400">暂无体脂趋势记录</span>
              )}
            </div>
          </div>
        </div>

        {/* 3. Lean Mass Bar with Hover Trend Popovers */}
        <div className="relative p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] mb-3">
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span className="text-neutral-600 dark:text-neutral-300 font-medium">身体成分构成 (瘦体重 vs 脂肪)</span>
            <span className="font-bold text-neutral-900 dark:text-white font-mono">{body.leanMassKg} kg ({leanPercent}%) / {body.fatMassKg} kg ({fatPercent}%)</span>
          </div>

          {/* Interactive Dual-Segment Bar */}
          <div className="w-full h-3.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden flex relative">
            {/* Left Segment: Muscle / Lean Mass (Hover shows 7-day muscle trend) */}
            <div
              style={{ width: `${leanPercent}%` }}
              className="group/muscle-seg h-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:brightness-125 transition-all cursor-pointer relative"
            >
              {/* Floating 7-day Lean Mass Trend Popover */}
              <div className="absolute left-0 bottom-full mb-2 z-50 opacity-0 group-hover/muscle-seg:opacity-100 transition-opacity pointer-events-none p-2.5 rounded-2xl bg-neutral-950/95 text-white text-[11px] border border-indigo-500/40 shadow-2xl backdrop-blur-xl w-60">
                <div className="flex items-center justify-between text-indigo-300 font-bold mb-1.5 border-b border-white/10 pb-1">
                  <span>💪 去脂瘦体重 7 日趋势</span>
                  <span className="text-emerald-400 text-[10px]">占比 {leanPercent}%</span>
                </div>
                <MiniSevenDayBars points={trendPoints} color="#6366F1" mode="lean" />
              </div>
            </div>

            {/* Right Segment: Fat Mass / Bone (Hover shows 7-day fat mass trend) */}
            <div
              style={{ width: `${fatPercent}%` }}
              className="group/bone-seg h-full bg-gradient-to-r from-amber-400 to-orange-400 hover:brightness-125 transition-all cursor-pointer relative"
            >
              {/* Floating 7-day Fat Mass Trend Popover */}
              <div className="absolute right-0 bottom-full mb-2 z-50 opacity-0 group-hover/bone-seg:opacity-100 transition-opacity pointer-events-none p-2.5 rounded-2xl bg-neutral-950/95 text-white text-[11px] border border-amber-500/40 shadow-2xl backdrop-blur-xl w-60">
                <div className="flex items-center justify-between text-amber-300 font-bold mb-1.5 border-b border-white/10 pb-1">
                  <span>🧈 脂肪与骨量 7 日趋势</span>
                  <span className="text-amber-400 text-[10px]">{body.fatMassKg} kg ({fatPercent}%)</span>
                </div>
                <MiniSevenDayBars points={trendPoints} color="#F59E0B" mode="fat" />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] text-neutral-500 dark:text-neutral-400 mt-1.5 px-0.5">
            <span className="flex items-center gap-1 font-medium text-indigo-500 dark:text-indigo-400">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              去脂瘦体重 {body.leanMassKg} kg
            </span>
            <span className="flex items-center gap-1 font-medium text-amber-500 dark:text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              脂肪量 {body.fatMassKg} kg{boneMassEst ? ` · 骨量 ${boneMassEst} kg` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Submetrics Footer Row (User Comment 4: Hover BMI to show trend) */}
      <div className="grid grid-cols-2 gap-2 text-xs relative">
        {/* BMI Tile with Hover Trend */}
        <div className="relative group/bmi p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.03] hover:border-amber-500/40 flex items-center justify-between cursor-pointer transition-all">
          <span className="text-neutral-500 dark:text-neutral-400">体质指数 (BMI)</span>
          <span className="font-bold text-neutral-900 dark:text-white font-mono">{body.bmi}</span>

          {/* Hover Popover for BMI */}
          <div className="absolute left-0 bottom-full mb-2 z-50 opacity-0 pointer-events-none group-hover/bmi:opacity-100 group-hover/bmi:pointer-events-auto transition-all duration-200 p-2.5 rounded-xl bg-neutral-950/95 text-white text-[10px] border border-white/20 shadow-2xl backdrop-blur-xl w-56">
            <div className="font-bold text-emerald-400 mb-1 flex items-center justify-between">
              <span>BMI 指数：{body.bmi}</span>
              <span className="text-neutral-400 font-normal">标准: 18.5~23.9</span>
            </div>
            <div className="text-neutral-300">
              {body.weightKg > 0 ? '仅展示本次体脂秤实测值。' : '暂无体测数据。'}
            </div>
          </div>
        </div>

        {/* Muscle Level */}
        <div className="p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.03] flex items-center justify-between">
          <span className="text-neutral-500 dark:text-neutral-400">肌肉量等级</span>
          <span className="font-bold text-indigo-500 dark:text-indigo-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            {body.skeletalMusclePercent ? `${body.skeletalMusclePercent}%` : '—'}
          </span>
        </div>
      </div>
    </AppleCard>
  );
};
