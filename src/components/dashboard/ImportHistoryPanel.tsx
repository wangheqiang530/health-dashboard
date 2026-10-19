import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Archive,
  Bike,
  CheckCircle2,
  Clock3,
  Database,
  LoaderCircle,
  RefreshCw,
  Scale,
  Smartphone,
} from 'lucide-react';
import { fetchImportHistory, type ImportBatchItem } from '../../api/healthApi';

type SourceFilter = 'all' | ImportBatchItem['sourceId'];

const SOURCE_META: Record<
  ImportBatchItem['sourceId'],
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    background: string;
  }
> = {
  hae: {
    label: 'Apple Health / HAE',
    icon: Smartphone,
    color: 'text-rose-500',
    background: 'bg-rose-500/10 border-rose-500/20',
  },
  fitdays: {
    label: 'Fitdays 体脂秤',
    icon: Scale,
    color: 'text-amber-500',
    background: 'bg-amber-500/10 border-amber-500/20',
  },
  igpsport: {
    label: 'iGPSPORT 码表',
    icon: Bike,
    color: 'text-sky-500',
    background: 'bg-sky-500/10 border-sky-500/20',
  },
};

const importKindLabel = (item: ImportBatchItem): string => {
  const labels: Record<string, string> = {
    'apple-health-export': 'Apple Health ZIP 全量导入',
    'health-auto-export': 'HAE API 推送',
    'health-auto-export-backfill': 'HAE 历史数据回填',
    'fitdays-cloud-sync': 'Fitdays 云端同步',
    'fitdays-raw-backfill': 'Fitdays 历史数据回填',
    'igpsport-rides': 'iGPSPORT 骑行同步',
    'igpsport-raw-backfill': 'iGPSPORT 历史数据回填',
  };
  return labels[item.importKind] || item.importKind;
};

const formatDateTime = (value: string): string =>
  new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value));

const formatDuration = (item: ImportBatchItem): string => {
  const start = new Date(item.startedAt).getTime();
  const end = item.finishedAt ? new Date(item.finishedAt).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return '—';
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
};

const statusMeta = (item: ImportBatchItem) => {
  if (item.status === 'running') {
    return {
      label: '写入中',
      color: 'text-sky-500',
      badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/20',
      icon: LoaderCircle,
    };
  }
  if (item.status === 'failed') {
    return {
      label: '失败',
      color: 'text-rose-500',
      badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/20',
      icon: AlertCircle,
    };
  }
  return {
    label: item.normalizedCount > 0 ? '已写入数据库' : '完成，无新增',
    color: 'text-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
    icon: CheckCircle2,
  };
};

