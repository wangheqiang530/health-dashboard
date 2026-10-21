import React from 'react';
import { motion } from 'framer-motion';
import type { VitalityScore } from '../../types/health';
import { AppleCard } from '../ui/AppleCard';
import { Zap, HeartPulse, Moon, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface EnergyVitalityCardProps {
  vitality: VitalityScore;
  currentHrv: number;
  restingHr: number;
}

export const EnergyVitalityCard: React.FC<EnergyVitalityCardProps> = ({
  vitality,
  currentHrv,
  restingHr,
}) => {
  const effectiveRestingHr = vitality.restingHrUsed || restingHr;
  const hasRestingHr = effectiveRestingHr > 0;
  const hasHrv = currentHrv > 0;
  const coverage = vitality.dataCoverage ?? 0;
  const getBadgeStyle = (label: VitalityScore['label']) => {
    switch (label) {
      case '优异':
        return 'from-emerald-500/20 to-teal-500/20 text-emerald-500 dark:text-emerald-400 border-emerald-500/30';
      case '充沛':
      case '良好':
        return 'from-blue-500/20 to-indigo-500/20 text-sky-500 dark:text-sky-400 border-sky-500/30';
      case '轻度疲倦':
        return 'from-amber-500/20 to-orange-500/20 text-amber-500 dark:text-amber-400 border-amber-500/30';
      case '需休整':
        return 'from-rose-500/20 to-red-500/20 text-rose-500 dark:text-rose-400 border-rose-500/30';
      case '数据不足':
        return 'from-neutral-500/10 to-neutral-500/10 text-neutral-500 dark:text-neutral-400 border-neutral-500/20';
    }
  };

  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference * (1 - vitality.score / 100);

  return (
    <AppleCard className="overflow-hidden h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white shadow-sm shadow-indigo-500/30">
              <Zap className="w-4 h-4 fill-white" />
            </div>
            <h3 className="text-sm font-semibold tracking-wider text-neutral-500 dark:text-neutral-400 uppercase">
              身体状态
            </h3>
          </div>
          <span
            className={`px-3 py-0.5 text-xs font-semibold rounded-full border bg-gradient-to-r ${getBadgeStyle(
              vitality.label
            )}`}
          >
            {vitality.label}状态
          </span>
        </div>

        <div className="flex flex-col md:flex-row gap-6 items-center">
          {/* Glow Circular Battery Indicator */}
          <div className="relative flex-shrink-0 flex items-center justify-center w-36 h-36" key={`vitality-ring-${vitality.score}`}>
            <svg className="w-full h-full rotate-[-90deg]" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="vitalityGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38BDF8" />
                  <stop offset="50%" stopColor="#818CF8" />
                  <stop offset="100%" stopColor="#C084FC" />
                </linearGradient>
              </defs>
              {/* Background ring */}
              <circle
                cx="50"
                cy="50"
                r="40"
                className="text-neutral-200 dark:text-white/10"
                strokeWidth="8"
                stroke="currentColor"
                fill="transparent"
              />
              {/* Animated progress ring starting from 0 */}
              <motion.circle
                cx="50"
                cy="50"
                r="40"
                stroke="url(#vitalityGradient)"
                strokeWidth="8"
                strokeLinecap="round"
                fill="transparent"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
              />
            </svg>

            {/* Central Score readout */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="text-4xl font-black tracking-tight text-neutral-900 dark:text-white"
              >
                {vitality.score > 0 ? vitality.score : '—'}
              </motion.span>
              <span className="text-[11px] font-medium text-neutral-400 -mt-0.5">
                / 100 分
              </span>
            </div>

            {/* Ambient Glow */}
            <div className="absolute inset-0 bg-indigo-500/15 rounded-full blur-xl pointer-events-none" />
          </div>

          {/* Narrative & Metric Tiles */}
          <div className="flex-1 space-y-3 w-full">
            <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 font-normal">
              {vitality.statusDescription}
            </p>
            {vitality.score > 0 && (
              <div className="flex items-center gap-2 text-[10px] text-neutral-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>
                  {coverage > 0 ? `${coverage}/3 项今日实测` : '参考评分'}
                  {vitality.missingSignals && vitality.missingSignals.length > 0
                    ? ` · 待同步 ${vitality.missingSignals.join('、')}`
                    : ''}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div className="p-2.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05]">
                <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
                  <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
                  <span>HRV 变异性</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold text-neutral-900 dark:text-white">
                    {hasHrv ? currentHrv : '—'}
                  </span>
                  <span className="text-[10px] text-neutral-400">ms</span>
                </div>
                <div
                  className={`flex items-center text-[10px] mt-0.5 ${
                    vitality.hrvStatus === '高于基线'
                      ? 'text-emerald-500 dark:text-emerald-400'
                      : vitality.hrvStatus === '低于基线'
                        ? 'text-rose-500'
                        : 'text-neutral-400'
                  }`}
                >
                  {vitality.hrvStatus === '高于基线' ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : vitality.hrvStatus === '低于基线' ? (
                    <ArrowDownRight className="w-3 h-3" />
                  ) : null}
                  <span>{vitality.hrvStatus}</span>
                </div>
              </div>

              <div className="p-2.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05]">
                <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
                  <Activity className="w-3.5 h-3.5 text-sky-400" />
                  <span>静息心率</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold text-neutral-900 dark:text-white">
                    {hasRestingHr ? effectiveRestingHr : '—'}
                  </span>
                  <span className="text-[10px] text-neutral-400">bpm</span>
                </div>
                <div className="flex items-center text-[10px] text-emerald-500 dark:text-emerald-400 mt-0.5">
                  {hasRestingHr ? (
                    <>
                      {vitality.restingHrDiff <= 0 ? (
                        <ArrowDownRight className="w-3 h-3" />
                      ) : (
                        <ArrowUpRight className="w-3 h-3 text-amber-500" />
                      )}
                      <span>
                        {vitality.restingHrDiff > 0 ? `+${vitality.restingHrDiff}` : vitality.restingHrDiff} vs 基线
                      </span>
                    </>
                  ) : (
                    <span>等待静息心率</span>
                  )}
                </div>
              </div>

              <div className="p-2.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05]">
                <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span>睡眠蓄能</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold text-neutral-900 dark:text-white">
                    {vitality.sleepContribution > 0 ? vitality.sleepContribution : '—'}
                  </span>
                  <span className="text-[10px] text-neutral-400">%</span>
                </div>
                <div className="text-[10px] text-neutral-400 mt-0.5">
                  {vitality.sleepContribution > 0 ? '睡眠效率' : '等待睡眠数据'}
                </div>
              </div>

              <div className="p-2.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05]">
                <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>压力负荷</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold text-emerald-500 dark:text-emerald-400">{vitality.stressLevel}</span>
                </div>
                <div className="text-[10px] text-neutral-400 mt-0.5">
                  {vitality.stressLevel === '数据不足' ? '等待 HRV 数据' : '基于 HRV 估算'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppleCard>
  );
};
