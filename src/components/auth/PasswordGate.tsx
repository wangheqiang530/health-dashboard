import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Clock3,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import {
  fetchAuthStatus,
  loginDashboard,
  type DashboardSessionDuration,
} from '../../api/healthApi';
import { useTheme } from '../../context/ThemeContext';

interface PasswordGateProps {
  children: React.ReactNode;
}

type GateState = 'checking' | 'locked' | 'authenticated';

export const PasswordGate: React.FC<PasswordGateProps> = ({ children }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [state, setState] = useState<GateState>('checking');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [passwordRecoveryFile, setPasswordRecoveryFile] = useState<string | null>(null);
  const [duration, setDuration] = useState<DashboardSessionDuration>('1d');
  const [trustedDuration, setTrustedDuration] =
    useState<DashboardSessionDuration>('1d');

  useEffect(() => {
    const handleUnauthorized = () => {
      setPassword('');
      setError(null);
      setState('locked');
    };
    window.addEventListener('health-dashboard:unauthorized', handleUnauthorized);
    return () =>
      window.removeEventListener('health-dashboard:unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    let active = true;
    void fetchAuthStatus()
      .then((status) => {
        if (!active) return;
        setPasswordRecoveryFile(status.passwordRecoveryFile);
        const configuredTrustedDuration =
          status.defaultSessionDuration === 'session'
            ? '1d'
            : status.defaultSessionDuration;
        setTrustedDuration(configuredTrustedDuration);
        setDuration(configuredTrustedDuration);
        setState(status.authenticated ? 'authenticated' : 'locked');
      })
      .catch(() => {
        if (!active) return;
        setError('无法连接后端服务，请确认容器正在运行。');
        setState('locked');
      });
    return () => {
      active = false;
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password) {
      setError('请输入面板密码。');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await loginDashboard(password, duration);
      setPassword('');
      setState('authenticated');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : '登录失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  };

  if (state === 'authenticated') return <>{children}</>;

  if (state === 'checking') {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDark ? 'bg-[#060709] text-white' : 'bg-[#EAECEF] text-neutral-900'
        }`}
      >
        <div className="flex items-center gap-3 text-sm">
          <LoaderCircle className="w-5 h-5 animate-spin text-emerald-500" />
          <span>正在检查登录会话...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen relative overflow-hidden flex items-center justify-center p-5 ${
        isDark ? 'bg-[#060709] text-white' : 'bg-[#EAECEF] text-neutral-900'
      }`}
    >
      <div
        className={`absolute inset-0 ${
          isDark
            ? 'bg-[radial-gradient(circle_at_20%_20%,rgba(250,17,79,0.16),transparent_34%),radial-gradient(circle_at_80%_30%,rgba(0,245,212,0.12),transparent_30%)]'
            : 'bg-[radial-gradient(circle_at_20%_20%,rgba(250,17,79,0.1),transparent_34%),radial-gradient(circle_at_80%_30%,rgba(14,165,233,0.1),transparent_30%)]'
        }`}
      />
      <motion.form
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        onSubmit={submit}
        className={`relative z-10 w-full max-w-md rounded-3xl border p-6 sm:p-8 shadow-2xl backdrop-blur-2xl ${
          isDark ? 'bg-[#11141b]/90 border-white/10' : 'bg-white/90 border-black/10'
        }`}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#FA114F] via-[#A1FF00] to-[#00F5D4] p-[1.5px] shadow-lg shadow-rose-500/20">
            <div
              className={`w-full h-full rounded-[14px] flex items-center justify-center ${
                isDark ? 'bg-neutral-950' : 'bg-white'
              }`}
            >
              <LockKeyhole className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">健康面板密码登录</h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              验证一次后，在所选有效期内免密访问
            </p>
          </div>
        </div>

        <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-2">
          面板密码
        </label>
        <div className="relative">
          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
            autoComplete="current-password"
            placeholder="输入面板密码"
            className={`w-full h-11 pl-10 pr-11 rounded-xl border outline-none text-sm transition-colors ${
              isDark
                ? 'bg-black/30 border-white/10 focus:border-emerald-500/60'
                : 'bg-white border-black/10 focus:border-emerald-500/60'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer"
            aria-label={showPassword ? '隐藏密码' : '显示密码'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mt-4 mb-2">
          <span className="flex items-center gap-1.5">
            <Clock3 className="w-3.5 h-3.5 text-sky-500" />
            本次登录有效期
          </span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              value: 'session' as DashboardSessionDuration,
              label: '仅本次',
              description: '关闭浏览器后失效',
            },
            {
              value: trustedDuration,
              label:
                trustedDuration === '1d'
                  ? '保持 1 天'
                  : trustedDuration === '30d'
                    ? '保持 1 个月'
                    : trustedDuration === '365d'
                      ? '保持 1 年'
                      : trustedDuration === '7d'
                        ? '保持 7 天'
                        : '保持 1 小时',
              description: '可在配置中心调整时长',
            },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setDuration(option.value)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                duration === option.value
                  ? 'bg-sky-500/12 border-sky-500/40 ring-1 ring-sky-500/25'
                  : isDark
                    ? 'bg-black/20 border-white/10 hover:border-sky-500/25'
                    : 'bg-white/70 border-black/10 hover:border-sky-500/25'
              }`}
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

        {error && (
          <p className="mt-3 text-xs leading-relaxed text-rose-500 dark:text-rose-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 w-full h-11 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
        >
          {submitting ? (
            <LoaderCircle className="w-4 h-4 animate-spin" />
          ) : (
            <ShieldCheck className="w-4 h-4" />
          )}
          <span>{submitting ? '验证中...' : '登录健康面板'}</span>
        </button>

        <p className="mt-4 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          {passwordRecoveryFile ? (
            <>
              忘记密码时，可在服务端查看明文找回文件
              <span className="font-mono text-neutral-700 dark:text-neutral-300">
                {' '}
                {passwordRecoveryFile}
              </span>
              。登录后可在配置中心修改密码。
            </>
          ) : (
            '当前没有密码找回文件。登录后在配置中心重新设置一次密码，即可生成 data/dashboard-password.txt。'
          )}
        </p>
      </motion.form>
    </div>
  );
};
