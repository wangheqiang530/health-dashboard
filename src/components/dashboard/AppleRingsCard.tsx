import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { ActivityRings } from '../../types/health';
import { AppleCard } from '../ui/AppleCard';
import { Flame, Timer, PersonStanding, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

interface AppleRingsCardProps {
  rings: ActivityRings;
  onRingClick?: () => void;
}

export const AppleRingsCard: React.FC<AppleRingsCardProps> = ({ rings, onRingClick }) => {
  const size = 200;
  const center = size / 2;
  const strokeWidth = 14;
  const [animKey, setAnimKey] = useState(0);

  // Trigger smooth 0->100% spin on mount and whenever ring numbers change
  useEffect(() => {
    setAnimKey((prev) => prev + 1);
  }, [rings.move.current, rings.exercise.current, rings.stand.current]);

  const ringConfigs = [
    {
      key: 'move',
      radius: 78,
      ring: rings.move,
      icon: Flame,
      label: '动态能量',
      gradientId: 'moveGrad',
      startColor: '#FF2D55',
      endColor: '#FA114F',
    },
    {
      key: 'exercise',
      radius: 60,
      ring: rings.exercise,
      icon: Timer,
      label: '锻炼时间',
      gradientId: 'exerciseGrad',
      startColor: '#B6FF3B',
      endColor: '#99E834',
    },
    {
      key: 'stand',
      radius: 42,
      ring: rings.stand,
      icon: PersonStanding,
      label: '站立时间',
      gradientId: 'standGrad',
      startColor: '#00F5D4',
      endColor: '#00D0FF',
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
          {/* Tri-Rings Graphic with animated key */}
          <div className="md:col-span-5 flex justify-center py-2 relative" key={`rings-canvas-${animKey}`}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
              <defs>
                <linearGradient id="moveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FF5277" />
                  <stop offset="100%" stopColor="#FA114F" />
                </linearGradient>
                <linearGradient id="exerciseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#CCFF00" />
                  <stop offset="100%" stopColor="#99E834" />
                </linearGradient>
                <linearGradient id="standGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00F5D4" />
                  <stop offset="100%" stopColor="#00C4FF" />
                </linearGradient>
                <filter id="ringCapShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="2" dy="2" stdDeviation="2.5" floodColor="#000" floodOpacity="0.4" />
                </filter>
              </defs>

              {/* Background Tracks */}
              {ringConfigs.map((cfg) => (
                <circle
                  key={`bg-${cfg.key}`}
                  cx={center}
                  cy={center}
                  r={cfg.radius}
                  stroke={cfg.ring.bgTrack}
                  strokeWidth={strokeWidth}
                  fill="none"
                />
              ))}

              {/* Foreground Arcs starting from 0 and spinning to value */}
              {ringConfigs.map((cfg, idx) => {
                const circumference = 2 * Math.PI * cfg.radius;
                const ratio = cfg.ring.current / Math.max(cfg.ring.goal, 1);
                const strokeDashoffset = circumference * (1 - Math.min(ratio, 1));

                return (
                  <g key={`fg-${cfg.key}`}>
                    <motion.circle
                      cx={center}
                      cy={center}
                      r={cfg.radius}
                      stroke={`url(#${cfg.gradientId})`}
                      strokeWidth={strokeWidth}
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset }}
                      transition={{ duration: 1.6, delay: idx * 0.15, ease: [0.16, 1, 0.3, 1] }}
                    />
                    {ratio > 1 && (
                      <motion.circle
                        cx={center}
                        cy={center}
                        r={cfg.radius}
                        stroke={`url(#${cfg.gradientId})`}
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset: circumference * (1 - Math.min(ratio - 1, 1)) }}
                        transition={{ duration: 1.6, delay: 0.5 + idx * 0.1, ease: 'easeOut' }}
                        filter="url(#ringCapShadow)"
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Ambient center blur */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#FA114F]/10 via-[#A1FF00]/10 to-[#00F5D4]/10 blur-xl" />
            </div>
          </div>

          {/* Detailed Metrics List */}
          <div className="md:col-span-7 flex flex-col justify-center space-y-3">
            {ringConfigs.map((cfg) => {
              const percent = Math.round((cfg.ring.current / Math.max(cfg.ring.goal, 1)) * 100);
              const Icon = cfg.icon;

              return (
                <div
                  key={cfg.key}
                  className="group p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.05] transition-all duration-200"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="p-1.5 rounded-lg"
                        style={{ backgroundColor: `${cfg.endColor}20` }}
                      >
                        <Icon className="w-4 h-4" style={{ color: cfg.endColor }} />
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
                      style={{ backgroundColor: cfg.endColor }}
                    />
                  </div>
                  <div className="flex justify-between items-center mt-1 text-[11px] text-neutral-400">
                    <span>达成率</span>
                    <span
                      className="font-semibold"
                      style={{ color: percent >= 100 ? cfg.endColor : undefined }}
                    >
                      {percent}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppleCard>
  );
};