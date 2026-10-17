import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppleCard } from '../ui/AppleCard';
import { Dumbbell, Activity } from 'lucide-react';

type BodyPartKey = 'trunk' | 'arms' | 'legs';

interface SegmentHistoryPoint {
  date: string;
  muscle: number;
  fat: number;
}

export const BodySilhouette: React.FC = () => {
  const [selectedBodyMode, setSelectedBodyMode] = useState<'muscle' | 'fat'>('muscle');
  const [hoveredPart, setHoveredPart] = useState<BodyPartKey>('trunk');

  const segmentData: Record<
    BodyPartKey,
    {
      name: string;
      subname: string;
      muscleVal: string;
      fatVal: string;
      muscleTrend: string;
      fatTrend: string;
      musclePct: number;
      eval: string;
      history: SegmentHistoryPoint[];
    }
  > = {
    trunk: {
      name: '核心与躯干节段',
      subname: '胸大肌 · 腹直肌 · 背阔肌群',
      muscleVal: '28.4 kg',
      fatVal: '10.2 kg',
      muscleTrend: '+0.2 kg',
      fatTrend: '-0.3 kg',
      musclePct: 73.6,
      eval: '核心肌群力量极充沛，腰腹深层肌肉紧致，利于骑行耐力抗疲劳。',
      history: [
        { date: '10-11', muscle: 28.2, fat: 10.5 },
        { date: '10-12', muscle: 28.2, fat: 10.4 },
        { date: '10-13', muscle: 28.3, fat: 10.4 },
        { date: '10-14', muscle: 28.3, fat: 10.3 },
        { date: '10-15', muscle: 28.4, fat: 10.3 },
        { date: '10-16', muscle: 28.4, fat: 10.2 },
        { date: '10-17', muscle: 28.4, fat: 10.2 },
      ],
    },
    arms: {
      name: '双臂上肢节段',
      subname: '三角肌 · 肱二头肌 · 前臂肌群',
      muscleVal: '8.2 kg (各 4.1kg)',
      fatVal: '2.4 kg (各 1.2kg)',
      muscleTrend: '+0.1 kg',
      fatTrend: '持平',
      musclePct: 77.4,
      eval: '左右上肢力量均衡（对称度 99.2%），握力与公路车弯把操控支撑稳定。',
      history: [
        { date: '10-11', muscle: 8.1, fat: 2.4 },
        { date: '10-12', muscle: 8.1, fat: 2.4 },
        { date: '10-13', muscle: 8.1, fat: 2.4 },
        { date: '10-14', muscle: 8.2, fat: 2.4 },
        { date: '10-15', muscle: 8.2, fat: 2.4 },
        { date: '10-16', muscle: 8.2, fat: 2.4 },
        { date: '10-17', muscle: 8.2, fat: 2.4 },
      ],
    },
    legs: {
      name: '双腿下肢节段',
      subname: '股四头肌 · 臀大肌 · 腓肠肌群',
      muscleVal: '20.6 kg (各 10.3kg)',
      fatVal: '5.2 kg (各 2.6kg)',
      muscleTrend: '+0.4 kg',
      fatTrend: '-0.2 kg',
      musclePct: 79.8,
      eval: '高负荷输出主力，下肢去脂肌肉占比接近 80%，极具公路车爬坡与巡航爆发力。',
      history: [
        { date: '10-11', muscle: 20.2, fat: 5.4 },
        { date: '10-12', muscle: 20.3, fat: 5.4 },
        { date: '10-13', muscle: 20.4, fat: 5.3 },
        { date: '10-14', muscle: 20.4, fat: 5.3 },
        { date: '10-15', muscle: 20.5, fat: 5.2 },
        { date: '10-16', muscle: 20.6, fat: 5.2 },
        { date: '10-17', muscle: 20.6, fat: 5.2 },
      ],
    },
  };

  const currentInfo = segmentData[hoveredPart];
  const historyVals = currentInfo.history.map((h) =>
    selectedBodyMode === 'muscle' ? h.muscle : h.fat
  );
  const minHist = Math.min(...historyVals);
  const maxHist = Math.max(...historyVals);
  const rangeHist = maxHist - minHist || 1;

  // SVG mini sparkline path for recent history
  const chartW = 320;
  const chartH = 70;
  const coords = currentInfo.history.map((h, i) => {
    const val = selectedBodyMode === 'muscle' ? h.muscle : h.fat;
    const x = 15 + (i / (currentInfo.history.length - 1)) * (chartW - 30);
    const y = chartH - 12 - ((val - minHist) / rangeHist) * (chartH - 24);
    return { x, y, val, date: h.date };
  });

  const splineD = coords.reduce(
    (acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`,
    ''
  );

  return (
    <AppleCard>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Dumbbell className="w-4 h-4 text-indigo-500" />
          <div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white m-0">
              人体解剖节段肌脂分布 (悬停部位联动实时趋势)
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              高精度矢量解剖剪影 · 鼠标划过模型部位即时联动右侧 7 日历史数据走势
            </p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-black/5 dark:border-white/5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSelectedBodyMode('muscle')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedBodyMode === 'muscle'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            💪 骨骼肌视图
          </button>
          <button
            type="button"
            onClick={() => setSelectedBodyMode('fat')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedBodyMode === 'fat'
                ? 'bg-amber-500 text-black shadow-sm font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            🧈 脂肪分布视图
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: Professional Vector Anatomical Human Silhouette */}
        <div className="lg:col-span-5 flex justify-center py-2 relative">
          <div className="relative w-64 h-96 flex items-center justify-center p-2 bg-black/[0.02] dark:bg-white/[0.02] rounded-3xl border border-black/5 dark:border-white/5">
            <svg viewBox="0 0 200 340" className="w-full h-full overflow-visible select-none">
              <defs>
                <filter id="partGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <linearGradient id="muscleActiveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#818CF8" />
                  <stop offset="100%" stopColor="#4F46E5" />
                </linearGradient>
                <linearGradient id="fatActiveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FBBF24" />
                  <stop offset="100%" stopColor="#D97706" />
                </linearGradient>
              </defs>

              {/* Head / Face */}
              <ellipse cx="100" cy="32" rx="16" ry="20" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.2" className="text-neutral-400" />
              {/* Neck */}
              <rect x="94" y="51" width="12" height="12" rx="2" fill="currentColor" fillOpacity="0.2" className="text-neutral-400" />

              {/* 1. Trunk (Chest, Core, Abdomen, Back) */}
              <g
                onMouseEnter={() => setHoveredPart('trunk')}
                className="cursor-pointer group"
              >
                <path
                  d="M 72 63 C 78 61, 122 61, 128 63 C 136 78, 134 115, 128 142 L 72 142 C 66 115, 64 78, 72 63 Z"
                  fill={hoveredPart === 'trunk' ? (selectedBodyMode === 'muscle' ? 'url(#muscleActiveGrad)' : 'url(#fatActiveGrad)') : 'currentColor'}
                  fillOpacity={hoveredPart === 'trunk' ? 0.9 : 0.25}
                  stroke={hoveredPart === 'trunk' ? (selectedBodyMode === 'muscle' ? '#818CF8' : '#F59E0B') : 'currentColor'}
                  strokeWidth={hoveredPart === 'trunk' ? 2 : 1}
                  filter={hoveredPart === 'trunk' ? 'url(#partGlow)' : undefined}
                  className="transition-all duration-300 text-neutral-400"
                />
                {/* Abdomen line detailing */}
                <line x1="100" y1="78" x2="100" y2="135" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
                <line x1="88" y1="95" x2="112" y2="95" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" />
                <line x1="86" y1="112" x2="114" y2="112" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" />
              </g>

              {/* Pelvis Belt */}
              <path d="M 72 142 L 128 142 L 120 166 L 80 166 Z" fill="currentColor" fillOpacity="0.18" className="text-neutral-500" />

              {/* 2. Left Arm (Shoulder, Bicep, Forearm) */}
              <g
                onMouseEnter={() => setHoveredPart('arms')}
                className="cursor-pointer group"
              >
                <path
                  d="M 69 66 C 54 85, 48 115, 42 148 C 38 168, 44 174, 50 160 C 56 128, 62 98, 74 76 Z"
                  fill={hoveredPart === 'arms' ? (selectedBodyMode === 'muscle' ? 'url(#muscleActiveGrad)' : 'url(#fatActiveGrad)') : 'currentColor'}
                  fillOpacity={hoveredPart === 'arms' ? 0.9 : 0.25}
                  stroke={hoveredPart === 'arms' ? (selectedBodyMode === 'muscle' ? '#818CF8' : '#F59E0B') : 'currentColor'}
                  strokeWidth={hoveredPart === 'arms' ? 2 : 1}
                  filter={hoveredPart === 'arms' ? 'url(#partGlow)' : undefined}
                  className="transition-all duration-300 text-neutral-400"
                />
              </g>

              {/* 2. Right Arm */}
              <g
                onMouseEnter={() => setHoveredPart('arms')}
                className="cursor-pointer group"
              >
                <path
                  d="M 131 66 C 146 85, 152 115, 158 148 C 162 168, 156 174, 150 160 C 144 128, 138 98, 126 76 Z"
                  fill={hoveredPart === 'arms' ? (selectedBodyMode === 'muscle' ? 'url(#muscleActiveGrad)' : 'url(#fatActiveGrad)') : 'currentColor'}
                  fillOpacity={hoveredPart === 'arms' ? 0.9 : 0.25}
                  stroke={hoveredPart === 'arms' ? (selectedBodyMode === 'muscle' ? '#818CF8' : '#F59E0B') : 'currentColor'}
                  strokeWidth={hoveredPart === 'arms' ? 2 : 1}
                  filter={hoveredPart === 'arms' ? 'url(#partGlow)' : undefined}
                  className="transition-all duration-300 text-neutral-400"
                />
              </g>

              {/* 3. Left Leg (Thigh, Knee, Calf) */}
              <g
                onMouseEnter={() => setHoveredPart('legs')}
                className="cursor-pointer group"
              >
                <path
                  d="M 78 166 C 74 205, 72 245, 68 285 C 65 296, 76 298, 80 286 C 86 248, 90 208, 94 166 Z"
                  fill={hoveredPart === 'legs' ? (selectedBodyMode === 'muscle' ? 'url(#muscleActiveGrad)' : 'url(#fatActiveGrad)') : 'currentColor'}
                  fillOpacity={hoveredPart === 'legs' ? 0.9 : 0.25}
                  stroke={hoveredPart === 'legs' ? (selectedBodyMode === 'muscle' ? '#818CF8' : '#F59E0B') : 'currentColor'}
                  strokeWidth={hoveredPart === 'legs' ? 2 : 1}
                  filter={hoveredPart === 'legs' ? 'url(#partGlow)' : undefined}
                  className="transition-all duration-300 text-neutral-400"
                />
              </g>

              {/* 3. Right Leg */}
              <g
                onMouseEnter={() => setHoveredPart('legs')}
                className="cursor-pointer group"
              >
                <path
                  d="M 122 166 C 126 205, 128 245, 132 285 C 135 296, 124 298, 120 286 C 114 248, 110 208, 106 166 Z"
                  fill={hoveredPart === 'legs' ? (selectedBodyMode === 'muscle' ? 'url(#muscleActiveGrad)' : 'url(#fatActiveGrad)') : 'currentColor'}
                  fillOpacity={hoveredPart === 'legs' ? 0.9 : 0.25}
                  stroke={hoveredPart === 'legs' ? (selectedBodyMode === 'muscle' ? '#818CF8' : '#F59E0B') : 'currentColor'}
                  strokeWidth={hoveredPart === 'legs' ? 2 : 1}
                  filter={hoveredPart === 'legs' ? 'url(#partGlow)' : undefined}
                  className="transition-all duration-300 text-neutral-400"
                />
              </g>
            </svg>

            {/* Overlaid Badges */}
            <div
              onMouseEnter={() => setHoveredPart('trunk')}
              className={`absolute top-24 px-2.5 py-1 rounded-xl text-[10px] font-mono shadow-md cursor-pointer transition-all ${
                hoveredPart === 'trunk'
                  ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 scale-105'
                  : 'bg-neutral-900/80 text-neutral-200 border border-white/20'
              }`}
            >
              {selectedBodyMode === 'muscle' ? '躯干 28.4kg' : '脂肪 10.2kg'}
            </div>

            <div
              onMouseEnter={() => setHoveredPart('arms')}
              className={`absolute top-20 -left-2 px-2 py-0.5 rounded-xl text-[10px] font-mono shadow-md cursor-pointer transition-all ${
                hoveredPart === 'arms'
                  ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 scale-105'
                  : 'bg-neutral-900/80 text-neutral-200 border border-white/20'
              }`}
            >
              {selectedBodyMode === 'muscle' ? '双臂 8.2kg' : '脂肪 2.4kg'}
            </div>

            <div
              onMouseEnter={() => setHoveredPart('legs')}
              className={`absolute bottom-12 px-2.5 py-1 rounded-xl text-[10px] font-mono shadow-md cursor-pointer transition-all ${
                hoveredPart === 'legs'
                  ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 scale-105'
                  : 'bg-neutral-900/80 text-neutral-200 border border-white/20'
              }`}
            >
              {selectedBodyMode === 'muscle' ? '双腿 20.6kg' : '脂肪 5.2kg'}
            </div>
          </div>
        </div>

        {/* Right: Linked Real-Time Detailed Panel + 7-Day Historical Trend */}
        <div className="lg:col-span-7 space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${hoveredPart}-${selectedBodyMode}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="p-4 rounded-3xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                <div>
                  <h4 className="text-base font-bold text-neutral-900 dark:text-white m-0">
                    {currentInfo.name}
                  </h4>
                  <span className="text-xs text-neutral-400">{currentInfo.subname}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-emerald-500 block">
                    肌肉占比 {currentInfo.musclePct}%
                  </span>
                  <span className="text-[10px] text-neutral-400">解剖机能评估卓越</span>
                </div>
              </div>

              {/* Current Values & Micro-Trends */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                  <div className="flex justify-between items-center text-[11px] text-neutral-400 mb-1">
                    <span>骨骼肌含量</span>
                    <span className="text-emerald-500 font-bold font-mono">{currentInfo.muscleTrend}</span>
                  </div>
                  <span className="text-xl font-black text-indigo-400 font-mono block">
                    {currentInfo.muscleVal}
                  </span>
                  <span className="text-[10px] text-neutral-400 mt-1 block">7日呈平稳增肌</span>
                </div>

                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <div className="flex justify-between items-center text-[11px] text-neutral-400 mb-1">
                    <span>附着脂肪量</span>
                    <span className="text-emerald-500 font-bold font-mono">{currentInfo.fatTrend}</span>
                  </div>
                  <span className="text-xl font-black text-amber-400 font-mono block">
                    {currentInfo.fatVal}
                  </span>
                  <span className="text-[10px] text-neutral-400 mt-1 block">体脂率紧致达标</span>
                </div>
              </div>

              {/* 7-Day Historical Spline Trend for this specific body part */}
              <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-indigo-400" />
                    <span>该部位最近 7 日{selectedBodyMode === 'muscle' ? '骨骼肌' : '脂肪'}历史趋势 (kg)</span>
                  </span>
                  <span className="font-mono text-emerald-500 font-bold">
                    {currentInfo.muscleTrend}
                  </span>
                </div>

                {/* Mini SVG Trend Line */}
                <div className="h-16 w-full mt-2">
                  <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-full overflow-visible">
                    <path
                      d={splineD}
                      fill="none"
                      stroke={selectedBodyMode === 'muscle' ? '#6366F1' : '#F59E0B'}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    {coords.map((c, idx) => (
                      <g key={idx}>
                        <circle
                          cx={c.x}
                          cy={c.y}
                          r="3"
                          fill="#FFF"
                          stroke={selectedBodyMode === 'muscle' ? '#6366F1' : '#F59E0B'}
                          strokeWidth="2"
                        />
                        <text
                          x={c.x}
                          y={c.y - 7}
                          textAnchor="middle"
                          className="text-[9px] font-mono fill-neutral-400"
                        >
                          {c.val}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
                <div className="flex justify-between items-center text-[9px] text-neutral-400 font-mono px-3 mt-1">
                  {currentInfo.history.map((h) => (
                    <span key={h.date}>{h.date}</span>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed m-0">
                {currentInfo.eval}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </AppleCard>
  );
};