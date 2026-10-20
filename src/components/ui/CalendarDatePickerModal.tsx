import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface CalendarDatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string; // YYYY-MM-DD
  availableDates: string[]; // YYYY-MM-DD list from database
  onSelectDate: (date: string) => void;
  title?: string;
  footer?: React.ReactNode;
  closeOnSelect?: boolean;
}

export const CalendarDatePickerModal: React.FC<CalendarDatePickerModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  availableDates,
  onSelectDate,
  title = '选择健康记录日期',
  footer,
  closeOnSelect = true,
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const availableSet = new Set(availableDates);

  const initialDate =
    selectedDate ||
    availableDates[availableDates.length - 1] ||
    new Date().toISOString().slice(0, 10);
  const [viewYear, setViewYear] = useState(
    () => parseInt(initialDate.slice(0, 4), 10) || new Date().getFullYear()
  );
  const [viewMonth, setViewMonth] = useState(
    () => parseInt(initialDate.slice(5, 7), 10) || new Date().getMonth() + 1
  );
  const [openPicker, setOpenPicker] = useState<'year' | 'month' | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const initial = selectedDate || availableDates[availableDates.length - 1];
    if (!initial) return;
    setViewYear(parseInt(initial.slice(0, 4), 10) || new Date().getFullYear());
    setViewMonth(parseInt(initial.slice(5, 7), 10) || new Date().getMonth() + 1);
  }, [availableDates, isOpen, selectedDate]);

  if (!isOpen) return null;

  const availableYearSet = new Set(availableDates.map((date) => date.slice(0, 4)));
  availableYearSet.add(String(viewYear));
  const availableYears = [...availableYearSet].sort((left, right) =>
    right.localeCompare(left)
  );
  const availableMonthSet = new Set(
    availableDates
      .filter((date) => date.startsWith(`${viewYear}-`))
      .map((date) => date.slice(5, 7))
  );

  const selectYear = (year: number) => {
    setViewYear(year);
    const months = availableDates
      .filter((date) => date.startsWith(`${year}-`))
      .map((date) => Number(date.slice(5, 7)))
      .filter((month) => Number.isFinite(month));
    const closestMonth = months.includes(viewMonth)
      ? viewMonth
      : months.sort((left, right) => left - right)[0] || viewMonth;
    setViewMonth(closestMonth);
    setOpenPicker('month');
  };

  const prevMonth = () => {
    setOpenPicker(null);
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    setOpenPicker(null);
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
    if (closeOnSelect) onClose();
  };

  const handleQuickJumpLatest = () => {
    const latest = availableDates[availableDates.length - 1];
    if (latest) {
      onSelectDate(latest);
      if (closeOnSelect) onClose();
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
          className={`relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl p-6 z-10 border shadow-2xl backdrop-blur-2xl ${
            isDark
              ? 'bg-[#11141b]/95 border-white/20 text-white'
              : 'bg-white/95 border-black/10 text-neutral-900'
          }`}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className={`absolute top-5 right-5 p-2 rounded-full transition-all cursor-pointer ${
              isDark
                ? 'bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white'
                : 'bg-black/5 hover:bg-black/10 text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-300 uppercase tracking-wider">
              {title}
            </span>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="relative flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setOpenPicker((current) => current === 'year' ? null : 'year')}
                className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-lg font-bold font-mono transition-colors ${
                  isDark
                    ? 'hover:bg-white/10 text-white'
                    : 'hover:bg-black/5 text-neutral-900'
                }`}
              >
                {viewYear}年
                <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
              </button>
              <button
                type="button"
                onClick={() => setOpenPicker((current) => current === 'month' ? null : 'month')}
                className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-lg font-bold font-mono transition-colors ${
                  isDark
                    ? 'hover:bg-white/10 text-white'
                    : 'hover:bg-black/5 text-neutral-900'
                }`}
              >
                {viewMonth}月
                <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
              </button>

              {openPicker === 'year' && (
                <div
                  className={`absolute left-0 top-full z-30 mt-1 max-h-64 w-36 overflow-y-auto rounded-2xl border p-1.5 shadow-2xl ${
                    isDark
                      ? 'border-white/15 bg-[#171a21]'
                      : 'border-black/10 bg-white'
                  }`}
                >
                  {availableYears.map((year) => {
                    const hasData = availableDates.some((date) => date.startsWith(`${year}-`));
                    return (
                      <button
                        key={year}
                        type="button"
                        onClick={() => selectYear(Number(year))}
                        className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-mono ${
                          Number(year) === viewYear
                            ? 'bg-sky-500/15 text-sky-500'
                            : isDark
                              ? 'text-neutral-200 hover:bg-white/10'
                              : 'text-neutral-700 hover:bg-black/5'
                        }`}
                      >
                        <span>{year} 年</span>
                        {hasData && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {openPicker === 'month' && (
                <div
                  className={`absolute left-24 top-full z-30 mt-1 grid w-56 grid-cols-3 gap-1 rounded-2xl border p-2 shadow-2xl ${
                    isDark
                      ? 'border-white/15 bg-[#171a21]'
                      : 'border-black/10 bg-white'
                  }`}
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => {
                    const key = String(month).padStart(2, '0');
                    const hasData = availableMonthSet.has(key);
                    return (
                      <button
                        key={month}
                        type="button"
                        onClick={() => {
                          setViewMonth(month);
                          setOpenPicker(null);
                        }}
                        className={`relative rounded-xl px-2 py-2 text-xs font-mono ${
                          month === viewMonth
                            ? 'bg-sky-500/15 text-sky-500'
                            : isDark
                              ? 'text-neutral-200 hover:bg-white/10'
                              : 'text-neutral-700 hover:bg-black/5'
                        }`}
                      >
                        {month} 月
                        {hasData && (
                          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={prevMonth}
                className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                  isDark
                    ? 'bg-white/10 hover:bg-white/20 text-neutral-200 hover:text-white'
                    : 'bg-black/5 hover:bg-black/10 text-neutral-600 hover:text-neutral-900'
                }`}
                title="上一月"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                  isDark
                    ? 'bg-white/10 hover:bg-white/20 text-neutral-200 hover:text-white'
                    : 'bg-black/5 hover:bg-black/10 text-neutral-600 hover:text-neutral-900'
                }`}
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
                  onClick={() => hasData && handleDayClick(day)}
                  disabled={!hasData}
                  title={hasData ? `选择 ${dateStr}` : `${dateStr} 无健康记录`}
                  className={`relative h-10 rounded-2xl flex flex-col items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-gradient-to-tr from-rose-500 to-indigo-600 text-white font-black shadow-lg shadow-rose-500/30 ring-2 ring-white/50 scale-105'
                      : hasData
                        ? isDark
                          ? 'bg-white/10 hover:bg-white/20 text-white font-bold border border-white/10 cursor-pointer'
                          : 'bg-black/5 hover:bg-black/10 text-neutral-900 font-bold border border-black/5 cursor-pointer'
                        : isDark
                          ? 'text-neutral-600 border border-transparent cursor-not-allowed'
                          : 'text-neutral-300 border border-transparent cursor-not-allowed'
                  }`}
                >
                  <span>{day}</span>
                  {hasData && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full -mt-0.5 ${
                        isSelected ? 'bg-white shadow-sm' : 'bg-emerald-400'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {footer && (
            <div className="mb-3 rounded-2xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-3">
              {footer}
            </div>
          )}

          {/* Footer Info & Quick Jump */}
          <div className="flex items-center justify-between pt-3 border-t border-black/5 dark:border-white/10 text-xs">
            <div className="flex items-center gap-2 text-neutral-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>有健康记录 ({availableDates.length} 天)</span>
              </span>
            </div>
            <button
              type="button"
              onClick={handleQuickJumpLatest}
              className={`px-3 py-1 rounded-xl font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                isDark
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : 'bg-black/5 hover:bg-black/10 text-neutral-900'
              }`}
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
