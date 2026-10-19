import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react';
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
  verifyAccessToken,
} from '../../api/healthApi';
import { useTheme } from '../../context/ThemeContext';

interface AccessTokenGateProps {
  children: React.ReactNode;
}

type GateState = 'checking' | 'locked' | 'authenticated';

export const AccessTokenGate: React.FC<AccessTokenGateProps> = ({ children }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [state, setState] = useState<GateState>(() =>
    getAccessToken() ? 'checking' : 'locked'
  );
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const lock = () => {
    clearAccessToken();
    setToken('');
    setError(null);
    setState('locked');
  };

  useEffect(() => {
    const handleUnauthorized = () => lock();
    window.addEventListener('health-dashboard:unauthorized', handleUnauthorized);
    return () =>
      window.removeEventListener('health-dashboard:unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    let active = true;
    const saved = getAccessToken();
    if (!saved) {
      setState('locked');
      return;
    }

    void verifyAccessToken(saved)
      .then((valid) => {
        if (!active) return;
        if (valid) {
          setState('authenticated');
        } else {
          lock();
        }
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
    const nextToken = token.trim();
    if (!nextToken) {
      setError('请输入面板访问密钥。');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const valid = await verifyAccessToken(nextToken);
      if (!valid) {
        setError('访问密钥无效，请检查 data/dashboard-access-token.txt。');
        return;
      }
      setAccessToken(nextToken);
      setToken('');
      setState('authenticated');
    } catch {
      setError('无法连接后端服务，请稍后重试。');
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
          <span>正在验证面板访问权限...</span>
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
          isDark
            ? 'bg-[#11141b]/90 border-white/10'
            : 'bg-white/90 border-black/10'
        }`}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#FA114F] via-[#A1FF00] to-[#00F5D4] p-[1.5px] shadow-lg shadow-rose-500/20">
            <div
              className={`w-full h-full rounded-[14px] flex items-center justify-center ${
                isDark ? 'bg-neutral-950' : 'bg-white'
              }`}
            >
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">健康面板访问验证</h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              私有健康数据仅在验证后加载
            </p>
          </div>
        </div>

        <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-2">
          面板访问密钥
        </label>
        <div className="relative">
          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type={showToken ? 'text' : 'password'}
            value={token}
            onChange={(event) => setToken(event.target.value)}
            autoFocus
            autoComplete="current-password"
            placeholder="输入 DASHBOARD_ACCESS_TOKEN"
            className={`w-full h-11 pl-10 pr-11 rounded-xl border outline-none font-mono text-sm transition-colors ${
              isDark
                ? 'bg-black/30 border-white/10 focus:border-emerald-500/60'
                : 'bg-white border-black/10 focus:border-emerald-500/60'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowToken((value) => !value)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
            aria-label={showToken ? '隐藏访问密钥' : '显示访问密钥'}
          >
            {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-xs leading-relaxed text-rose-500 dark:text-rose-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 w-full h-11 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {submitting ? (
            <LoaderCircle className="w-4 h-4 animate-spin" />
          ) : (
            <ShieldCheck className="w-4 h-4" />
          )}
          <span>{submitting ? '验证中...' : '解锁健康面板'}</span>
        </button>

        <p className="mt-4 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          密钥由服务端首次启动时生成，并保存在宿主机
          <span className="font-mono text-neutral-700 dark:text-neutral-300"> data/dashboard-access-token.txt</span>。
          也可通过环境变量 <span className="font-mono">DASHBOARD_ACCESS_TOKEN</span> 指定。
        </p>
      </motion.form>
    </div>
  );
};
