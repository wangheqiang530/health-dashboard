import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Check,
  Eye,
  EyeOff,
  RotateCcw,
  Scale,
  X,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export interface BodySectionConfig {
  id: string;
  name: string;
  desc: string;
  visible: boolean;
  group?: 'section' | 'metric';
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

  const moveItem = (
    index: number,
    direction: 'up' | 'down' | 'top' | 'bottom'
  ) => {
    const item = sections[index];
    if (!item) return;
    const group = item.group || 'section';
    const groupIndices = sections
      .map((section, sectionIndex) => ({ section, sectionIndex }))
      .filter(({ section }) => (section.group || 'section') === group)
      .map(({ sectionIndex }) => sectionIndex);
    const currentPosition = groupIndices.indexOf(index);
    let targetPosition = currentPosition;
    if (direction === 'top') targetPosition = 0;
    else if (direction === 'bottom') targetPosition = groupIndices.length - 1;
    else if (direction === 'up') targetPosition = currentPosition - 1;
    else if (direction === 'down') targetPosition = currentPosition + 1;

    if (
      currentPosition < 0 ||
      targetPosition < 0 ||
      targetPosition >= groupIndices.length ||
      targetPosition === currentPosition
    ) {
      return;
    }

    const targetItem = sections[groupIndices[targetPosition]];
    const updated = [...sections];
    const [moved] = updated.splice(index, 1);
    const targetIndexAfterRemoval = updated.findIndex(
      (section) => section.id === targetItem.id
    );
    const insertAt =
      direction === 'down' || direction === 'bottom'
        ? targetIndexAfterRemoval + 1
        : targetIndexAfterRemoval;
    updated.splice(Math.max(0, insertAt), 0, moved);
    onChange(updated);
  };

  const toggleVisibility = (id: string) => {
    onChange(
      sections.map((item) =>
        item.id === id ? { ...item, visible: !item.visible } : item
      )
    );
  };

  const renderGroup = (group: 'section' | 'metric') => {
    const items = sections
      .map((section, index) => ({ section, index }))
      .filter(({ section }) => (section.group || 'section') === group);
    if (items.length === 0) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
            {group === 'section'
              ? '页面区块'
              : `指标卡片 · ${items.filter(({ section }) => section.visible).length}/${items.length} 显示`}
          </span>
        </div>
        {items.map(({ section: item, index }) => {
          const positionInGroup = items.findIndex(
            ({ section }) => section.id === item.id
          );
          return (
            <div
              key={item.id}
              className={`flex items-center justify-between gap-3 rounded-2xl border p-3 transition-all ${
                item.visible
                  ? isDark
                    ? 'border-white/10 bg-white/[0.04]'
                    : 'border-black/5 bg-black/[0.02]'
                  : 'border-black/5 bg-black/[0.03] opacity-55 dark:border-white/5 dark:bg-black/20'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold text-neutral-400">
                    {(index + 1).toString().padStart(2, '0')}
                  </span>
                  <span className="truncate text-xs font-bold text-neutral-900 dark:text-white">
                    {item.name}
                  </span>
                  {!item.visible && (
                    <span className="rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-600 dark:text-amber-300">
                      已隐藏
                    </span>
                  )}
                </div>
                <span className="mt-0.5 block truncate text-[10px] text-neutral-400">
                  {item.desc}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveItem(index, 'top')}
                  disabled={positionInGroup === 0}
                  className="rounded-lg border border-black/5 bg-black/[0.03] p-1.5 text-neutral-500 hover:bg-black/[0.06] disabled:cursor-not-allowed disabled:opacity-30 dark:border-white/10 dark:bg-white/[0.05] dark:text-neutral-300 dark:hover:bg-white/10"
                  title="置于本组顶部"
                >
                  <ArrowUpToLine className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(index, 'up')}
                  disabled={positionInGroup === 0}
                  className="rounded-lg border border-black/5 bg-black/[0.03] p-1.5 text-neutral-500 hover:bg-black/[0.06] disabled:cursor-not-allowed disabled:opacity-30 dark:border-white/10 dark:bg-white/[0.05] dark:text-neutral-300 dark:hover:bg-white/10"
                  title="上移"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(index, 'down')}
                  disabled={positionInGroup === items.length - 1}
                  className="rounded-lg border border-black/5 bg-black/[0.03] p-1.5 text-neutral-500 hover:bg-black/[0.06] disabled:cursor-not-allowed disabled:opacity-30 dark:border-white/10 dark:bg-white/[0.05] dark:text-neutral-300 dark:hover:bg-white/10"
                  title="下移"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(index, 'bottom')}
                  disabled={positionInGroup === items.length - 1}
                  className="rounded-lg border border-black/5 bg-black/[0.03] p-1.5 text-neutral-500 hover:bg-black/[0.06] disabled:cursor-not-allowed disabled:opacity-30 dark:border-white/10 dark:bg-white/[0.05] dark:text-neutral-300 dark:hover:bg-white/10"
                  title="置于本组底部"
                >
                  <ArrowDownToLine className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleVisibility(item.id)}
                  className="ml-1 rounded-lg border border-black/5 bg-black/[0.03] p-1.5 text-neutral-500 hover:bg-black/[0.06] dark:border-white/10 dark:bg-white/[0.05] dark:text-neutral-300 dark:hover:bg-white/10"
                  title={item.visible ? '隐藏' : '显示'}
                >
                  {item.visible ? (
                    <Eye className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-amber-500" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
        <motion.button
          type="button"
          aria-label="关闭身体详情编辑"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 14 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          role="dialog"
          aria-modal="true"
          aria-label="编辑身体详情卡片"
          className={`relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border shadow-2xl backdrop-blur-2xl ${
            isDark
              ? 'border-white/10 bg-[#11141b]/95 text-white'
              : 'border-black/10 bg-white/95 text-neutral-900'
          }`}
        >
          <div className="flex items-start justify-between gap-3 border-b border-black/5 px-5 py-4 dark:border-white/10 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
                <Scale className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">编辑身体详情卡片</h2>
                <p className="mt-0.5 text-[11px] text-neutral-400">
                  可调整页面区块和每个指标的先后顺序，并单独显示或隐藏。
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-black/5 p-2 text-neutral-500 hover:bg-black/10 dark:bg-white/10 dark:text-neutral-300 dark:hover:bg-white/20"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-5 overflow-y-auto p-5 sm:p-6">
            {renderGroup('section')}
            {renderGroup('metric')}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-black/5 px-5 py-4 dark:border-white/10 sm:px-6">
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1.5 rounded-xl bg-black/5 px-3 py-2 text-xs font-semibold text-neutral-600 hover:bg-black/10 dark:bg-white/10 dark:text-neutral-300 dark:hover:bg-white/15"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              恢复默认
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-neutral-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400"
            >
              <Check className="h-4 w-4" />
              完成并保存
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
