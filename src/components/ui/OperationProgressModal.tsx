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

const DETAIL_LABELS: Record<string, string> = {
  activeSuid: '当前档案 SUID',
  profileCount: '账号档案数',
  deviceCount: '绑定设备数',
  recentRecordCount: '最近记录数',
  archivePath: '原始归档路径',
  isFullSync: '同步方式',
  totalAccountRides: '账号活动总数',
  outputDirectory: 'FIT 文件目录',
  archiveWritable: '归档目录可写',
  lastReceivedAt: '最近接收时间',
  dateFrom: '数据起始日期',
  dateTo: '数据结束日期',
  metricCount: '健康指标数',
  workoutCount: '运动记录数',
  passwordConfigured: '密码已配置',
  filename: '文件名',
  startedAt: '开始时间',
  fileSizeBytes: '文件大小',
  days: '健康数据天数',
  importId: '导入任务 ID',
  dailySummaryCount: '日汇总天数',
  receivedCount: '云端读取数',
  savedCount: '成功入库数',
  autoIgnoredCount: '自动忽略数',
  ignoredCount: '已在忽略列表',
  retentionDays: '归档保留天数',
  deletedFiles: '清理文件数',
  freedBytes: '释放空间',
  totalFiles: '归档文件总数',
  connected: '数据库连接',
  source: '数据来源',
  configured: '代理已启用',
  proxyUrl: '地图代理地址',
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatDetailValue = (key: string, value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'isFullSync') {
    return value === true ? '全量同步（全部历史）' : '增量同步（按回看范围）';
  }
  if (key === 'archiveWritable' || key === 'passwordConfigured' || key === 'connected') {
    return value === true ? '是' : '否';
  }
  if (
    typeof value === 'number' &&
    (key.endsWith('Bytes') || key === 'freedBytes' || key === 'archiveSizeBytes')
  ) {
    return formatBytes(value);
  }
  if (
    typeof value === 'number' &&
    (key.endsWith('Count') ||
      key === 'days' ||
      key === 'recordsCount' ||
      key === 'deletedFiles' ||
      key === 'totalFiles' ||
      key === 'retentionDays')
  ) {
    return value.toLocaleString('zh-CN');
  }
  if (
    typeof value === 'string' &&
    (key === 'startedAt' ||
      key === 'lastReceivedAt' ||
      key.endsWith('At')) &&
    !Number.isNaN(new Date(value).getTime())
  ) {
    return new Intl.DateTimeFormat('zh-CN', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(new Date(value));
  }
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const detailLabel = (key: string): string =>
  DETAIL_LABELS[key] || `业务参数（${key}）`;

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
              <p className="mb-1.5 text-[9px] text-neutral-500">
                参数已转换为中文业务含义，SUID 与任务 ID 保留原标识。
              </p>
              {Object.entries(state.details).map(([key, value]) => (
                <div key={key} className="flex items-start justify-between gap-4 py-1 text-[11px]">
                  <span className="shrink-0 text-neutral-400">{detailLabel(key)}</span>
                  <span className="break-all text-right text-neutral-100">
                    {formatDetailValue(key, value)}
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