export const ImportHistoryPanel: React.FC = () => {
  const [imports, setImports] = useState<ImportBatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  const loadImports = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await fetchImportHistory(120);
      setImports(result.imports || []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '读取导入记录失败');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void loadImports();
    const timer = window.setInterval(() => void loadImports(true), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  const filteredImports = useMemo(
    () =>
      sourceFilter === 'all'
        ? imports
        : imports.filter((item) => item.sourceId === sourceFilter),
    [imports, sourceFilter]
  );

  const summary = useMemo(
    () => ({
      total: imports.length,
      success: imports.filter((item) => item.status === 'success').length,
      failed: imports.filter((item) => item.status === 'failed').length,
      running: imports.filter((item) => item.status === 'running').length,
    }),
    [imports]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-black/5 px-5 py-3 dark:border-white/10">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: '最近批次', value: summary.total, color: 'text-indigo-500' },
            { label: '成功写入', value: summary.success, color: 'text-emerald-500' },
            { label: '失败批次', value: summary.failed, color: 'text-rose-500' },
            { label: '正在写入', value: summary.running, color: 'text-sky-500' },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <span className="text-[10px] text-neutral-400">{item.label}</span>
              <span className={`mt-0.5 block font-mono text-lg font-black ${item.color}`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: 'all' as const, label: '全部' },
              { key: 'hae' as const, label: 'Apple Health / HAE' },
              { key: 'fitdays' as const, label: 'Fitdays' },
              { key: 'igpsport' as const, label: 'iGPSPORT' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSourceFilter(item.key)}
                className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                  sourceFilter === item.key
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                    : 'bg-black/5 text-neutral-500 hover:text-neutral-900 dark:bg-white/5 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void loadImports()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-500/10 px-2.5 py-1 text-[10px] font-semibold text-indigo-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            刷新导入记录
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-500">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {loading && imports.length === 0 ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center gap-2 text-neutral-400">
            <LoaderCircle className="h-6 w-6 animate-spin text-indigo-500" />
            <span className="text-xs">正在读取数据库导入记录…</span>
          </div>
        ) : filteredImports.length === 0 ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center gap-2 text-neutral-400">
            <Database className="h-8 w-8 opacity-40" />
            <span className="text-xs">暂无对应渠道的导入记录</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredImports.map((item) => {
              const source = SOURCE_META[item.sourceId];
              const SourceIcon = source.icon;
              const status = statusMeta(item);
              const StatusIcon = status.icon;
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-black/5 bg-white/70 p-3.5 dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${source.background}`}
                      >
                        <SourceIcon className={`h-4 w-4 ${source.color}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-bold text-neutral-900 dark:text-white">
                            {importKindLabel(item)}
                          </span>
                          <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-semibold ${source.background} ${source.color}`}>
                            {source.label}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-neutral-400">
                          <span className="flex items-center gap-1">
                            <Clock3 className="h-3 w-3" />
                            {formatDateTime(item.startedAt)}
                          </span>
                          <span>耗时 {formatDuration(item)}</span>
                          <span>批次 {item.id.slice(0, 8)}</span>
                        </div>
                      </div>
                    </div>
                    <span
                      className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold ${status.badge}`}
                    >
                      <StatusIcon className={`h-3 w-3 ${item.status === 'running' ? 'animate-spin' : ''}`} />
                      {status.label}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-xl bg-black/[0.025] px-2.5 py-2 dark:bg-black/20">
                      <span className="text-[9px] text-neutral-400">原始对象</span>
                      <span className="mt-0.5 block font-mono text-sm font-bold text-neutral-900 dark:text-white">
                        {item.rawCount.toLocaleString()}
                      </span>
                    </div>
                    <div className="rounded-xl bg-black/[0.025] px-2.5 py-2 dark:bg-black/20">
                      <span className="text-[9px] text-neutral-400">标准化样本</span>
                      <span className="mt-0.5 block font-mono text-sm font-bold text-emerald-500">
                        {item.normalizedCount.toLocaleString()}
                      </span>
                    </div>
                    <div className="rounded-xl bg-black/[0.025] px-2.5 py-2 dark:bg-black/20">
                      <span className="text-[9px] text-neutral-400">跳过 / 异常</span>
                      <span className="mt-0.5 block font-mono text-sm font-bold text-amber-500">
                        {item.skippedCount.toLocaleString()} / {item.errorCount.toLocaleString()}
                      </span>
                    </div>
                    <div className="rounded-xl bg-black/[0.025] px-2.5 py-2 dark:bg-black/20">
                      <span className="text-[9px] text-neutral-400">归档文件</span>
                      <span className="mt-0.5 block truncate font-mono text-[10px] font-semibold text-neutral-600 dark:text-neutral-300" title={item.fileName || item.archivePath || '—'}>
                        {item.fileName || item.archivePath?.split('/').at(-1) || '—'}
                      </span>
                    </div>
                  </div>

                  {(item.errorMessage || item.archivePath) && (
                    <div className="mt-2 flex flex-wrap items-start gap-2 border-t border-black/5 pt-2 text-[10px] dark:border-white/5">
                      {item.archivePath && (
                        <span className="flex min-w-0 items-center gap-1 text-neutral-400">
                          <Archive className="h-3 w-3 shrink-0" />
                          <span className="truncate font-mono">{item.archivePath}</span>
                        </span>
                      )}
                      {item.errorMessage && (
                        <span className="flex w-full items-start gap-1 rounded-lg bg-rose-500/10 px-2 py-1.5 text-rose-500">
                          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                          <span className="break-all">{item.errorMessage}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
