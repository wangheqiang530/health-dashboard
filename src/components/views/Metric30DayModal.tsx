import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export interface Metric30DayModalData {
  title: string;
  unit: string;
  current: string;
  eval: string;
  standard: string;
  points: { date: string; value: number }[];
}

interface Metric30DayModalProps {
  data: Metric30DayModalData | null;
  onClose: () => void;
}

export const Metric30DayModal: React.FC<Metric30DayModalProps> = ({ data, onClose }) => {
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
          className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl apple-glass-dark p-6 md:p-8 z-10 border border-white/10 shadow-2xl text-white"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              体脂秤深度医学趋势分析
            </span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white mb-1">
            {data.title} · 最近 30 日连续走势
          </h2>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-3xl font-black font-mono text-amber-400">{data.current}</span>
            <span className="text-xs text-neutral-400">{data.unit}</span>
            <span className="text-xs text-neutral-400 ml-2">({data.eval})</span>
          </div>

          {/* 30-Day SVG Spline Chart */}
          <div className="h-44 w-full bg-black/40 rounded-2xl p-3 border border-white/10 mb-5 relative overflow-hidden">
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
              <span>30天前 ({data.points[0]?.date})</span>
              <span>15天前</span>
              <span>今天 ({data.points[data.points.length - 1]?.date})</span>
            </div>
          </div>

          {/* 30-Day Statistics Grid */}
          <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
              <span className="text-[10px] text-neutral-400 block mb-1">30日均值</span>
              <span className="text-base font-bold text-white font-mono">
                {(data.points.reduce((a, b) => a + b.value, 0) / data.points.length).toFixed(1)} {data.unit}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
              <span className="text-[10px] text-neutral-400 block mb-1">30日最高</span>
              <span className="text-base font-bold text-white font-mono">
                {max} {data.unit}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
              <span className="text-[10px] text-neutral-400 block mb-1">30日最低</span>
              <span className="text-base font-bold text-white font-mono">
                {min} {data.unit}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.05] text-[11px] text-neutral-300">
            <span className="font-semibold text-white block mb-0.5">参考标准评估与医学建议</span>
            <span>{data.standard}。当前指标长期保持高度稳定，与高强度运动及规律作息完美正相关。</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};