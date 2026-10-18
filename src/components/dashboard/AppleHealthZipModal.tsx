import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { importAppleHealthZip } from '../../api/healthApi';
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

export const AppleHealthZipModal: React.FC<AppleHealthZipModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<string>('');
  const [resultSummary, setResultSummary] = useState<{
    importedDays: number;
    earliestDate: string;
    latestDate: string;
    totalWorkouts: number;
    archivePath: string;
    archiveSizeBytes: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFile = (file: File) => {
    setErrorMsg(null);
    setResultSummary(null);
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setErrorMsg('请选择有效的 .zip 压缩包 (例如 iPhone 导出的 导出.zip 或 export.zip)');
      return;
    }
    setSelectedFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleUploadAndProcess = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setErrorMsg(null);
    setUploadStep('正在上传 ZIP 包并持久化到本地备份目录...');

    try {
      const res = await importAppleHealthZip(selectedFile);
      setUploadStep('解析完成！');
      setResultSummary(res);
      onImportSuccess();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '解析或导入失败，请检查文件是否完整。');
    } finally {
      setIsUploading(false);
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
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl apple-glass-dark p-6 md:p-8 z-10 border border-white/15 shadow-2xl text-white"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white shadow-md">
              <FileArchive className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              iOS 健康 App · 官方导出包导入
            </span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
            导入 Apple Health 完整 ZIP 导出包
          </h2>
          <p className="text-xs text-neutral-400 mb-5 leading-relaxed">
            支持直接上传 iPhone「健康」App 导出的 <code className="text-amber-300 font-mono">导出.zip</code> 或 <code className="text-amber-300 font-mono">export.zip</code>。服务端将自动持久化至本地备份目录（默认保留 365 天），流式提取全部三环、心率、睡眠分期、步态健康及 GPX 运动路线并无缝入库。
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
                ? 'border-amber-400 bg-amber-500/10'
                : selectedFile
                  ? 'border-emerald-500/60 bg-emerald-500/5'
                  : 'border-white/15 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/30'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".zip,application/zip"
              className="hidden"
            />
            {selectedFile ? (
              <div className="flex flex-col items-center">
                <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-400 mb-2">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <span className="text-sm font-bold text-white block">
                  {selectedFile.name}
                </span>
                <span className="text-xs text-neutral-400 mt-0.5 font-mono">
                  文件大小：{formatBytes(selectedFile.size)} · 点击可重新选择
                </span>
              </div>
            ) : (
              <>
                <UploadCloud className="w-8 h-8 mx-auto text-neutral-400 mb-2" />
                <span className="text-sm font-semibold text-white block">
                  点击选择文件，或将 导出.zip 拖拽至此处
                </span>
                <span className="text-xs text-neutral-400 mt-1 block">
                  支持任何版本的 iOS 苹果健康官方完整导出压缩包
                </span>
              </>
            )}
          </div>

          {/* Progress / Status Notice */}
          {isUploading && (
            <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 text-xs text-indigo-300 flex items-center gap-2.5 mb-4">
              <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
              <div>
                <span className="font-semibold block">{uploadStep}</span>
                <span className="text-[10px] text-neutral-400 mt-0.5 block">
                  正在流式解析大数据集，请勿刷新页面，通常需要数秒至十余秒。
                </span>
              </div>
            </div>
          )}

          {/* Error notice */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Summary Banner */}
          {resultSummary && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs mb-4 space-y-3"
            >
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>导入与本地归档完成！PostgreSQL 数据已就绪</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-neutral-300">
                <div className="p-2.5 rounded-xl bg-black/25">
                  <span className="text-neutral-400 block text-[10px]">导入健康天数</span>
                  <span className="font-bold text-white text-sm">{resultSummary.importedDays} 天</span>
                  <span className="block text-[10px] text-neutral-400 truncate">
                    {resultSummary.earliestDate} 至 {resultSummary.latestDate}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/25">
                  <span className="text-neutral-400 block text-[10px]">识别体能训练</span>
                  <span className="font-bold text-[#A1FF00] text-sm">
                    {resultSummary.totalWorkouts} 场运动
                  </span>
                  <span className="block text-[10px] text-neutral-400">含心率/距离/GPX</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/25">
                  <span className="text-neutral-400 block text-[10px]">本地持久化备份</span>
                  <span className="font-bold text-amber-400 text-sm">保留 365 天</span>
                  <span className="block text-[10px] text-neutral-400 truncate">
                    {formatBytes(resultSummary.archiveSizeBytes)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 pt-1 border-t border-white/10">
                <FolderArchive className="w-3.5 h-3.5 text-amber-400" />
                <span className="truncate">归档路径：{resultSummary.archivePath}</span>
              </div>
            </motion.div>
          )}

          {/* Privacy & Storage Guarantee Note */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-neutral-400 flex items-center gap-2 mb-5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>
              纯本地隐私存储：原始压缩包安全存档于本地，365 天后自动滚动清除或随时在配置中心手动清除。
            </span>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-neutral-300 hover:text-white transition-all cursor-pointer"
            >
              {resultSummary ? '关闭' : '取消'}
            </button>
            {!resultSummary && (
              <button
                type="button"
                onClick={handleUploadAndProcess}
                disabled={!selectedFile || isUploading}
                className={`px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  selectedFile && !isUploading
                    ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 text-white shadow-lg shadow-rose-500/25 hover:brightness-110 cursor-pointer'
                    : 'bg-white/5 text-neutral-500 cursor-not-allowed'
                }`}
              >
                {isUploading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{isUploading ? '正在流式解析入库...' : '开始导入并归档'}</span>
                <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
