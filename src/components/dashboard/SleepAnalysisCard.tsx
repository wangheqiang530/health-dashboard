import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { SleepAnalysis, DailySummary } from '../../types/health';
import { AppleCard } from '../ui/AppleCard';
import { Moon, Wind, HeartPulse, Clock, Sparkles } from 'lucide-react';

interface SleepAnalysisCardProps {
  sleep: SleepAnalysis;
  days?: Record<string, DailySummary>;
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
}

export const SleepAnalysisCard: React.FC<SleepAnalysisCardProps> = ({
  sleep,
  days,
  selectedDate,
  onSelectDate,
}) => {
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [activeSpan, setActiveSpan] = useState<'day' | 'week'>('day');
  const [hoveredWeekDay, setHoveredWeekDay] = useState<DailySummary | null>(null);

  const hours = Math.floor(sleep.totalMinutes / 60);
  const minutes = sleep.totalMinutes % 60;

  const stageConfigs = [
    { key: 'deep', label: '深度睡眠', color: '#5E5CE6', minutes: sleep.stages.deep, desc: '体能恢复与免疫力构建' },
    { key: 'core', label: '核心睡眠', color: '#0A84FF', minutes: sleep.stages.core, desc: '肌肉修护与记忆巩固' },
    { key: 'rem', label: '快速眼动', color: '#64D2FF', minutes: sleep.stages.rem, desc: '认知恢复与梦境处理' },
    { key: 'awake', label: '清醒阶段', color: '#FF9F0A', minutes: sleep.stages.awake, desc: '夜间微觉醒与辗转' },
  ];

  const totalStageMinutes =
    sleep.stages.awake + sleep.stages.rem + sleep.stages.core + sleep.stages.deep;

  // Extract recent 7 days for the weekly stacked chart
  const recentDaysList: DailySummary[] = days
    ? Object.keys(days)
        .sort()
        .slice(-7)
        .map((d) => days[d])
    : [];

  const handleBarClick = (dateStr: string) => {
    if (onSelectDate) {
      onSelectDate(dateStr);
      setActiveSpan('day'); // Enter date detail as requested by user
    }
  };

  return (
    <AppleCard className="overflow-hidden h-full flex flex-col justify-between">
      <div>
        {/* Header - Renamed to 睡眠分析 (User Comment 9) with Day/Week Span Toggle (User Comment 10) */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex-shrink-0">
              <Moon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-wider text-neutral-500 dark:text-neutral-400 uppercase">
                睡眠分析
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Day / Week Time Span Switcher */}
            <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-black/5 dark:border-white/5">
              <button
                type="button"
                onClick={() => setActiveSpan('day')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeSpan === 'day'
                    ? 'bg-indigo-500 text-white shadow-sm'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                日
              </button>
              <button
                type="button"
                onClick={() => setActiveSpan('week')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeSpan === 'week'
                    ? 'bg-indigo-500 text-white shadow-sm'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                周 (7日柱状)
              </button>
            </div>

            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              得分 {sleep.score}
            </span>
          </div>
        </div>

        {/* View 1: Day View (Detailed Hypnogram + Stages) */}
        {activeSpan === 'day' ? (
          <div>
            {/* Main Sleep Duration & Times */}
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mb-4 gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
                  {hours}
                </span>
                <span className="text-sm text-neutral-400 font-medium">小时</span>
                <span className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white ml-1">
                  {minutes}
                </span>
                <span className="text-sm text-neutral-400 font-medium">分钟</span>
                <span className="text-xs text-neutral-400 ml-2 font-normal">
                  (实际入睡时长)
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-neutral-400">
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-neutral-400" />
                  <span>入睡: {sleep.bedTime}</span>
                </div>
                <span>•</span>
                <div>
                  <span>醒来: {sleep.wakeTime}</span>
                </div>
              </div>
            </div>

            {/* Hypnogram / Multi-segment Sleep Stage Timeline */}
            <div className="mb-4">
              <div className="relative w-full h-8 rounded-xl overflow-hidden bg-black/5 dark:bg-white/5 flex gap-0.5 p-0.5">
                {sleep.timeline.map((seg, idx) => {
                  const widthPct = (seg.durationMinutes / Math.max(sleep.totalMinutes, 1)) * 100;
                  const stageCfg = stageConfigs.find((s) => s.key === seg.stage);
                  const isHovered = activeStage === seg.stage;

                  return (
                    <motion.div
                      key={idx}
                      onMouseEnter={() => setActiveStage(seg.stage)}
                      onMouseLeave={() => setActiveStage(null)}
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: stageCfg?.color || '#888',
                        opacity: activeStage && !isHovered ? 0.35 : 0.95,
                      }}
                      className="h-full rounded-sm transition-all duration-200 cursor-pointer relative group"
                      whileHover={{ scaleY: 1.1 }}
                    />
                  );
                })}
              </div>

              {/* Time Axis Labels */}
              <div className="flex justify-between items-center text-[10px] text-neutral-400 mt-1 px-1 font-mono">
                <span>{sleep.bedTime}</span>
                <span>夜间修护分期</span>
                <span>{sleep.wakeTime}</span>
              </div>
            </div>

            {/* Stage Legend & Proportions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {stageConfigs.map((cfg) => {
                const pct = Math.round((cfg.minutes / Math.max(totalStageMinutes, 1)) * 100);
                const stHours = Math.floor(cfg.minutes / 60);
                const stMins = cfg.minutes % 60;
                const isSelected = activeStage === cfg.key;

                return (
                  <div
                    key={cfg.key}
                    onMouseEnter={() => setActiveStage(cfg.key)}
                    onMouseLeave={() => setActiveStage(null)}
                    className={`p-2.5 rounded-2xl border transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'bg-black/[0.06] dark:bg-white/[0.08] border-black/20 dark:border-white/20'
                        : 'bg-black/[0.02] dark:bg-white/[0.03] border-black/[0.05] dark:border-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: cfg.color }}
                      />
                      <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-bold text-neutral-900 dark:text-white font-mono">
                        {stHours > 0 ? `${stHours}h ` : ''}{stMins}m
                      </span>
                      <span className="text-xs text-neutral-400 font-semibold">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* View 2: Week View (User Comment 10: 7-day vertical stacked bars, click a bar to enter date details) */
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-2">
              <span>最近 7 日睡眠分期结构对比 · 点击任一日查看该日详情</span>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#5E5CE6]" />深睡</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#0A84FF]" />核心</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#64D2FF]" />REM</span>
              </div>
            </div>

            {/* 7-Day Vertical Stacked Bars */}
            <div className="flex items-end justify-between h-[155px] gap-2 px-1 pt-2">
              {recentDaysList.map((d) => {
                const s = d.sleep;
                const totalH = (s.totalMinutes / 60).toFixed(1);
                const isSelected = selectedDate === d.date;
                const maxDayMinutes = 600; // 10h baseline
                const totalHeightPct = Math.min((s.totalMinutes / maxDayMinutes) * 100, 100);
                const stageTotal =
                  s.stages.deep + s.stages.core + s.stages.rem + s.stages.awake || s.totalMinutes || 1;

                const deepPct = (s.stages.deep / stageTotal) * 100;
                const corePct = (s.stages.core / stageTotal) * 100;
                const remPct = (s.stages.rem / stageTotal) * 100;
                const awakePct = (s.stages.awake / stageTotal) * 100;

                return (
                  <div
                    key={d.date}
                    onClick={() => handleBarClick(d.date)}
                    onMouseEnter={() => setHoveredWeekDay(d)}
                    onMouseLeave={() => setHoveredWeekDay(null)}
                    className={`flex-1 flex flex-col items-center h-full justify-end cursor-pointer group p-1 rounded-xl transition-all ${
                      isSelected
                        ? 'bg-indigo-500/15 ring-2 ring-indigo-400/50'
                        : 'hover:bg-black/[0.03] dark:hover:bg-white/5'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-neutral-900 dark:text-white font-mono mb-1">
                      {totalH}h
                    </span>

                    {/* Stacked Vertical Bar */}
                    <div
                      className="w-5 sm:w-6 bg-black/5 dark:bg-white/5 rounded-t-lg overflow-hidden flex flex-col-reverse transition-all duration-300 group-hover:scale-105"
                      style={{ height: `${totalHeightPct}%` }}
                    >
                      <div style={{ height: `${deepPct}%` }} className="w-full bg-[#5E5CE6]" title="深睡" />
                      <div style={{ height: `${corePct}%` }} className="w-full bg-[#0A84FF]" title="核心" />
                      <div style={{ height: `${remPct}%` }} className="w-full bg-[#64D2FF]" title="REM" />
                      <div style={{ height: `${awakePct}%` }} className="w-full bg-[#FF9F0A]" title="清醒" />
                    </div>

                    <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-1">
                      周{d.shortDay}
                    </span>
                    <span className="text-[9px] text-indigo-400 font-bold">
                      {s.score}分
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Hover Tooltip for Week View Bar */}
            {hoveredWeekDay && (
              <div className="mt-2 p-2 rounded-xl bg-black/5 dark:bg-white/5 text-[11px] text-neutral-600 dark:text-neutral-300 flex items-center justify-between border border-black/5 dark:border-white/5">
                <span className="font-bold text-indigo-500">{hoveredWeekDay.date} (周{hoveredWeekDay.shortDay}) 睡眠详情:</span>
                <span>实际入睡 {Math.floor(hoveredWeekDay.sleep.totalMinutes / 60)}h {hoveredWeekDay.sleep.totalMinutes % 60}m</span>
                <span>深睡 {Math.floor(hoveredWeekDay.sleep.stages.deep)}m · REM {hoveredWeekDay.sleep.stages.rem}m</span>
                <span className="text-amber-500 font-semibold">👉 点击进入此日详情</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Key Sleep Vitals Footer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06] text-xs">
        <div className="flex items-center gap-2">
          <Wind className="w-3.5 h-3.5 text-sky-400" />
          <div>
            <span className="text-neutral-400 text-[11px] block">呼吸频率</span>
            <span className="font-semibold text-neutral-900 dark:text-white">{sleep.respiratoryRate} 次/分</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
          <div>
            <span className="text-neutral-400 text-[11px] block">睡眠平均 HRV</span>
            <span className="font-semibold text-neutral-900 dark:text-white">{sleep.hrvSleepAvg} ms</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Moon className="w-3.5 h-3.5 text-indigo-400" />
          <div>
            <span className="text-neutral-400 text-[11px] block">睡眠效率</span>
            <span className="font-semibold text-neutral-900 dark:text-white">{sleep.efficiency}% (在床 {Math.floor(sleep.inBedMinutes / 60)}h)</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <div>
            <span className="text-neutral-400 text-[11px] block">呼吸扰动指数</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {sleep.breathingDisturbances !== undefined ? sleep.breathingDisturbances : '0.78'} 次/时 (通畅)
            </span>
          </div>
        </div>
      </div>
    </AppleCard>
  );
};
