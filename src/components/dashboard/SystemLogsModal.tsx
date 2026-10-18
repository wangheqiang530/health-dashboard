import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { fetchSystemLogs, clearSystemLogs } from '../../api/healthApi';
import {
  X,
  FileText,
  RefreshCw,
  Copy,
  Check,
  Trash2,
  Terminal,
  Search,
} from 'lucide-react';

interface SystemLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemLogsModal: React.FC<SystemLogsModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL');
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetchSystemLogs();
      setLogs(res.lines || []);
    } catch (err) {
      setLogs([`[ERROR] 获取系统日志失败: ${err instanceof Error ? err.message : String(err)}`]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    void loadLogs();
    const interval = setInterval(() => void loadLogs(true), 4000);
    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = async () => {
    if (!confirm('确定清空当前的系统运行日志视窗吗？')) return;
    setClearing(true);
    try {
      await clearSystemLogs();
      await loadLogs();
    } finally {
      setClearing(false);
    }
  };

  const filteredLogs = logs.filter((line) => {
    if (levelFilter === 'ERROR' && !line.includes('[ERROR]')) return false;
    if (levelFilter === 'WARN' && !line.includes('[WARN]') && !line.includes('[ERROR]')) return false;
    if (levelFilter === 'INFO' && !line.includes('[INFO]')) return false;
    if (searchFilter.trim()) {
      return line.toLowerCase().includes(searchFilter.trim().toLowerCase());
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-4xl bg-white/95 dark:bg-[#12141a]/95 backdrop-blur-2xl rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-black/5 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/20">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>系统运行日志 (System Console)</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                实时输出 Fastify API 请求、HAE Webhook 接收、Fitdays/iGPSPORT 调度同步与报错调用栈
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadLogs()}
              disabled={loading}
              className="p-2 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
              title="刷新最新日志"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="p-2 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
              title="复制全部日志"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={clearing}
              className="p-2 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-rose-500/10 text-neutral-700 dark:text-neutral-200 hover:text-rose-500 transition-colors cursor-pointer"
              title="清空日志视窗"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="px-6 py-2.5 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            {(['ALL', 'INFO', 'WARN', 'ERROR'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  levelFilter === lvl
                    ? lvl === 'ERROR'
                      ? 'bg-rose-500 text-white shadow-sm'
                      : lvl === 'WARN'
                        ? 'bg-amber-500 text-black shadow-sm'
                        : 'bg-indigo-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="搜索关键词 (如 hae, sync, error)..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#1a1c24] rounded-xl border border-black/10 dark:border-white/10 text-neutral-800 dark:text-neutral-200 outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Console Log Content Area */}
        <div
          ref={scrollRef}
          className="p-4 flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed bg-[#0b0c10] text-neutral-300 select-text min-h-[380px]"
        >
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-neutral-500 py-12">
              <FileText className="w-8 h-8 mb-2 opacity-40" />
              <span>暂无符合条件的日志记录</span>
            </div>
          ) : (
            filteredLogs.map((line, idx) => {
              const isError = line.includes('[ERROR]') || line.includes('error') || line.includes('Error');
              const isWarn = line.includes('[WARN]') || line.includes('warn');
              const isHae = line.includes('HAE') || line.includes('health-auto-export');
              const isSync = line.includes('sync') || line.includes('fitdays') || line.includes('igpsport');

              return (
                <div
                  key={idx}
                  className={`py-0.5 px-1.5 rounded transition-colors break-all ${
                    isError
                      ? 'text-rose-400 bg-rose-500/10'
                      : isWarn
                        ? 'text-amber-300 bg-amber-500/10'
                        : isHae
                          ? 'text-sky-300 hover:bg-white/5'
                          : isSync
                            ? 'text-emerald-300 hover:bg-white/5'
                            : 'hover:bg-white/5 text-neutral-300'
                  }`}
                >
                  {line}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-2.5 border-t border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between text-[11px] text-neutral-400 font-mono">
          <span>共载入 {filteredLogs.length} / {logs.length} 条记录</span>
          <span>按 ESC 或点击关闭退出</span>
        </div>
      </motion.div>
    </div>
  );
};
