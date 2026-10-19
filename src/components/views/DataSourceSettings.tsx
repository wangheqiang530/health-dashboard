import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Archive,
  Bike,
  Check,
  Clock3,
  CloudDownload,
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  FolderArchive,
  KeyRound,
  Play,
  RefreshCw,
  Save,
  Scale,
  Server,
  ShieldCheck,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import {
  deleteArchiveFile,
  downloadArchiveFile,
  fetchBackendConfig,
  fetchSourceRuns,
  testDataSource,
  triggerSourceSync,
  updateArchiveRetention,
  updateDataSource,
  type ArchiveItem,
  type BackendConfig,
  type DataSourceConfig,
} from '../../api/healthApi';
import { AppleCard } from '../ui/AppleCard';
import {
  OperationProgressModal,
  type OperationProgressState,
} from '../ui/OperationProgressModal';

interface DataSourceSettingsProps {
  onDataChanged: () => void | Promise<void>;
}

type SourceId = 'fitdays' | 'igpsport';

interface SourceDraft {
  account: string;
  password: string;
  cronExpression: string;
  enabled: boolean;
  targetSuid: string;
  syncDays: string;
  syncLimit: string;
}

const toDraft = (source: DataSourceConfig): SourceDraft => ({
  account: source.account,
  password: '',
  cronExpression: source.cronExpression,
  enabled: source.enabled,
  targetSuid: source.targetSuid?.toString() || '',
  syncDays: source.syncDays.toString(),
  syncLimit: source.syncLimit.toString(),
});

