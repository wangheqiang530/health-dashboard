import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { AutoExportSyncInfo, DailySummary } from '../../types/health';
import { useCustomization, PRESET_COLORS, type LiquidColorPreset } from '../../context/CustomizationContext';
import { AppleCard } from '../ui/AppleCard';
import { DataSourceSettings } from './DataSourceSettings';
import { AppleHealthZipModal } from '../dashboard/AppleHealthZipModal';
import { SystemLogsModal } from '../dashboard/SystemLogsModal';
import {
  Server,
  UploadCloud,
  FileArchive,
  Download,
  RefreshCw,
  HardDrive,
  RotateCcw,
  Sliders,
  Palette,
  Sparkles,
  Terminal,
} from 'lucide-react';

interface ConfigCenterViewProps {
  syncInfo: AutoExportSyncInfo;
  days: Record<string, DailySummary>;
  onOpenImport: () => void;
  onRefreshData: () => void;
  isRefreshing: boolean;
  onResetLayout: () => void;
  onOpenWizard?: () => void;
}

export const ConfigCenterView: React.FC<ConfigCenterViewProps> = ({
  syncInfo,
  days,
  onOpenImport,
  onRefreshData,
  isRefreshing,
  onResetLayout,
  onOpenWizard,
}) => {
  const [isZipImportOpen, setIsZipImportOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const {
    liquid,
    updateLiquid,
    glass,
    updateGlass,
    applyLiquidPreset,
    resetCustomizationDefaults,
  } = useCustomization();

  const handleExportBackup = () => {
    const blob = new Blob([JSON.stringify(days, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', url);
    downloadAnchor.setAttribute('download', `AppleHealth_Backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Hero Configuration Overview */}
      <AppleCard>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20 flex-shrink-0">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white m-0">
                  配置中心 · 视觉微调、NAS 部署与数据管道
                </h2>
                <span className="flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  API 状态: 在线 (200 OK)
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                实时调节底层弥散流光与苹果液态玻璃效果，管理局域网 Webhook 接收端点与数据备份
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <div className="hidden sm:block text-right text-xs">
              <span className="text-neutral-400 block text-[10px]">上次接收: {syncInfo.lastSyncTime}</span>
              <span className="font-semibold text-emerald-500">{syncInfo.device}</span>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onRefreshData}
              disabled={isRefreshing}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white shadow-md shadow-rose-500/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? '读取中...' : '刷新后端数据'}</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsLogsOpen(true)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-neutral-700 dark:text-neutral-200 border border-black/5 dark:border-white/10 transition-all cursor-pointer flex items-center gap-1.5"
              title="查看后端 Fastify 与数据同步运行日志"
            >
              <Terminal className="w-3.5 h-3.5 text-sky-500" />
              <span>运行日志</span>
            </motion.button>
            {onOpenWizard && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onOpenWizard}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-500 hover:bg-indigo-600 text-white shadow-md shadow-indigo-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                title="打开首次配置向导，配置并测试数据源联动"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>初次配置向导</span>
              </motion.button>
            )}
          </div>
        </div>
      </AppleCard>

      <DataSourceSettings onDataChanged={onRefreshData} />

      {/* Visual Customization Section: Liquid Background + Liquid Glass Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 1. Liquid Background Stream Controller (User Requirement) */}
        <AppleCard>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-rose-500" />
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                底层弥散流光动态控制 (Liquid Light)
              </h3>
            </div>
            <span className="text-[11px] text-neutral-400">实时滑块响应</span>
          </div>

          {/* Color Presets */}
          <div className="mb-4">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 block mb-2 font-medium">
              推荐色彩预设
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(PRESET_COLORS) as LiquidColorPreset[]).map((key) => {
                const p = PRESET_COLORS[key];
                const isSelected = liquid.preset === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyLiquidPreset(key)}
                    className={`p-2 rounded-xl text-xs font-semibold border flex items-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-rose-500/15 border-rose-500/40 text-neutral-900 dark:text-white shadow-sm ring-1 ring-rose-500/30'
                        : 'bg-black/[0.02] dark:bg-white/[0.03] border-black/5 dark:border-white/5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-800'
                    }`}
                  >
                    <div className="flex -space-x-1">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color1 }} />
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color2 }} />
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color3 }} />
                    </div>
                    <span className="truncate text-[11px]">{p.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Color Pickers */}
          <div className="grid grid-cols-3 gap-2 mb-4 p-2.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
            <div>
              <span className="text-[10px] text-neutral-400 block mb-1">主色调 (Primary)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={liquid.color1}
                  onChange={(e) => updateLiquid({ color1: e.target.value })}
                  className="w-6 h-6 rounded-lg cursor-pointer border-0 bg-transparent"
                />
                <span className="font-mono text-[11px] font-bold text-neutral-800 dark:text-neutral-200 uppercase">{liquid.color1}</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 block mb-1">次色调 (Secondary)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={liquid.color2}
                  onChange={(e) => updateLiquid({ color2: e.target.value })}
                  className="w-6 h-6 rounded-lg cursor-pointer border-0 bg-transparent"
                />
                <span className="font-mono text-[11px] font-bold text-neutral-800 dark:text-neutral-200 uppercase">{liquid.color2}</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 block mb-1">点缀色 (Tertiary)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={liquid.color3}
                  onChange={(e) => updateLiquid({ color3: e.target.value })}
                  className="w-6 h-6 rounded-lg cursor-pointer border-0 bg-transparent"
                />
                <span className="font-mono text-[11px] font-bold text-neutral-800 dark:text-neutral-200 uppercase">{liquid.color3}</span>
              </div>
            </div>
          </div>

          {/* Sliders: Speed, Blur, Opacity */}
          <div className="space-y-3.5 text-xs">
            {/* Speed Slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-neutral-600 dark:text-neutral-300 font-medium">漂浮流动速度 (循环时长)</span>
                <span className="font-mono font-bold text-neutral-900 dark:text-white">{liquid.speedSeconds} 秒/循环</span>
              </div>
              <input
                type="range"
                min="8"
                max="50"
                step="2"
                value={liquid.speedSeconds}
                onChange={(e) => updateLiquid({ speedSeconds: parseInt(e.target.value, 10) })}
                className="w-full accent-rose-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-neutral-400 mt-0.5">
                <span>快 (8s)</span>
                <span>适中 (24s)</span>
                <span>缓慢从容 (50s)</span>
              </div>
            </div>

            {/* Blur Slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-neutral-600 dark:text-neutral-300 font-medium">弥散高斯模糊半径</span>
                <span className="font-mono font-bold text-neutral-900 dark:text-white">{liquid.blurPx} px</span>
              </div>
              <input
                type="range"
                min="60"
                max="200"
                step="10"
                value={liquid.blurPx}
                onChange={(e) => updateLiquid({ blurPx: parseInt(e.target.value, 10) })}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-neutral-400 mt-0.5">
                <span>轻度弥散 (60px)</span>
                <span>自然漫射 (140px)</span>
                <span>超大光晕 (200px)</span>
              </div>
            </div>

            {/* Opacity Slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-neutral-600 dark:text-neutral-300 font-medium">流光整体不透明度</span>
                <span className="font-mono font-bold text-neutral-900 dark:text-white">{Math.round(liquid.opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={liquid.opacity}
                onChange={(e) => updateLiquid({ opacity: parseFloat(e.target.value) })}
                className="w-full accent-teal-500 cursor-pointer"
              />
            </div>
          </div>
        </AppleCard>

        {/* 2. Global Liquid Glass Effect Controller (User Requirement) */}
        <AppleCard>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                全局苹果液态玻璃效果微调 (Liquid Glass)
              </h3>
            </div>
            <button
              type="button"
              onClick={resetCustomizationDefaults}
              className="text-xs text-amber-500 hover:text-amber-400 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>恢复标准</span>
            </button>
          </div>

          <div className="space-y-4 text-xs">
            {/* Glass Backdrop Blur Slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-neutral-600 dark:text-neutral-300 font-medium">玻璃背面折射模糊度 (Backdrop Blur)</span>
                <span className="font-mono font-bold text-neutral-900 dark:text-white">{glass.blurPx} px</span>
              </div>
              <input
                type="range"
                min="12"
                max="60"
                step="2"
                value={glass.blurPx}
                onChange={(e) => updateGlass({ blurPx: parseInt(e.target.value, 10) })}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-neutral-400 mt-0.5">
                <span>通透浅磨砂 (12px)</span>
                <span>经典苹果玻璃 (38px)</span>
                <span>重度乳化 (60px)</span>
              </div>
            </div>

            {/* Card Opacity Slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-neutral-600 dark:text-neutral-300 font-medium">卡片基底厚度 (Surface Opacity)</span>
                <span className="font-mono font-bold text-neutral-900 dark:text-white">{Math.round(glass.opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.4"
                max="0.95"
                step="0.05"
                value={glass.opacity}
                onChange={(e) => updateGlass({ opacity: parseFloat(e.target.value) })}
                className="w-full accent-sky-500 cursor-pointer"
              />
            </div>

            {/* Saturation Slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-neutral-600 dark:text-neutral-300 font-medium">透过色彩饱和度增强 (Saturation Boost)</span>
                <span className="font-mono font-bold text-neutral-900 dark:text-white">{glass.saturationPercent}%</span>
              </div>
              <input
                type="range"
                min="120"
                max="260"
                step="10"
                value={glass.saturationPercent}
                onChange={(e) => updateGlass({ saturationPercent: parseInt(e.target.value, 10) })}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>

            {/* Specular Highlight Gloss Slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-neutral-600 dark:text-neutral-300 font-medium">顶部镜面高光反射强度 (Specular Gloss)</span>
                <span className="font-mono font-bold text-neutral-900 dark:text-white">{Math.round(glass.specularGloss * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.7"
                step="0.05"
                value={glass.specularGloss}
                onChange={(e) => updateGlass({ specularGloss: parseFloat(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Border Light Glow Slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-neutral-600 dark:text-neutral-300 font-medium">微光边框对比 (Border Glow)</span>
                <span className="font-mono font-bold text-neutral-900 dark:text-white">{Math.round(glass.borderGlow * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.35"
                step="0.02"
                value={glass.borderGlow}
                onChange={(e) => updateGlass({ borderGlow: parseFloat(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        </AppleCard>
      </div>

      {/* Data Ingestion & Backup Actions */}
      <AppleCard>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                健康数据导入、导出与归档
              </h3>
            </div>
            <span className="text-xs text-neutral-400">纯本地离线处理</span>
          </div>

          <div className="space-y-3">
            {/* Import Apple Health ZIP Tile */}
            <div
              onClick={() => setIsZipImportOpen(true)}
              className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] border border-black/5 dark:border-white/5 transition-all cursor-pointer flex items-center justify-between gap-3 group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 group-hover:scale-105 transition-transform">
                  <FileArchive className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                    <span>导入 iOS 健康 App 官方导出包 (.zip)</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-500 font-normal">支持 导出.zip</span>
                  </h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    直接上传 iPhone 导出的官方完整压缩包，持久化本地备份并流式解析全周期健康档案
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-amber-500">上传 ZIP ➔</span>
            </div>

            {/* Import Button Tile */}
            <div
              onClick={onOpenImport}
              className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] border border-black/5 dark:border-white/5 transition-all cursor-pointer flex items-center justify-between gap-3 group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-500 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                    导入 HAE 导出的 JSON 数据
                  </h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    支持拖拽或粘贴 HAE V2 JSON，写入 PostgreSQL 后刷新看板
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-sky-500">立即导入 ➔</span>
            </div>

            {/* Export Backup Tile */}
            <div
              onClick={handleExportBackup}
              className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] border border-black/5 dark:border-white/5 transition-all cursor-pointer flex items-center justify-between gap-3 group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 group-hover:scale-105 transition-transform">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                    导出大屏健康数据备份 (.json)
                  </h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    将当前收录的全部 8 天每日健康摘要、体脂与运动数据下载到本地
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-emerald-500">下载备份 ➔</span>
            </div>

            {/* Reset Layout */}
            <div
              onClick={onResetLayout}
              className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] border border-black/5 dark:border-white/5 transition-all cursor-pointer flex items-center justify-between gap-3 group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 group-hover:scale-105 transition-transform">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                    恢复默认排版顺序
                  </h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    重置首屏各个卡片自定义拖动及排序状态
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-amber-500">重置 ➔</span>
            </div>
          </div>
      </AppleCard>

      <AppleHealthZipModal
        isOpen={isZipImportOpen}
        onClose={() => setIsZipImportOpen(false)}
        onImportSuccess={onRefreshData}
      />

      <SystemLogsModal
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
      />
    </div>
  );
};
