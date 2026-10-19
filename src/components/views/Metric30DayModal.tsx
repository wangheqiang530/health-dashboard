import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export interface Metric30DayModalData {
  title: string;
  unit: string;
  current: string;
  eval: string;
  standard: string;
  points: { date: string; value: number }[];
  periodLabel?: string;
}

interface Metric30DayModalProps {
  data: Metric30DayModalData | null;
  onClose: () => void;
}

export const Metric30DayModal: React.FC<Metric30DayModalProps> = ({ data, onClose }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  if (!data) return null;

  const pts = data.points;
  const vals = pts.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const w = 480;
  const h = 130;
  const coords = pts.map((p, idx) => ({
    x: 20 + (idx / Math.max(pts.length - 1, 1)) * (w - 40),
    y: h - 15 - ((p.value - min) / range) * (h - 30),
  }));

  const pathD = coords.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`, '');

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 md:p-8 z-10 border shadow-2xl backdrop-blur-2xl ${
            isDark
              ? 'bg-[#11141b]/95 border-white/10 text-white'
              : 'bg-white/95 border-black/10 text-neutral-900'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`absolute top-5 right-5 p-2 rounded-full transition-all cursor-pointer ${
              isDark
                ? 'bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white'
                : 'bg-black/5 hover:bg-black/10 text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              体脂秤深度医学趋势分析
            </span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white mb-1">
            {data.title} · {data.periodLabel || '最近 30 日'}连续走势
          </h2>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-3xl font-black font-mono text-amber-400">{data.current}</span>
            <span className="text-xs text-neutral-400">{data.unit}</span>
            <span className="text-xs text-neutral-400 ml-2">({data.eval})</span>
          </div>

          {/* 30-Day SVG Spline Chart */}
          <div className={`h-44 w-full rounded-2xl p-3 border mb-5 relative overflow-hidden ${
            isDark ? 'bg-black/40 border-white/10' : 'bg-black/[0.03] border-black/5'
          }`}>
            <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="modal30Grad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`${pathD} L ${coords[coords.length - 1].x} ${h} L ${coords[0].x} ${h} Z`} fill="url(#modal30Grad)" />
              <path d={pathD} fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
              {coords.map((c, i) => (
                <circle key={i} cx={c.x} cy={c.y} r="2.5" fill="#FFF" stroke="#F59E0B" strokeWidth="1.5" />
              ))}
            </svg>
            <div className="flex justify-between items-center text-[10px] text-neutral-400 font-mono mt-1 px-2">
              <span>最早 ({data.points[0]?.date})</span>
              <span>共 {data.points.length} 次实测</span>
              <span>最新 ({data.points[data.points.length - 1]?.date})</span>
            </div>
          </div>

          {/* 30-Day Statistics Grid */}
          <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
            <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/[0.05]">
              <span className="text-[10px] text-neutral-400 block mb-1">实测均值</span>
              <span className="text-base font-bold text-neutral-900 dark:text-white font-mono">
                {(data.points.reduce((a, b) => a + b.value, 0) / data.points.length).toFixed(1)} {data.unit}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/[0.05]">
              <span className="text-[10px] text-neutral-400 block mb-1">最高记录</span>
              <span className="text-base font-bold text-neutral-900 dark:text-white font-mono">
                {max} {data.unit}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/[0.05]">
              <span className="text-[10px] text-neutral-400 block mb-1">最低记录</span>
              <span className="text-base font-bold text-neutral-900 dark:text-white font-mono">
                {min} {data.unit}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/[0.05] text-[11px] text-neutral-600 dark:text-neutral-300">
            <span className="font-semibold text-neutral-900 dark:text-white block mb-0.5">数据说明</span>
            <span>{data.standard}。趋势仅来自体脂秤实测记录，不包含推断或补齐数据。</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
