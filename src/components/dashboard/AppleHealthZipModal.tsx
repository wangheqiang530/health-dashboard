import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  createAppleHealthZipTask,
  fetchAppleHealthZipTask,
  uploadAppleHealthZipTask,
  type AppleHealthZipImportResult,
  type AppleHealthZipTask,
} from '../../api/healthApi';
import {
  X,
  UploadCloud,
  FileArchive,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
  FolderArchive,
} from 'lucide-react';

interface AppleHealthZipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

const TASK_STORAGE_KEY = 'health_dashboard_apple_zip_task_id';
const ACTIVE_TASK_STATUSES = new Set<AppleHealthZipTask['status']>([
  'queued',
  'running',
  'stalled',
]);

const STAGE_NAMES: Record<string, string> = {
  upload: '上传 ZIP',
  queued: '等待后台任务',
  archiving: '保存原始归档',
  extracting: '解压与提取文件',
  parsing: '解析 XML 与写入原始层',
  workouts: '训练记录入库',
  daily_summaries: '生成每日汇总',
  finalizing: '收尾与提交事务',
};

const readSavedTaskId = (): string | null => {
  try {
    return window.localStorage.getItem(TASK_STORAGE_KEY);
  } catch {
    return null;
  }
};

const saveTaskId = (taskId: string): void => {
  try {
    window.localStorage.setItem(TASK_STORAGE_KEY, taskId);
  } catch {
    // Private browsing may reject storage; the active in-memory task still works.
  }
};

