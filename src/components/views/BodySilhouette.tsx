import React from 'react';
import type { DailySummary } from '../../types/health';
import { AppleCard } from '../ui/AppleCard';
import { Activity, Droplets, Info, Scale, Zap } from 'lucide-react';

interface BodySilhouetteProps {
  currentDay?: DailySummary;
}

const hasValue = (value: number | undefined | null): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

export const BodySilhouette: React.FC<BodySilhouetteProps> = ({ currentDay }) => {
  const body = currentDay?.body;
  const weight = hasValue(body?.weightKg) ? body.weightKg : 0;
  const leanMass = hasValue(body?.leanMassKg) ? body.leanMassKg : 0;
  const fatMass = hasValue(body?.fatMassKg) ? body.fatMassKg : 0;
  const bodyFat = hasValue(body?.bodyFatPercent) ? body.bodyFatPercent : 0;
  const leanPercent = weight > 0 ? Math.round((leanMass / weight) * 100) : 0;
  const fatPercent = weight > 0 ? Math.round((fatMass / weight) * 100) : 0;

  return (
    <AppleCard>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-500" />
          <div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white m-0">
              身体成分整体分布
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              仅展示体脂秤实际返回的整身指标，不推断左右肢体或躯干节段数据
            </p>
          </div>
        </div>
        <span className="text-[11px] text-neutral-400">
          {body?.measuredAt
            ? `测量时间 ${new Intl.DateTimeFormat('zh-CN', {
                timeZone: 'Asia/Shanghai',
                dateStyle: 'short',
                timeStyle: 'short',
              }).format(new Date(body.measuredAt))}`
            : '尚无测量时间'}
        </span>
      </div>

      {weight <= 0 || leanMass <= 0 ? (
        <div className="py-12 text-center">
          <Scale className="w-8 h-8 mx-auto text-neutral-300 dark:text-neutral-600 mb-3" />
          <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
            暂无体重与去脂体重数据
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            完成一次 Fitdays 体测同步后，这里会显示实际的身体成分比例。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-64 h-96 flex items-center justify-center p-2 bg-black/[0.02] dark:bg-white/[0.02] rounded-3xl border border-black/5 dark:border-white/5">
              <svg viewBox="0 0 200 340" className="w-full h-full select-none" aria-label="身体成分整体比例示意">
                <defs>
                  <linearGradient id="bodyLeanGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#818CF8" />
                    <stop offset="100%" stopColor="#4F46E5" />
                  </linearGradient>
                  <linearGradient id="bodyFatGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FBBF24" />
                    <stop offset="100%" stopColor="#D97706" />
                  </linearGradient>
                </defs>
                <ellipse cx="100" cy="32" rx="16" ry="20" fill="#818CF8" fillOpacity="0.35" />
                <rect x="94" y="51" width="12" height="12" rx="2" fill="#818CF8" fillOpacity="0.35" />
                <path
                  d="M72 63 C78 61 122 61 128 63 C136 78 134 115 128 142 L72 142 C66 115 64 78 72 63 Z"
                  fill="url(#bodyLeanGradient)"
                  fillOpacity="0.9"
                />
                <path d="M69 66 C54 85 48 115 42 148 C38 168 44 174 50 160 C56 128 62 98 74 76 Z" fill="url(#bodyLeanGradient)" fillOpacity="0.8" />
                <path d="M131 66 C146 85 152 115 158 148 C162 168 156 174 150 160 C144 128 138 98 126 76 Z" fill="url(#bodyLeanGradient)" fillOpacity="0.8" />
                <path d="M78 142 L122 142 L120 166 L80 166 Z" fill="url(#bodyFatGradient)" fillOpacity="0.55" />
                <path d="M78 166 C74 205 72 245 68 285 C65 296 76 298 80 286 C86 248 90 208 94 166 Z" fill="url(#bodyLeanGradient)" fillOpacity="0.85" />
                <path d="M122 166 C126 205 128 245 132 285 C135 296 124 298 120 286 C114 248 110 208 106 166 Z" fill="url(#bodyLeanGradient)" fillOpacity="0.85" />
                <rect x="72" y="142" width="56" height="24" rx="6" fill="url(#bodyFatGradient)" fillOpacity="0.35" />
              </svg>
              <div className="absolute left-2 bottom-3 px-2.5 py-1 rounded-xl bg-indigo-600 text-white text-[10px] font-mono shadow-md">
                去脂 {leanPercent}%
              </div>
              <div className="absolute right-2 bottom-3 px-2.5 py-1 rounded-xl bg-amber-500 text-neutral-950 text-[10px] font-mono shadow-md">
                脂肪 {fatPercent}%
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">去脂体重</span>
                <span className="text-lg font-black text-indigo-500 font-mono">{leanMass}</span>
                <span className="text-[10px] text-neutral-400 ml-1">kg</span>
              </div>
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">脂肪量</span>
                <span className="text-lg font-black text-amber-500 font-mono">{fatMass}</span>
                <span className="text-[10px] text-neutral-400 ml-1">kg</span>
              </div>
              <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">体脂率</span>
                <span className="text-lg font-black text-cyan-500 font-mono">{bodyFat}</span>
                <span className="text-[10px] text-neutral-400 ml-1">%</span>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">BMI</span>
                <span className="text-lg font-black text-emerald-500 font-mono">
                  {hasValue(body?.bmi) ? body.bmi : '—'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  <Droplets className="w-3.5 h-3.5 text-sky-400" />
                  身体水分率
                </span>
                <span className="font-mono font-bold text-neutral-900 dark:text-white">
                  {hasValue(body?.waterPercent) ? `${body.waterPercent}%` : '—'}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  骨骼肌量
                </span>
                <span className="font-mono font-bold text-neutral-900 dark:text-white">
                  {hasValue(body?.skeletalMuscleKg) ? `${body.skeletalMuscleKg} kg` : '—'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-sky-500/[0.06] border border-sky-500/15 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-sky-500 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400 m-0">
                当前 Fitdays 接口提供整身成分数据，但没有提供可信的左右上肢、左右下肢及躯干阻抗明细。
                为避免把推算值当作实测值，本页不再展示节段肌脂、双频阻抗或推算的 7 日部位历史。
              </p>
            </div>
          </div>
        </div>
      )}
    </AppleCard>
  );
};
