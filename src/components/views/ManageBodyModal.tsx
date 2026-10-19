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
  Scale,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export interface BodySectionConfig {
  id: string;
  name: string;
  desc: string;
  visible: boolean;
}

interface ManageBodyModalProps {
  isOpen: boolean;
  onClose: () => void;
  sections: BodySectionConfig[];
  onChange: (newSections: BodySectionConfig[]) => void;
  onReset: () => void;
}

export const ManageBodyModal: React.FC<ManageBodyModalProps> = ({
  isOpen,
  onClose,
  sections,
  onChange,
  onReset,
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  if (!isOpen) return null;

  const moveItem = (index: number, direction: 'up' | 'down' | 'top' | 'bottom') => {
    let newIdx = index;
    if (direction === 'top') newIdx = 0;
    else if (direction === 'bottom') newIdx = sections.length - 1;
    else if (direction === 'up') newIdx = index - 1;
    else if (direction === 'down') newIdx = index + 1;

    if (newIdx < 0 || newIdx >= sections.length || newIdx === index) return;
    const updated = [...sections];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIdx, 0, moved);
    onChange(updated);
  };

  const toggleVisibility = (id: string) => {
    onChange(sections.map((item) => (item.id === id ? { ...item, visible: !item.visible } : item)));
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
          className={`relative w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl p-6 md:p-8 z-10 border shadow-2xl backdrop-blur-2xl ${
            isDark
              ? 'bg-[#11141b]/95 border-white/10 text-white'
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
            <X className="w-5 h-5" />
          </button>

          {/* Modal Header */}
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/30">
              <Scale className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              身体详情 · 板块自定义与排序
            </span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white mb-1">
            身体详情板块排序与显示
          </h2>
          <p className="text-xs text-neutral-400 mb-5">
            可调整身体成分概览、8 维 BIA 核心指标、人体解剖节段分布图的排列先后，并支持自由显隐。
          </p>

          {/* Strip List */}
          <div className="space-y-2 mb-6">
            {sections.map((item, idx) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  item.visible
                    ? 'bg-white/[0.04] border-white/10 hover:border-white/20'
                    : 'bg-black/20 border-white/5 opacity-50'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-neutral-500">
                      {(idx + 1).toString().padStart(2, '0')}
                    </span>
                    <span className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                      {item.name}
                    </span>
                    {!item.visible && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        已隐藏
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-neutral-400 block mt-0.5 truncate">
                    {item.desc}
                  </span>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
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
                    disabled={idx === sections.length - 1}
                    className={`p-1.5 rounded-lg border transition-all ${
                      idx < sections.length - 1
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
                    disabled={idx === sections.length - 1}
                    className={`p-1.5 rounded-lg border text-[11px] font-semibold transition-all ${
                      idx < sections.length - 1
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
                    title={item.visible ? '隐藏此板块' : '显示此板块'}
                  >
                    {item.visible ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-amber-400" />}
                  </button>
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
              className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black shadow-lg shadow-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
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
