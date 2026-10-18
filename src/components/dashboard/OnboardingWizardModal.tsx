import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { AutoExportSyncInfo } from '../../types/health';
import {
  fetchBackendConfig,
  testDataSource,
  updateDataSource,
  triggerSourceSync,
  type BackendConfig,
  type SourceTestResult,
} from '../../api/healthApi';
import {
  Smartphone,
  Scale,
  Bike,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  ArrowRight,
  ChevronLeft,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';

interface OnboardingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFinish: () => void;
  onOpenConfigCenter: () => void;
  syncInfo?: AutoExportSyncInfo | null;
}

type StepId = 'hae' | 'fitdays' | 'igpsport' | 'done';

export const OnboardingWizardModal: React.FC<OnboardingWizardModalProps> = ({
  isOpen,
  onClose,
  onFinish,
  syncInfo,
}) => {
  const [currentStep, setCurrentStep] = useState<StepId>('hae');
  const [backendConfig, setBackendConfig] = useState<BackendConfig | null>(null);

  // Step 1: HAE state
  const [copiedField, setCopiedField] = useState<'url' | 'key' | null>(null);
  const [haeTesting, setHaeTesting] = useState(false);
  const [haeSuccess, setHaeSuccess] = useState(false);
  const [haeMessage, setHaeMessage] = useState<string>('正在等待来自 iPhone 的首次数据推送...');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 2: Fitdays state
  const [fitdaysAccount, setFitdaysAccount] = useState('');
  const [fitdaysPassword, setFitdaysPassword] = useState('');
  const [showFitdaysPassword, setShowFitdaysPassword] = useState(false);
  const [fitdaysTesting, setFitdaysTesting] = useState(false);
  const [fitdaysResult, setFitdaysResult] = useState<SourceTestResult | null>(null);

  // Step 3: iGPSPORT state
  const [igpsportAccount, setIgpsportAccount] = useState('');
  const [igpsportPassword, setIgpsportPassword] = useState('');
  const [showIgpsportPassword, setShowIgpsportPassword] = useState(false);
  const [igpsportTesting, setIgpsportTesting] = useState(false);
  const [igpsportResult, setIgpsportResult] = useState<SourceTestResult | null>(null);

  // Load backend config (for endpoints and keys)
  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    fetchBackendConfig()
      .then((cfg) => {
        if (!mounted) return;
        setBackendConfig(cfg);
        const fitdays = cfg.sources.find((s) => s.id === 'fitdays');
        if (fitdays?.account) setFitdaysAccount(fitdays.account);
        const igp = cfg.sources.find((s) => s.id === 'igpsport');
        if (igp?.account) setIgpsportAccount(igp.account);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [isOpen]);

  // Polling for HAE sync check when on step 1
  const checkHaeStatus = async (silent = false) => {
    if (!silent) setHaeTesting(true);
    try {
      const res = await testDataSource('hae');
      const details = res.details as {
        hasReceivedData?: boolean;
        metricCount?: number;
        lastReceivedAt?: string | null;
        archiveWritable?: boolean;
      };
      if (res.ok && (details?.hasReceivedData || (details?.metricCount && details.metricCount > 0) || details?.lastReceivedAt)) {
        setHaeSuccess(true);
        setHaeMessage(res.message || '检测成功，已接收来自 iPhone 的健康数据。');
      } else {
        setHaeSuccess(false);
        setHaeMessage(res.message || '接收端点已就绪，尚未检测到来自 iPhone 的数据推送。');
      }
    } catch (err) {
      if (!silent) {
        setHaeSuccess(false);
        setHaeMessage(err instanceof Error ? err.message : '检测失败');
      }
    } finally {
      if (!silent) setHaeTesting(false);
    }
  };

  useEffect(() => {
    if (isOpen && currentStep === 'hae') {
      void checkHaeStatus(true);
      pollingRef.current = setInterval(() => {
        void checkHaeStatus(true);
      }, 3500);
    } else if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isOpen, currentStep]);

  // Fitdays save and test
  const handleTestAndSaveFitdays = async () => {
    if (!fitdaysAccount.trim()) {
      setFitdaysResult({ ok: false, message: '请输入手机号或账号。', details: {} });
      return;
    }
    setFitdaysTesting(true);
    setFitdaysResult(null);
    try {
      await updateDataSource('fitdays', {
        account: fitdaysAccount.trim(),
        password: fitdaysPassword.trim() || undefined,
        enabled: true,
        cronExpression: '15 */6 * * *',
      });
      const res = await testDataSource('fitdays');
      setFitdaysResult(res);
      if (res.ok) {
        void triggerSourceSync('fitdays').catch(() => {});
      }
    } catch (err) {
      setFitdaysResult({
        ok: false,
        message: err instanceof Error ? err.message : '连接测试失败',
        details: {},
      });
    } finally {
      setFitdaysTesting(false);
    }
  };

  // iGPSPORT save and test
  const handleTestAndSaveIgpsport = async () => {
    if (!igpsportAccount.trim()) {
      setIgpsportResult({ ok: false, message: '请输入手机号或账号。', details: {} });
      return;
    }
    setIgpsportTesting(true);
    setIgpsportResult(null);
    try {
      await updateDataSource('igpsport', {
        account: igpsportAccount.trim(),
        password: igpsportPassword.trim() || undefined,
        enabled: true,
        cronExpression: '30 */6 * * *',
      });
      const res = await testDataSource('igpsport');
      setIgpsportResult(res);
      if (res.ok) {
        void triggerSourceSync('igpsport').catch(() => {});
      }
    } catch (err) {
      setIgpsportResult({
        ok: false,
        message: err instanceof Error ? err.message : '连接测试失败',
        details: {},
      });
    } finally {
      setIgpsportTesting(false);
    }
  };

  const handleCopy = (text: string, field: 'url' | 'key') => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const effectiveEndpoint =
    backendConfig?.hae?.endpoint ||
    (syncInfo?.nasEndpoint ? `${syncInfo.nasEndpoint}/api/v1/health-auto-export` : `${window.location.origin}/api/v1/health-auto-export`);
  const effectiveApiKey = backendConfig?.hae?.apiKey || '';

  if (!isOpen) return null;

  const steps: { id: StepId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'hae', label: 'iOS 健康 (HAE)', icon: Smartphone },
    { id: 'fitdays', label: '体脂秤 (Fitdays)', icon: Scale },
    { id: 'igpsport', label: '码表 (iGPSPORT)', icon: Bike },
    { id: 'done', label: '完成准备', icon: CheckCircle2 },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-2xl bg-white/95 dark:bg-[#121316]/95 backdrop-blur-2xl rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-black/5 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-rose-500 via-indigo-500 to-emerald-400 text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                首次配置新手向导
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                辅助配置健康数据流与设备联动，可按需配置或随时跳过
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onFinish}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 px-3 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="跳过配置，数据页以空值进入"
            >
              跳过向导直接进入
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stepper Progress Bar */}
        <div className="px-6 py-3 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5 flex items-center justify-between gap-2 overflow-x-auto">
          {steps.map((st, idx) => {
            const isActive = st.id === currentStep;
            const isPassed = currentStepIndex > idx;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setCurrentStep(st.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
                    : isPassed
                      ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                      : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isActive
                      ? 'bg-indigo-500 text-white'
                      : isPassed
                        ? 'bg-emerald-500 text-white'
                        : 'bg-black/10 dark:bg-white/10 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  {isPassed ? <Check className="w-3 h-3" /> : idx + 1}
                </span>
                <span>{st.label}</span>
              </button>
            );
          })}
        </div>

        {/* Step Contents */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Step 1: HAE */}
          {currentStep === 'hae' && (
            <motion.div
              key="step-hae"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-5"
            >
              <div className="space-y-1">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-indigo-500" />
                  步骤 1: 连接 iOS 健康 (Health Auto Export)
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  通过 iPhone 上的 Health Auto Export App，将 Apple Watch 与 iOS 健康体征实时同步至你的私有看板。
                </p>
              </div>

              {/* Webhook Endpoint Box */}
              <div className="space-y-3 p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
                    REST API Webhook 接收地址
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={effectiveEndpoint}
                      className="flex-1 px-3 py-2 text-xs font-mono bg-white dark:bg-[#1a1c22] rounded-xl border border-black/10 dark:border-white/10 text-neutral-800 dark:text-neutral-200 select-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(effectiveEndpoint, 'url')}
                      className="px-3 py-2 text-xs font-medium rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm shadow-indigo-500/20"
                    >
                      {copiedField === 'url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'url' ? '已复制' : '复制'}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
                    请求头密钥 Header (x-api-key)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={effectiveApiKey}
                      className="flex-1 px-3 py-2 text-xs font-mono bg-white dark:bg-[#1a1c22] rounded-xl border border-black/10 dark:border-white/10 text-neutral-800 dark:text-neutral-200 select-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(effectiveApiKey, 'key')}
                      className="px-3 py-2 text-xs font-medium rounded-xl bg-neutral-800 hover:bg-neutral-900 dark:bg-white/10 dark:hover:bg-white/15 text-white flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    >
                      {copiedField === 'key' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'key' ? '已复制' : '复制'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Configuration Tutorial Steps */}
              <div className="p-4 rounded-2xl bg-indigo-500/[0.04] border border-indigo-500/15 space-y-2">
                <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  iPhone 手机端配置简易教程:
                </h4>
                <ol className="text-xs text-neutral-600 dark:text-neutral-300 space-y-1.5 list-decimal list-inside leading-relaxed">
                  <li>在 App Store 下载并打开「Health Auto Export」</li>
                  <li>点击底部「Automations」- 选择「REST API」或自动化导出任务</li>
                  <li>将上方 URL 粘贴至「URL」输入框</li>
                  <li>在「Headers」新增项：名称填 <code>x-api-key</code>，值填上方密钥</li>
                  <li>在手机端点击「Send Now (立即发送)」测试推送</li>
                </ol>
              </div>

              {/* Live Connectivity Check Box */}
              <div
                className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                  haeSuccess
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                    : 'bg-black/[0.02] dark:bg-white/[0.02] border-black/10 dark:border-white/10 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  {haeSuccess ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <RefreshCw
                      className={`w-5 h-5 text-indigo-500 shrink-0 mt-0.5 ${haeTesting ? 'animate-spin' : ''}`}
                    />
                  )}
                  <div>
                    <div className="text-xs font-bold">
                      {haeSuccess ? '连接检测成功' : '实时监听同步状态中'}
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                      {haeMessage}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void checkHaeStatus(false)}
                  disabled={haeTesting}
                  className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 text-xs font-medium transition-colors cursor-pointer shrink-0"
                >
                  {haeTesting ? '检测中...' : '立即检测'}
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Fitdays */}
          {currentStep === 'fitdays' && (
            <motion.div
              key="step-fitdays"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-5"
            >
              <div className="space-y-1">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <Scale className="w-5 h-5 text-indigo-500" />
                  步骤 2: 配置智能体脂秤 (Fitdays，可跳过)
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  支持沃莱、Fitdays、乐福等智能体脂秤。自动定时同步体重、体脂率、骨骼肌、内脏脂肪等体测数据。
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 space-y-3.5">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
                    Fitdays 注册手机号或邮箱账号
                  </label>
                  <input
                    type="text"
                    value={fitdaysAccount}
                    onChange={(e) => setFitdaysAccount(e.target.value)}
                    placeholder="例如: 13800000000 或 user@example.com"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#1a1c22] rounded-xl border border-black/10 dark:border-white/10 text-neutral-800 dark:text-neutral-200 outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
                    Fitdays 登录密码
                  </label>
                  <div className="relative">
                    <input
                      type={showFitdaysPassword ? 'text' : 'password'}
                      value={fitdaysPassword}
                      onChange={(e) => setFitdaysPassword(e.target.value)}
                      placeholder="登录密码 (AES-256 本地加密存储)"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#1a1c22] rounded-xl border border-black/10 dark:border-white/10 text-neutral-800 dark:text-neutral-200 outline-none focus:border-indigo-500 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowFitdaysPassword(!showFitdaysPassword)}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                    >
                      {showFitdaysPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleTestAndSaveFitdays}
                    disabled={fitdaysTesting}
                    className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-indigo-500/20"
                  >
                    {fitdaysTesting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{fitdaysTesting ? '正在验证连接...' : '测试连接并保存'}</span>
                  </button>
                  <span className="text-[11px] text-neutral-400">
                    如无此设备，直接点击下一步即可跳过
                  </span>
                </div>

                {fitdaysResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                      fitdaysResult.ok
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
                    }`}
                  >
                    {fitdaysResult.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-semibold">{fitdaysResult.ok ? '连接验证成功' : '连接失败'}</div>
                      <div className="mt-0.5 leading-relaxed">{fitdaysResult.message}</div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 3: iGPSPORT */}
          {currentStep === 'igpsport' && (
            <motion.div
              key="step-igpsport"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-5"
            >
              <div className="space-y-1">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <Bike className="w-5 h-5 text-indigo-500" />
                  步骤 3: 配置骑行码表 (iGPSPORT，可跳过)
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  支持 iGPSPORT 码表骑行活动记录与原生 FIT 轨迹文件同步，自动合流至大屏体能训练与心率区间分析。
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 space-y-3.5">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
                    iGPSPORT 注册手机号或账号
                  </label>
                  <input
                    type="text"
                    value={igpsportAccount}
                    onChange={(e) => setIgpsportAccount(e.target.value)}
                    placeholder="例如: 13800000000"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#1a1c22] rounded-xl border border-black/10 dark:border-white/10 text-neutral-800 dark:text-neutral-200 outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
                    iGPSPORT 登录密码
                  </label>
                  <div className="relative">
                    <input
                      type={showIgpsportPassword ? 'text' : 'password'}
                      value={igpsportPassword}
                      onChange={(e) => setIgpsportPassword(e.target.value)}
                      placeholder="登录密码 (AES-256 本地加密存储)"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#1a1c22] rounded-xl border border-black/10 dark:border-white/10 text-neutral-800 dark:text-neutral-200 outline-none focus:border-indigo-500 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowIgpsportPassword(!showIgpsportPassword)}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                    >
                      {showIgpsportPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleTestAndSaveIgpsport}
                    disabled={igpsportTesting}
                    className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-indigo-500/20"
                  >
                    {igpsportTesting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{igpsportTesting ? '正在验证连接...' : '测试连接并保存'}</span>
                  </button>
                  <span className="text-[11px] text-neutral-400">
                    如无此设备，直接点击下一步即可跳过
                  </span>
                </div>

                {igpsportResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                      igpsportResult.ok
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
                    }`}
                  >
                    {igpsportResult.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-semibold">{igpsportResult.ok ? '连接验证成功' : '连接失败'}</div>
                      <div className="mt-0.5 leading-relaxed">{igpsportResult.message}</div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 4: Done */}
          {currentStep === 'done' && (
            <motion.div
              key="step-done"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-5 text-center py-4"
            >
              <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/15">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                  初始化向导已就绪
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  你已完成私有化健康数字看板的基础配置。后续如有更多设备，可以随时在「配置中心」中开启同步或管理数据备份。
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 text-left max-w-md mx-auto text-xs space-y-2 text-neutral-600 dark:text-neutral-300">
                <div className="flex items-center justify-between">
                  <span>iOS 健康 (HAE):</span>
                  <span className={haeSuccess ? 'text-emerald-500 font-semibold' : 'text-neutral-400'}>
                    {haeSuccess ? '已成功接收推送' : 'Webhook 已就绪'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Fitdays 智能体脂秤:</span>
                  <span className={fitdaysResult?.ok ? 'text-emerald-500 font-semibold' : 'text-neutral-400'}>
                    {fitdaysResult?.ok ? '已启用自动同步' : '未配置 (已跳过)'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>iGPSPORT 码表:</span>
                  <span className={igpsportResult?.ok ? 'text-emerald-500 font-semibold' : 'text-neutral-400'}>
                    {igpsportResult?.ok ? '已启用自动同步' : '未配置 (已跳过)'}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 bg-black/[0.02] dark:bg-white/[0.02] border-t border-black/5 dark:border-white/10 flex items-center justify-between">
          <div>
            {currentStepIndex > 0 && currentStep !== 'done' ? (
              <button
                type="button"
                onClick={() => setCurrentStep(steps[currentStepIndex - 1].id)}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>上一步</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onFinish}
                className="px-3 py-1.5 rounded-xl text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors cursor-pointer"
              >
                跳过向导直接进入
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep === 'hae' && (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentStep('fitdays')}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                >
                  稍后配置 (跳过)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep('fitdays')}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-indigo-500 hover:bg-indigo-600 text-white flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 transition-colors cursor-pointer"
                >
                  <span>下一步: 配置体脂秤</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {currentStep === 'fitdays' && (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentStep('igpsport')}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                >
                  跳过体脂秤
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep('igpsport')}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-indigo-500 hover:bg-indigo-600 text-white flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 transition-colors cursor-pointer"
                >
                  <span>下一步: 配置码表</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {currentStep === 'igpsport' && (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentStep('done')}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                >
                  跳过码表
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep('done')}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-indigo-500 hover:bg-indigo-600 text-white flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 transition-colors cursor-pointer"
                >
                  <span>完成配置</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {currentStep === 'done' && (
              <button
                type="button"
                onClick={onFinish}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white flex items-center gap-1.5 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
              >
                <span>进入健康数字大屏</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
