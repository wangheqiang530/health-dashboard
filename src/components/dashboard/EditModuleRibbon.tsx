import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpToLine, ArrowDownToLine, Eye, EyeOff } from 'lucide-react';
import type { DashboardModuleId } from '../../types/health';

interface EditModuleRibbonProps {
  id: DashboardModuleId;
  title: string;
  visible: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveTop: () => void;
  onMoveBottom: () => void;
  onToggleVisible: () => void;
}

export const EditModuleRibbon: React.FC<EditModuleRibbonProps> = ({
  title,
  visible,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onMoveTop,
  onMoveBottom,
  onToggleVisible,
}) => {
  return (
    <div className="flex items-center justify-between px-3.5 py-1.5 mb-2 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/30 text-xs">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
        <span className="font-bold text-indigo-600 dark:text-indigo-300">{title}</span>
        {!visible && <span className="text-[10px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">已隐藏</span>}
      </div>

      <div className="flex items-center gap-1">
        {/* Move to Top (置顶) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMoveTop();
          }}
          disabled={!canMoveUp}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-all ${
            canMoveUp
              ? 'bg-black/5 dark:bg-white/10 hover:bg-black/10 text-neutral-800 dark:text-white border-black/10 dark:border-white/10 cursor-pointer'
              : 'opacity-30 cursor-not-allowed border-transparent text-neutral-400'
          }`}
          title="置顶此模块"
        >
          <ArrowUpToLine className="w-3.5 h-3.5 text-indigo-500" />
          <span>置顶</span>
        </button>

        {/* Move Up */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp();
          }}
          disabled={!canMoveUp}
          className={`p-1.5 rounded-lg border transition-all ${
            canMoveUp
              ? 'bg-black/5 dark:bg-white/10 hover:bg-black/10 text-neutral-800 dark:text-white border-black/10 dark:border-white/10 cursor-pointer'
              : 'opacity-30 cursor-not-allowed border-transparent text-neutral-400'
          }`}
          title="上移此模块"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>

        {/* Move Down */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown();
          }}
          disabled={!canMoveDown}
          className={`p-1.5 rounded-lg border transition-all ${
            canMoveDown
              ? 'bg-black/5 dark:bg-white/10 hover:bg-black/10 text-neutral-800 dark:text-white border-black/10 dark:border-white/10 cursor-pointer'
              : 'opacity-30 cursor-not-allowed border-transparent text-neutral-400'
          }`}
          title="下移此模块"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>

        {/* Move to Bottom (置底) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMoveBottom();
          }}
          disabled={!canMoveDown}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-all ${
            canMoveDown
              ? 'bg-black/5 dark:bg-white/10 hover:bg-black/10 text-neutral-800 dark:text-white border-black/10 dark:border-white/10 cursor-pointer'
              : 'opacity-30 cursor-not-allowed border-transparent text-neutral-400'
          }`}
          title="置底此模块"
        >
          <ArrowDownToLine className="w-3.5 h-3.5 text-indigo-500" />
          <span>置底</span>
        </button>

        {/* Toggle Hide/Show */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisible();
          }}
          className="p-1.5 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 text-neutral-800 dark:text-white border border-black/10 dark:border-white/10 transition-all cursor-pointer ml-1"
          title={visible ? '隐藏此模块' : '显示此模块'}
        >
          {visible ? <Eye className="w-3.5 h-3.5 text-emerald-500" /> : <EyeOff className="w-3.5 h-3.5 text-amber-500" />}
        </button>
      </div>
    </div>
  );
};