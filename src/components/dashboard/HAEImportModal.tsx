import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseHealthAutoExportJSON } from '../../utils/haeParser';
import { importHaePayload } from '../../api/healthApi';
import type { DailySummary } from '../../types/health';
import {
  OperationProgressModal,
  type OperationProgressState,
} from '../ui/OperationProgressModal';
import {
  X,
  UploadCloud,
  FileJson,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

interface HAEImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (parsedDays: Record<string, DailySummary>, latestDate: string) => void;
}

export const HAEImportModal: React.FC<HAEImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [jsonText, setJsonText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [operation, setOperation] = useState<OperationProgressState | null>(null);
  const [rawPayload, setRawPayload] = useState<unknown>(null);
  const [parsedInfo, setParsedInfo] = useState<{
    days: Record<string, DailySummary>;
    dates: string[];
    totalWorkouts: number;
    totalDays: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessJSON = (content: string) => {
    setErrorMsg(null);
    try {
      const parsed = JSON.parse(content);
      const result = parseHealthAutoExportJSON(parsed);
      setRawPayload(parsed);
      setParsedInfo(result);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message || 'JSON 解析失败，请确认导出的文件内容完整。');
      } else {
        setErrorMsg('JSON 格式解析错误。');
      }
      setParsedInfo(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonText(content.slice(0, 500) + '... (已加载大文件)');
      handleProcessJSON(content);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonText(content.slice(0, 500) + '... (已加载大文件)');
      handleProcessJSON(content);
    };
    reader.readAsText(file);
  };

  const applyData = async () => {
    if (!parsedInfo) return;
    setIsApplying(true);
    setErrorMsg(null);
    const startedAt = Date.now();
    setOperation({
      title: '导入 HAE JSON 原始数据',
      status: 'running',
      message: '正在保存原始 JSON、逐点样本、训练记录与每日聚合…',
      startedAt,
    });
    try {
      if (!rawPayload) throw new Error('尚未读取到可导入的 JSON 内容。');
      const result = await importHaePayload(rawPayload);
      onImportSuccess(parsedInfo.days, result.dateTo);
      setOperation({
        title: '导入 HAE JSON 原始数据',
        status: 'success',
        message: `导入完成：${result.metricCount.toLocaleString()} 条指标、${result.workoutCount} 场训练。`,
        startedAt,
        details: {
          importId: result.importId,
          dateFrom: result.dateFrom,
          dateTo: result.dateTo,
          dailySummaryCount: result.dailySummaryCount,
          archivePath: result.archivePath,
        },
      });
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message === 'UNAUTHORIZED'
            ? '登录会话已失效，请重新输入面板密码。'
            : error.message
          : '写入数据库失败'
      );
      setOperation({
        title: '导入 HAE JSON 原始数据',
        status: 'error',
        message:
          error instanceof Error ? error.message : '写入数据库失败',
        startedAt,
      });
    } finally {
      setIsApplying(false);
    }
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

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl apple-glass-dark p-6 md:p-8 z-10 border border-white/10 shadow-2xl text-white"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-xl bg-gradient-to-tr from-[#FA114F] to-indigo-500 text-white">
              <FileJson className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              Health Auto Export · 数据导入
            </span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
            导入 HAE 原始 JSON 数据
          </h2>
          <p className="text-xs text-neutral-400 mb-5 leading-relaxed">
            建议使用 HAE v2 JSON、关闭 Summarize Data，并按秒或原始粒度导出。导入后会同时保留原始 JSON、标准化样本、训练明细与每日聚合。
          </p>

          {/* Drag & Drop Box */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center mb-4 ${
              isDragging
                ? 'border-[#FA114F] bg-[#FA114F]/10'
                : 'border-white/15 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/30'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json,application/json"
              className="hidden"
            />
            <UploadCloud className="w-8 h-8 mx-auto text-neutral-400 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-semibold text-white block">
              点击选择文件，或将 .json 文件拖拽至此处
            </span>
            <span className="text-xs text-neutral-400 mt-1 block">
              支持任何 Health Auto Export V2 导出的全量 JSON
            </span>
          </div>

          {/* Or Paste textarea */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5 text-xs text-neutral-400">
              <span>或者直接粘贴 JSON 文本：</span>
              {jsonText && (
                <button
                  onClick={() => {
                    setJsonText('');
                    setParsedInfo(null);
                    setRawPayload(null);
                    setErrorMsg(null);
                  }}
                  className="text-neutral-400 hover:text-white"
                >
                  清空
                </button>
              )}
            </div>
            <textarea
              rows={3}
              value={jsonText}
              onChange={(e) => {
                const val = e.target.value;
                setJsonText(val);
                const trimmed = val.trim();
                if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                  handleProcessJSON(trimmed);
                }
              }}
              onBlur={() => {
                const trimmed = jsonText.trim();
                if (trimmed.startsWith('{') && !parsedInfo) {
                  handleProcessJSON(trimmed);
                }
              }}
              placeholder='在此粘贴 {"data": {"metrics": [...], "workouts": [...]}}'
              className="w-full p-3 rounded-2xl bg-black/40 border border-white/10 text-xs font-mono text-emerald-300 placeholder:text-neutral-600 focus:outline-none focus:border-white/30 resize-none"
            />
          </div>

          {/* Error notice */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Summary Banner */}
          {parsedInfo && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs mb-4 space-y-2"
            >
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>解析成功！已提取完整健康数据集</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-neutral-300 pt-1">
                <div className="p-2 rounded-xl bg-black/20">
                  <span className="text-neutral-400 block text-[10px]">有效日期跨度</span>
                  <span className="font-bold text-white text-sm">{parsedInfo.totalDays} 天</span>
                  <span className="block text-[10px] text-neutral-400 truncate">{parsedInfo.dates[0]} 至 {parsedInfo.dates[parsedInfo.dates.length - 1]}</span>
                </div>
                <div className="p-2 rounded-xl bg-black/20">
                  <span className="text-neutral-400 block text-[10px]">识别体能运动</span>
                  <span className="font-bold text-[#A1FF00] text-sm">{parsedInfo.totalWorkouts} 场训练</span>
                  <span className="block text-[10px] text-neutral-400">心率区间/骑行/GPX</span>
                </div>
                <div className="p-2 rounded-xl bg-black/20">
                  <span className="text-neutral-400 block text-[10px]">体脂与步态</span>
                  <span className="font-bold text-[#FA114F] text-sm">完整 100%</span>
                  <span className="block text-[10px] text-neutral-400">体重/体脂/步态/听力</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Footer Action Button */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-neutral-300 hover:text-white transition-all cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={applyData}
              disabled={!parsedInfo || isApplying}
              className={`px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                parsedInfo && !isApplying
                  ? 'bg-gradient-to-r from-rose-500 via-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/25 hover:brightness-110 cursor-pointer'
                  : 'bg-white/5 text-neutral-500 cursor-not-allowed'
              }`}
            >
              {isApplying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{isApplying ? '写入数据库...' : '导入 PostgreSQL 并展示'}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
        </motion.div>
      </div>
      <OperationProgressModal state={operation} onClose={() => setOperation(null)} />
    </AnimatePresence>
  );
};
