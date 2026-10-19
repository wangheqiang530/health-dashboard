import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Clock3,
  Eye,
  EyeOff,
  FileKey2,
  KeyRound,
  LoaderCircle,
  Save,
  ShieldCheck,
} from 'lucide-react';
import {
  changeDashboardPassword,
  fetchAuthSettings,
  updateDashboardSessionDuration,
  type AuthSettings,
  type DashboardSessionDuration,
} from '../../api/healthApi';
import { AppleCard } from '../ui/AppleCard';

type Message = { type: 'success' | 'error'; text: string } | null;

export const SecuritySettings: React.FC = () => {
  const [settings, setSettings] = useState<AuthSettings | null>(null);
  const [duration, setDuration] = useState<DashboardSessionDuration>('1d');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingDuration, setSavingDuration] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    let active = true;
    void fetchAuthSettings()
      .then((nextSettings) => {
        if (!active) return;
        setSettings(nextSettings);
        setDuration(nextSettings.defaultSessionDuration);
      })
      .catch((error) => {
        if (!active) return;
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : '读取访问安全设置失败。',
        });
      });
    return () => {
      active = false;
    };
  }, []);

  const saveDuration = async () => {
    setSavingDuration(true);
    setMessage(null);
    try {
      const result = await updateDashboardSessionDuration(duration);
      setSettings((current) =>
        current ? { ...current, defaultSessionDuration: result.defaultSessionDuration } : current
      );
      setMessage({ type: 'success', text: '默认会话有效期已更新，下次登录生效。' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '保存会话有效期失败。',
      });
    } finally {
      setSavingDuration(false);
    }
  };

  const savePassword = async () => {
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: '新密码至少需要 8 个字符。' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: '两次输入的新密码不一致。' });
      return;
    }

    setSavingPassword(true);
    setMessage(null);
    try {
      const result = await changeDashboardPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSettings(await fetchAuthSettings());
      setMessage({ type: 'success', text: result.message });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '修改密码失败。',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <AppleCard>
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">访问密码与会话</h3>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              密码只验证一次；会话有效期内使用 HttpOnly Cookie 自动续用，不再重复输入密码。
            </p>
          </div>
        </div>
        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 px-3 py-2">
          <span className="flex items-center gap-1.5">
            <FileKey2 className="w-3.5 h-3.5 text-amber-500" />
            密码找回文件：
            <span className="font-mono text-neutral-700 dark:text-neutral-300 break-all">
              {settings?.passwordRecoveryFile || '尚未生成，请重新设置一次密码'}
            </span>
          </span>
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded-xl border text-xs flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-300'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {!settings ? (
        <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <LoaderCircle className="w-4 h-4 animate-spin" />
          正在读取安全设置...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.025] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock3 className="w-4 h-4 text-sky-500" />
              <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                登录页“保持登录”时长
              </h4>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed mb-3">
              首次登录只显示“仅本次”和“保持登录”两个选项。这里设置“保持登录”对应的有效期，
              不影响当前已经建立的会话。
            </p>
            <div className="grid grid-cols-2 gap-2">
              {settings.sessionDurations.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDuration(option.value)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    duration === option.value
                      ? 'bg-sky-500/12 border-sky-500/40 ring-1 ring-sky-500/25'
                      : 'bg-white/60 dark:bg-black/20 border-black/5 dark:border-white/10 hover:border-sky-500/25'
                  }`}
                  title={option.description}
                >
                  <span className="block text-xs font-bold text-neutral-900 dark:text-white">
                    {option.label}
                  </span>
                  <span className="block text-[10px] text-neutral-400 mt-0.5">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void saveDuration()}
              disabled={savingDuration}
              className="mt-3 h-9 px-3 rounded-xl text-xs font-semibold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {savingDuration ? (
                <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{savingDuration ? '保存中...' : '保存登录有效期'}</span>
            </button>
          </div>

          <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.025] p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-bold text-neutral-900 dark:text-white">修改面板密码与找回</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswords((current) => !current)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-800 dark:hover:text-white cursor-pointer"
                aria-label={showPasswords ? '隐藏密码' : '显示密码'}
              >
                {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-neutral-400 leading-relaxed mb-2">
              修改或首次设置密码后，当前明文密码会写入宿主机
              <span className="font-mono"> data/dashboard-password.txt</span>，用于本地找回。
            </p>
            <div className="space-y-2.5">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="当前密码"
                className="w-full h-10 px-3 rounded-xl bg-white/70 dark:bg-black/30 border border-black/10 dark:border-white/10 text-neutral-900 dark:text-white text-xs outline-none focus:border-amber-500/60"
              />
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="新密码（至少 8 个字符）"
                className="w-full h-10 px-3 rounded-xl bg-white/70 dark:bg-black/30 border border-black/10 dark:border-white/10 text-neutral-900 dark:text-white text-xs outline-none focus:border-amber-500/60"
              />
              <input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="再次输入新密码"
                className="w-full h-10 px-3 rounded-xl bg-white/70 dark:bg-black/30 border border-black/10 dark:border-white/10 text-neutral-900 dark:text-white text-xs outline-none focus:border-amber-500/60"
              />
            </div>
            <button
              type="button"
              onClick={() => void savePassword()}
              disabled={savingPassword || !currentPassword || !newPassword}
              className="mt-3 h-9 px-3 rounded-xl text-xs font-semibold bg-amber-500 text-neutral-950 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {savingPassword ? (
                <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <KeyRound className="w-3.5 h-3.5" />
              )}
              <span>{savingPassword ? '更新中...' : '更新密码'}</span>
            </button>
          </div>
        </div>
      )}
    </AppleCard>
  );
};
