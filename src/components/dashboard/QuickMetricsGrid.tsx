import React from 'react';
import type { DailySummary } from '../../types/health';
import { AppleCard } from '../ui/AppleCard';
import { Footprints, Droplets, Thermometer, Wind, Mountain, Brain } from 'lucide-react';

interface QuickMetricsGridProps {
  summary: DailySummary;
}

export const QuickMetricsGrid: React.FC<QuickMetricsGridProps> = ({ summary }) => {
  const { steps, vitals, mindfulMinutes } = summary;
  const stepPercent =
    steps.goal > 0 ? Math.min(Math.round((steps.count / steps.goal) * 100), 150) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* 1. Steps & Distance */}
      <AppleCard className="p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
          <div className="flex items-center gap-1.5">
            <Footprints className="w-3.5 h-3.5 text-orange-400" />
            <span>步数</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-semibold">{stepPercent}%</span>
        </div>
        <div>
          <div className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
            {steps.count > 0 ? steps.count.toLocaleString() : '—'}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5">
            {steps.distanceKm > 0 ? `${steps.distanceKm} 公里` : '暂无距离数据'}
          </div>
        </div>
        <div className="w-full h-1 bg-black/10 dark:bg-white/10 rounded-full mt-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full"
            style={{ width: `${Math.min(stepPercent, 100)}%` }}
          />
        </div>
      </AppleCard>

      {/* 2. Blood Oxygen (SpO2) */}
      <AppleCard className="p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
          <div className="flex items-center gap-1.5">
            <Droplets className="w-3.5 h-3.5 text-sky-400" />
            <span>血氧 SpO2</span>
          </div>
          <span className="text-[10px] text-neutral-400">日常</span>
        </div>
        <div>
          <div className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
            {vitals.spo2 > 0 ? `${vitals.spo2}%` : '—'}
          </div>
          <div className="text-[11px] text-emerald-400 mt-0.5 font-medium">
            {vitals.spo2 > 0 ? 'Apple Health 实测均值' : '等待血氧数据'}
          </div>
        </div>
        <div className="text-[10px] text-neutral-500 mt-3">
          范围 95% - 100%
        </div>
      </AppleCard>

      {/* 3. Wrist Temperature */}
      <AppleCard className="p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
          <div className="flex items-center gap-1.5">
            <Thermometer className="w-3.5 h-3.5 text-teal-400" />
            <span>手腕体温</span>
          </div>
          <span className="text-[10px] text-neutral-400">夜间</span>
        </div>
        <div>
          <div className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
            {vitals.wristTemperatureAbs
              ? `${vitals.wristTemperatureAbs}°C`
              : '—'}
          </div>
          <div className="text-[11px] text-teal-400 mt-0.5 font-medium">
            {vitals.wristTemperatureAbs ? '睡眠腕温实测值' : '等待腕温数据'}
          </div>
        </div>
        <div className="text-[10px] text-neutral-500 mt-3">
          Apple Watch 睡眠腕温
        </div>
      </AppleCard>

      {/* 4. VO2 Max */}
      <AppleCard className="p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
          <div className="flex items-center gap-1.5">
            <Wind className="w-3.5 h-3.5 text-indigo-400" />
            <span>最大摄氧量</span>
          </div>
          <span className="text-[10px] text-indigo-400 font-semibold">VO2</span>
        </div>
        <div>
          <div className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
            {vitals.vo2Max ?? '—'}
          </div>
          <div className="text-[11px] text-indigo-300 mt-0.5 font-medium">
            {vitals.vo2Max ? 'Apple Health 实测记录' : '等待 VO2 Max 数据'}
          </div>
        </div>
        <div className="text-[10px] text-neutral-500 mt-3">
          ml / kg / min
        </div>
      </AppleCard>

      {/* 5. Flights Climbed */}
      <AppleCard className="p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
          <div className="flex items-center gap-1.5">
            <Mountain className="w-3.5 h-3.5 text-emerald-400" />
            <span>已爬楼层</span>
          </div>
          <span className="text-[10px] text-neutral-400">气压计</span>
        </div>
        <div>
          <div className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
            {steps.flightsClimbed > 0 ? steps.flightsClimbed : '—'}{' '}
            <span className="text-sm font-normal text-neutral-400">层</span>
          </div>
          <div className="text-[11px] text-emerald-400 mt-0.5 font-medium">
            {steps.flightsClimbed > 0 ? 'Apple Health 爬楼记录' : '等待爬楼数据'}
          </div>
        </div>
        <div className="text-[10px] text-neutral-500 mt-3">
          {steps.flightsClimbed > 0
            ? `≈ ${Math.round(steps.flightsClimbed * 3)} 米海拔升降`
            : '暂无爬楼数据'}
        </div>
      </AppleCard>

      {/* 6. Mindful Minutes */}
      <AppleCard className="p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
          <div className="flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            <span>正念分钟</span>
          </div>
          <span className="text-[10px] text-purple-400 font-semibold">冥想</span>
        </div>
        <div>
          <div className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
            {mindfulMinutes > 0 ? mindfulMinutes : '—'}{' '}
            <span className="text-sm font-normal text-neutral-400">分钟</span>
          </div>
          <div className="text-[11px] text-purple-300 mt-0.5 font-medium">
            {mindfulMinutes > 0 ? 'Apple Health 正念记录' : '等待正念数据'}
          </div>
        </div>
        <div className="text-[10px] text-neutral-500 mt-3">
          来自正念会话累计
        </div>
      </AppleCard>
    </div>
  );
};
