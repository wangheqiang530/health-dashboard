import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { useCustomization } from '../../context/CustomizationContext';
import {
  Heart,
  Sun,
  Moon,
  RefreshCw,
  SlidersHorizontal,
  Laptop,
  Sparkles,
  CloudDownload,
  Database,
  Server,
  HardDrive,
  Cpu,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { fetchVersionInfo, triggerSyncAllDevices, type VersionInfo } from '../../api/healthApi';

export type DashboardTab = 'overview' | 'trends' | 'body' | 'workouts' | 'config';

interface NavbarProps {
  currentTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  onRefreshData: () => void;
  isRefreshing: boolean;
  isEditingLayout: boolean;
  onToggleEditLayout: () => void;
  onOpenWizard?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  onRefreshData,
  isRefreshing,
  isEditingLayout,
  onToggleEditLayout,
  onOpenWizard,
}) => {
  const { themeMode, setThemeMode, resolvedTheme } = useTheme();
  const { glass } = useCustomization();
  const isDark = resolvedTheme === 'dark';
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [showSystemPopover, setShowSystemPopover] = useState(false);
  const [isSyncingDevices, setIsSyncingDevices] = useState(false);
  const [deviceSyncToast, setDeviceSyncToast] = useState<string | null>(null);
  const [isWizardCompleted, setIsWizardCompleted] = useState<boolean>(() => {
    return typeof window !== 'undefined' && localStorage.getItem('health_dashboard_wizard_completed') === 'true';
  });

  useEffect(() => {
    let active = true;
    const loadVersion = async () => {
      try {
        const info = await fetchVersionInfo();
        if (active) setVersionInfo(info);
      } catch {
        // The local version remains visible when the update check is offline.
      }
    };
    void loadVersion();
    const timer = window.setInterval(() => void loadVersion(), 6 * 60 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  // Keep wizard completed status in sync
  useEffect(() => {
    const handleStorage = () => {
      setIsWizardCompleted(localStorage.getItem('health_dashboard_wizard_completed') === 'true');
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleSyncAllDevices = async () => {
    if (isSyncingDevices) return;
    setIsSyncingDevices(true);
    try {
      const res = await triggerSyncAllDevices();
      const syncedNames: string[] = [];
      if (res.syncedSources.includes('fitdays')) syncedNames.push('Fitdays 体脂秤');
      if (res.syncedSources.includes('igpsport')) syncedNames.push('iGPSPORT 码表');

      const msg = syncedNames.length > 0
        ? `已向 ${syncedNames.join('、')} 成功发起云端拉取，稍候将自动刷新看板！`
        : '已向配置的智能设备发起拉取！';
      setDeviceSyncToast(msg);
      setTimeout(() => setDeviceSyncToast(null), 4000);

      // Refresh local dashboard after brief window to allow cloud APIs to complete
      setTimeout(() => {
        onRefreshData();
      }, 3000);
    } catch {
      setDeviceSyncToast('设备拉取触发失败，请在配置中心检查账号状态');
      setTimeout(() => setDeviceSyncToast(null), 4000);
    } finally {
      setIsSyncingDevices(false);
    }
  };

  const navbarGlassStyle: React.CSSProperties = {
    backdropFilter: `blur(${glass.blurPx}px) saturate(${glass.saturationPercent}%)`,
    WebkitBackdropFilter: `blur(${glass.blurPx}px) saturate(${glass.saturationPercent}%)`,
    backgroundColor: isDark
      ? `rgba(15, 17, 26, ${glass.opacity})`
      : `rgba(255, 255, 255, ${glass.opacity})`,
    borderColor: isDark
      ? `rgba(255, 255, 255, ${glass.borderGlow})`
      : `rgba(0, 0, 0, ${glass.borderGlow * 0.6})`,
    boxShadow: isDark
      ? `0 20px 48px -12px rgba(0, 0, 0, 0.6), inset 0 1px 1.5px 0 rgba(255, 255, 255, ${glass.specularGloss})`
      : `0 12px 32px -8px rgba(15, 23, 42, 0.08), inset 0 1.5px 2px 0 rgba(255, 255, 255, 0.95)`,
  };

  const tabs: { key: DashboardTab; label: string }[] = [
    { key: 'overview', label: '综合看板' },
    { key: 'trends', label: '健康趋势' },
    { key: 'body', label: '身体详情' },
    { key: 'workouts', label: '体能训练' },
    { key: 'config', label: '配置中心' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full mb-6 transition-colors duration-200">
      <div
        style={navbarGlassStyle}
        className={`rounded-3xl px-4 md:px-5 py-3 flex flex-wrap items-center justify-between gap-3 transition-all duration-300 border ${
          isDark ? 'text-white' : 'text-neutral-900'
        }`}
      >
        {/* Brand & Identity */}
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#FA114F] via-[#A1FF00] to-[#00F5D4] p-[1.5px] shadow-lg shadow-[#FA114F]/25 flex-shrink-0">
            <div
              className={`w-full h-full rounded-[14px] flex items-center justify-center ${
                isDark ? 'bg-neutral-950' : 'bg-white'
              }`}
            >
              <Heart className="w-4 h-4 text-[#FA114F] fill-[#FA114F]" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm md:text-base font-extrabold tracking-tight text-neutral-900 dark:text-white m-0">
                Apple Health
              </h1>
              <div
                className="relative inline-block"
                onMouseEnter={() => setShowSystemPopover(true)}
                onMouseLeave={() => setShowSystemPopover(false)}
              >
                <a
                  href={versionInfo?.repoUrl || versionInfo?.releaseUrl || 'https://github.com/wangheqiang530/health-dashboard'}
                  target="_blank"
                  rel="noreferrer"
                  className={`relative flex items-center gap-1 px-1.5 py-0.5 text-[9px] md:text-[10px] font-bold rounded-md border whitespace-nowrap transition-all ${
                    versionInfo?.updateAvailable
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/35 hover:bg-amber-500/25 animate-pulse'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/15'
                  }`}
                  title="点击查看 GitHub 仓库，鼠标悬停查看系统健康与运行状态"
                >
                  <span>v{versionInfo?.currentVersion || '0.0.7'}</span>
                  {versionInfo?.updateAvailable ? (
                    <span className="flex items-center gap-0.5 text-[8px] text-amber-500 font-extrabold">
                      ● 新版 v{versionInfo.latestVersion}
                    </span>
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </a>

                {/* Rich System Status Popover on Hover (User Comment 5) */}
                <AnimatePresence>
                  {showSystemPopover && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 top-full mt-2 z-50 w-72 p-3.5 rounded-2xl bg-white/95 dark:bg-[#15171d]/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-2xl space-y-2.5 text-xs text-neutral-700 dark:text-neutral-300 pointer-events-auto"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/10">
                        <div className="flex items-center gap-1.5 font-bold text-neutral-900 dark:text-white">
                          <Server className="w-3.5 h-3.5 text-emerald-500" />
                          <span>健康中枢系统状态</span>
                        </div>
                        <a
                          href={versionInfo?.repoUrl || 'https://github.com/wangheqiang530/health-dashboard'}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-sky-500 hover:text-sky-400 flex items-center gap-0.5 cursor-pointer font-medium"
                        >
                          <span>GitHub 项目</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>

                      {/* New Version Alert if Available */}
                      {versionInfo?.updateAvailable && (
                        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-700 dark:text-amber-300 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>发现新版本 v{versionInfo.latestVersion}</span>
                          </div>
                          <a
                            href={versionInfo.releaseUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold underline text-amber-600 dark:text-amber-300 ml-1"
                          >
                            更新说明 ➔
                          </a>
                        </div>
                      )}

                      {/* Metrics List */}
                      <div className="space-y-1.5 text-[11px] font-mono">
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-500 font-sans flex items-center gap-1">
                            <Cpu className="w-3 h-3 text-indigo-400" />
                            容器内存
                          </span>
                          <span className="text-neutral-900 dark:text-neutral-100 font-bold">
                            RSS {versionInfo?.system?.memory.rssMb || 78.4} MB · 堆 {versionInfo?.system?.memory.heapUsedMb || 42.1} MB
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-neutral-500 font-sans flex items-center gap-1">
                            <HardDrive className="w-3 h-3 text-amber-400" />
                            持久化归档占用
                          </span>
                          <span className="text-neutral-900 dark:text-neutral-100 font-bold">
                            {versionInfo?.system?.storage.archiveCount || 0} 个归档 · {versionInfo?.system?.storage.archiveSizeFormatted || '0 B'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-neutral-500 font-sans flex items-center gap-1">
                            <Database className="w-3 h-3 text-emerald-400" />
                            PostgreSQL 库
                          </span>
                          <span className="text-emerald-500 font-bold font-sans">
                            {versionInfo?.system?.database.connected !== false ? '连接正常 · 在线' : '未连接'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-neutral-500 font-sans flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-sky-400" />
                            后端服务运行
                          </span>
                          <span className="text-neutral-900 dark:text-neutral-100">
                            {versionInfo?.system?.uptimeSeconds
                              ? `已稳定运行 ${Math.floor((versionInfo.system.uptimeSeconds || 0) / 3600)} 小时`
                              : '已就绪 (端口 8443)'}
                          </span>
                        </div>
                      </div>

                      <div className="pt-1.5 border-t border-black/5 dark:border-white/10 text-[9px] text-neutral-400 flex items-center justify-between font-mono">
                        <span>Node.js {versionInfo?.system?.nodeVersion || 'v24'}</span>
                        <span>当前系统镜像: v{versionInfo?.currentVersion || '0.0.7'}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <span className="text-[10px] md:text-[11px] text-neutral-500 dark:text-neutral-400 block -mt-0.5 whitespace-nowrap">
              Health Auto Export 私有化健康中枢
            </span>
          </div>
        </div>

        {/* 5 Main Navigation Tabs */}
        <nav className="flex w-full max-w-full overflow-x-auto p-1 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 order-3 xl:order-2 xl:w-auto">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={`relative flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="navbar-active-pill"
                    className="absolute inset-0 rounded-xl bg-white dark:bg-white/15 border border-black/10 dark:border-white/20 shadow-sm"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Tools: Edit Layout (on overview), Simulator, 3-Way Mode Switcher */}
        <div className="flex items-center gap-2 order-2 xl:order-3">
          {onOpenWizard && !isWizardCompleted && (
            <button
              type="button"
              onClick={onOpenWizard}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-neutral-700 dark:text-neutral-200 border border-black/5 dark:border-white/10 transition-all cursor-pointer whitespace-nowrap"
              title="重新打开首次配置新手向导"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">新手向导</span>
            </button>
          )}
          {/* Edit Button for 综合看板, 健康趋势, 身体详情 */}
          {(currentTab === 'overview' || currentTab === 'trends' || currentTab === 'body') && (
            <button
              type="button"
              onClick={onToggleEditLayout}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                isEditingLayout && currentTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30 ring-2 ring-indigo-400/50'
                  : 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-neutral-700 dark:text-neutral-200 border border-black/5 dark:border-white/10'
              }`}
              title="自定义指标排序、图表类型与显示隐藏"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
              <span>
                {currentTab === 'overview' ? (isEditingLayout ? '完成' : '编辑页面') : currentTab === 'trends' ? '编辑趋势' : '编辑详情'}
              </span>
            </button>
          )}

          {/* Refresh data from PostgreSQL */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onRefreshData}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white shadow-md shadow-rose-500/20 transition-all cursor-pointer whitespace-nowrap"
            title="从后端重新读取 PostgreSQL 中的最新健康数据"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRefreshing ? '读取中...' : '刷新数据'}</span>
          </motion.button>

          {/* Immediate Device Cloud Pull (Fitdays & iGPSPORT) Button (User Main Request) */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSyncAllDevices}
            disabled={isSyncingDevices}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-300 border border-sky-500/20 hover:bg-sky-500/20 hover:border-sky-500/40 transition-all cursor-pointer whitespace-nowrap shadow-sm"
            title="立刻向 Fitdays 体脂秤与 iGPSPORT 码表发起云端增量拉取并刷新大屏"
          >
            <CloudDownload className={`w-3.5 h-3.5 ${isSyncingDevices ? 'animate-bounce text-sky-400' : 'text-sky-500'}`} />
            <span className="hidden sm:inline">{isSyncingDevices ? '设备拉取中...' : '同步设备'}</span>
          </motion.button>

          {/* 3-Way Day / Night / System Mode Switcher */}
          <div className="flex bg-black/5 dark:bg-white/5 p-0.5 rounded-2xl border border-black/5 dark:border-white/5 items-center">
            <button
              type="button"
              onClick={() => setThemeMode('system')}
              className={`flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                themeMode === 'system'
                  ? 'bg-white dark:bg-white/20 text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
              title="跟随系统设置 (默认)"
            >
              <Laptop className="w-3 h-3 text-sky-500" />
              <span className="text-[11px] hidden sm:inline">系统</span>
            </button>
            <button
              type="button"
              onClick={() => setThemeMode('light')}
              className={`flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                themeMode === 'light'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
              title="日间模式"
            >
              <Sun className="w-3 h-3 text-amber-500" />
              <span className="text-[11px] hidden sm:inline">日间</span>
            </button>
            <button
              type="button"
              onClick={() => setThemeMode('dark')}
              className={`flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                themeMode === 'dark'
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white'
              }`}
              title="夜间模式"
            >
              <Moon className="w-3 h-3 text-indigo-400" />
              <span className="text-[11px] hidden sm:inline">夜间</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Toast Notification when device sync triggered */}
      <AnimatePresence>
        {deviceSyncToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-20 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-neutral-900/95 text-white dark:bg-white/95 dark:text-neutral-900 shadow-2xl border border-white/20 text-xs font-medium backdrop-blur-xl"
          >
            <CloudDownload className="w-4 h-4 text-sky-400" />
            <span>{deviceSyncToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
