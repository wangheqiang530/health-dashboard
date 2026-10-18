import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AutoExportSyncInfo } from '../../types/health';
import { X, Server, Smartphone, Watch, ArrowRight, CheckCircle2, Copy, Check, RefreshCw } from 'lucide-react';

const sampleHaePayload = {
  data: {
    metrics: [
      {
        name: 'active_energy',
        units: 'kcal',
        data: [{ qty: 586.4, date: '2026-10-17 17:25:00 +0800' }],
      },
      {
        name: 'apple_exercise_time',
        units: 'min',
        data: [{ qty: 42, date: '2026-10-17 17:25:00 +0800' }],
      },
      {
        name: 'step_count',
        units: 'count',
        data: [{ qty: 11840, date: '2026-10-17 17:25:00 +0800' }],
      },
      {
        name: 'resting_heart_rate',
        units: 'bpm',
        data: [{ qty: 52, date: '2026-10-17 07:15:00 +0800' }],
      },
      {
        name: 'heart_rate_variability_sdnn',
        units: 'ms',
        data: [{ qty: 71.2, date: '2026-10-17 07:18:00 +0800' }],
      },
    ],
    workouts: [
      {
        name: '户外骑行',
        start: '2026-10-16 21:31:08 +0800',
        end: '2026-10-16 22:27:28 +0800',
        duration: 2249,
        activeEnergy: { qty: 407, units: 'kcal' },
        cyclingDistance: { qty: 18208, units: 'm' },
        avgHeartRate: { qty: 137, units: 'bpm' },
      },
    ],
  },
};

interface AutoExportHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncInfo: AutoExportSyncInfo;
  onRefreshData: () => void;
}

export const AutoExportHubModal: React.FC<AutoExportHubModalProps> = ({
  isOpen,
  onClose,
  syncInfo,
  onRefreshData,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'payload' | 'docker' | 'setup'>('payload');

  if (!isOpen) return null;

  const copyPayload = () => {
    navigator.clipboard.writeText(JSON.stringify(sampleHaePayload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const dockerComposeSnippet = `services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: health_dashboard
      POSTGRES_USER: health
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
    volumes:
      - health_pgdata:/var/lib/postgresql/data

  app:
    build: .
    ports:
      - "8443:8080"
    env_file: .env
    volumes:
      - ./data:/app/data

volumes:
  health_pgdata:`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-md"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl apple-glass-dark p-6 md:p-8 z-10 border border-white/10 shadow-2xl text-white"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Modal Header */}
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Health Auto Export 自动化连接中心
            </span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
            iOS 推送与 NAS 部署架构
          </h2>
          <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
            Health Auto Export 应用在 iOS 发生健康数据变化时，将通过 REST API Webhook 自动推送加密 JSON 至您的 NAS 容器。
          </p>

          {/* Device Sync Pipeline Bar */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05] mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-neutral-800 text-neutral-300">
                <Watch className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-neutral-400 block">{syncInfo.watchModel}</span>
                <span className="text-xs font-bold text-white whitespace-nowrap">Apple Watch 实时采集</span>
              </div>
            </div>

            <ArrowRight className="w-4 h-4 text-neutral-500 hidden sm:block" />

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-neutral-800 text-neutral-300">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-neutral-400 block">{syncInfo.device} ({syncInfo.osVersion})</span>
                <span className="text-xs font-bold text-white whitespace-nowrap">Auto Export 自动打包</span>
              </div>
            </div>

            <ArrowRight className="w-4 h-4 text-neutral-500 hidden sm:block" />

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-emerald-400 block">NAS Docker 容器</span>
                <span className="text-xs font-bold text-emerald-300 whitespace-nowrap">在线监听服务</span>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-white/10 pb-3 mb-4">
            <button
              onClick={() => setActiveTab('payload')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'payload'
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Health Auto Export JSON 格式
            </button>
            <button
              onClick={() => setActiveTab('docker')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'docker'
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              NAS Docker Compose 配置
            </button>
            <button
              onClick={() => setActiveTab('setup')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'setup'
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              iOS 客户端配置参数
            </button>
          </div>

          {/* Tab 1: Payload Preview */}
          {activeTab === 'payload' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-neutral-400 font-mono">
                  POST /api/v1/health-auto-export (Payload Preview)
                </span>
                <button
                  onClick={copyPayload}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-white/10 hover:bg-white/15 text-neutral-200 transition-all"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? '已复制' : '复制 JSON'}</span>
                </button>
              </div>

              <pre className="p-4 rounded-2xl bg-black/60 border border-white/10 text-xs font-mono text-emerald-300 overflow-x-auto max-h-64 scrollbar-thin">
                {JSON.stringify(sampleHaePayload, null, 2)}
              </pre>
            </div>
          )}

          {/* Tab 2: Docker Compose */}
          {activeTab === 'docker' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-neutral-400 font-mono">
                  docker-compose.yml 示例
                </span>
                <span className="text-xs text-neutral-400">
                  支持 群晖 Synology / 威联通 QNAP / UNRAID / TrueNAS
                </span>
              </div>

              <pre className="p-4 rounded-2xl bg-black/60 border border-white/10 text-xs font-mono text-sky-300 overflow-x-auto max-h-64 scrollbar-thin">
                {dockerComposeSnippet}
              </pre>
            </div>
          )}

          {/* Tab 3: iOS Setup */}
          {activeTab === 'setup' && (
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
                <span className="font-semibold text-white block mb-1">1. 在 iPhone 打开 Health Auto Export</span>
                <p className="text-neutral-400">进入「Automations (自动化)」页面，点击「+」添加 REST API 导出任务。</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
                <span className="font-semibold text-white block mb-1">2. 填入接收服务器 URL</span>
                <p className="text-neutral-400 font-mono text-[11px] text-amber-300">{syncInfo.nasEndpoint}/api/v1/health-auto-export</p>
                <p className="text-neutral-500 mt-1">Header 秘钥请在配置中心的 PostgreSQL 数据管道中复制。</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
                <span className="font-semibold text-white block mb-1">3. 勾选导出指标</span>
                <p className="text-neutral-400">勾选 Active Energy, Exercise Time, Stand Hours, Steps, Heart Rate, Resting Heart Rate, Sleep Analysis, Workouts 等全部健康元数据。</p>
              </div>
            </div>
          )}

          {/* Bottom Action Footer */}
          <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>上次推送: {syncInfo.lastSyncTime}</span>
            </div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                onRefreshData();
                onClose();
              }}
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-rose-500 via-purple-500 to-indigo-500 text-white shadow-lg hover:brightness-110 flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>重新读取数据库最新数据</span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
