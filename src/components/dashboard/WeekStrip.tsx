import React from 'react';
import { motion } from 'framer-motion';
import type { DailySummary, ActivityRings } from '../../types/health';
import { AppleCard } from '../ui/AppleCard';
import { Calendar as CalendarIcon, Sparkles } from 'lucide-react';

interface WeekStripProps {
  days: Record<string, DailySummary>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

const MiniTriRings: React.FC<{ rings: ActivityRings; isSelected: boolean }> = ({ rings }) => {
  const size = 36;
  const center = size / 2;
  const strokeWidth = 2.5;

  const moveR = 14;
  const moveC = 2 * Math.PI * moveR;
  const moveRatio = rings.move.current / Math.max(rings.move.goal, 1);
  const moveOffset = moveC * (1 - Math.min(moveRatio, 1));

  const exerciseR = 10.5;
  const exerciseC = 2 * Math.PI * exerciseR;
  const exerciseRatio = rings.exercise.current / Math.max(rings.exercise.goal, 1);
  const exerciseOffset = exerciseC * (1 - Math.min(exerciseRatio, 1));

  const standR = 7;
  const standC = 2 * Math.PI * standR;
  const standRatio = rings.stand.current / Math.max(rings.stand.goal, 1);
  const standOffset = standC * (1 - Math.min(standRatio, 1));

  return (
    <div className="relative w-9 h-9 flex items-center justify-center my-1.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
        {/* Background Tracks */}
        <circle cx={center} cy={center} r={moveR} stroke="rgba(250, 17, 79, 0.25)" strokeWidth={strokeWidth} fill="none" />
        <circle cx={center} cy={center} r={exerciseR} stroke="rgba(161, 255, 0, 0.25)" strokeWidth={strokeWidth} fill="none" />
        <circle cx={center} cy={center} r={standR} stroke="rgba(0, 245, 212, 0.25)" strokeWidth={strokeWidth} fill="none" />

        {/* Animated Active Arcs */}
        <motion.circle
          cx={center}
          cy={center}
          r={moveR}
          stroke="#FA114F"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={moveC}
          initial={{ strokeDashoffset: moveC }}
          animate={{ strokeDashoffset: moveOffset }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.circle
          cx={center}
          cy={center}
          r={exerciseR}
          stroke="#A1FF00"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={exerciseC}
          initial={{ strokeDashoffset: exerciseC }}
          animate={{ strokeDashoffset: exerciseOffset }}
          transition={{ duration: 1.2, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.circle
          cx={center}
          cy={center}
          r={standR}
          stroke="#00F5D4"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={standC}
          initial={{ strokeDashoffset: standC }}
          animate={{ strokeDashoffset: standOffset }}
          transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
    </div>
  );
};

export const WeekStrip: React.FC<WeekStripProps> = ({
  days,
  selectedDate,
  onSelectDate,
}) => {
  const allDates = Object.keys(days).sort();
  // Focus on recent 7 days as requested by user
  const recent7Dates = allDates.slice(-7);

  return (
    <AppleCard className="p-3 md:p-4 mb-6">
      <div className="flex items-center justify-between mb-2.5 px-1">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-neutral-400" />
          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
            最近 7 日 · 三色健身圆环合盖记录
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-neutral-400">
          <div className="hidden sm:flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#FA114F]" />动态能量</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#A1FF00]" />锻炼时间</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#00F5D4]" />站立时间</span>
          </div>
          <span className="text-[11px] text-neutral-400">点击切换整屏数据</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 md:gap-3">
        {recent7Dates.map((date) => {
          const item = days[date];
          if (!item) return null;
          const isSelected = selectedDate === date;
          const dayNum = date.split('-')[2];
          const allRingsClosed =
            item.rings.move.current >= item.rings.move.goal &&
            item.rings.exercise.current >= item.rings.exercise.goal &&
            item.rings.stand.current >= item.rings.stand.goal;

          return (
            <button
              key={date}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectDate(date);
              }}
              className={`relative flex flex-col items-center py-2 px-1 rounded-2xl transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'bg-black/10 dark:bg-white/15 shadow-md text-neutral-900 dark:text-white border border-black/15 dark:border-white/25 scale-[1.02]'
                  : 'hover:bg-black/[0.04] dark:hover:bg-white/5 text-neutral-500 dark:text-neutral-400 border border-transparent'
              }`}
            >
              {/* Day Name */}
              <span className="text-[11px] font-medium text-neutral-400">
                周{item.shortDay}
              </span>

              {/* Day Number */}
              <span
                className={`text-sm md:text-base font-bold tracking-tight ${
                  isSelected ? 'text-neutral-900 dark:text-white font-black' : 'text-neutral-600 dark:text-neutral-300'
                }`}
              >
                {dayNum}
              </span>

              {/* Mini Tri-Color Activity Rings Graphic */}
              <MiniTriRings rings={item.rings} isSelected={isSelected} />

              {/* Status footer: Today or Star badge */}
              <div className="h-4 flex items-center justify-center">
                {item.isToday ? (
                  <span className="text-[9px] font-bold text-rose-500 dark:text-rose-400 bg-rose-500/10 px-1 rounded">
                    今天
                  </span>
                ) : allRingsClosed ? (
                  <span className="flex items-center gap-0.5 text-[9px] text-amber-500 dark:text-amber-400 font-semibold">
                    <Sparkles className="w-2.5 h-2.5" />
                    合盖
                  </span>
                ) : (
                  <span className="text-[9px] text-neutral-400">
                    {Math.round((item.rings.move.current / item.rings.move.goal) * 100)}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </AppleCard>
  );
};