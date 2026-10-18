import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { CustomizationProvider } from './context/CustomizationContext';
import type { AutoExportSyncInfo, DailySummary, DashboardModuleConfig, DashboardModuleId } from './types/health';
import { Navbar, type DashboardTab } from './components/layout/Navbar';
import { LiquidBackground } from './components/ui/LiquidBackground';
import { WeekStrip } from './components/dashboard/WeekStrip';
import { AppleRingsCard } from './components/dashboard/AppleRingsCard';
import { EnergyVitalityCard } from './components/dashboard/EnergyVitalityCard';
import { BodyCompositionCard } from './components/dashboard/BodyCompositionCard';
import { MobilityGaitCard } from './components/dashboard/MobilityGaitCard';
import { SleepAnalysisCard } from './components/dashboard/SleepAnalysisCard';
import { HeartRateCard } from './components/dashboard/HeartRateCard';
import { EnvironmentHearingCard } from './components/dashboard/EnvironmentHearingCard';
import { WorkoutsSection } from './components/dashboard/WorkoutsSection';
import { QuickMetricsGrid } from './components/dashboard/QuickMetricsGrid';
import { AutoExportHubModal } from './components/dashboard/AutoExportHubModal';
import { HAEImportModal } from './components/dashboard/HAEImportModal';
import { EditModuleRibbon } from './components/dashboard/EditModuleRibbon';
import { fetchDashboard } from './api/healthApi';
import { createEmptyDailySummary } from './utils/emptyData';
import { OnboardingWizardModal } from './components/dashboard/OnboardingWizardModal';

// 5 Dedicated Views for the 5 Tabs
import { TrendsView } from './components/views/TrendsView';
import { BodyDetailsView } from './components/views/BodyDetailsView';
import { WorkoutsView } from './components/views/WorkoutsView';
import { ConfigCenterView } from './components/views/ConfigCenterView';

import {
  Sparkles,
  RotateCcw,
  Check,
  RefreshCw,
} from 'lucide-react';
import confetti from 'canvas-confetti';

const DEFAULT_MODULES: DashboardModuleConfig[] = [
  { id: 'rings', title: '健身圆环', visible: true },
  { id: 'vitality', title: '身体状态', visible: true },
  { id: 'body', title: '身体成分', visible: true },
  { id: 'mobility', title: '步态健康', visible: true },
  { id: 'sleep', title: '睡眠分析', visible: true },
  { id: 'heartRate', title: '心率与自主神经趋势', visible: true },
  { id: 'workouts', title: '体能训练记录', visible: true },
  { id: 'environment', title: '感官环境与户外采光', visible: true },
  { id: 'quickMetrics', title: '核心体征速览格', visible: true },
];

