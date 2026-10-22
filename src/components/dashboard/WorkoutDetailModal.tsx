import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { WorkoutRecord } from '../../types/health';
import { X, Flame, Heart, MapPin, Gauge, Mountain, Activity, Zap, Info } from 'lucide-react';
import { WorkoutRoutePlayback } from './WorkoutRoutePlayback';
import { getCalorieFoodEquivalents } from '../../utils/calorieFoods';
import { PowerDurationCurveCard } from './PowerDurationCurveCard';

interface WorkoutDetailModalProps {
  workout: WorkoutRecord | null;
  onClose: () => void;
}

const TermHelp: React.FC<{ term: string; explanation: string }> = ({
  term,
  explanation,
}) => (
  <span className="relative inline-flex items-center group/help">
    <Info className="w-3 h-3 text-neutral-400 cursor-help" />
    <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-xl border border-black/10 dark:border-white/15 bg-white/98 dark:bg-neutral-950/98 px-3 py-2 text-[10px] font-normal leading-relaxed text-neutral-600 dark:text-neutral-300 opacity-0 shadow-2xl transition-opacity group-hover/help:opacity-100">
      <strong className="block text-neutral-900 dark:text-white mb-0.5">{term}</strong>
      {explanation}
    </span>
  </span>
);

export const WorkoutDetailModal: React.FC<WorkoutDetailModalProps> = ({ workout, onClose }) => {
  if (!workout) return null;

  const isIgpsport = workout.source === 'igpsport' || workout.id.startsWith('igpsport');
  const foodEquiv = getCalorieFoodEquivalents(workout.activeCalories);
  const hasRoute = Boolean(workout.routeGpxPoints?.length);
  const hasHrZones = Object.values(workout.hrZones).some((value) => value > 0);
  const hrZoneUnavailableMessage =
    workout.source === 'hae'
      ? '数据源限制：Apple Health 导出的训练记录只包含平均与最高心率，不包含五个心率区间的停留时长。'
      : '该 FIT 文件未写入 time_in_hr_zone 字段，因此无法还原逐区间停留时长。';
  const isStrengthLike = workout.category === 'strength' || workout.category === 'hiit';
  const showDistanceMetric =
    !isStrengthLike && Boolean(workout.distanceKm);
  const showPaceMetric =
    !isStrengthLike &&
    (workout.category === 'cycling' ||
      workout.category === 'running' ||
      workout.category === 'walking' ||
      workout.category === 'swimming' ||
      Boolean(workout.paceAvg));

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
          className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white/95 dark:bg-[#12141a]/95 backdrop-blur-2xl p-6 md:p-8 z-10 border border-black/10 dark:border-white/10 shadow-2xl text-neutral-900 dark:text-white"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-neutral-500 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#A1FF00] tracking-wider uppercase">
                {isIgpsport
                  ? 'iGPSPORT 迹驰码表训练记录'
                  : workout.source === 'fit'
                    ? 'FIT 文件导入记录'
                    : 'Apple Health 运动记录'}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                isIgpsport
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              }`}>
                {isIgpsport ? '🚴 智能码表直连' : '⌚ Apple Fitness'}
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white mt-1">
              {workout.name}
            </h2>
            <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              <span>开始时间: {workout.startTime}</span>
              <span>•</span>
              <span>时长: {workout.durationMinutes} 分钟</span>
              {hasRoute && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  附 GPS 轨迹
                </span>
              )}
            </div>
          </div>

          {/* GPS Trail Map & Live Playback Component */}
          {hasRoute && (
            <div className="mb-6">
              <WorkoutRoutePlayback workout={workout} />
            </div>
          )}

          {/* Primary Key Metrics 2x2 grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/[0.06]">
              <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                <Flame className="w-4 h-4 text-[#FA114F]" />
                <span>动态消耗</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-neutral-900 dark:text-white">
                  {workout.activeCalories}
                </span>
                <span className="text-xs text-neutral-400">kcal</span>
              </div>
              {/* Food Calorie Equivalent */}
              <div className="mt-1 text-[11px] text-amber-500 dark:text-amber-300 flex items-center gap-1 font-medium">
                <span className="text-sm">{foodEquiv.emojis}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/[0.06]">
              <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                <Heart className="w-4 h-4 text-rose-500" />
                <span>平均心率</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-neutral-900 dark:text-white">
                  {workout.avgHeartRate}
                </span>
                <span className="text-xs text-neutral-400">bpm</span>
              </div>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500">最高 {workout.maxHeartRate} bpm</span>
            </div>

            {isStrengthLike && (
              <>
                <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/[0.06]">
                  <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                    <Activity className="w-4 h-4 text-sky-500" />
                    <span>训练时长</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-neutral-900 dark:text-white">
                      {workout.durationMinutes}
                    </span>
                    <span className="text-xs text-neutral-400">分钟</span>
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/[0.06]">
                  <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                    <Heart className="w-4 h-4 text-rose-500" />
                    <span>峰值心率</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-neutral-900 dark:text-white">
                      {workout.maxHeartRate || '—'}
                    </span>
                    <span className="text-xs text-neutral-400">bpm</span>
                  </div>
                </div>
              </>
            )}

            {showDistanceMetric && (
              <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  <MapPin className="w-4 h-4 text-[#00F5D4]" />
                  <span>运动距离</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-neutral-900 dark:text-white">
                    {workout.distanceKm}
                  </span>
                  <span className="text-xs text-neutral-400">km</span>
                </div>
              </div>
            )}

            {showPaceMetric && (
              <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  <Gauge className="w-4 h-4 text-[#A1FF00]" />
                  <span>{workout.category === 'cycling' ? '平均速度' : '平均配速'}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-neutral-900 dark:text-white">
                    {workout.category === 'cycling'
                      ? (workout.distanceKm && workout.durationMinutes > 0
                          ? `${(workout.distanceKm / (workout.durationMinutes / 60)).toFixed(1)} km/h`
                          : '-')
                      : workout.paceAvg || '-'}
                  </span>
                </div>
              </div>
            )}

            {workout.cadenceAvg && (
              <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  <Activity className="w-4 h-4 text-sky-400" />
                  <span>平均踏频 / 步频</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-neutral-900 dark:text-white">
                    {workout.cadenceAvg}
                  </span>
                  <span className="text-xs text-neutral-400">{workout.category === 'cycling' ? 'rpm' : 'spm'}</span>
                </div>
              </div>
            )}

            {workout.elevationGainM !== undefined && (
              <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  <Mountain className="w-4 h-4 text-amber-400" />
                  <span>累计爬升</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-neutral-900 dark:text-white">
                    {workout.elevationGainM}
                  </span>
                  <span className="text-xs text-neutral-400">m</span>
                </div>
              </div>
            )}

            {/* Power / TSS (iGPSPORT metrics) */}
            {(workout.avgPower || isIgpsport) && (
              <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>平均功率</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-neutral-900 dark:text-white">
                    {workout.avgPower ?? '—'}
                  </span>
                  <span className="text-xs text-neutral-400">W</span>
                </div>
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                  最高功率: {workout.maxPower ? `${workout.maxPower} W` : '—'}
                </span>
              </div>
            )}
          </div>

          {(workout.category === 'cycling' || isIgpsport) && (
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-amber-500/[0.06] to-cyan-500/[0.05] border border-amber-500/15">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider m-0 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>骑行强度指标</span>
                </h4>
                <span className="text-[10px] text-neutral-400">悬停问号查看名词解释</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-white/65 dark:bg-black/25 border border-black/5 dark:border-white/10">
                  <span className="flex items-center gap-1 text-[10px] text-neutral-500 dark:text-neutral-400">
                    IF
                    <TermHelp
                      term="IF · 强度因子"
                      explanation="Intensity Factor，标准化功率与 FTP 的比值。越高表示整场骑行相对阈值强度的负荷越大。"
                    />
                  </span>
                  <span className="text-xl font-black text-amber-500 font-mono block mt-1">
                    {workout.intensityFactor ? workout.intensityFactor.toFixed(2) : '—'}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-white/65 dark:bg-black/25 border border-black/5 dark:border-white/10">
                  <span className="flex items-center gap-1 text-[10px] text-neutral-500 dark:text-neutral-400">
                    NP
                    <TermHelp
                      term="NP · 标准化功率"
                      explanation="Normalized Power，对功率波动进行加权后的等效功率，比平均功率更能反映真实生理负荷。"
                    />
                  </span>
                  <span className="text-xl font-black text-cyan-500 font-mono block mt-1">
                    {workout.normalizedPower ? `${workout.normalizedPower} W` : '—'}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-white/65 dark:bg-black/25 border border-black/5 dark:border-white/10">
                  <span className="flex items-center gap-1 text-[10px] text-neutral-500 dark:text-neutral-400">
                    TSS
                    <TermHelp
                      term="TSS · 训练压力分数"
                      explanation="Training Stress Score，综合时长与强度衡量一次训练造成的生理压力。100 通常约等于 1 小时 FTP 强度训练。"
                    />
                  </span>
                  <span className="text-xl font-black text-purple-500 font-mono block mt-1">
                    {workout.tss ? workout.tss.toFixed(1) : '—'}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-white/65 dark:bg-black/25 border border-black/5 dark:border-white/10">
                  <span className="flex items-center gap-1 text-[10px] text-neutral-500 dark:text-neutral-400">
                    左右平衡
                    <TermHelp
                      term="左右平衡"
                      explanation="左腿与右腿输出功率占比。轻微差异常见，长期明显偏侧可能需要关注踩踏对称性与肌力平衡。"
                    />
                  </span>
                  <span className="text-xl font-black text-emerald-500 font-mono block mt-1">
                    {workout.leftRightBalance
                      ? `${workout.leftRightBalance.left}/${workout.leftRightBalance.right}`
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Heart Rate Zones Breakdown */}
          <div className="mb-6 p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/[0.05]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                心率区间分布 (Apple Fitness Heart Rate Zones)
              </h4>
              {!hasHrZones && (
                <span className="shrink-0 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-300">
                  数据源未提供
                </span>
              )}
            </div>
            {hasHrZones ? (
            <div className="space-y-2">
              {[
                { zone: '区间 1', name: '热身 / 恢复', pct: workout.hrZones.zone1, color: '#38BDF8' },
                { zone: '区间 2', name: '轻松燃脂', pct: workout.hrZones.zone2, color: '#4ADE80' },
                { zone: '区间 3', name: '有氧耐力', pct: workout.hrZones.zone3, color: '#FACC15' },
                { zone: '区间 4', name: '乳酸阈值', pct: workout.hrZones.zone4, color: '#FB923C' },
                { zone: '区间 5', name: '极限无氧', pct: workout.hrZones.zone5, color: '#F43F5E' },
              ].map((z) => (
                <div key={z.zone} className="flex items-center gap-3 text-xs">
                  <span className="w-14 font-mono font-medium text-neutral-500 dark:text-neutral-400">{z.zone}</span>
                  <span className="w-20 text-neutral-700 dark:text-neutral-300 truncate">{z.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${z.pct}%`, backgroundColor: z.color }}
                    />
                  </div>
                  <span className="w-10 text-right font-mono font-bold text-neutral-900 dark:text-white">{z.pct}%</span>
                </div>
              ))}
            </div>
            ) : (
              <div className="flex items-start gap-2 rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 text-[11px] leading-relaxed text-neutral-500 dark:border-white/5 dark:bg-white/[0.02] dark:text-neutral-400">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span>{hrZoneUnavailableMessage} 这不是读取失败。</span>
              </div>
            )}
          </div>

          {/* Coggan 7-Zone Power Distribution for Cycling Workouts */}
          {(workout.category === 'cycling' || isIgpsport) && (
            <div className="mb-6 p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/[0.05]">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider m-0 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Coggan 经典功率区间 (Power Zones Z1 ~ Z7)</span>
                </h4>
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">
                  NP: {workout.normalizedPower ? `${workout.normalizedPower}W` : '—'}
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                当前数据源未提供逐秒功率，因此不生成 Coggan 功率区间分布。
              </p>
            </div>
          )}

          {/* Power Duration Curve (PDC) inside Cycling Details */}
          {(workout.category === 'cycling' || isIgpsport) && (
            <div className="mb-2">
              <PowerDurationCurveCard workouts={[workout]} />
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
