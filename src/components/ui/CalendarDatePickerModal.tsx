import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface CalendarDatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string; // YYYY-MM-DD
  availableDates: string[]; // YYYY-MM-DD list from database
  onSelectDate: (date: string) => void;
  title?: string;
}

export const CalendarDatePickerModal: React.FC<CalendarDatePickerModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  availableDates,
  onSelectDate,
  title = '选择健康记录日期',
}) => {
  const availableSet = new Set(availableDates);

  // Parse initial view year and month
  const initialDate = selectedDate || availableDates[availableDates.length - 1] || '2026-10-17';
  const [viewYear, setViewYear] = useState(() => parseInt(initialDate.slice(0, 4), 10) || 2026);
  const [viewMonth, setViewMonth] = useState(() => parseInt(initialDate.slice(5, 7), 10) || 10);

  if (!isOpen) return null;

  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Days in month calculation
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const firstDayWeekIndex = new Date(viewYear, viewMonth - 1, 1).getDay(); // 0 is Sunday

  const daysArray: (number | null)[] = [];
  for (let i = 0; i < firstDayWeekIndex; i++) {
    daysArray.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    daysArray.push(d);
  }

  const handleDayClick = (day: number) => {
    const dateStr = `${viewYear}-${viewMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    onSelectDate(dateStr);
    onClose();
  };

  const handleQuickJumpLatest = () => {
    const latest = availableDates[availableDates.length - 1];
    if (latest) {
      onSelectDate(latest);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Dialog Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', damping: 25, stiffness: 320 }}
          className="relative w-full max-w-md rounded-3xl apple-glass-dark p-6 z-10 border border-white/20 shadow-2xl text-white"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              {title}
            </span>
          </div>

          <div className="flex items-center justify-between mb-4">
            <span className="text-xl font-bold tracking-tight text-white font-mono">
              {viewYear}年 {viewMonth}月
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-neutral-200 hover:text-white transition-all cursor-pointer"
                title="上一月"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-neutral-200 hover:text-white transition-all cursor-pointer"
                title="下一月"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-neutral-400 font-semibold mb-2">
            <span>日</span>
            <span>一</span>
            <span>二</span>
            <span>三</span>
            <span>四</span>
            <span>五</span>
            <span>六</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1.5 text-center text-sm font-mono mb-5">
            {daysArray.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="h-10" />;
              }

              const dateStr = `${viewYear}-${viewMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
              const isSelected = selectedDate === dateStr;
              const hasData = availableSet.has(dateStr);

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={`relative h-10 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-tr from-rose-500 to-indigo-600 text-white font-black shadow-lg shadow-rose-500/30 ring-2 ring-white/50 scale-105'
                      : hasData
                        ? 'bg-white/10 hover:bg-white/20 text-white font-bold border border-white/10'
                        : 'text-neutral-500 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <span>{day}</span>
                  {hasData && !isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 -mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer Info & Quick Jump */}
          <div className="flex items-center justify-between pt-3 border-t border-white/10 text-xs">
            <div className="flex items-center gap-2 text-neutral-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>有健康记录 ({availableDates.length} 天)</span>
              </span>
            </div>
            <button
              type="button"
              onClick={handleQuickJumpLatest}
              className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-all cursor-pointer flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>跳转最新记录</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
