import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bike,
  CheckCircle2,
  Database,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Scale,
  Trash2,
} from 'lucide-react';
import {
  deleteIgnoredRule,
  fetchIgnoredRecords,
  restoreIgnoredRecord,
  type IgnoredRecord,
} from '../../api/healthApi';

interface IgnoredRecordsPanelProps {
  onDataChanged: () => void | Promise<void>;
}

const sourceLabel = (sourceId: string): string => {
  if (sourceId === 'fitdays') return 'Fitdays';
  if (sourceId === 'igpsport') return 'iGPSPORT';
  return 'Apple Health / HAE';
};

const recordKindLabel = (kind: IgnoredRecord['recordKind']): string => {
  if (kind === 'body_measurement') return '体测记录';
  if (kind === 'cycling_activity') return '骑行记录';
  return '运动记录';
};

const RecordIcon: React.FC<{ kind: IgnoredRecord['recordKind'] }> = ({ kind }) => {
  if (kind === 'body_measurement') return <Scale className="h-4 w-4" />;
  if (kind === 'cycling_activity') return <Bike className="h-4 w-4" />;
  return <Activity className="h-4 w-4" />;
};

const formatDateTime = (value: string): string =>
  new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

export const IgnoredRecordsPanel: React.FC<IgnoredRecordsPanelProps> = ({
  onDataChanged,
}) => {
  const [records, setRecords] = useState<IgnoredRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchIgnoredRecords();
      setRecords(result.records);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '读取忽略列表失败。');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const handleRestore = async (record: IgnoredRecord) => {
    if (
      !window.confirm(
        `确定恢复“${record.displayName}”吗？恢复后会重新出现在对应的健康页面。`
      )
    ) {
      return;
    }
    setWorkingId(record.id);
    setError(null);
    setSuccess(null);
    try {
      const result = await restoreIgnoredRecord(record.id);
      setSuccess(result.message);
      await onDataChanged();
      await loadRecords();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : '恢复记录失败。');
    } finally {
      setWorkingId(null);
    }
  };

  const handleRemoveRule = async (record: IgnoredRecord) => {
    if (
      !window.confirm(
        '确定仅移出忽略列表吗？记录本身不会恢复到数据库，后续同步仍可能再次写入。'
      )
    ) {
      return;
    }
    setWorkingId(record.id);
    setError(null);
    setSuccess(null);
    try {
      await deleteIgnoredRule(record.id);
      setSuccess('忽略规则已移除，记录本身未恢复。');
      await loadRecords();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : '移除忽略规则失败。');
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <div className="min-h-[360px] p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
              同步忽略列表
            </h3>
          </div>
          <p className="mt-1 text-[11px] text-neutral-400">
            手动删除与自动判定的不完整记录会保留在这里，避免后续同步重新回灌。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-black/5 bg-black/[0.03] px-2.5 py-1 font-mono text-[10px] text-neutral-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-300">
            {records.length} 条
          </span>
          <button
            type="button"
            onClick={() => void loadRecords()}
            disabled={loading}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-black/5 px-2.5 text-[11px] font-semibold text-neutral-600 hover:bg-black/10 disabled:opacity-50 dark:bg-white/10 dark:text-neutral-300 dark:hover:bg-white/15"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-500">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-xs text-neutral-400">
          <LoaderCircle className="h-4 w-4 animate-spin text-sky-500" />
          正在读取忽略列表…
        </div>
      ) : records.length === 0 ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
          <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-400/60" />
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            当前没有忽略记录
          </p>
          <p className="mt-1 text-[10px] text-neutral-400">
            删除异常数据后，会在这里保留恢复入口。
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((record) => (
            <div
              key={record.id}
              className="rounded-2xl border border-black/5 bg-black/[0.02] p-3 dark:border-white/5 dark:bg-white/[0.025]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                    <RecordIcon kind={record.recordKind} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-xs font-bold text-neutral-900 dark:text-white">
                        {record.displayName}
                      </span>
                      <span className="rounded-full border border-black/5 bg-black/5 px-1.5 py-0.5 text-[9px] text-neutral-500 dark:border-white/10 dark:bg-white/10 dark:text-neutral-300">
                        {sourceLabel(record.sourceId)} · {recordKindLabel(record.recordKind)}
                      </span>
                      {record.autoIgnored && (
                        <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-300">
                          自动忽略
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                      {record.reason}
                    </p>
                    <p className="mt-1 font-mono text-[9px] text-neutral-400">
                      删除时间 {formatDateTime(record.deletedAt)} · 外部 ID {record.externalId}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleRestore(record)}
                    disabled={workingId === record.id || record.autoIgnored}
                    title={
                      record.autoIgnored
                        ? '不完整数据不能恢复；等待上游生成完整体测后可重新同步'
                        : '恢复记录到数据库'
                    }
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 text-[10px] font-semibold text-emerald-600 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-40 dark:text-emerald-300"
                  >
                    {workingId === record.id ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    恢复记录
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRemoveRule(record)}
                    disabled={workingId === record.id}
                    title="仅移出忽略列表，不恢复记录"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/5 bg-black/[0.03] text-neutral-400 hover:text-rose-500 disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.04]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
