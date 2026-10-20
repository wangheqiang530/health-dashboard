import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarRange, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface DateRangePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fromDate: string;
  toDate: string;
  availableDates: string[];
  onApply: (fromDate: string, toDate: string) => void;
}

const toDateString = (year: number, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const DateRangePickerModal: React.FC<DateRangePickerModalProps> = ({
  isOpen,
  onClose,
  fromDate,
  toDate,
  availableDates,
  onApply,
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const initialDate = fromDate || toDate || availableDates.at(-1) || new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(fromDate);
  const [endDate, setEndDate] = useState(toDate);
  const [viewYear, setViewYear] = useState(Number(initialDate.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(Number(initialDate.slice(5, 7)));
  const [openPicker, setOpenPicker] = useState<'year' | 'month' | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const initial = fromDate || toDate || availableDates.at(-1) || new Date().toISOString().slice(0, 10);
    setStartDate(fromDate);
    setEndDate(toDate);
    setViewYear(Number(initial.slice(0, 4)));
    setViewMonth(Number(initial.slice(5, 7)));
    setOpenPicker(null);
  }, [availableDates, fromDate, isOpen, toDate]);

  const availableSet = useMemo(() => new Set(availableDates), [availableDates]);
  const availableYearSet = useMemo(
    () => new Set([...availableDates.map((date) => date.slice(0, 4)), String(viewYear)]),
    [availableDates, viewYear]
  );
  const availableYears = [...availableYearSet].sort((left, right) => right.localeCompare(left));
  const availableMonthSet = useMemo(
    () =>
      new Set(
        availableDates
          .filter((date) => date.startsWith(`${viewYear}-`))
          .map((date) => date.slice(5, 7))
      ),
    [availableDates, viewYear]
  );

  if (!isOpen) return null;

  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const firstWeekday = new Date(viewYear, viewMonth - 1, 1).getDay();
  const days: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  const handleDayClick = (date: string) => {
    if (!startDate || (startDate && endDate)) {
      setStartDate(date);
      setEndDate('');
      return;
    }
    if (date < startDate) {
      setEndDate(startDate);
      setStartDate(date);
      return;
    }
    setEndDate(date);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <motion.button
          type="button"
          aria-label="关闭日期区间选择"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-md"
        />
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          className={`relative z-10 w-full max-w-lg rounded-3xl border p-6 shadow-2xl ${
            isDark
              ? 'border-white/15 bg-[#11141b]/95 text-white'
              : 'border-black/10 bg-white/95 text-neutral-900'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 rounded-full bg-black/5 p-1.5 text-neutral-400 hover:text-neutral-900 dark:bg-white/10 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 p-1.5 text-sky-500">
              <CalendarRange className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">选择训练日期区间</h3>
              <p className="text-[10px] text-neutral-400">
                {startDate || '起始日期'} → {endDate || '结束日期'}
              </p>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <div className="relative flex items-center gap-1">
              <button
                type="button"
                onClick={() => setOpenPicker((current) => current === 'year' ? null : 'year')}
                className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-base font-bold font-mono hover:bg-black/5 dark:hover:bg-white/10"
              >
                {viewYear} 年
                <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
              </button>
              <button
                type="button"
                onClick={() => setOpenPicker((current) => current === 'month' ? null : 'month')}
                className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-base font-bold font-mono hover:bg-black/5 dark:hover:bg-white/10"
              >
                {viewMonth} 月
                <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
              </button>

              {openPicker === 'year' && (
                <div
                  className={`absolute left-0 top-full z-20 mt-1 max-h-60 w-36 overflow-y-auto rounded-2xl border p-1.5 shadow-2xl ${
                    isDark ? 'border-white/15 bg-[#171a21]' : 'border-black/10 bg-white'
                  }`}
                >
                  {availableYears.map((year) => {
                    const hasData = availableDates.some((date) => date.startsWith(`${year}-`));
                    return (
                      <button
                        key={year}
                        type="button"
                        onClick={() => {
                          setViewYear(Number(year));
                          const firstMonth = availableDates
                            .filter((date) => date.startsWith(`${year}-`))
                            .map((date) => Number(date.slice(5, 7)))
                            .sort((left, right) => left - right)[0];
                          if (firstMonth) setViewMonth(firstMonth);
                          setOpenPicker('month');
                        }}
                        className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-mono hover:bg-black/5 dark:hover:bg-white/10"
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
                  className={`absolute left-24 top-full z-20 mt-1 grid w-56 grid-cols-3 gap-1 rounded-2xl border p-2 shadow-2xl ${
                    isDark ? 'border-white/15 bg-[#171a21]' : 'border-black/10 bg-white'
                  }`}
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => {
                    const key = String(month).padStart(2, '0');
                    return (
                      <button
                        key={month}
                        type="button"
                        onClick={() => {
                          setViewMonth(month);
                          setOpenPicker(null);
                        }}
                        className="relative rounded-xl px-2 py-2 text-xs font-mono hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        {month} 月
                        {availableMonthSet.has(key) && (
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
                onClick={() => {
                  if (viewMonth === 1) {
                    setViewYear((year) => year - 1);
                    setViewMonth(12);
                  } else {
                    setViewMonth((month) => month - 1);
                  }
                }}
                className="rounded-xl bg-black/5 p-1.5 dark:bg-white/10"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (viewMonth === 12) {
                    setViewYear((year) => year + 1);
                    setViewMonth(1);
                  } else {
                    setViewMonth((month) => month + 1);
                  }
                }}
                className="rounded-xl bg-black/5 p-1.5 dark:bg-white/10"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mb-2 grid grid-cols-7 text-center text-[10px] font-semibold text-neutral-400">
            {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="mb-4 grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              if (day === null) return <div key={`empty-${index}`} className="h-9" />;
              const date = toDateString(viewYear, viewMonth, day);
              const inRange =
                Boolean(startDate) &&
                Boolean(endDate) &&
                date >= startDate &&
                date <= endDate;
              const isBoundary = date === startDate || date === endDate;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => handleDayClick(date)}
                  className={`relative h-9 rounded-xl text-xs font-mono transition-colors ${
                    isBoundary
                      ? 'bg-sky-500 font-bold text-white'
                      : inRange
                        ? 'bg-sky-500/15 text-sky-600 dark:text-sky-300'
                        : 'hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  {day}
                  {availableSet.has(date) && (
                    <span
                      className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${
                        isBoundary ? 'bg-white' : 'bg-emerald-400'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-black/5 pt-3 dark:border-white/10">
            <button
              type="button"
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs text-neutral-400 hover:text-rose-500"
            >
              清除区间
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-9 rounded-xl bg-black/5 px-3 text-xs font-semibold dark:bg-white/10"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  onApply(startDate, endDate || startDate);
                  onClose();
                }}
                className="h-9 rounded-xl bg-sky-500 px-4 text-xs font-semibold text-white hover:bg-sky-600"
              >
                应用区间
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
