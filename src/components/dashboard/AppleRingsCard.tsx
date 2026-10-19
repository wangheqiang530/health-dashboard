import React, { useState } from 'react';
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
  const [hoveredRing, setHoveredRing] = useState<'move' | 'exercise' | 'stand' | null>(null);

  const size = 200;
  const center = size / 2;
  const strokeWidth = 14;

  const ringConfigs = [
    {
      key: 'move',
      radius: 78,
      ring: rings.move,
      icon: Flame,
      label: '动态能量',
      gradientId: 'moveGrad',
      glowColor: '#FA114F',
    },
    {
      key: 'exercise',
      radius: 60,
      ring: rings.exercise,
      icon: Timer,
      label: '锻炼时间',
      gradientId: 'exerciseGrad',
      glowColor: '#A1FF00',
    },
    {
      key: 'stand',
      radius: 42,
      ring: rings.stand,
      icon: PersonStanding,
      label: '站立时间',
      gradientId: 'standGrad',
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
          {/* Tri-Rings Graphic with animated key */}
          <div
            className="md:col-span-5 flex justify-center py-2 relative"
            key={`rings-canvas-${rings.move.current}-${rings.exercise.current}-${rings.stand.current}`}
          >
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
              <defs>
                {/* Apple Official Move Gradient: Coral-Red to Hot Pink/Crimson */}
                <linearGradient id="moveGrad" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FF3366" />
                  <stop offset="30%" stopColor="#FF4955" />
                  <stop offset="70%" stopColor="#FF1447" />
                  <stop offset="100%" stopColor="#D60036" />
                </linearGradient>

                {/* Apple Official Exercise Gradient: Chartreuse to Electric Lime */}
                <linearGradient id="exerciseGrad" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#E4FF00" />
                  <stop offset="50%" stopColor="#A1FF00" />
                  <stop offset="100%" stopColor="#6EE000" />
                </linearGradient>

                {/* Apple Official Stand Gradient: Cyan to Electric Blue */}
                <linearGradient id="standGrad" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#00F5D4" />
                  <stop offset="50%" stopColor="#00D2FF" />
                  <stop offset="100%" stopColor="#0077FE" />
                </linearGradient>

                {/* Radial Depth Shadow for Overlapping Cap */}
                <filter id="lapCapShadow" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="3.2" result="blur" />
                  <feColorMatrix type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0  0 0 0 0.85 0" />
                  <feBlend in="SourceGraphic" in2="blur" mode="normal" />
                </filter>
                <filter id="glowMove" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feDropShadow dx="0" dy="0" stdDeviation="4.5" floodColor="#FA114F" floodOpacity="0.65" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="glowExercise" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feDropShadow dx="0" dy="0" stdDeviation="4.5" floodColor="#99E834" floodOpacity="0.65" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="glowStand" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feDropShadow dx="0" dy="0" stdDeviation="4.5" floodColor="#00F5D4" floodOpacity="0.65" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Background Tracks */}
              {ringConfigs.map((cfg) => {
                const isHovered = hoveredRing === cfg.key;
                const isDimmed = hoveredRing !== null && !isHovered;
                const currentStroke = isHovered ? strokeWidth + 4 : strokeWidth;

                return (
                  <circle
                    key={`bg-${cfg.key}`}
                    cx={center}
                    cy={center}
                    r={cfg.radius}
                    stroke={cfg.ring.bgTrack}
                    strokeWidth={currentStroke}
                    strokeOpacity={isDimmed ? 0.25 : 1}
                    fill="none"
                    className="transition-all duration-300"
                  />
                );
              })}

              {/* Foreground Arcs starting from 0 and spinning to value */}
              {ringConfigs.map((cfg, idx) => {
                const circumference = 2 * Math.PI * cfg.radius;
                const ratio = cfg.ring.current / Math.max(cfg.ring.goal, 1);
                const baseOffset = circumference * (1 - Math.min(ratio, 1));
                const isHovered = hoveredRing === cfg.key;
                const isDimmed = hoveredRing !== null && !isHovered;
                const currentStroke = isHovered ? strokeWidth + 4 : strokeWidth;
                const glowFilter = cfg.key === 'move' ? 'url(#glowMove)' : cfg.key === 'exercise' ? 'url(#glowExercise)' : 'url(#glowStand)';

                // Overlap calculation
                const hasOverlap = ratio > 1;
                const overlapRatio = hasOverlap ? Math.min(ratio - 1, 0.999) : 0;
                const overlapOffset = circumference * (1 - overlapRatio);

                // Polar coordinates in rotated SVG:
                // Angle 0 in SVG space corresponds to 12 o'clock on screen due to rotate-[-90deg].
                const headAngle = overlapRatio * 2 * Math.PI;
                const headX = center + cfg.radius * Math.cos(headAngle);
                const headY = center + cfg.radius * Math.sin(headAngle);

                return (
                  <g
                    key={`fg-${cfg.key}`}
                    onMouseEnter={() => setHoveredRing(cfg.key as 'move' | 'exercise' | 'stand')}
                    onMouseLeave={() => setHoveredRing(null)}
                    className="cursor-pointer"
                    filter={isHovered ? glowFilter : undefined}
                    opacity={isDimmed ? 0.35 : 1}
                    style={{ transition: 'opacity 0.25s ease, filter 0.25s ease' }}
                  >
                    {/* Base Ring Lap 1 (0 to 100%) */}
                    <motion.circle
                      cx={center}
                      cy={center}
                      r={cfg.radius}
                      stroke={`url(#${cfg.gradientId})`}
                      strokeWidth={currentStroke}
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset: baseOffset }}
                      transition={{ duration: 1.6, delay: idx * 0.15, ease: [0.16, 1, 0.3, 1] }}
                    />

                    {/* Overlap Lap 2 (> 100%) with Realistic Apple Shadow */}
                    {hasOverlap && (
                      <g>
                        {/* 1. Overlapping Stroke Arc on top */}
                        <motion.circle
                          cx={center}
                          cy={center}
                          r={cfg.radius}
                          stroke={`url(#${cfg.gradientId})`}
                          strokeWidth={currentStroke}
                          fill="none"
                          strokeLinecap="round"
                          strokeDasharray={circumference}
                          initial={{ strokeDashoffset: circumference }}
                          animate={{ strokeDashoffset: overlapOffset }}
                          transition={{ duration: 1.6, delay: 0.4 + idx * 0.1, ease: 'easeOut' }}
                        />

                        {/* 2. Apple watchOS Depth Shadow beneath the leading end cap */}
                        <circle
                          cx={headX}
                          cy={headY}
                          r={currentStroke * 0.52}
                          fill="#000000"
                          filter="url(#lapCapShadow)"
                          opacity="0.75"
                          pointerEvents="none"
                        />

                        {/* 3. Terminal End Cap Disk resting firmly on top of the shadow */}
                        <circle
                          cx={headX}
                          cy={headY}
                          r={currentStroke * 0.5}
                          fill={cfg.glowColor}
                          stroke="rgba(0,0,0,0.25)"
                          strokeWidth="0.8"
                          pointerEvents="none"
                        />
                      </g>
                    )}

                    {/* Transparent hover hit target to ensure effortless mouse interaction */}
                    <circle
                      cx={center}
                      cy={center}
                      r={cfg.radius}
                      stroke="transparent"
                      strokeWidth={strokeWidth + 12}
                      fill="none"
                      className="cursor-pointer pointer-events-auto"
                    />
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
