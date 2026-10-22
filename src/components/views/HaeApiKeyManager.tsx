import { useState, type FC } from 'react';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Pencil,
  Plus,
  Power,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import {
  createHaeApiKey,
  deleteHaeApiKey,
  updateHaeApiKey,
  type HaeApiKey,
} from '../../api/healthApi';

interface HaeApiKeyManagerProps {
  apiKeys: HaeApiKey[];
  onChanged: () => void | Promise<void>;
}

const formatDateTime = (value: string | null): string => {
  if (!value) return '尚未使用';
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
};

export const HaeApiKeyManager: FC<HaeApiKeyManagerProps> = ({
  apiKeys,
  onChanged,
}) => {
  const [deviceName, setDeviceName] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const refresh = async () => {
    await onChanged();
  };

  const handleAdd = async () => {
    if (!deviceName.trim()) {
      setMessage({ type: 'error', text: '请先填写设备备注。' });
      return;
    }
    setAdding(true);
    setMessage(null);
    try {
      const result = await createHaeApiKey(deviceName.trim());
      setDeviceName('');
      setRevealedIds((current) => new Set(current).add(result.apiKey.id));
      setMessage({ type: 'success', text: `已生成 ${result.apiKey.deviceName} 的推送 API。` });
      await refresh();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '生成 API 失败。',
      });
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (apiKey: HaeApiKey) => {
    setBusyId(apiKey.id);
    setMessage(null);
    try {
      await updateHaeApiKey(apiKey.id, { enabled: !apiKey.enabled });
      setMessage({
        type: 'success',
        text: `${apiKey.deviceName} 已${apiKey.enabled ? '禁用' : '恢复'}。`,
      });
      await refresh();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '更新 API 状态失败。',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleRename = async (apiKey: HaeApiKey) => {
    if (!editingName.trim()) {
      setMessage({ type: 'error', text: '设备备注不能为空。' });
      return;
    }
    setBusyId(apiKey.id);
    setMessage(null);
    try {
      await updateHaeApiKey(apiKey.id, { deviceName: editingName.trim() });
      setEditingId(null);
      setMessage({ type: 'success', text: '设备备注已更新。' });
      await refresh();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '更新设备备注失败。',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (apiKey: HaeApiKey) => {
    setBusyId(apiKey.id);
    setMessage(null);
    try {
      await deleteHaeApiKey(apiKey.id);
      setDeletingId(null);
      setMessage({ type: 'success', text: `${apiKey.deviceName} 的推送 API 已删除。` });
      await refresh();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '删除 API 失败。',
      });
    } finally {
      setBusyId(null);
    }
  };

  const copyKey = async (apiKey: HaeApiKey) => {
    try {
      await navigator.clipboard.writeText(apiKey.key);
      setCopiedId(apiKey.id);
      window.setTimeout(() => setCopiedId((current) => (current === apiKey.id ? null : current)), 1800);
    } catch {
      setMessage({ type: 'error', text: '复制失败，请手动选择 API Key。' });
    }
  };

  const toggleReveal = (id: string) => {
    setRevealedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={deviceName}
          onChange={(event) => setDeviceName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void handleAdd();
          }}
          maxLength={80}
          placeholder="设备备注，例如：我的 iPhone 16 Pro"
          className="h-9 min-w-0 flex-1 rounded-xl border border-black/10 bg-white/70 px-3 text-xs text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-sky-500/60 dark:border-white/10 dark:bg-black/30 dark:text-neutral-200"
          aria-label="新推送 API 的设备备注"
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={adding}
          className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-sky-500 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-sky-600 disabled:opacity-60"
        >
          {adding ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          生成 API
        </button>
      </div>

      {message && (
        <div
          className={`rounded-xl border px-3 py-2 text-[11px] ${
            message.type === 'success'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
              : 'border-rose-500/20 bg-rose-500/10 text-rose-500'
          }`}
        >
          {message.text}
        </div>
      )}

      {apiKeys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/10 px-3 py-5 text-center text-[11px] text-neutral-400 dark:border-white/10">
          暂无推送 API，请先为设备生成一个。
        </div>
      ) : (
        <div className="space-y-2">
          {apiKeys.map((apiKey) => {
            const revealed = revealedIds.has(apiKey.id);
            const editing = editingId === apiKey.id;
            const deleting = deletingId === apiKey.id;
            const busy = busyId === apiKey.id;
            return (
              <div
                key={apiKey.id}
                className={`rounded-2xl border p-3 transition-colors ${
                  apiKey.enabled
                    ? 'border-black/5 bg-white/60 dark:border-white/10 dark:bg-black/20'
                    : 'border-black/5 bg-black/[0.03] opacity-70 dark:border-white/5 dark:bg-white/[0.02]'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="rounded-lg bg-sky-500/10 p-1.5 text-sky-500">
                      <Smartphone className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      {editing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            value={editingName}
                            onChange={(event) => setEditingName(event.target.value)}
                            maxLength={80}
                            autoFocus
                            className="h-7 w-44 rounded-lg border border-sky-500/40 bg-white px-2 text-xs text-neutral-900 outline-none dark:bg-neutral-900 dark:text-white"
                            aria-label="修改设备备注"
                          />
                          <button
                            type="button"
                            onClick={() => void handleRename(apiKey)}
                            disabled={busy}
                            className="rounded-lg bg-sky-500 p-1.5 text-white disabled:opacity-50"
                            aria-label="保存设备备注"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-lg bg-black/5 p-1.5 text-neutral-500 dark:bg-white/10 dark:text-neutral-300"
                            aria-label="取消修改设备备注"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="truncate text-xs font-bold text-neutral-900 dark:text-white">
                            {apiKey.deviceName}
                          </span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                              apiKey.enabled
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                                : 'bg-neutral-500/10 text-neutral-500'
                            }`}
                          >
                            {apiKey.enabled ? '启用中' : '已禁用'}
                          </span>
                        </div>
                      )}
                      <span className="mt-0.5 block text-[9px] text-neutral-400">
                        最近使用：{formatDateTime(apiKey.lastUsedAt)}
                        {apiKey.lastSourceIp ? ` · ${apiKey.lastSourceIp}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {!editing && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(apiKey.id);
                          setEditingName(apiKey.deviceName);
                        }}
                        className="rounded-lg p-1.5 text-neutral-400 hover:bg-black/5 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-white"
                        aria-label={`修改 ${apiKey.deviceName} 的备注`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleToggle(apiKey)}
                      disabled={busy}
                      className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold disabled:opacity-50 ${
                        apiKey.enabled
                          ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/15 dark:text-amber-300'
                          : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-300'
                      }`}
                    >
                      {busy ? (
                        <LoaderCircle className="h-3 w-3 animate-spin" />
                      ) : (
                        <Power className="h-3 w-3" />
                      )}
                      {apiKey.enabled ? '禁用' : '恢复'}
                    </button>
                    {deleting ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void handleDelete(apiKey)}
                          disabled={busy}
                          className="rounded-lg bg-rose-600 px-2 py-1.5 text-[10px] font-semibold text-white disabled:opacity-50"
                        >
                          确认删除
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(null)}
                          className="rounded-lg p-1.5 text-neutral-400 hover:bg-black/5 dark:hover:bg-white/10"
                          aria-label="取消删除"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeletingId(apiKey.id)}
                        className="rounded-lg p-1.5 text-neutral-400 hover:bg-rose-500/10 hover:text-rose-500"
                        aria-label={`删除 ${apiKey.deviceName} 的 API`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-1.5 rounded-xl border border-black/5 bg-black/[0.02] px-2 py-1.5 dark:border-white/5 dark:bg-white/[0.03]">
                  <KeyRound className="h-3 w-3 shrink-0 text-neutral-400" />
                  <code className="min-w-0 flex-1 break-all font-mono text-[10px] text-neutral-600 dark:text-neutral-300">
                    {revealed ? apiKey.key : `${'•'.repeat(18)}${apiKey.key.slice(-8)}`}
                  </code>
                  <button
                    type="button"
                    onClick={() => toggleReveal(apiKey.id)}
                    className="rounded p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
                    aria-label={revealed ? '隐藏 API Key' : '显示 API Key'}
                  >
                    {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyKey(apiKey)}
                    className="rounded p-1 text-neutral-400 hover:text-sky-500"
                    aria-label="复制 API Key"
                  >
                    {copiedId === apiKey.id ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
