import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { WorkoutRecord } from '../../types/health';
import { X, Flame, Heart, MapPin, Gauge, Mountain, Activity, Navigation } from 'lucide-react';

interface WorkoutDetailModalProps {
  workout: WorkoutRecord | null;
  onClose: () => void;
}

export const WorkoutDetailModal: React.FC<WorkoutDetailModalProps> = ({ workout, onClose }) => {
  if (!workout) return null;

  // Generate SVG path if GPX points exist
  let gpxPathD = '';
  let startX = 0;
  let startY = 0;
  let endX = 0;
  let endY = 0;

  if (workout.routeGpxPoints && workout.routeGpxPoints.length > 1) {
    const pts = workout.routeGpxPoints;
    const lats = pts.map((p) => p.lat);
    const lons = pts.map((p) => p.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    const svgW = 480;
    const svgH = 180;
    const pad = 24;

    const mapped = pts.map((p) => {
      // Invert lat for SVG Y coordinate
      const x = pad + ((p.lon - minLon) / Math.max(maxLon - minLon, 0.0001)) * (svgW - pad * 2);
      const y = svgH - pad - ((p.lat - minLat) / Math.max(maxLat - minLat, 0.0001)) * (svgH - pad * 2);
      return { x, y };
    });

    gpxPathD = mapped.reduce((acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`, '');
    startX = mapped[0].x;
    startY = mapped[0].y;
    endX = mapped[mapped.length - 1].x;
    endY = mapped[mapped.length - 1].y;
  }

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
            <span className="text-xs font-semibold text-[#A1FF00] tracking-wider uppercase">
              Apple Watch 运动体能记录
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-white mt-1">
              {workout.name}
            </h2>
            <div className="flex items-center gap-2 text-xs text-neutral-400 mt-1">
              <span>开始时间: {workout.startTime}</span>
              <span>•</span>
              <span>时长: {workout.durationMinutes} 分钟</span>
              {workout.routeGpxPoints && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  附真实 GPX 轨迹
                </span>
              )}
            </div>
          </div>

          {/* GPS Trail Map Card if Available */}
          {workout.routeGpxPoints && workout.routeGpxPoints.length > 1 && (
            <div className="mb-6 p-4 rounded-2xl bg-black/50 border border-white/10 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs text-neutral-300">
                  <Navigation className="w-3.5 h-3.5 text-[#A1FF00]" />
                  <span className="font-semibold">Apple Watch 真实 GPS 运动轨迹</span>
                </div>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {workout.routeGpxPoints.length} 个轨迹锚点{workout.distanceKm ? ` · ${workout.distanceKm} km` : ''}
                </span>
              </div>

              <div className="relative w-full h-[180px] bg-neutral-950/70 rounded-xl overflow-hidden border border-white/5 flex items-center justify-center">
                <svg viewBox="0 0 480 180" className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00F5D4" />
                      <stop offset="50%" stopColor="#A1FF00" />
                      <stop offset="100%" stopColor="#FFD60A" />
                    </linearGradient>
                    <filter id="glowRoute" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>

                  {/* Faint trail shadow */}
                  <path
                    d={gpxPathD}
                    fill="none"
                    stroke="#A1FF00"
                    strokeWidth="6"
                    strokeOpacity="0.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Main illuminated vector line */}
                  <motion.path
                    d={gpxPathD}
                    fill="none"
                    stroke="url(#routeGradient)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#glowRoute)"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.5, ease: 'easeInOut' }}
                  />

                  {/* Start Point */}
                  <circle cx={startX} cy={startY} r="5" fill="#00F5D4" stroke="#000" strokeWidth="2" />
                  <text x={startX + 8} y={startY - 6} fill="#00F5D4" className="text-[10px] font-bold">起点</text>

                  {/* End Point */}
                  <circle cx={endX} cy={endY} r="5" fill="#FFD60A" stroke="#000" strokeWidth="2" />
                  <text x={endX + 8} y={endY + 12} fill="#FFD60A" className="text-[10px] font-bold">终点</text>
                </svg>
              </div>
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
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
