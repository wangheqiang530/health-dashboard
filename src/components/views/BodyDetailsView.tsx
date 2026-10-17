import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DailySummary } from '../../types/health';
import { AppleCard } from '../ui/AppleCard';
import {
  Scale,
  Sparkles,
  Droplets,
  Dumbbell,
  ShieldCheck,
  Zap,
  Flame,
  Layers,
  Heart,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Metric30DayModal, type Metric30DayModalData } from './Metric30DayModal';
import { BodySilhouette } from './BodySilhouette';
import { ManageBodyModal, type BodySectionConfig } from './ManageBodyModal';

interface BodyDetailsViewProps {
  currentDay: DailySummary;
  isManageOpen?: boolean;
  onCloseManage?: () => void;
}

const DEFAULT_BODY_SECTIONS: BodySectionConfig[] = [
  { id: 'hero', name: '身体成分概览与平衡条', desc: '体重、体脂率、去脂净重与双色肌肉脂肪比例条', visible: true },
  { id: 'metrics', name: '8 维智能体脂秤核心指标', desc: '骨骼肌、水分率、内脏脂肪、基础代谢、骨量等', visible: true },
  { id: 'silhouette', name: '人体解剖节段肌脂分布图', desc: '躯干、双臂、双腿肌肉/脂肪矢量图谱及7日走势', visible: true },
];