const clearSavedTaskId = (): void => {
  try {
    window.localStorage.removeItem(TASK_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
};

const formatElapsed = (milliseconds: number): string => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes} 分 ${remainder} 秒`;
};

export const AppleHealthZipModal: React.FC<AppleHealthZipModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(() => readSavedTaskId());
  const [task, setTask] = useState<AppleHealthZipTask | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [uploadLoaded, setUploadLoaded] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadStartedAt, setUploadStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const successNotifiedRef = useRef(false);

  const isActiveTask = Boolean(task && ACTIVE_TASK_STATUSES.has(task.status));
  const isBusy = isUploading || isActiveTask;
  const resultSummary =
    task?.status === 'success' ? (task.result as AppleHealthZipImportResult | null) : null;
  const stalled = task?.status === 'stalled' || Boolean(task?.stalled);
  const activeStartedAt = task?.startedAt
    ? new Date(task.startedAt).getTime()
    : uploadStartedAt;
  const elapsedMs = activeStartedAt ? Math.max(0, now - activeStartedAt) : 0;
  const uploadRatio =
    uploadTotal > 0 ? Math.min(1, Math.max(0, uploadLoaded / uploadTotal)) : 0;
  const displayProgress = isUploading
    ? Math.max(task?.progress || 0, 1 + uploadRatio * 7)
    : task?.progress || 0;
  const displayStage = isUploading
    ? '正在上传 ZIP 文件'
    : task?.stageLabel || '等待开始';
  const displayBytesProcessed = isUploading
    ? uploadLoaded
    : task?.bytesProcessed || 0;
  const displayBytesTotal = isUploading
    ? uploadTotal
    : task?.bytesTotal || task?.fileSizeBytes || 0;

  useEffect(() => {
    if (!isOpen || (!isBusy && !isRestoring)) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isBusy, isOpen, isRestoring]);

  useEffect(() => {
    if (!isOpen) return;
    const savedTaskId = readSavedTaskId();
    if (!savedTaskId) return;

    let cancelled = false;
    // The saved task ID must be reflected immediately when restoring a background task.
    // oxlint-disable-next-line react/set-state-in-effect
    setTaskId(savedTaskId);
    // oxlint-disable-next-line react/set-state-in-effect
    setIsRestoring(true);
    void fetchAppleHealthZipTask(savedTaskId)
      .then((nextTask) => {
        if (!cancelled) setTask(nextTask);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : '恢复导入任务状态失败。';
        if (message.includes('未找到')) {
          clearSavedTaskId();
          setTaskId(null);
          setTask(null);
        } else {
          setErrorMsg(message);
        }
      })
      .finally(() => {
        if (!cancelled) setIsRestoring(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !taskId || !task || !ACTIVE_TASK_STATUSES.has(task.status)) return;

    let cancelled = false;
    let timer = 0;
    const delay = task.status === 'stalled' ? 3000 : 1200;
    const poll = async () => {
      try {
        const nextTask = await fetchAppleHealthZipTask(taskId);
        if (!cancelled) setTask(nextTask);
      } catch (error) {
        if (!cancelled) {
          setErrorMsg(
            error instanceof Error ? error.message : '查询导入任务进度失败。'
          );
        }
      } finally {
        if (!cancelled) timer = window.setTimeout(poll, delay);
      }
    };
    timer = window.setTimeout(poll, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, task, taskId]);

  useEffect(() => {
    if (!task) return;
    if (task.status === 'success' && task.result) {
      if (!successNotifiedRef.current) {
        successNotifiedRef.current = true;
        onImportSuccess();
      }
    } else if (task.status === 'failed') {
      const stageName = task.failedStage
        ? STAGE_NAMES[task.failedStage] || task.failedStage
        : '导入过程';
      // Surface the persisted task error in the visible modal as soon as polling receives it.
      // oxlint-disable-next-line react/set-state-in-effect
      setErrorMsg(
        `${stageName}失败：${task.errorMessage || '未知错误'}`
      );
    }
  }, [onImportSuccess, task]);

  if (!isOpen) return null;

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const resetTaskState = (clearFile = false) => {
    clearSavedTaskId();
    setTaskId(null);
    setTask(null);
    setErrorMsg(null);
    setIsUploading(false);
    setUploadLoaded(0);
    setUploadTotal(0);
    setUploadStartedAt(null);
    successNotifiedRef.current = false;
    if (clearFile) setSelectedFile(null);
  };

  const handleFile = (file: File) => {
    if (isBusy) return;
    if (task && !ACTIVE_TASK_STATUSES.has(task.status)) {
      resetTaskState();
    }
    setErrorMsg(null);
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setErrorMsg(
        '请选择有效的 .zip 压缩包 (例如 iPhone 导出的 导出.zip 或 export.zip)'
      );
      return;
    }
    setSelectedFile(file);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    if (isBusy) return;
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleUploadAndProcess = async () => {
    if (!selectedFile || isBusy) return;

    const startedAt = Date.now();
    let createdTask: AppleHealthZipTask | null = null;
    successNotifiedRef.current = false;
    setErrorMsg(null);
    setUploadStartedAt(startedAt);
    setUploadLoaded(0);
    setUploadTotal(selectedFile.size);
    setIsUploading(true);

    try {
      createdTask = await createAppleHealthZipTask({
        fileName: selectedFile.name,
        fileSizeBytes: selectedFile.size,
      });
      setTaskId(createdTask.id);
      setTask(createdTask);
      saveTaskId(createdTask.id);

      const uploadedTask = await uploadAppleHealthZipTask(
        createdTask.id,
        selectedFile,
        ({ loaded, total }) => {
          setUploadLoaded(loaded);
          setUploadTotal(total);
          setTask((current) =>
            current
              ? {
                  ...current,
                  stage: 'upload',
                  stageLabel: '正在上传 ZIP 文件',
                  progress: 1 + (total > 0 ? Math.min(1, loaded / total) : 0) * 7,
                  bytesProcessed: loaded,
                  bytesTotal: total,
                }
              : current
          );
        }
      );
      setTask(uploadedTask);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message === 'UNAUTHORIZED'
            ? '登录会话已失效，请重新输入面板密码。'
            : error.message
          : '上传或启动导入任务失败。';
      setErrorMsg(message);
      if (createdTask) {
        const latest = await fetchAppleHealthZipTask(createdTask.id).catch(() => null);
        if (latest) setTask(latest);
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative z-10 max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/15 bg-[#11141b]/96 p-6 text-white shadow-2xl backdrop-blur-2xl md:p-8"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-neutral-300 transition-all hover:bg-white/20 hover:text-white"
            aria-label="关闭 Apple Health ZIP 导入窗口"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mb-2 flex items-center gap-2">
            <div className="rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 p-1.5 text-white shadow-md">
              <FileArchive className="h-4 w-4" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              iOS 健康 App · 官方导出包导入
            </span>
          </div>

          <h2 className="mb-2 text-2xl font-bold tracking-tight text-white">
            导入 Apple Health 完整 ZIP 导出包
          </h2>
          <p className="mb-5 text-xs leading-relaxed text-neutral-400">
            支持直接上传 iPhone「健康」App 导出的{' '}
            <code className="font-mono text-amber-300">导出.zip</code> 或{' '}
            <code className="font-mono text-amber-300">export.zip</code>。上传完成后由后台任务继续解压、解析与入库，关闭窗口或刷新页面不会丢失任务状态。
          </p>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              if (!isBusy) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => {
              if (!isBusy) fileInputRef.current?.click();
            }}
            className={`mb-4 rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
              isBusy
                ? 'cursor-default border-white/10 bg-white/[0.01] opacity-60'
                : isDragging
                  ? 'cursor-pointer border-amber-400 bg-amber-500/10'
                  : selectedFile
                    ? 'cursor-pointer border-emerald-500/60 bg-emerald-500/5'
                    : 'cursor-pointer border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".zip,application/zip"
              disabled={isBusy}
              className="hidden"
            />
            {selectedFile ? (
              <div className="flex flex-col items-center">
                <div className="mb-2 rounded-2xl bg-emerald-500/15 p-3 text-emerald-400">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <span className="block text-sm font-bold text-white">
                  {selectedFile.name}
                </span>
                <span className="mt-0.5 font-mono text-xs text-neutral-400">
                  文件大小：{formatBytes(selectedFile.size)}
                  {!isBusy && ' · 点击可重新选择'}
                </span>
              </div>
            ) : (
              <>
                <UploadCloud className="mx-auto mb-2 h-8 w-8 text-neutral-400" />
                <span className="block text-sm font-semibold text-white">
                  点击选择文件，或将 导出.zip 拖拽至此处
                </span>
                <span className="mt-1 block text-xs text-neutral-400">
                  支持任何版本的 iOS 苹果健康官方完整导出压缩包
                </span>
              </>
            )}
          </div>

          {(isRestoring || isBusy) && (
            <div
              className={`mb-4 rounded-2xl border p-3.5 text-xs ${
                stalled
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                  : 'border-indigo-500/25 bg-indigo-500/10 text-indigo-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {stalled ? (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                ) : (
                  <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-semibold">
                      {isRestoring ? '正在恢复后台导入任务…' : displayStage}
                    </span>
                    <span className="font-mono text-[10px]">
                      {Math.round(displayProgress)}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ${
                        stalled
                          ? 'bg-amber-400'
                          : 'bg-gradient-to-r from-sky-500 to-indigo-500'
                      }`}
                      style={{ width: `${displayProgress}%` }}
                    />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[10px] text-neutral-400 sm:grid-cols-4">
                    <span>
                      阶段：{STAGE_NAMES[task?.stage || ''] || task?.stage || '上传'}
                    </span>
                    <span>
                      记录：
                      {task?.totalCount
                        ? `${task.processedCount.toLocaleString()} / ${task.totalCount.toLocaleString()}`
                        : task?.processedCount
                          ? task.processedCount.toLocaleString()
                          : '—'}
                    </span>
                    <span>
                      数据：
                      {displayBytesTotal > 0
                        ? `${formatBytes(displayBytesProcessed)} / ${formatBytes(displayBytesTotal)}`
                        : formatBytes(displayBytesProcessed)}
                    </span>
                    <span>耗时：{formatElapsed(elapsedMs)}</span>
                  </div>
                  {task?.updatedAt && (
                    <span className="mt-1 block font-mono text-[9px] text-neutral-500">
                      最后更新：
                      {new Intl.DateTimeFormat('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false,
                      }).format(new Date(task.updatedAt))}
                    </span>
                  )}
                </div>
              </div>
              {stalled && (
                <p className="mt-2 border-t border-amber-400/15 pt-2 text-[10px] leading-relaxed">
                  任务可能停滞：进度长时间没有更新。系统仍在查询后台状态，不会继续虚增百分比。
                </p>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/15 p-3.5 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {resultSummary && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs"
            >
              <div className="flex items-center gap-2 font-bold text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>导入与本地归档完成！PostgreSQL 数据已就绪</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-neutral-300 sm:grid-cols-4">
                <div className="rounded-xl bg-black/25 p-2.5">
                  <span className="block text-[10px] text-neutral-400">导入健康天数</span>
                  <span className="text-sm font-bold text-white">
                    {resultSummary.importedDays} 天
                  </span>
                  <span className="block truncate text-[10px] text-neutral-400">
                    {resultSummary.earliestDate} 至 {resultSummary.latestDate}
                  </span>
                </div>
                <div className="rounded-xl bg-black/25 p-2.5">
                  <span className="block text-[10px] text-neutral-400">识别体能训练</span>
                  <span className="text-sm font-bold text-[#A1FF00]">
                    {resultSummary.totalWorkouts} 场运动
                  </span>
                  <span className="block text-[10px] text-neutral-400">
                    含心率/距离/GPX
                  </span>
                </div>
                <div className="rounded-xl bg-black/25 p-2.5">
                  <span className="block text-[10px] text-neutral-400">原始对象</span>
                  <span className="text-sm font-bold text-amber-400">
                    {resultSummary.rawRecordCount.toLocaleString()} 条
                  </span>
                  <span className="block text-[10px] text-neutral-400">
                    标准化 {resultSummary.normalizedRecordCount.toLocaleString()} 条
                  </span>
                </div>
                <div className="rounded-xl bg-black/25 p-2.5">
                  <span className="block text-[10px] text-neutral-400">本地持久化备份</span>
                  <span className="text-sm font-bold text-emerald-400">永久保留</span>
                  <span className="block text-[10px] text-neutral-400">
                    {formatBytes(resultSummary.archiveSizeBytes)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 border-t border-white/10 pt-1 text-[10px] text-neutral-400">
                <FolderArchive className="h-3.5 w-3.5 text-amber-400" />
                <span className="truncate">归档路径：{resultSummary.archivePath}</span>
              </div>
            </motion.div>
          )}

          <div className="mb-5 flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-[11px] text-neutral-400">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>
              纯本地隐私存储：原始压缩包默认永久保留；只有手动清理或显式修改保留策略后才会删除。
            </span>
          </div>

          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-neutral-300 transition-all hover:bg-white/15 hover:text-white"
            >
              {isBusy ? '后台继续运行' : resultSummary ? '关闭' : '取消'}
            </button>
            {!isBusy && (resultSummary || task?.status === 'failed') && (
              <button
                type="button"
                onClick={() => resetTaskState(true)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-neutral-200 transition-all hover:bg-white/10"
              >
                开始新的导入
              </button>
            )}
            {!isBusy && !resultSummary && task?.status !== 'failed' && (
              <button
                type="button"
                onClick={handleUploadAndProcess}
                disabled={!selectedFile}
                className={`flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-semibold transition-all ${
                  selectedFile
                    ? 'cursor-pointer bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 text-white shadow-lg shadow-rose-500/25 hover:brightness-110'
                    : 'cursor-not-allowed bg-white/5 text-neutral-500'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>开始后台导入</span>
                <ArrowRight className="ml-0.5 h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
