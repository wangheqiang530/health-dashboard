import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { DailySummary, ActivityRings } from '../../types/health';
import { AppleCard } from '../ui/AppleCard';
import { Calendar as CalendarIcon, Sparkles, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { CalendarDatePickerModal } from '../ui/CalendarDatePickerModal';

interface WeekStripProps {
  days: Record<string, DailySummary>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

const MiniTriRings: React.FC<{ rings: ActivityRings; isSelected: boolean }> = ({ rings }) => {
  const size = 38;
  const center = size / 2;
  const strokeWidth = 2.8;

  const moveR = 14;
  const moveC = 2 * Math.PI * moveR;
  const moveRatio = rings.move.current / Math.max(rings.move.goal, 1);
  const moveOverlap = moveRatio > 1 ? Math.min(moveRatio - 1, 0.999) : 0;

  const exerciseR = 10.5;
  const exerciseC = 2 * Math.PI * exerciseR;
  const exerciseRatio = rings.exercise.current / Math.max(rings.exercise.goal, 1);
  const exerciseOverlap = exerciseRatio > 1 ? Math.min(exerciseRatio - 1, 0.999) : 0;

  const standR = 7.0;
  const standC = 2 * Math.PI * standR;
  const standRatio = rings.stand.current / Math.max(rings.stand.goal, 1);
  const standOverlap = standRatio > 1 ? Math.min(standRatio - 1, 0.999) : 0;

  return (
    <div className="relative w-10 h-10 flex items-center justify-center my-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
        <defs>
          <linearGradient id="miniMoveGrad" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FF3366" />
            <stop offset="100%" stopColor="#FA114F" />
          </linearGradient>
          <linearGradient id="miniExerciseGrad" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#E4FF00" />
            <stop offset="100%" stopColor="#A1FF00" />
          </linearGradient>
          <linearGradient id="miniStandGrad" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00F5D4" />
            <stop offset="100%" stopColor="#00A3FF" />
          </linearGradient>
          <filter id="miniCapShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" />
          </filter>
        </defs>

        {/* Background Tracks */}
        <circle cx={center} cy={center} r={moveR} stroke="rgba(250, 17, 79, 0.25)" strokeWidth={strokeWidth} fill="none" />
        <circle cx={center} cy={center} r={exerciseR} stroke="rgba(161, 255, 0, 0.25)" strokeWidth={strokeWidth} fill="none" />
        <circle cx={center} cy={center} r={standR} stroke="rgba(0, 245, 212, 0.25)" strokeWidth={strokeWidth} fill="none" />

        {/* Animated Active Arcs */}
        {/* Move Ring */}
        <motion.circle
          cx={center}
          cy={center}
          r={moveR}
          stroke="url(#miniMoveGrad)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={moveC}
          initial={{ strokeDashoffset: moveC }}
          animate={{ strokeDashoffset: moveC * (1 - Math.min(moveRatio, 1)) }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
        {moveOverlap > 0 && (
          <g>
            <motion.circle
              cx={center}
              cy={center}
              r={moveR}
              stroke="url(#miniMoveGrad)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={moveC}
              initial={{ strokeDashoffset: moveC }}
              animate={{ strokeDashoffset: moveC * (1 - moveOverlap) }}
              transition={{ duration: 1.2, delay: 0.3, ease: 'easeOut' }}
            />
            <circle
              cx={center + moveR * Math.cos(moveOverlap * 2 * Math.PI)}
              cy={center + moveR * Math.sin(moveOverlap * 2 * Math.PI)}
              r={strokeWidth * 0.5}
              fill="#FA114F"
              stroke="rgba(0,0,0,0.5)"
              strokeWidth="0.5"
            />
          </g>
        )}

        {/* Exercise Ring */}
        <motion.circle
          cx={center}
          cy={center}
          r={exerciseR}
          stroke="url(#miniExerciseGrad)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={exerciseC}
          initial={{ strokeDashoffset: exerciseC }}
          animate={{ strokeDashoffset: exerciseC * (1 - Math.min(exerciseRatio, 1)) }}
          transition={{ duration: 1.2, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        />
        {exerciseOverlap > 0 && (
          <g>
            <motion.circle
              cx={center}
              cy={center}
              r={exerciseR}
              stroke="url(#miniExerciseGrad)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={exerciseC}
              initial={{ strokeDashoffset: exerciseC }}
              animate={{ strokeDashoffset: exerciseC * (1 - exerciseOverlap) }}
              transition={{ duration: 1.2, delay: 0.4, ease: 'easeOut' }}
            />
            <circle
              cx={center + exerciseR * Math.cos(exerciseOverlap * 2 * Math.PI)}
              cy={center + exerciseR * Math.sin(exerciseOverlap * 2 * Math.PI)}
              r={strokeWidth * 0.5}
              fill="#A1FF00"
              stroke="rgba(0,0,0,0.5)"
              strokeWidth="0.5"
            />
          </g>
        )}

        {/* Stand Ring */}
        <motion.circle
          cx={center}
          cy={center}
          r={standR}
          stroke="url(#miniStandGrad)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={standC}
          initial={{ strokeDashoffset: standC }}
          animate={{ strokeDashoffset: standC * (1 - Math.min(standRatio, 1)) }}
          transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        />
        {standOverlap > 0 && (
          <g>
            <motion.circle
              cx={center}
              cy={center}
              r={standR}
              stroke="url(#miniStandGrad)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={standC}
              initial={{ strokeDashoffset: standC }}
              animate={{ strokeDashoffset: standC * (1 - standOverlap) }}
              transition={{ duration: 1.2, delay: 0.5, ease: 'easeOut' }}
            />
            <circle
              cx={center + standR * Math.cos(standOverlap * 2 * Math.PI)}
              cy={center + standR * Math.sin(standOverlap * 2 * Math.PI)}
              r={strokeWidth * 0.5}
              fill="#00F5D4"
              stroke="rgba(0,0,0,0.5)"
              strokeWidth="0.5"
            />
          </g>
        )}
      </svg>
    </div>
  );
};

export const WeekStrip: React.FC<WeekStripProps> = ({
  days,
  selectedDate,
  onSelectDate,
}) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const allDates = Object.keys(days).sort();

  // Center 7 days around selectedDate when selectedDate is in the past
  const selectedIndex = allDates.indexOf(selectedDate);
  let displayDates: string[] = [];
  if (selectedIndex >= 0 && allDates.length > 7) {
    const start = Math.max(0, Math.min(selectedIndex - 3, allDates.length - 7));
    displayDates = allDates.slice(start, start + 7);
  } else {
    displayDates = allDates.slice(-7);
  }

  return (
    <>
    <AppleCard className="p-3 md:p-4 mb-6">
      <div className="flex items-center justify-between mb-2.5 px-1">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-neutral-400" />
          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
            三色健身圆环合盖记录
          </span>
        </div>
        <div className="flex items-center gap-2.5 text-xs text-neutral-400">
          <div className="hidden sm:flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#FA114F]" />动态能量</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#A1FF00]" />锻炼时间</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#00F5D4]" />站立时间</span>
          </div>
          {/* Quick Date Stepper Navigation (Time Travel) */}
          <div className="flex items-center gap-1 bg-black/5 dark:bg-white/10 p-0.5 rounded-xl border border-black/5 dark:border-white/10">
            <button
              type="button"
              onClick={() => selectedIndex > 0 && onSelectDate(allDates[selectedIndex - 1])}
              disabled={selectedIndex <= 0}
              className="p-1 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="前一天"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsCalendarOpen(true)}
              className="px-2 py-0.5 text-neutral-800 dark:text-white font-mono text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1"
              title="打开日历选择任意历史日期查看"
            >
              <CalendarIcon className="w-3 h-3 text-amber-500" />
              <span>{selectedDate || '选择日期'}</span>
              <ChevronDown className="w-3 h-3 text-neutral-400" />
            </button>
            <button
              type="button"
              onClick={() => selectedIndex < allDates.length - 1 && onSelectDate(allDates[selectedIndex + 1])}
              disabled={selectedIndex >= allDates.length - 1}
              className="p-1 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="后一天"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            {selectedIndex < allDates.length - 1 && allDates.length > 0 && (
              <button
                type="button"
                onClick={() => onSelectDate(allDates[allDates.length - 1])}
                className="px-1.5 py-0.5 text-[10px] font-bold rounded-lg bg-indigo-500 text-white ml-0.5 cursor-pointer shadow-sm"
                title="回到最新今天"
              >
                今天
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 md:gap-3">
        {displayDates.map((date) => {
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

    <CalendarDatePickerModal
      isOpen={isCalendarOpen}
      onClose={() => setIsCalendarOpen(false)}
      selectedDate={selectedDate}
      availableDates={allDates}
      onSelectDate={onSelectDate}
      title="综合看板 · 历史数据日期选择"
    />
    </>
  );
};
