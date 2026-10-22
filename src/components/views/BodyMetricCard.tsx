import React, { useMemo } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Minus,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { BodyMeasurement } from '../../types/health';
import { AppleCard } from '../ui/AppleCard';
import {
  bodyMetricValue,
  compareBodyMetric,
  formatBodyMetricValue,
  type BodyMetricDefinition,
} from '../../utils/bodyMetrics';

interface BodyMetricCardProps {
  definition: BodyMetricDefinition;
  measurement: BodyMeasurement | null;
  measurements: BodyMeasurement[];
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  dateLabel: string;
  onClick?: () => void;
}

const DeltaText: React.FC<{
  definition: BodyMetricDefinition;
  delta: number | null;
}> = ({ definition, delta }) => {
  if (delta === null) return <span>—</span>;
  const sign = delta > 0 ? '+' : '';
  return (
    <span>
      {sign}
      {delta.toFixed(definition.decimals)}
      {definition.unit ? ` ${definition.unit}` : ''}
    </span>
  );
};

export const BodyMetricCard: React.FC<BodyMetricCardProps> = ({
  definition,
  measurement,
  measurements,
  color,
  icon: Icon,
  dateLabel,
  onClick,
}) => {
  const comparison = useMemo(
    () => compareBodyMetric(definition, measurement, measurements),
    [definition, measurement, measurements]
  );
  const currentValue = bodyMetricValue(measurement, definition.key);
  const epsilon = 10 ** -Math.max(definition.decimals, 1) / 2;
  const yesterdayDelta = comparison.yesterdayDelta;
  const sevenDayDelta = comparison.sevenDayDelta;
  const YesterdayIcon =
    yesterdayDelta === null || Math.abs(yesterdayDelta) < epsilon
      ? Minus
      : yesterdayDelta > 0
        ? ArrowUp
        : ArrowDown;
  const SevenDayIcon =
    sevenDayDelta === null || Math.abs(sevenDayDelta) < epsilon
      ? Minus
      : sevenDayDelta > 0
        ? TrendingUp
        : TrendingDown;
  const yesterdayColor =
    comparison.yesterdayBetter === true
      ? 'text-emerald-500'
      : comparison.yesterdayBetter === false
        ? 'text-amber-500'
        : 'text-neutral-400';
  const sevenDayColor =
    comparison.sevenDayBetter === true
      ? 'text-emerald-500'
      : comparison.sevenDayBetter === false
        ? 'text-rose-500'
        : 'text-neutral-400';

  return (
    <AppleCard
      onClick={onClick}
      className={`flex h-full flex-col justify-between p-4 transition-all ${
        onClick ? 'cursor-pointer hover:border-amber-500/40' : ''
      }`}
    >
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border"
            style={{
              backgroundColor: `${color}15`,
              borderColor: `${color}30`,
              color,
            }}
          >
            <Icon className="h-4 w-4" />
          </span>
          <span className="rounded-full bg-black/[0.03] px-2 py-0.5 text-[9px] text-neutral-400 dark:bg-white/[0.05]">
            {dateLabel}
          </span>
        </div>
        <span className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400">
          {definition.title}
        </span>
        <div className="my-1 flex min-h-8 items-baseline gap-1">
          <span className="font-mono text-2xl font-black tracking-tight text-neutral-900 dark:text-white">
            {formatBodyMetricValue(currentValue, definition)}
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 border-t border-black/5 pt-2.5 text-[10px] dark:border-white/5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-neutral-400">相较于昨日</span>
          <span className={`flex items-center gap-1 font-mono font-semibold ${yesterdayColor}`}>
            <DeltaText definition={definition} delta={comparison.yesterdayDelta} />
            <YesterdayIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-neutral-400">相较于七日均值</span>
          <span className={`flex items-center gap-1 font-mono font-semibold ${sevenDayColor}`}>
            <DeltaText definition={definition} delta={comparison.sevenDayDelta} />
            <SevenDayIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </AppleCard>
  );
};
