import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpToLine,
  ArrowDownToLine,
  Eye,
  EyeOff,
  RotateCcw,
  Check,
  LineChart,
  BarChart3,
  SlidersHorizontal,
} from 'lucide-react';

export type ChartType = 'line' | 'bar';

export interface TrendMetricItemConfig {
  id: string;
  name: string;
  visible: boolean;
  chartType: ChartType;
}

interface ManageTrendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: TrendMetricItemConfig[];
  onChange: (newConfig: TrendMetricItemConfig[]) => void;
  onReset: () => void;
}

export const ManageTrendsModal: React.FC<ManageTrendsModalProps> = ({
  isOpen,
  onClose,
  config,
  onChange,
  onReset,
}) => {
  if (!isOpen) return null;

  const moveItem = (index: number, direction: 'up' | 'down' | 'top' | 'bottom') => {
    let newIdx = index;
    if (direction === 'top') newIdx = 0;
    else if (direction === 'bottom') newIdx = config.length - 1;
    else if (direction === 'up') newIdx = index - 1;
    else if (direction === 'down') newIdx = index + 1;

    if (newIdx < 0 || newIdx >= config.length || newIdx === index) return;
    const updated = [...config];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIdx, 0, moved);
    onChange(updated);
  };

  const toggleVisibility = (id: string) => {
    onChange(config.map((item) => (item.id === id ? { ...item, visible: !item.visible } : item)));
  };

  const setMetricChartType = (id: string, type: ChartType) => {
    onChange(config.map((item) => (item.id === id ? { ...item, chartType: type } : item)));
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-md"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl apple-glass-dark p-6 md:p-8 z-10 border border-white/10 shadow-2xl text-white"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Modal Header */}
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              健康趋势 · 自定义指标与图表管理
            </span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white mb-1">
            趋势指标排序与图表样式
          </h2>
          <p className="text-xs text-neutral-400 mb-5">
            自由调整各项趋势的展现顺序，选择显示或隐藏指标，并为每一项指定「平滑折线图」或「柱状分布图」。
          </p>

          {/* Draggable/Reorderable Strip List */}
          <div className="space-y-2 mb-6">
            {config.map((item, idx) => (
              <div
                key={item.id}
                className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  item.visible
                    ? 'bg-white/[0.04] border-white/10 hover:border-white/20'
                    : 'bg-black/20 border-white/5 opacity-50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono text-xs font-bold text-neutral-500 w-5">
                    {(idx + 1).toString().padStart(2, '0')}
                  </span>
                  <span className="text-sm font-bold text-white truncate">
                    {item.name}
                  </span>
                  {!item.visible && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      已隐藏
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
                  {/* Chart Style Switcher */}
                  <div className="flex bg-black/40 p-0.5 rounded-xl border border-white/10 text-xs">
                    <button
                      type="button"
                      onClick={() => setMetricChartType(item.id, 'line')}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all cursor-pointer ${
                        item.chartType === 'line'
                          ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                      title="折线面积图"
                    >
                      <LineChart className="w-3.5 h-3.5" />
                      <span className="text-[11px]">折线</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMetricChartType(item.id, 'bar')}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all cursor-pointer ${
                        item.chartType === 'bar'
                          ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                      title="柱状分布图"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span className="text-[11px]">柱状</span>
                    </button>
                  </div>

                  {/* Move & Visibility Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveItem(idx, 'top')}
                      disabled={idx === 0}
                      className={`p-1.5 rounded-lg border text-[11px] font-semibold transition-all ${
                        idx > 0
                          ? 'bg-white/10 hover:bg-white/20 text-white border-white/10 cursor-pointer'
                          : 'opacity-30 cursor-not-allowed border-transparent text-neutral-500'
                      }`}
                      title="置顶"
                    >
                      <ArrowUpToLine className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(idx, 'up')}
                      disabled={idx === 0}
                      className={`p-1.5 rounded-lg border transition-all ${
                        idx > 0
                          ? 'bg-white/10 hover:bg-white/20 text-white border-white/10 cursor-pointer'
                          : 'opacity-30 cursor-not-allowed border-transparent text-neutral-500'
                      }`}
                      title="上移"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(idx, 'down')}
                      disabled={idx === config.length - 1}
                      className={`p-1.5 rounded-lg border transition-all ${
                        idx < config.length - 1
                          ? 'bg-white/10 hover:bg-white/20 text-white border-white/10 cursor-pointer'
                          : 'opacity-30 cursor-not-allowed border-transparent text-neutral-500'
                      }`}
                      title="下移"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(idx, 'bottom')}
                      disabled={idx === config.length - 1}
                      className={`p-1.5 rounded-lg border text-[11px] font-semibold transition-all ${
                        idx < config.length - 1
                          ? 'bg-white/10 hover:bg-white/20 text-white border-white/10 cursor-pointer'
                          : 'opacity-30 cursor-not-allowed border-transparent text-neutral-500'
                      }`}
                      title="置底"
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleVisibility(item.id)}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all cursor-pointer ml-1"
                      title={item.visible ? '隐藏此项' : '显示此项'}
                    >
                      {item.visible ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-amber-400" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onReset}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-neutral-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>恢复默认设置</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>完成并保存</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};