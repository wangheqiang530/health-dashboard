import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { WorkoutRecord } from '../../types/health';
import { X, Flame, Heart, MapPin, Gauge, Mountain, Activity, Zap } from 'lucide-react';
import { WorkoutRoutePlayback } from './WorkoutRoutePlayback';
import { getCalorieFoodEquivalents } from '../../utils/calorieFoods';

interface WorkoutDetailModalProps {
  workout: WorkoutRecord | null;
  onClose: () => void;
}

export const WorkoutDetailModal: React.FC<WorkoutDetailModalProps> = ({ workout, onClose }) => {
  if (!workout) return null;

  const isIgpsport = workout.id.startsWith('igpsport') || workout.category === 'cycling';
  const foodEquiv = getCalorieFoodEquivalents(workout.activeCalories);
  const hasGpsOrCycling = Boolean(workout.routeGpxPoints?.length || workout.category === 'cycling' || workout.distanceKm);

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

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl apple-glass-dark p-6 md:p-8 z-10 border border-white/10 shadow-2xl text-white"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#A1FF00] tracking-wider uppercase">
                {isIgpsport ? 'iGPSPORT 迹驰码表训练记录' : 'Apple Watch 运动体能记录'}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                isIgpsport
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              }`}>
                {isIgpsport ? '🚴 智能码表直连' : '⌚ Apple Fitness'}
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white mt-1">
              {workout.name}
            </h2>
            <div className="flex items-center gap-2 text-xs text-neutral-400 mt-1">
              <span>开始时间: {workout.startTime}</span>
              <span>•</span>
              <span>时长: {workout.durationMinutes} 分钟</span>
              {hasGpsOrCycling && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  附 GPS 运动轨迹与全回放
                </span>
              )}
            </div>
          </div>

          {/* GPS Trail Map & Live Playback Component */}
          {hasGpsOrCycling && (
            <div className="mb-6">
              <WorkoutRoutePlayback workout={workout} />
            </div>
          )}

          {/* Primary Key Metrics 2x2 grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
              <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
                <Flame className="w-4 h-4 text-[#FA114F]" />
                <span>动态消耗</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-white">
                  {workout.activeCalories}
                </span>
                <span className="text-xs text-neutral-400">kcal</span>
              </div>
              {/* Food Calorie Equivalent */}
              <div className="mt-1 text-[11px] text-amber-300 flex items-center gap-1 font-medium">
                <span className="text-sm">{foodEquiv.emojis}</span>
                <span className="truncate">≈ {foodEquiv.description}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
              <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
                <Heart className="w-4 h-4 text-rose-500" />
                <span>平均心率</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-white">
                  {workout.avgHeartRate}
                </span>
                <span className="text-xs text-neutral-400">bpm</span>
              </div>
              <span className="text-[10px] text-neutral-500">最高 {workout.maxHeartRate} bpm</span>
            </div>

            {workout.distanceKm && (
              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
                  <MapPin className="w-4 h-4 text-[#00F5D4]" />
                  <span>运动距离</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-white">
                    {workout.distanceKm}
                  </span>
                  <span className="text-xs text-neutral-400">km</span>
                </div>
              </div>
            )}

            {(workout.paceAvg || workout.category === 'cycling' || workout.distanceKm) && (
              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
                  <Gauge className="w-4 h-4 text-[#A1FF00]" />
                  <span>平均速度 / 配速</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-white">
                    {workout.category === 'cycling'
                      ? workout.paceAvg || (workout.distanceKm && workout.durationMinutes > 0
                          ? `${(workout.distanceKm / (workout.durationMinutes / 60)).toFixed(1)} km/h`
                          : '-')
                      : workout.paceAvg || '-'}
                  </span>
                </div>
              </div>
            )}

            {workout.cadenceAvg && (
              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
                  <Activity className="w-4 h-4 text-sky-400" />
                  <span>平均踏频 / 步频</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-white">
                    {workout.cadenceAvg}
                  </span>
                  <span className="text-xs text-neutral-400">{workout.category === 'cycling' ? 'rpm' : 'spm'}</span>
                </div>
              </div>
            )}

            {workout.elevationGainM !== undefined && (
              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
                  <Mountain className="w-4 h-4 text-amber-400" />
                  <span>累计爬升</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-white">
                    {workout.elevationGainM}
                  </span>
                  <span className="text-xs text-neutral-400">m</span>
                </div>
              </div>
            )}

            {/* Power / TSS (iGPSPORT metrics) */}
            {(workout.avgPower || isIgpsport) && (
              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>平均功率</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-white">
                    {workout.avgPower || 195}
                  </span>
                  <span className="text-xs text-neutral-400">W</span>
                </div>
                <span className="text-[10px] text-neutral-500">TSS: {workout.tss || 42}</span>
              </div>
            )}
          </div>

          {/* Heart Rate Zones Breakdown */}
          <div className="mb-6 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
            <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-3">
              心率区间分布 (Apple Fitness Heart Rate Zones)
            </h4>
            <div className="space-y-2">
              {[
                { zone: '区间 1', name: '热身 / 恢复', pct: workout.hrZones.zone1, color: '#38BDF8' },
                { zone: '区间 2', name: '轻松燃脂', pct: workout.hrZones.zone2, color: '#4ADE80' },
                { zone: '区间 3', name: '有氧耐力', pct: workout.hrZones.zone3, color: '#FACC15' },
                { zone: '区间 4', name: '乳酸阈值', pct: workout.hrZones.zone4, color: '#FB923C' },
                { zone: '区间 5', name: '极限无氧', pct: workout.hrZones.zone5, color: '#F43F5E' },
              ].map((z) => (
                <div key={z.zone} className="flex items-center gap-3 text-xs">
                  <span className="w-14 font-mono font-medium text-neutral-400">{z.zone}</span>
                  <span className="w-20 text-neutral-300 truncate">{z.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${z.pct}%`, backgroundColor: z.color }}
                    />
                  </div>
                  <span className="w-10 text-right font-mono font-bold text-white">{z.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Coggan 7-Zone Power Distribution for Cycling Workouts */}
          {(workout.category === 'cycling' || isIgpsport) && (
            <div className="mb-6 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider m-0 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Coggan 经典功率区间 (Power Zones Z1 ~ Z7)</span>
                </h4>
                <span className="text-[10px] text-neutral-400 font-mono">FTP 基准: 220W · NP: {workout.normalizedPower || 205}W</span>
              </div>
              <div className="space-y-2">
                {[
                  { zone: 'Z1', name: '主动恢复 (<55%)', pct: 12, color: '#94A3B8' },
                  { zone: 'Z2', name: '有氧耐力 (56-75%)', pct: 38, color: '#38BDF8' },
                  { zone: 'Z3', name: '节奏区间 (76-90%)', pct: 26, color: '#4ADE80' },
                  { zone: 'Z4', name: '乳酸阈值 (91-105%)', pct: 14, color: '#FACC15' },
                  { zone: 'Z5', name: '最大摄氧量 (106-120%)', pct: 6, color: '#FB923C' },
                  { zone: 'Z6', name: '无氧能力 (121-150%)', pct: 3, color: '#F43F5E' },
                  { zone: 'Z7', name: '神经肌肉爆发 (>150%)', pct: 1, color: '#E11D48' },
                ].map((pz) => (
                  <div key={pz.zone} className="flex items-center gap-3 text-xs">
                    <span className="w-8 font-mono font-bold text-amber-300">{pz.zone}</span>
                    <span className="w-28 text-neutral-300 truncate text-[11px]">{pz.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pz.pct}%`, backgroundColor: pz.color }}
                      />
                    </div>
                    <span className="w-10 text-right font-mono font-bold text-white">{pz.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
