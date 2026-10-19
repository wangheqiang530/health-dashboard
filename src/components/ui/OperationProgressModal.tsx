import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, LoaderCircle, X } from 'lucide-react';

export interface OperationProgressState {
  title: string;
  status: 'running' | 'success' | 'error';
  message?: string;
  detail?: string;
  startedAt: number;
  progress?: number | null;
  details?: Record<string, unknown>;
}

interface OperationProgressModalProps {
  state: OperationProgressState | null;
  onClose: () => void;
}

const formatElapsed = (milliseconds: number): string => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes} 分 ${remainder} 秒`;
};

export const OperationProgressModal: React.FC<OperationProgressModalProps> = ({
  state,
  onClose,
}) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!state || state.status !== 'running') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state]);

  if (!state) return null;

  const isRunning = state.status === 'running';
  const isSuccess = state.status === 'success';
  const progress = Math.min(100, Math.max(0, state.progress ?? 0));

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
        <motion.button
          type="button"
          aria-label="关闭操作浮窗"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 cursor-default bg-black/65 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          className="relative w-full max-w-md rounded-3xl border border-white/15 bg-[#11141b]/95 p-5 text-white shadow-2xl backdrop-blur-2xl"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-1.5 text-neutral-300 transition-colors hover:text-white"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>

          <div
            className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${
              isRunning
                ? 'bg-sky-500/15 text-sky-400'
                : isSuccess
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-rose-500/15 text-rose-400'
            }`}
          >
            {isRunning ? (
              <LoaderCircle className="h-5 w-5 animate-spin" />
            ) : isSuccess ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
          </div>

          <h3 className="pr-8 text-base font-bold">{state.title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-neutral-300">
            {state.message || (isRunning ? '正在处理，请稍候…' : isSuccess ? '操作完成。' : '操作失败。')}
          </p>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3">
            <div className="flex items-center justify-between text-[11px] text-neutral-400">
              <span>{isRunning ? '当前状态' : '处理结果'}</span>
              <span className="font-mono">
                {isRunning ? '进行中' : isSuccess ? '成功' : '失败'} · {formatElapsed(now - state.startedAt)}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className={`h-full rounded-full ${
                  isRunning
                    ? 'bg-gradient-to-r from-sky-500 to-indigo-500'
                    : isSuccess
                      ? 'bg-emerald-500'
                      : 'bg-rose-500'
                }`}
                initial={{ width: 0 }}
                animate={{
                  width: isRunning && state.progress == null ? '72%' : `${isSuccess ? 100 : progress}%`,
                }}
                transition={
                  isRunning && state.progress == null
                    ? { repeat: Infinity, repeatType: 'reverse', duration: 1.1 }
                    : { duration: 0.3 }
                }
              />
            </div>
            {state.detail && (
              <p className="mt-2 break-all font-mono text-[10px] leading-relaxed text-neutral-400">
                {state.detail}
              </p>
            )}
          </div>

          {state.details && Object.keys(state.details).length > 0 && (
            <div className="mt-3 max-h-40 overflow-y-auto rounded-2xl border border-white/10 bg-black/25 p-3">
              {Object.entries(state.details).map(([key, value]) => (
                <div key={key} className="flex items-start justify-between gap-4 py-1 text-[11px]">
                  <span className="font-mono text-neutral-400">{key}</span>
                  <span className="break-all text-right text-neutral-100">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-4 h-9 w-full rounded-xl bg-white text-xs font-semibold text-neutral-900 transition-colors hover:bg-neutral-100"
          >
            {isRunning ? '后台继续运行' : '关闭'}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