function DashboardContent() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [daysData, setDaysData] = useState<Record<string, DailySummary>>({});
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [syncInfo, setSyncInfo] = useState<AutoExportSyncInfo | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [currentTab, setCurrentTabState] = useState<DashboardTab>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '') as DashboardTab;
      if (['overview', 'trends', 'body', 'workouts', 'config'].includes(hash)) return hash;
    }
    return 'overview';
  });
  const setCurrentTab = (tab: DashboardTab) => {
    setCurrentTabState(tab);
    if (typeof window !== 'undefined') {
      window.location.hash = tab;
    }
  };
  const [isSyncHubOpen, setIsSyncHubOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [hasRealData, setHasRealData] = useState(false);

  // Custom layout order with local storage persistence
  const [modules, setModules] = useState<DashboardModuleConfig[]>(() => {
    try {
      const saved = localStorage.getItem('apple_health_layout_v4');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === DEFAULT_MODULES.length) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return DEFAULT_MODULES;
  });

  useEffect(() => {
    try {
      localStorage.setItem('apple_health_layout_v4', JSON.stringify(modules));
    } catch {
      // ignore
    }
  }, [modules]);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }

  const refreshDashboard = async (silent = false) => {
    setIsRefreshing(true);
    try {
      const data = await fetchDashboard();
      setBackendConnected(true);
      setSyncInfo(data.syncInfo);
      if (Object.keys(data.days).length > 0) {
        setHasRealData(true);
        localStorage.setItem('health_dashboard_wizard_completed', 'true');
        window.dispatchEvent(new Event('storage'));
        setDaysData(data.days);
        setSelectedDate((prev) => (prev && data.days[prev] ? prev : data.selectedDate || data.dates[data.dates.length - 1] || ''));
        if (!silent) {
          showToast(`已从 PostgreSQL 刷新 ${data.dates.length} 天健康数据。`);
        }
      } else {
        setHasRealData(false);
        const emptyDay = createEmptyDailySummary();
        setDaysData({ [emptyDay.date]: emptyDay });
        setSelectedDate(emptyDay.date);
        const dismissed = localStorage.getItem('health_dashboard_onboarding_dismissed');
        if (!dismissed) {
          setIsOnboardingOpen(true);
        }
        if (!silent) {
          showToast('后端已连接，数据库暂无健康数据，各项体征已置为初始 0 值。');
        }
      }
    } catch (error) {
      setBackendConnected(false);
      if (!silent) {
        showToast(error instanceof Error ? error.message : '无法连接后端服务');
      }
    } finally {
      setIsRefreshing(false);
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    void refreshDashboard(true);
  }, []);

  const currentDay =
    (selectedDate ? daysData[selectedDate] : null) ||
    Object.values(daysData)[0] ||
    createEmptyDailySummary();

  // Handle successful import of user's real HAE JSON
  const handleImportSuccess = (parsedDays: Record<string, DailySummary>, latestDate: string) => {
    setDaysData(parsedDays);
    setSelectedDate(latestDate);
    showToast(`🎉 成功导入 ${Object.keys(parsedDays).length} 天真实 Apple Health 数据！`);
    void refreshDashboard(true);
    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.6 },
    });
  };

  // Module reordering functions (Supports Up, Down, Top, Bottom)
  const moveModule = (index: number, direction: 'up' | 'down' | 'top' | 'bottom') => {
    let newIdx = index;
    if (direction === 'top') newIdx = 0;
    else if (direction === 'bottom') newIdx = modules.length - 1;
    else if (direction === 'up') newIdx = index - 1;
    else if (direction === 'down') newIdx = index + 1;

    if (newIdx < 0 || newIdx >= modules.length || newIdx === index) return;
    const updated = [...modules];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIdx, 0, moved);
    setModules(updated);
  };

  const toggleModuleVisibility = (id: DashboardModuleId) => {
    setModules((prev) =>
      prev.map((m) => (m.id === id ? { ...m, visible: !m.visible } : m))
    );
  };

  const resetDefaultLayout = () => {
    setModules(DEFAULT_MODULES);
    showToast('已恢复看板默认排版！');
  };

  // Render individual module component
  const renderModuleComponent = (id: DashboardModuleId) => {
    switch (id) {
      case 'rings':
        return (
          <AppleRingsCard
            rings={currentDay.rings}
            onRingClick={() => setCurrentTab('trends')}
          />
        );
      case 'vitality':
        return (
          <EnergyVitalityCard
            vitality={currentDay.vitality}
            currentHrv={currentDay.vitals.hrvCurrent}
            restingHr={currentDay.vitals.restingHr}
          />
        );
      case 'body':
        return <BodyCompositionCard body={currentDay.body} />;
      case 'mobility':
        return <MobilityGaitCard mobility={currentDay.mobility} />;
      case 'sleep':
        return (
          <SleepAnalysisCard
            sleep={currentDay.sleep}
            days={daysData}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        );
      case 'heartRate':
        return (
          <HeartRateCard
            timeline={currentDay.heartRateTimeline}
            vitals={currentDay.vitals}
          />
        );
      case 'workouts':
        return <WorkoutsSection workouts={currentDay.workouts} />;
      case 'environment':
        return (
          <EnvironmentHearingCard
            environment={currentDay.environment}
            cyclingDistanceKm={currentDay.cyclingDistanceKm}
          />
        );
      case 'quickMetrics':
        return <QuickMetricsGrid summary={currentDay} />;
      default:
        return null;
    }
  };

  if (initialLoading) {
    return (
      <div
        className={`min-h-screen relative flex flex-col items-center justify-center p-6 transition-colors duration-500 ${
          isDark ? 'bg-[#060709] text-white' : 'bg-[#EAECEF] text-neutral-900'
        }`}
      >
        <LiquidBackground />
        <div className="relative z-10 flex flex-col items-center gap-4 text-center max-w-sm apple-glass-dark p-8 rounded-3xl border border-white/10 shadow-2xl">
          <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-rose-500 via-indigo-500 to-emerald-400 text-white shadow-lg shadow-indigo-500/25">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
          <div>
            <h3 className="text-base font-bold tracking-tight text-neutral-900 dark:text-white">
              正在加载健康档案
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
              正在连接 PostgreSQL 数据库并读取全部体测、骑行与健康体征数据...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen relative transition-colors duration-500 ${
        isDark ? 'bg-[#060709] text-white' : 'bg-[#EAECEF] text-neutral-900'
      }`}
    >
      {/* Slow Floating Liquid Glass Ambient Background */}
      <LiquidBackground />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 z-10">
        {/* Navigation Bar */}
        <Navbar
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          onRefreshData={() => void refreshDashboard(false)}
          isRefreshing={isRefreshing}
          isEditingLayout={isEditingLayout}
          onToggleEditLayout={() => setIsEditingLayout((prev) => !prev)}
          onOpenWizard={() => setIsOnboardingOpen(true)}
        />

        {/* View Tabs Content */}
        <AnimatePresence mode="wait">
          {/* Tab 1: 综合看板 (Overview) */}
          {currentTab === 'overview' && (
            <motion.main
              key="overview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {/* Empty Data / Onboarding Banner */}
              {!hasRealData && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-5 rounded-3xl apple-glass-dark border border-indigo-500/30 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-3 rounded-2xl bg-gradient-to-tr from-rose-500 via-indigo-500 to-emerald-400 text-white shadow-lg shadow-indigo-500/25 shrink-0">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                        <span>健康看板初始化就绪</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          等待首次数据同步
                        </span>
                      </h4>
                      <p className="text-xs text-neutral-300 mt-1 leading-relaxed max-w-xl">
                        数据库已成功连接，当前各项体征显示为初始空值。请按需开启 iOS 健康、智能体脂秤或码表自动化同步，或通过新手向导辅助配置。
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
                    <button
                      type="button"
                      onClick={() => setIsOnboardingOpen(true)}
                      className="flex-1 md:flex-initial px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-500 hover:bg-indigo-600 text-white shadow-md shadow-indigo-500/25 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>新手配置向导</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentTab('config')}
                      className="flex-1 md:flex-initial px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>前往配置中心</span>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* 7-Day Apple Strip */}
              <WeekStrip
                days={daysData}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />

              {/* Editing Mode Banner */}
              {isEditingLayout && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 p-4 rounded-3xl apple-glass-dark border-2 border-dashed border-indigo-500/40 text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-2xl bg-indigo-500 text-white shadow-md shadow-indigo-500/30">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">大屏排版自定义模式</h4>
                      <p className="text-xs text-neutral-400">
                        点击各模块顶部的「置顶」「上移」「下移」「置底」调整顺序，点击「👁️」显示/隐藏模块。修改自动保存。
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={resetDefaultLayout}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-neutral-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>恢复默认</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingLayout(false);
                        showToast('💾 已保存您的大屏模块排序！');
                      }}
                      className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-indigo-500 hover:bg-indigo-600 text-white transition-all shadow-md shadow-indigo-500/30 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>完成编辑</span>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Dynamic Customizable Bento Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                {modules.map((mod, idx) => {
                  if (!mod.visible && !isEditingLayout) return null;
                  const isFullWidth = mod.id === 'quickMetrics';

                  return (
                    <div
                      key={mod.id}
                      className={`flex flex-col transition-all duration-300 ${
                        isFullWidth ? 'md:col-span-2' : 'col-span-1'
                      } ${!mod.visible ? 'opacity-40 grayscale-[50%]' : ''}`}
                    >
                      {/* Editing ribbon on top with Top, Up, Down, Bottom, Toggle */}
                      {isEditingLayout && (
                        <EditModuleRibbon
                          id={mod.id}
                          title={mod.title}
                          visible={mod.visible}
                          canMoveUp={idx > 0}
                          canMoveDown={idx < modules.length - 1}
                          onMoveTop={() => moveModule(idx, 'top')}
                          onMoveUp={() => moveModule(idx, 'up')}
                          onMoveDown={() => moveModule(idx, 'down')}
                          onMoveBottom={() => moveModule(idx, 'bottom')}
                          onToggleVisible={() => toggleModuleVisibility(mod.id)}
                        />
                      )}

                      {/* Actual module card */}
                      <div className="h-full flex flex-col">
                        {renderModuleComponent(mod.id)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.main>
          )}

          {/* Tab 2: 健康趋势 (Long-Term Trends with Day, Week, Month, Year switches) */}
          {currentTab === 'trends' && (
            <motion.div
              key="trends"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <TrendsView
                days={daysData}
                currentDay={currentDay}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                isManageOpen={isEditingLayout && currentTab === 'trends'}
                onCloseManage={() => setIsEditingLayout(false)}
              />
            </motion.div>
          )}

          {/* Tab 3: 身体详情 (Smart Scale & Body Composition deep dive) */}
          {currentTab === 'body' && (
            <motion.div
              key="body"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <BodyDetailsView
                currentDay={currentDay}
                days={daysData}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                isManageOpen={isEditingLayout && currentTab === 'body'}
                onCloseManage={() => setIsEditingLayout(false)}
              />
            </motion.div>
          )}

          {/* Tab 4: 体能训练 (Road bike computer + Apple Watch workouts hub) */}
          {currentTab === 'workouts' && (
            <motion.div
              key="workouts"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <WorkoutsView days={daysData} currentDay={currentDay} />
            </motion.div>
          )}

          {/* Tab 5: 配置中心 (NAS, Webhook, Docker, Import/Export, Settings) */}
          {currentTab === 'config' && (
            <motion.div
              key="config"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <ConfigCenterView
                syncInfo={
                  syncInfo || {
                    lastSyncTime: '尚未同步',
                    status: 'offline',
                    device: 'PostgreSQL',
                    osVersion: 'iOS',
                    watchModel: 'Apple Watch',
                    payloadSizeKb: 0,
                    pendingSyncCount: 0,
                    nasEndpoint: 'http://127.0.0.1:8443',
                  }
                }
                days={daysData}
                onOpenImport={() => setIsImportOpen(true)}
                onRefreshData={() => void refreshDashboard(false)}
                isRefreshing={isRefreshing}
                onResetLayout={resetDefaultLayout}
                onOpenWizard={() => setIsOnboardingOpen(true)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-black/5 dark:border-white/5 text-center text-xs text-neutral-500 dark:text-neutral-400 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                backendConnected ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-amber-500'
              }`}
            />
            <span>
              {backendConnected
                ? `PostgreSQL 已连接 · 实时加载 ${Object.keys(daysData).length} 天健康档案`
                : '后端未连接 · 请先启动数据库与容器服务'}
            </span>
          </div>
          <div>
            <span>设计语言：Apple Health &amp; Fitness + Grow App Bento 风格</span>
          </div>
        </footer>
      </div>

      {/* Sync Hub Modal */}
      {syncInfo && (
        <AutoExportHubModal
          isOpen={isSyncHubOpen}
          onClose={() => setIsSyncHubOpen(false)}
          syncInfo={syncInfo}
          onRefreshData={() => void refreshDashboard(false)}
        />
      )}

      {/* HAE Import Modal */}
      <HAEImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportSuccess={handleImportSuccess}
      />

      {/* Onboarding Wizard Modal */}
      <OnboardingWizardModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onFinish={() => {
          setIsOnboardingOpen(false);
          localStorage.setItem('health_dashboard_onboarding_dismissed', 'true');
          localStorage.setItem('health_dashboard_wizard_completed', 'true');
          window.dispatchEvent(new Event('storage'));
          void refreshDashboard(true);
        }}
        onOpenConfigCenter={() => {
          setIsOnboardingOpen(false);
          localStorage.setItem('health_dashboard_onboarding_dismissed', 'true');
          localStorage.setItem('health_dashboard_wizard_completed', 'true');
          window.dispatchEvent(new Event('storage'));
          setCurrentTab('config');
        }}
        syncInfo={syncInfo}
      />

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 max-w-md px-4 py-3 rounded-2xl apple-glass-dark border border-white/20 text-white shadow-2xl flex items-center gap-3"
          >
            <div className="p-2 rounded-xl bg-[#A1FF00]/20 text-[#A1FF00]">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium leading-tight">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <CustomizationProvider>
        <DashboardContent />
      </CustomizationProvider>
    </ThemeProvider>
  );
}