export const BodyDetailsView: React.FC<BodyDetailsViewProps> = ({ currentDay, isManageOpen = false, onCloseManage }) => {
  const [sectionsConfig, setSectionsConfig] = useState<BodySectionConfig[]>(() => {
    try {
      const saved = localStorage.getItem('apple_health_body_sections_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_BODY_SECTIONS;
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('apple_health_body_sections_v2', JSON.stringify(sectionsConfig));
    } catch {}
  }, [sectionsConfig]);
  const { body } = currentDay;
  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null);
  const [modalData, setModalData] = useState<Metric30DayModalData | null>(null);
  
  // Date selector state
  const [activeDateRange, setActiveDateRange] = useState<'today' | '7d' | '30d' | '90d' | '180d'>('today');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const calendarMonth = '2026年10月';

    const isVisible = (id: string) => sectionsConfig.find((s) => s.id === id)?.visible !== false;
  const leanPercent = Math.round((body.leanMassKg / Math.max(body.weightKg, 1)) * 100);
  const fatPercent = Math.round(body.bodyFatPercent);

  // Helper to generate realistic 30-day data for modal
  const generate30DayPoints = (baseVal: number, variance: number, decimals: number = 1) => {
    const pts: { date: string; value: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date('2026-10-17');
      d.setDate(d.getDate() - i);
      const dateStr = `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      const noise = (Math.sin(i * 0.7) * variance * 0.5) + (Math.cos(i * 0.3) * variance * 0.5);
      const val = parseFloat((baseVal + noise).toFixed(decimals));
      pts.push({ date: dateStr, value: val });
    }
    return pts;
  };

  const scaleMetrics = [
    {
      title: '骨骼肌量 (Muscle Mass)',
      value: '41.2',
      unit: 'kg',
      badge: '充沛',
      badgeColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
      icon: Dumbbell,
      color: '#6366F1',
      eval: '占体重 45.9% · 运动机能强劲',
      standard: '标准 > 34.0 kg',
      sevenDay: [40.8, 40.9, 41.0, 41.1, 41.1, 41.2, 41.2],
      thirtyDay: generate30DayPoints(41.0, 0.4, 1),
    },
    {
      title: '身体水分率 (Body Water)',
      value: '56.8',
      unit: '%',
      badge: '充足',
      badgeColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
      icon: Droplets,
      color: '#0EA5E9',
      eval: '细胞水合状态极佳 · 利于肌肉合成',
      standard: '标准 50% ~ 65%',
      sevenDay: [56.2, 56.4, 56.5, 56.7, 56.6, 56.8, 56.8],
      thirtyDay: generate30DayPoints(56.5, 0.8, 1),
    },
    {
      title: '内脏脂肪等级 (Visceral Fat)',
      value: '7',
      unit: '级',
      badge: '健康',
      badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      icon: ShieldCheck,
      color: '#10B981',
      eval: '腹腔内脏无多余脂肪沉积',
      standard: '健康 1 ~ 9 级',
      sevenDay: [7, 7, 7, 7, 7, 7, 7],
      thirtyDay: generate30DayPoints(7, 0.3, 0),
    },
    {
      title: '基础代谢率 (BMR)',
      value: '1,780',
      unit: 'kcal',
      badge: '高效',
      badgeColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      icon: Flame,
      color: '#FA114F',
      eval: '每日静息最低能量消耗',
      standard: '同体重标准 1,650 kcal',
      sevenDay: [1765, 1770, 1775, 1780, 1778, 1780, 1780],
      thirtyDay: generate30DayPoints(1770, 20, 0),
    },
    {
      title: '骨量 (Bone Mineral)',
      value: '3.65',
      unit: 'kg',
      badge: '坚密',
      badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      icon: Layers,
      color: '#F59E0B',
      eval: '骨骼无机盐矿化程度高',
      standard: '标准 3.1 ~ 3.8 kg',
      sevenDay: [3.64, 3.64, 3.65, 3.65, 3.65, 3.65, 3.65],
      thirtyDay: generate30DayPoints(3.65, 0.05, 2),
    },
    {
      title: '蛋白质率 (Protein)',
      value: '18.4',
      unit: '%',
      badge: '优良',
      badgeColor: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
      icon: Sparkles,
      color: '#14B8A6',
      eval: '体内高营养储备水平',
      standard: '标准 16% ~ 20%',
      sevenDay: [18.2, 18.2, 18.3, 18.3, 18.4, 18.4, 18.4],
      thirtyDay: generate30DayPoints(18.3, 0.3, 1),
    },
    {
      title: '身体年龄 (Metabolic Age)',
      value: '28',
      unit: '岁',
      badge: '年轻态',
      badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      icon: Heart,
      color: '#A855F7',
      eval: '代谢机能较实际生理状态更年轻',
      standard: '评估基于体脂与肌肉比',
      sevenDay: [28, 28, 28, 28, 28, 28, 28],
      thirtyDay: generate30DayPoints(28, 0, 0),
    },
    {
      title: '去脂体重 (Lean Body Mass)',
      value: `${body.leanMassKg}`,
      unit: 'kg',
      badge: '77%',
      badgeColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      icon: Zap,
      color: '#3B82F6',
      eval: '扣除全部脂肪后的纯净体重',
      standard: '高瘦体重运动型体格',
      sevenDay: [68.8, 69.0, 69.1, 69.2, 69.1, 69.2, 69.25],
      thirtyDay: generate30DayPoints(69.0, 0.5, 1),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Top Horizontal Date Span Bar with Floating Calendar */}
      <AppleCard className="p-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/30 flex-shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-neutral-900 dark:text-white block">
                体脂秤数据跨度查阅
              </span>
              <span className="text-[10px] text-neutral-400">
                当前聚焦: 2026-10-17 (支持历史任意长跨度回溯)
              </span>
            </div>
          </div>

          {/* Horizontal Quick Range Segmented Controls */}
          <div className="flex items-center gap-2">
            <div className="flex bg-black/5 dark:bg-white/5 p-0.5 rounded-xl border border-black/5 dark:border-white/5">
              {[
                { key: 'today', label: '今日' },
                { key: '7d', label: '近7天' },
                { key: '30d', label: '近30天' },
                { key: '90d', label: '近一季' },
                { key: '180d', label: '近半年' },
              ].map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setActiveDateRange(r.key as typeof activeDateRange)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeDateRange === r.key
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Floating Calendar Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCalendarOpen((prev) => !prev)}
                className={`p-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                  isCalendarOpen
                    ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                    : 'bg-black/5 dark:bg-white/10 hover:bg-black/10 text-neutral-700 dark:text-neutral-200 border-black/5 dark:border-white/10'
                }`}
                title="打开日历选择长时间跨度"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">选择日历</span>
              </button>

              {/* Floating Calendar Popover */}
              <AnimatePresence>
                {isCalendarOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    className="absolute right-0 top-full mt-2 z-50 p-4 rounded-3xl bg-neutral-900 text-white border border-white/20 shadow-2xl backdrop-blur-2xl w-72"
                  >
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                      <span className="text-xs font-bold text-amber-400">{calendarMonth}</span>
                      <div className="flex items-center gap-1">
                        <button type="button" className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white">
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-neutral-400 mb-1">
                      <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center text-xs font-mono">
                      {[...Array(31)].map((_, i) => {
                        const day = i + 1;
                        const isRecorded = day >= 10 && day <= 17;
                        const isCurrent = day === 17;

                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              setIsCalendarOpen(false);
                            }}
                            className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                              isCurrent
                                ? 'bg-amber-500 text-black font-black'
                                : isRecorded
                                ? 'bg-white/10 text-white hover:bg-white/20'
                                : 'text-neutral-600 hover:bg-white/5'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </AppleCard>

      {/* Hero Overview */}
      {isVisible('hero') && (
      <AppleCard>
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 to-orange-500 p-0.5 shadow-xl shadow-amber-500/20 flex-shrink-0">
              <div className="w-full h-full rounded-[22px] bg-neutral-950 dark:bg-neutral-950 light:bg-white flex items-center justify-center">
                <Scale className="w-10 h-10 text-amber-500" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight m-0">
                  身体详情 · 智能体脂秤深度分析
                </h2>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20">
                  {body.statusLabel}
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                悬停任意卡片查看 7 日走势，点击任意卡片弹出 30 日深度趋势分析大窗
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 self-start md:self-auto">
            <div className="text-right">
              <span className="text-[11px] text-neutral-400 block">当前体重</span>
              <span className="text-2xl font-black text-neutral-900 dark:text-white font-mono">
                {body.weightKg} <span className="text-xs font-normal text-neutral-400">kg</span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-neutral-400 block">体脂率</span>
              <span className="text-2xl font-black text-amber-500 font-mono">
                {body.bodyFatPercent} <span className="text-xs font-normal text-neutral-400">%</span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-neutral-400 block">去脂瘦体重</span>
              <span className="text-2xl font-black text-indigo-500 font-mono">
                {body.leanMassKg} <span className="text-xs font-normal text-neutral-400">kg</span>
              </span>
            </div>
          </div>
        </div>

        {/* Dual-color Proportion Balance Bar */}
        <div className="mt-6 pt-5 border-t border-black/5 dark:border-white/5">
          <div className="flex justify-between items-center text-xs mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                去脂瘦体重: {body.leanMassKg} kg ({leanPercent}%)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                脂肪总量: {body.fatMassKg} kg ({fatPercent}%)
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            </div>
          </div>
          <div className="w-full h-3 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden flex">
            <div
              style={{ width: `${leanPercent}%` }}
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-l-full"
            />
            <div
              style={{ width: `${fatPercent}%` }}
              className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-r-full"
            />
          </div>
        </div>
      </AppleCard>
      )}

      {/* 8 BIA Metric Cards */}
      {isVisible('metrics') && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {scaleMetrics.map((item, idx) => {
          const Icon = item.icon;
          const isHovered = hoveredCardIndex === idx;

          return (
            <div key={item.title} className="relative">
              <AppleCard
                onClick={() =>
                  setModalData({
                    title: item.title,
                    unit: item.unit,
                    current: item.value,
                    eval: item.eval,
                    standard: item.standard,
                    points: item.thirtyDay,
                  })
                }
                className="p-4 flex flex-col justify-between h-full cursor-pointer hover:border-amber-500/40 transition-all"
              >
                <div
                  onMouseEnter={() => setHoveredCardIndex(idx)}
                  onMouseLeave={() => setHoveredCardIndex(null)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className="p-1.5 rounded-xl border flex-shrink-0"
                      style={{
                        backgroundColor: `${item.color}15`,
                        borderColor: `${item.color}30`,
                        color: item.color,
                      }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  </div>

                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 block mb-1">
                    {item.title}
                  </span>

                  <div className="flex items-baseline gap-1 my-1">
                    <span className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight font-mono">
                      {item.value}
                    </span>
                    <span className="text-xs text-neutral-400 font-semibold">{item.unit}</span>
                  </div>
                </div>

                <div className="pt-2 mt-2 border-t border-black/5 dark:border-white/5 text-[10px]">
                  <span className="text-neutral-600 dark:text-neutral-300 block font-medium truncate">
                    {item.eval}
                  </span>
                  <div className="flex items-center justify-between mt-1 text-neutral-400">
                    <span>{item.standard}</span>
                    <span className="text-amber-500 font-medium">看30日 ➔</span>
                  </div>
                </div>
              </AppleCard>

              {/* Floating 7-day Sparkline on Hover (User Comment 3: Changed to Line Chart / 折线图) */}
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    className="absolute left-0 right-0 bottom-full mb-2 z-40 p-3 rounded-2xl bg-neutral-950/95 text-white border border-white/25 shadow-2xl backdrop-blur-2xl pointer-events-none"
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1.5 font-bold text-amber-400">
                      <span>7 日折线趋势 ({item.unit})</span>
                      <span className="text-emerald-400 text-[10px]">最新 {item.sevenDay[item.sevenDay.length - 1]}</span>
                    </div>

                    {/* 7-Day SVG Line Chart */}
                    <div className="h-10 w-full">
                      {(() => {
                        const vals = item.sevenDay;
                        const min = Math.min(...vals);
                        const max = Math.max(...vals);
                        const range = max - min || 1;
                        const w = 180;
                        const h = 32;
                        const coords = vals.map((v, i) => ({
                          x: 10 + (i / (vals.length - 1)) * (w - 20),
                          y: h - 6 - ((v - min) / range) * (h - 12),
                          v,
                        }));
                        const pathD = coords.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`, '');

                        return (
                          <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full overflow-visible">
                            <path d={pathD} fill="none" stroke={item.color} strokeWidth="2.2" strokeLinecap="round" />
                            {coords.map((c, i) => (
                              <circle key={i} cx={c.x} cy={c.y} r="2.2" fill="#FFF" stroke={item.color} strokeWidth="1.2" />
                            ))}
                          </svg>
                        );
                      })()}
                    </div>

                    <div className="flex justify-between items-center text-[8px] text-neutral-400 font-mono mt-1 px-1">
                      <span>10-11 ({item.sevenDay[0]})</span>
                      <span>今天 ({item.sevenDay[item.sevenDay.length - 1]})</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
      )}

      {/* Human Body Silhouette Component */}
      {isVisible('silhouette') && <BodySilhouette />}

      {/* 30-Day Trend Modal Dialog */}
      <Metric30DayModal data={modalData} onClose={() => setModalData(null)} />

      {/* Reorder and Visibility Management Modal */}
      {isManageOpen && (
        <ManageBodyModal
          isOpen={isManageOpen}
          onClose={onCloseManage || (() => {})}
          sections={sectionsConfig}
          onChange={setSectionsConfig}
          onReset={() => setSectionsConfig(DEFAULT_BODY_SECTIONS)}
        />
      )}
    </div>
  );
};