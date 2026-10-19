import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { ActivityRings } from '../../types/health';
import { AppleCard } from '../ui/AppleCard';
import { ActivityRingsVisual } from '../ui/ActivityRingsVisual';
import { Flame, Timer, PersonStanding, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

interface AppleRingsCardProps {
  rings: ActivityRings;
  onRingClick?: () => void;
}

export const AppleRingsCard: React.FC<AppleRingsCardProps> = ({ rings, onRingClick }) => {
  const [hoveredRing, setHoveredRing] = useState<'move' | 'exercise' | 'stand' | null>(null);

  const ringConfigs = [
    {
      key: 'move',
      ring: rings.move,
      icon: Flame,
      label: '动态能量',
      glowColor: '#FA114F',
    },
    {
      key: 'exercise',
      ring: rings.exercise,
      icon: Timer,
      label: '锻炼时间',
      glowColor: '#A1FF00',
    },
    {
      key: 'stand',
      ring: rings.stand,
      icon: PersonStanding,
      label: '站立时间',
      glowColor: '#00F5D4',
    },
  ];

  const allClosed = 
    rings.move.current >= rings.move.goal &&
    rings.exercise.current >= rings.exercise.goal &&
    rings.stand.current >= rings.stand.goal;

  const triggerConfetti = (e: React.MouseEvent) => {
    e.stopPropagation();
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FA114F', '#A1FF00', '#00F5D4'],
    });
  };

  return (
    <AppleCard onClick={onRingClick} className="overflow-hidden h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-[#FA114F] via-[#A1FF00] to-[#00F5D4] shadow-sm shadow-[#FA114F]/40" />
            <h3 className="text-sm font-semibold tracking-wider text-neutral-500 dark:text-neutral-400 uppercase">
              健身圆环
            </h3>
          </div>
          {allClosed ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={triggerConfetti}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-gradient-to-r from-amber-500/20 to-emerald-500/20 text-amber-500 dark:text-amber-300 border border-amber-500/30"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              今日已达成圆环!
            </motion.button>
          ) : (
            <span className="text-xs text-neutral-400">Apple Watch 同步</span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Official Apple activity-ring shader */}
          <div
            className="md:col-span-5 flex justify-center py-2 relative"
            onMouseLeave={() => setHoveredRing(null)}
          >
            <div className="relative h-[200px] w-[200px]">
              <ActivityRingsVisual
                rings={rings}
                size={200}
                highlightedRing={hoveredRing}
                className="pointer-events-none"
              />
              <svg
                width="200"
                height="200"
                viewBox="0 0 200 200"
                className="absolute inset-0"
                aria-hidden="true"
              >
                <circle
                  cx="100"
                  cy="100"
                  r="89.8"
                  fill="none"
                  stroke="transparent"
                  strokeWidth="21"
                  style={{ pointerEvents: 'stroke' }}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredRing('move')}
                />
                <circle
                  cx="100"
                  cy="100"
                  r="69.1"
                  fill="none"
                  stroke="transparent"
                  strokeWidth="21"
                  style={{ pointerEvents: 'stroke' }}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredRing('exercise')}
                />
                <circle
                  cx="100"
                  cy="100"
                  r="48.3"
                  fill="none"
                  stroke="transparent"
                  strokeWidth="21"
                  style={{ pointerEvents: 'stroke' }}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredRing('stand')}
                />
              </svg>
            </div>
          </div>

          {/* Detailed Metrics List */}
          <div className="md:col-span-7 flex flex-col justify-center space-y-3">
            {ringConfigs.map((cfg) => {
              const percent = Math.round((cfg.ring.current / Math.max(cfg.ring.goal, 1)) * 100);
              const Icon = cfg.icon;
              const isHovered = hoveredRing === cfg.key;
              const isDimmed = hoveredRing !== null && !isHovered;

              return (
                <motion.div
                  key={cfg.key}
                  onMouseEnter={() => setHoveredRing(cfg.key as 'move' | 'exercise' | 'stand')}
                  onMouseLeave={() => setHoveredRing(null)}
                  animate={{
                    scale: isHovered ? 1.03 : 1,
                    opacity: isDimmed ? 0.45 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                  className={`group p-3 rounded-2xl transition-all duration-200 cursor-pointer ${
                    isHovered
                      ? 'border shadow-lg'
                      : 'bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.05]'
                  }`}
                  style={{
                    borderColor: isHovered ? `${cfg.glowColor}80` : undefined,
                    backgroundColor: isHovered ? `${cfg.glowColor}15` : undefined,
                    boxShadow: isHovered ? `0 10px 25px -5px ${cfg.glowColor}30` : undefined,
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="p-1.5 rounded-lg"
                        style={{ backgroundColor: `${cfg.glowColor}20` }}
                      >
                        <Icon className="w-4 h-4" style={{ color: cfg.glowColor }} />
                      </div>
                      <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        {cfg.label}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-bold tracking-tight text-neutral-900 dark:text-white">
                        {cfg.ring.current}
                      </span>
                      <span className="text-xs text-neutral-400 ml-1">
                        / {cfg.ring.goal} {cfg.ring.unit}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="relative w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(percent, 100)}%` }}
                      transition={{ duration: 1.4, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: cfg.glowColor }}
                    />
                  </div>
                  <div className="flex justify-between items-center mt-1 text-[11px] text-neutral-400">
                    <span>达成率</span>
                    <span
                      className="font-semibold"
                      style={{ color: percent >= 100 ? cfg.glowColor : undefined }}
                    >
                      {percent}%
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </AppleCard>
  );
};