const formatDateTime = (value: string | null): string => {
  if (!value) return '尚未运行';
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const archiveSourceName = (sourceId: ArchiveItem['sourceId']): string => {
  if (sourceId === 'fitdays') return 'Fitdays';
  if (sourceId === 'igpsport') return 'iGPSPORT';
  return 'HAE';
};

const sourceIcon = (sourceId: SourceId) => {
  if (sourceId === 'fitdays') {
    return <Scale className="w-4 h-4 text-rose-500" />;
  }
  return <Bike className="w-4 h-4 text-sky-500" />;
};

const sourceLabel = (sourceId: 'hae' | SourceId): string => {
  if (sourceId === 'fitdays') return 'Fitdays 体脂秤';
  if (sourceId === 'igpsport') return 'iGPSPORT 码表';
  return 'Health Auto Export';
};

const formatCoverage = (earliest: string | null, latest: string | null): string =>
  earliest && latest ? `${earliest} → ${latest}` : '暂无记录';

export const DataSourceSettings: React.FC<DataSourceSettingsProps> = ({ onDataChanged }) => {
  const [config, setConfig] = useState<BackendConfig | null>(null);
  const [drafts, setDrafts] = useState<Record<SourceId, SourceDraft> | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<SourceId | null>(null);
  const [syncingId, setSyncingId] = useState<SourceId | null>(null);
  const [confirmFullSyncSource, setConfirmFullSyncSource] = useState<SourceId | null>(null);
  const [showPassword, setShowPassword] = useState<Record<SourceId, boolean>>({
    fitdays: false,
    igpsport: false,
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [retentionDays, setRetentionDays] = useState('0');
  const [savingStorage, setSavingStorage] = useState(false);
  const [testingId, setTestingId] = useState<'hae' | SourceId | null>(null);
  const [operation, setOperation] = useState<OperationProgressState | null>(null);

  const loadConfig = async (updateDrafts: boolean) => {
    try {
      const nextConfig = await fetchBackendConfig();
      setConfig(nextConfig);
      setRetentionDays(String(nextConfig.storage.retentionDays));
      if (updateDrafts) {
        const fitdays = nextConfig.sources.find((source) => source.id === 'fitdays');
        const igpsport = nextConfig.sources.find((source) => source.id === 'igpsport');
        if (fitdays && igpsport) {
          setDrafts({
            fitdays: toDraft(fitdays),
            igpsport: toDraft(igpsport),
          });
        }
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '无法连接后端服务',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConfig(true);
  }, []);

  const sources = useMemo(
    () => ({
      fitdays: config?.sources.find((source) => source.id === 'fitdays') || null,
      igpsport: config?.sources.find((source) => source.id === 'igpsport') || null,
    }),
    [config]
  );

  const copyText = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const updateDraft = <K extends keyof SourceDraft>(
    sourceId: SourceId,
    key: K,
    value: SourceDraft[K]
  ) => {
    setDrafts((current) =>
      current
        ? {
            ...current,
            [sourceId]: {
              ...current[sourceId],
              [key]: value,
            },
          }
        : current
    );
  };

  const saveSource = async (sourceId: SourceId) => {
    if (!drafts) return;
    const draft = drafts[sourceId];
    setSavingId(sourceId);
    setMessage(null);
    const startedAt = Date.now();
    setOperation({
      title: `保存 ${sourceLabel(sourceId)} 配置`,
      status: 'running',
      message: '正在校验账号、加密凭据并重新加载定时任务…',
      startedAt,
    });
    try {
      await updateDataSource(sourceId, {
        account: draft.account,
        password: draft.password || undefined,
        cronExpression: draft.cronExpression,
        enabled: draft.enabled,
        targetSuid: sourceId === 'fitdays' ? Number(draft.targetSuid) || null : undefined,
        syncDays: sourceId === 'fitdays' ? Number(draft.syncDays) || 1095 : undefined,
        syncLimit: sourceId === 'igpsport' ? Number(draft.syncLimit) || 20 : undefined,
      });
      setMessage({ type: 'success', text: '数据源配置已保存，Cron 计划已重新加载。' });
      await loadConfig(true);
      setOperation({
        title: `保存 ${sourceLabel(sourceId)} 配置`,
        status: 'success',
        message: '配置已保存，自动同步计划已重新加载。',
        startedAt,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '保存失败',
      });
      setOperation({
        title: `保存 ${sourceLabel(sourceId)} 配置`,
        status: 'error',
        message: error instanceof Error ? error.message : '保存失败',
        startedAt,
      });
    } finally {
      setSavingId(null);
    }
  };

  const syncNow = async (sourceId: SourceId, full = false) => {
    setSyncingId(sourceId);
    setMessage(null);
    const startedAt = Date.now();
    setOperation({
      title: `${full ? '全量' : '增量'}同步 ${sourceLabel(sourceId)}`,
      status: 'running',
      message: '任务已下发，正在等待云端拉取、解析与数据库入库…',
      startedAt,
    });
    try {
      const started = await triggerSourceSync(sourceId, full);
      setMessage({
        type: 'success',
        text: full
          ? `已下发 ${sourceId === 'fitdays' ? 'Fitdays 体脂秤' : 'iGPSPORT 码表'} 的全量历史同步任务，正在等待云端拉取、FIT 解析与入库完成...`
          : '同步任务已启动，正在等待数据入库完成...',
      });

      let completedRun: Awaited<ReturnType<typeof fetchSourceRuns>>['runs'][number] | null = null;
      for (let attempt = 0; attempt < 300; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        try {
          const result = await fetchSourceRuns(sourceId);
          const run = result.runs.find((item) => item.id === started.runId);
          if (run) {
            setOperation({
              title: `${full ? '全量' : '增量'}同步 ${sourceLabel(sourceId)}`,
              status: 'running',
              message:
                run.status === 'running'
                  ? '正在拉取与写入数据…'
                  : '任务已结束，正在刷新数据库状态…',
              detail: `已处理 ${run.recordsCount.toLocaleString()} 条 · 任务 ${run.id.slice(0, 8)}`,
              startedAt,
            });
          }
          if (run && run.status !== 'running') {
            completedRun = run;
            break;
          }
        } catch {
          // A transient status read failure should not abort a running sync.
        }
      }

      if (!completedRun) {
        throw new Error('同步仍在后台运行，状态查询超时。请稍后刷新状态查看结果。');
      }
      if (completedRun.status === 'failed') {
        throw new Error(completedRun.message || '数据源同步失败。');
      }

      const recordLabel = sourceId === 'fitdays' ? '条体测记录' : '条骑行记录';
      setMessage({
        type: 'success',
        text: `${full ? '全量' : '增量'}同步完成，共处理 ${
          completedRun.recordsCount
        } ${recordLabel}。数据库覆盖范围已刷新。`,
      });
      await loadConfig(false);
      await onDataChanged();
      setOperation({
        title: `${full ? '全量' : '增量'}同步 ${sourceLabel(sourceId)}`,
        status: 'success',
        message: `同步完成，共处理 ${completedRun.recordsCount.toLocaleString()} ${recordLabel}。`,
        startedAt,
        details: completedRun.details,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '同步启动失败',
      });
      setOperation({
        title: `${full ? '全量' : '增量'}同步 ${sourceLabel(sourceId)}`,
        status: 'error',
        message: error instanceof Error ? error.message : '同步启动失败',
        startedAt,
      });
    } finally {
      setSyncingId(null);
      setConfirmFullSyncSource(null);
    }
  };

  const saveRetention = async () => {
    const days = Number(retentionDays);
    if (!Number.isInteger(days) || days < 0 || days > 3650) {
      setMessage({ type: 'error', text: '保留天数必须为 0 到 3650 的整数，0 表示永久保留。' });
      return;
    }
    setSavingStorage(true);
    setMessage(null);
    const startedAt = Date.now();
    setOperation({
      title: '保存归档保留策略',
      status: 'running',
      message: days === 0 ? '正在切换为永久保留，并停止自动清理…' : '正在应用保留期限并清理过期文件…',
      startedAt,
    });
    try {
      const result = await updateArchiveRetention(days);
      setRetentionDays(String(result.retentionDays));
      setMessage({
        type: 'success',
        text: `备份保留期已设为 ${result.retentionDays} 天，过期文件已清理，数据库数据保持不变。`,
      });
      await loadConfig(false);
      setOperation({
        title: '保存归档保留策略',
        status: 'success',
        message:
          result.retentionDays === 0
            ? '原始归档已设为永久保留，不会自动清理。'
            : `归档保留期已设为 ${result.retentionDays} 天。`,
        startedAt,
        details: result,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '保存存储期限失败',
      });
      setOperation({
        title: '保存归档保留策略',
        status: 'error',
        message: error instanceof Error ? error.message : '保存存储期限失败',
        startedAt,
      });
    } finally {
      setSavingStorage(false);
    }
  };

  const testSource = async (sourceId: 'hae' | SourceId) => {
    setTestingId(sourceId);
    const startedAt = Date.now();
    setOperation({
      title: `测试连接 · ${sourceLabel(sourceId)}`,
      status: 'running',
      message: '正在验证凭据、网络连接与接口响应…',
      startedAt,
    });
    try {
      const result = await testDataSource(sourceId);
      setOperation({
        title: `测试连接 · ${sourceLabel(sourceId)}`,
        status: result.ok ? 'success' : 'error',
        message: result.message,
        startedAt,
        details: result.details,
      });
    } catch (error) {
      setOperation({
        title: `测试连接 · ${sourceLabel(sourceId)}`,
        status: 'error',
        message: error instanceof Error ? error.message : '测试请求失败',
        startedAt,
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteArchive = async (archiveId: string) => {
    if (!window.confirm('确定删除这份本地来源备份吗？数据库中的健康记录不会删除。')) {
      return;
    }
    const startedAt = Date.now();
    setOperation({
      title: '删除来源归档',
      status: 'running',
      message: '正在删除本地压缩文件并更新归档索引…',
      startedAt,
    });
    try {
      await deleteArchiveFile(archiveId);
      setMessage({ type: 'success', text: '备份文件已从磁盘与记录中删除。' });
      await loadConfig(false);
      setOperation({
        title: '删除来源归档',
        status: 'success',
        message: '归档文件已删除，数据库健康记录未受影响。',
        startedAt,
      });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '删除备份文件失败' });
      setOperation({
        title: '删除来源归档',
        status: 'error',
        message: err instanceof Error ? err.message : '删除备份文件失败',
        startedAt,
      });
    }
  };

  const handleDownloadArchive = async (archiveId: string) => {
    const startedAt = Date.now();
    setOperation({
      title: '下载来源归档',
      status: 'running',
      message: '正在读取本地归档并准备浏览器下载…',
      startedAt,
    });
    try {
      const { blob, filename } = await downloadArchiveFile(archiveId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setOperation({
        title: '下载来源归档',
        status: 'success',
        message: `已开始下载 ${filename}`,
        startedAt,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '下载备份文件失败',
      });
      setOperation({
        title: '下载来源归档',
        status: 'error',
        message: error instanceof Error ? error.message : '下载备份文件失败',
        startedAt,
      });
    }
  };

  if (loading) {
    return (
      <AppleCard>
        <div className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>正在读取 PostgreSQL 配置...</span>
        </div>
      </AppleCard>
    );
  }

  if (!config || !drafts) {
    return (
      <AppleCard>
        <div className="flex items-center gap-3 text-sm text-rose-500">
          <AlertCircle className="w-4 h-4" />
          <span>{message?.text || '后端服务尚未连接，请先启动 Docker Compose。'}</span>
        </div>
      </AppleCard>
    );
  }

  const renderSource = (sourceId: SourceId) => {
    const source = sources[sourceId];
    const draft = drafts[sourceId];
    if (!source) return null;
    const isSaving = savingId === sourceId;
    const isSyncing = syncingId === sourceId || source.running;

    return (
      <div
        key={sourceId}
        className="rounded-2xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.025] p-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-white dark:bg-white/10 border border-black/5 dark:border-white/10">
              {sourceIcon(sourceId)}
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                {source.displayName}
              </h4>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                <span className="flex items-center gap-1">
                  <Clock3 className="w-3 h-3" />
                  上次成功：{formatDateTime(source.lastSuccessAt)}
                </span>
                {source.nextRunAt && (
                  <span>下次计划：{formatDateTime(source.nextRunAt)}</span>
                )}
              </div>
            </div>
          </div>
          <span
            className={`self-start sm:self-auto px-2.5 py-1 rounded-full text-[10px] font-bold border ${
              source.running
                ? 'bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/20'
                : source.enabled
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20'
                  : 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20'
            }`}
          >
            {source.running ? '同步中' : source.enabled ? '自动同步已启用' : '已停用'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs text-neutral-600 dark:text-neutral-300">
            <span className="block mb-1.5 font-medium">
              {sourceId === 'fitdays' ? 'Fitdays 账号' : 'iGPSPORT 账号'}
            </span>
            <input
              value={draft.account}
              onChange={(event) => updateDraft(sourceId, 'account', event.target.value)}
              autoComplete="username"
              className="w-full h-10 px-3 rounded-xl bg-white/70 dark:bg-black/30 border border-black/10 dark:border-white/10 text-neutral-900 dark:text-white outline-none focus:border-sky-500/60"
              placeholder="手机号或登录账号"
            />
          </label>
          <label className="text-xs text-neutral-600 dark:text-neutral-300">
            <span className="block mb-1.5 font-medium">登录密码</span>
            <div className="relative">
              <input
                type={showPassword[sourceId] ? 'text' : 'password'}
                value={draft.password}
                onChange={(event) => updateDraft(sourceId, 'password', event.target.value)}
                autoComplete="new-password"
                className="w-full h-10 px-3 pr-10 rounded-xl bg-white/70 dark:bg-black/30 border border-black/10 dark:border-white/10 text-neutral-900 dark:text-white outline-none focus:border-sky-500/60"
                placeholder={source.passwordConfigured ? '已加密保存，留空则不修改' : '填写登录密码'}
              />
              <button
                type="button"
                onClick={() =>
                  setShowPassword((current) => ({
                    ...current,
                    [sourceId]: !current[sourceId],
                  }))
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer"
                aria-label={showPassword[sourceId] ? '隐藏密码' : '显示密码'}
              >
                {showPassword[sourceId] ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </label>

          <label className="text-xs text-neutral-600 dark:text-neutral-300">
            <span className="block mb-1.5 font-medium">Cron 定时表达式</span>
            <input
              value={draft.cronExpression}
              onChange={(event) => updateDraft(sourceId, 'cronExpression', event.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-white/70 dark:bg-black/30 border border-black/10 dark:border-white/10 font-mono text-neutral-900 dark:text-white outline-none focus:border-sky-500/60"
              placeholder="15 */6 * * *"
            />
          </label>

          {sourceId === 'fitdays' ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-neutral-600 dark:text-neutral-300">
                <span className="block mb-1.5 font-medium">档案 SUID</span>
                <input
                  inputMode="numeric"
                  value={draft.targetSuid}
                  onChange={(event) => updateDraft(sourceId, 'targetSuid', event.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-white/70 dark:bg-black/30 border border-black/10 dark:border-white/10 font-mono text-neutral-900 dark:text-white outline-none focus:border-sky-500/60"
                  placeholder="自动识别"
                />
              </label>
              <label className="text-xs text-neutral-600 dark:text-neutral-300">
                <span className="block mb-1.5 font-medium">回看天数</span>
                <input
                  inputMode="numeric"
                  value={draft.syncDays}
                  onChange={(event) => updateDraft(sourceId, 'syncDays', event.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-white/70 dark:bg-black/30 border border-black/10 dark:border-white/10 font-mono text-neutral-900 dark:text-white outline-none focus:border-sky-500/60"
                />
              </label>
            </div>
          ) : (
            <label className="text-xs text-neutral-600 dark:text-neutral-300">
              <span className="block mb-1.5 font-medium">每次拉取活动数</span>
              <input
                inputMode="numeric"
                value={draft.syncLimit}
                onChange={(event) => updateDraft(sourceId, 'syncLimit', event.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-white/70 dark:bg-black/30 border border-black/10 dark:border-white/10 font-mono text-neutral-900 dark:text-white outline-none focus:border-sky-500/60"
              />
            </label>
          )}
        </div>

        {source.lastError && (
          <div className="mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-600 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span className="break-all">{source.lastError}</span>
          </div>
        )}

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="flex items-center gap-2.5 text-xs text-neutral-600 dark:text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) => updateDraft(sourceId, 'enabled', event.target.checked)}
              className="w-4 h-4 rounded accent-emerald-500"
            />
            <span>启用自动同步</span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void testSource(sourceId)}
              disabled={testingId === sourceId || !source.passwordConfigured}
              className="h-9 px-3 rounded-xl text-xs font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-300 border border-violet-500/20 hover:bg-violet-500/15 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {testingId === sourceId ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Activity className="w-3.5 h-3.5" />
              )}
              <span>测试连接</span>
            </button>
            <button
              type="button"
              onClick={() => void saveSource(sourceId)}
              disabled={isSaving}
              className="h-9 px-3 rounded-xl text-xs font-semibold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{isSaving ? '保存中' : '保存配置'}</span>
            </button>
            <button
              type="button"
              onClick={() => void syncNow(sourceId)}
              disabled={isSyncing || !source.passwordConfigured}
              className="h-9 px-3 rounded-xl text-xs font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-300 border border-sky-500/20 hover:bg-sky-500/15 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {isSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isSyncing ? '同步中' : '立即同步'}</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmFullSyncSource(sourceId)}
              disabled={isSyncing || !source.passwordConfigured}
              className="h-9 px-3 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20 hover:bg-amber-500/15 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              title="全量拉取账号历史所有数据（需二次确认，防止频繁调用触发官方风控）"
            >
              <CloudDownload className="w-3.5 h-3.5" />
              <span>全量同步</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
    <AppleCard>
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">PostgreSQL 数据管道</h3>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              {config.database.dailySummaries} 天聚合 · {config.database.metricPoints.toLocaleString()} 个指标点 ·{' '}
              {(config.database.rawRecords || 0).toLocaleString()} 条原始对象 ·{' '}
              {(config.database.healthSamples || 0).toLocaleString()} 条标准化样本 ·{' '}
              {config.database.bodyMeasurements} 次体测 · {config.database.cyclingActivities} 次骑行
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadConfig(false)}
          className="self-start h-8 px-2.5 rounded-lg text-[11px] font-semibold bg-black/5 dark:bg-white/10 text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          刷新状态
        </button>
      </div>

      {config.coverage && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 mb-4">
          {[
            {
              label: 'HAE 日汇总',
              coverage: config.coverage.dailySummaries,
              unit: '天',
              color: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
            },
            {
              label: 'Fitdays 体测',
              coverage: config.coverage.bodyMeasurements,
              unit: '次',
              color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
            },
            {
              label: 'iGPSPORT 骑行',
              coverage: config.coverage.cyclingActivities,
              unit: '次',
              color: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
            },
            {
              label: 'HAE 训练记录',
              coverage: config.coverage.healthWorkouts,
              unit: '次',
              color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
            },
          ].map((item) => (
            <div
              key={item.label}
              className={`p-3 rounded-2xl border ${item.color}`}
            >
              <span className="text-[10px] font-semibold opacity-80 block">{item.label}</span>
              <span className="text-lg font-black font-mono block mt-0.5">
                {item.coverage.count.toLocaleString()}{' '}
                <span className="text-[10px] font-normal">{item.unit}</span>
              </span>
              <span className="text-[9px] font-mono opacity-70 block mt-0.5">
                {formatCoverage(item.coverage.earliest, item.coverage.latest)}
              </span>
            </div>
          ))}
        </div>
      )}

      {message && (
        <div
          className={`mb-4 p-3 rounded-xl border text-xs flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-300'
          }`}
        >
          {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-gradient-to-br from-sky-500/[0.07] to-emerald-500/[0.05] p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Smartphone className="w-4 h-4 text-sky-500" />
          <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Health Auto Export Webhook</h4>
          <button
            type="button"
            onClick={() => void testSource('hae')}
            disabled={testingId === 'hae'}
            className="ml-auto h-8 px-2.5 rounded-lg text-[11px] font-semibold bg-white/70 dark:bg-white/10 border border-black/5 dark:border-white/10 text-neutral-600 dark:text-neutral-200 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {testingId === 'hae' ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Activity className="w-3 h-3" />
            )}
            测试连接
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/70 dark:bg-black/30 border border-black/5 dark:border-white/10 p-3">
            <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 mb-1">
              <span className="flex items-center gap-1">
                <Server className="w-3 h-3" />
                REST API URL
              </span>
              <button
                type="button"
                onClick={() => void copyText(config.hae.endpoint, 'endpoint')}
                className="flex items-center gap-1 text-sky-500 hover:text-sky-400 cursor-pointer"
              >
                {copiedKey === 'endpoint' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedKey === 'endpoint' ? '已复制' : '复制'}
              </button>
            </div>
            <div className="font-mono text-[11px] font-bold text-neutral-800 dark:text-emerald-300 break-all select-all">
              {config.hae.endpoint}
            </div>
          </div>
          <div className="rounded-xl bg-white/70 dark:bg-black/30 border border-black/5 dark:border-white/10 p-3">
            <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 mb-1">
              <span className="flex items-center gap-1">
                <KeyRound className="w-3 h-3" />
                X-Api-Key
              </span>
              <button
                type="button"
                onClick={() => void copyText(config.hae.apiKey, 'api-key')}
                className="flex items-center gap-1 text-sky-500 hover:text-sky-400 cursor-pointer"
              >
                {copiedKey === 'api-key' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedKey === 'api-key' ? '已复制' : '复制'}
              </button>
            </div>
            <div className="font-mono text-[11px] font-bold text-neutral-800 dark:text-neutral-200 break-all select-all">
              {config.hae.apiKey}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-amber-500/[0.04] p-4 mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <FolderArchive className="w-4 h-4 text-amber-500" />
            <div>
              <h4 className="text-sm font-bold text-neutral-900 dark:text-white">本地来源备份</h4>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                HAE、Fitdays、iGPSPORT 原始元数据先落盘，再导入数据库
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500 dark:text-neutral-400">
            <span className="flex items-center gap-1">
              <Archive className="w-3 h-3" />
              {config.storage.archiveCount} 个有效备份
            </span>
            <span>{formatBytes(config.storage.archiveSizeBytes)}</span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-300">
              <ShieldCheck className="w-3 h-3" />
              数据库数据不会删除
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-3">
          <div className="rounded-xl bg-white/70 dark:bg-black/25 border border-black/5 dark:border-white/10 p-3">
            <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-300 mb-1.5">
              备份文件保留天数
            </label>
            <div className="flex items-center gap-2">
              <input
                inputMode="numeric"
                min="0"
                max="3650"
                value={retentionDays}
                onChange={(event) => setRetentionDays(event.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-white dark:bg-black/30 border border-black/10 dark:border-white/10 font-mono text-sm text-neutral-900 dark:text-white outline-none focus:border-amber-500/60"
              />
              <span className="text-xs text-neutral-500">天</span>
              <button
                type="button"
                onClick={() => void saveRetention()}
                disabled={savingStorage}
                className="h-9 px-3 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 hover:bg-amber-500/20 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                {savingStorage ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                保存
              </button>
            </div>
            <p className="text-[10px] text-neutral-400 mt-2 leading-relaxed">
              0 表示永久保留。建议保持 0，避免原始 ZIP、FIT 与归档文件被自动清理。
            </p>
          </div>

          <div className="rounded-xl bg-white/70 dark:bg-black/25 border border-black/5 dark:border-white/10 p-3 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                最近备份文件
              </span>
              <span className="text-[10px] text-neutral-400">
                共记录 {config.storage.totalArchiveCount} 次
              </span>
            </div>
            {config.storage.archives.length === 0 ? (
              <div className="h-12 flex items-center text-[11px] text-neutral-400">
                尚无来源备份，首次推送或同步后自动生成。
              </div>
            ) : (
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {config.storage.archives.slice(0, 6).map((archive) => (
                  <div
                    key={archive.id}
                    className="flex items-center gap-2 text-[10px] text-neutral-500 dark:text-neutral-400"
                  >
                    <span className="w-14 flex-shrink-0 font-semibold text-neutral-700 dark:text-neutral-200">
                      {archiveSourceName(archive.sourceId)}
                    </span>
                    <span className="flex-1 min-w-0 truncate font-mono">{archive.relativePath}</span>
                    <span className="flex-shrink-0">{formatBytes(archive.sizeBytes)}</span>
                    {archive.deletedAt ? (
                      <span className="flex-shrink-0 text-neutral-400">已过期</span>
                    ) : (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleDownloadArchive(archive.id)}
                          className="p-1 rounded-md text-sky-500 hover:bg-sky-500/10 cursor-pointer"
                          title={`下载 ${formatDateTime(archive.capturedAt)} 的备份`}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteArchive(archive.id)}
                          className="p-1 rounded-md text-neutral-400 hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer transition-colors"
                          title="删除此本地备份文件"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {renderSource('fitdays')}
        {renderSource('igpsport')}
      </div>
    </AppleCard>
      <OperationProgressModal state={operation} onClose={() => setOperation(null)} />

      {/* Secondary Confirmation Modal for Full Sync */}
      {confirmFullSyncSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="relative w-full max-w-md p-6 bg-white dark:bg-[#16181d] rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500">
                  <CloudDownload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                    全量同步历史数据二次确认
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    目标源：{confirmFullSyncSource === 'fitdays' ? 'Fitdays 智能体脂秤' : 'iGPSPORT 骑行码表'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmFullSyncSource(null)}
                className="p-1 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-neutral-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed bg-amber-500/[0.06] p-3.5 rounded-2xl border border-amber-500/20">
              <p className="font-semibold text-amber-700 dark:text-amber-400">
                ⚠️ 为什么要二次确认并注意风控？
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-[11px] text-neutral-600 dark:text-neutral-300">
                <li>
                  {confirmFullSyncSource === 'fitdays'
                    ? '全量同步将向 Fitdays 官方云端请求长达 10 年的所有历史体测数据。'
                    : '全量同步将向 iGPSPORT 迹驰网关分页请求历史全部骑行记录，并批量逐一下载原生 FIT 运动轨迹文件。'}
                </li>
                <li>
                  因包含历史大量数据包与文件下载，该过程通常需要 <strong>1 ~ 3 分钟</strong>，后台会自动处理并落盘。
                </li>
                <li>
                  <strong className="text-amber-600 dark:text-amber-400">严禁在短时间内高频重复点击全量同步</strong>，否则官方云端可能会对您的账号或 IP 触发频率风控、临时封禁或接口限制。
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmFullSyncSource(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void syncNow(confirmFullSyncSource, true)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-500/20 transition-all cursor-pointer"
              >
                确认开始全量拉取
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
