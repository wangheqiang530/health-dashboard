import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Archive,
  Bike,
  Check,
  Clock3,
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
  X,
} from 'lucide-react';
import {
  fetchBackendConfig,
  testDataSource,
  triggerSourceSync,
  updateArchiveRetention,
  updateDataSource,
  type ArchiveItem,
  type BackendConfig,
  type DataSourceConfig,
  type SourceTestResult,
} from '../../api/healthApi';
import { AppleCard } from '../ui/AppleCard';

interface DataSourceSettingsProps {
  onDataChanged: () => void;
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

export const DataSourceSettings: React.FC<DataSourceSettingsProps> = ({ onDataChanged }) => {
  const [config, setConfig] = useState<BackendConfig | null>(null);
  const [drafts, setDrafts] = useState<Record<SourceId, SourceDraft> | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<SourceId | null>(null);
  const [syncingId, setSyncingId] = useState<SourceId | null>(null);
  const [showPassword, setShowPassword] = useState<Record<SourceId, boolean>>({
    fitdays: false,
    igpsport: false,
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [retentionDays, setRetentionDays] = useState('30');
  const [savingStorage, setSavingStorage] = useState(false);
  const [testingId, setTestingId] = useState<'hae' | SourceId | null>(null);
  const [testResult, setTestResult] = useState<{
    sourceId: 'hae' | SourceId;
    result: SourceTestResult;
  } | null>(null);

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
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '保存失败',
      });
    } finally {
      setSavingId(null);
    }
  };

  const syncNow = async (sourceId: SourceId) => {
    setSyncingId(sourceId);
    setMessage(null);
    try {
      await triggerSourceSync(sourceId);
      setMessage({ type: 'success', text: '同步任务已启动，完成后会自动刷新看板。' });
      window.setTimeout(() => {
        void loadConfig(false);
        onDataChanged();
      }, 5000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '同步启动失败',
      });
    } finally {
      setSyncingId(null);
    }
  };

  const saveRetention = async () => {
    const days = Number(retentionDays);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      setMessage({ type: 'error', text: '保留天数必须为 1 到 3650 的整数。' });
      return;
    }
    setSavingStorage(true);
    setMessage(null);
    try {
      const result = await updateArchiveRetention(days);
      setRetentionDays(String(result.retentionDays));
      setMessage({
        type: 'success',
        text: `备份保留期已设为 ${result.retentionDays} 天，过期文件已清理，数据库数据保持不变。`,
      });
      await loadConfig(false);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '保存存储期限失败',
      });
    } finally {
      setSavingStorage(false);
    }
  };

  const testSource = async (sourceId: 'hae' | SourceId) => {
    setTestingId(sourceId);
    setTestResult(null);
    try {
      const result = await testDataSource(sourceId);
      setTestResult({ sourceId, result });
    } catch (error) {
      setTestResult({
        sourceId,
        result: {
          ok: false,
          message: error instanceof Error ? error.message : '测试请求失败',
          details: {},
        },
      });
    } finally {
      setTestingId(null);
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
              超过期限只删除本地压缩备份和 FIT 文件，PostgreSQL 内的历史数据保留。
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
                      <a
                        href={`/api/v1/config/archives/${archive.id}/download`}
                        className="flex-shrink-0 p-1 rounded-md text-sky-500 hover:bg-sky-500/10"
                        title={`下载 ${formatDateTime(archive.capturedAt)} 的备份`}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
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
      {testResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="关闭测试结果"
            onClick={() => setTestResult(null)}
            className="absolute inset-0 bg-black/65 backdrop-blur-sm cursor-default"
          />
          <div className="relative w-full max-w-md rounded-3xl apple-glass-dark border border-white/15 p-5 text-white shadow-2xl">
            <button
              type="button"
              onClick={() => setTestResult(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 text-neutral-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-4 ${
                testResult.result.ok
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-rose-500/15 text-rose-400'
              }`}
            >
              {testResult.result.ok ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
            </div>
            <h3 className="text-base font-bold mb-1">
              {testResult.sourceId === 'hae'
                ? 'Health Auto Export'
                : testResult.sourceId === 'fitdays'
                  ? 'Fitdays 体脂秤'
                  : 'iGPSPORT 码表'}
              {' · '}
              {testResult.result.ok ? '连接正常' : '测试失败'}
            </h3>
            <p className="text-xs text-neutral-300 leading-relaxed mb-4">
              {testResult.result.message}
            </p>
            {Object.keys(testResult.result.details).length > 0 && (
              <div className="rounded-2xl bg-black/30 border border-white/10 p-3 mb-4">
                {Object.entries(testResult.result.details).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-start justify-between gap-4 py-1 text-[11px]"
                  >
                    <span className="text-neutral-400 font-mono">{key}</span>
                    <span className="text-neutral-100 text-right break-all">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '-')}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setTestResult(null)}
              className="w-full h-9 rounded-xl bg-white text-neutral-900 text-xs font-semibold hover:bg-neutral-100 cursor-pointer"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </>
  );
};
