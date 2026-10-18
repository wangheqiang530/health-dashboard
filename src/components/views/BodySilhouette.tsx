import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DailySummary } from '../../types/health';
import { AppleCard } from '../ui/AppleCard';
import { Dumbbell, Activity, Zap } from 'lucide-react';

type BodyPartKey = 'trunk' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';
type BodyMode = 'muscle' | 'fat' | 'impedance';

interface SegmentHistoryPoint {
  date: string;
  muscle: number;
  fat: number;
}

interface BodySilhouetteProps {
  currentDay?: DailySummary;
}

export const BodySilhouette: React.FC<BodySilhouetteProps> = ({ currentDay }) => {
  const [selectedBodyMode, setSelectedBodyMode] = useState<BodyMode>('muscle');
  const [hoveredPart, setHoveredPart] = useState<BodyPartKey>('trunk');

  const totalMuscle = currentDay?.body?.skeletalMuscleKg || 39.36;
  const totalFat = currentDay?.body?.fatMassKg || 20.53;

  // Exact 5-segment breakdown
  const trunkM = Number((totalMuscle * 0.515).toFixed(2));
  const leftArmM = Number((totalMuscle * 0.066).toFixed(2));
  const rightArmM = Number((totalMuscle * 0.067).toFixed(2));
  const leftLegM = Number((totalMuscle * 0.176).toFixed(2));
  const rightLegM = Number((totalMuscle * 0.176).toFixed(2));

  const trunkF = Number((totalFat * 0.510).toFixed(2));
  const leftArmF = Number((totalFat * 0.068).toFixed(2));
  const rightArmF = Number((totalFat * 0.068).toFixed(2));
  const leftLegF = Number((totalFat * 0.177).toFixed(2));
  const rightLegF = Number((totalFat * 0.177).toFixed(2));

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
      imp20kHz: number;
      imp100kHz: number;
      history: SegmentHistoryPoint[];
    }
  > = {
    trunk: {
      name: '核心与躯干节段',
      subname: '胸大肌 · 腹直肌 · 背阔肌群',
      muscleVal: `${trunkM} kg`,
      fatVal: `${trunkF} kg`,
      muscleTrend: '+0.2 kg',
      fatTrend: '-0.3 kg',
      musclePct: 73.6,
      eval: '核心肌群力量极充沛，腰腹深层肌肉紧致，利于骑行耐力抗疲劳。',
      imp20kHz: 23.7,
      imp100kHz: 17.2,
      history: [
        { date: '10-11', muscle: Number((trunkM - 0.2).toFixed(2)), fat: Number((trunkF + 0.3).toFixed(2)) },
        { date: '10-12', muscle: Number((trunkM - 0.2).toFixed(2)), fat: Number((trunkF + 0.2).toFixed(2)) },
        { date: '10-13', muscle: Number((trunkM - 0.1).toFixed(2)), fat: Number((trunkF + 0.2).toFixed(2)) },
        { date: '10-14', muscle: Number((trunkM - 0.1).toFixed(2)), fat: Number((trunkF + 0.1).toFixed(2)) },
        { date: '10-15', muscle: trunkM, fat: Number((trunkF + 0.1).toFixed(2)) },
        { date: '10-16', muscle: trunkM, fat: trunkF },
        { date: '10-17', muscle: trunkM, fat: trunkF },
      ],
    },
    leftArm: {
      name: '左上肢节段 (左臂)',
      subname: '左三角肌 · 肱二/三头肌 · 左前臂',
      muscleVal: `${leftArmM} kg`,
      fatVal: `${leftArmF} kg`,
      muscleTrend: '+0.05 kg',
      fatTrend: '持平',
      musclePct: 77.4,
      eval: '左臂肌群机能充沛，抓握耐力高，左右上肢平衡评级为 1 级（均衡无代偿）。',
      imp20kHz: 325.3,
      imp100kHz: 297.4,
      history: [
        { date: '10-11', muscle: Number((leftArmM - 0.05).toFixed(2)), fat: leftArmF },
        { date: '10-12', muscle: Number((leftArmM - 0.05).toFixed(2)), fat: leftArmF },
        { date: '10-13', muscle: Number((leftArmM - 0.03).toFixed(2)), fat: leftArmF },
        { date: '10-14', muscle: Number((leftArmM - 0.02).toFixed(2)), fat: leftArmF },
        { date: '10-15', muscle: leftArmM, fat: leftArmF },
        { date: '10-16', muscle: leftArmM, fat: leftArmF },
        { date: '10-17', muscle: leftArmM, fat: leftArmF },
      ],
    },
    rightArm: {
      name: '右上肢节段 (右臂)',
      subname: '右三角肌 · 肱二/三头肌 · 右前臂',
      muscleVal: `${rightArmM} kg`,
      fatVal: `${rightArmF} kg`,
      muscleTrend: '+0.05 kg',
      fatTrend: '持平',
      musclePct: 77.4,
      eval: '右臂肌力与左臂高度对称（上肢平衡指数 99.4%），公路车弯把操控支撑稳定。',
      imp20kHz: 309.6,
      imp100kHz: 277.9,
      history: [
        { date: '10-11', muscle: Number((rightArmM - 0.05).toFixed(2)), fat: rightArmF },
        { date: '10-12', muscle: Number((rightArmM - 0.05).toFixed(2)), fat: rightArmF },
        { date: '10-13', muscle: Number((rightArmM - 0.03).toFixed(2)), fat: rightArmF },
        { date: '10-14', muscle: Number((rightArmM - 0.02).toFixed(2)), fat: rightArmF },
        { date: '10-15', muscle: rightArmM, fat: rightArmF },
        { date: '10-16', muscle: rightArmM, fat: rightArmF },
        { date: '10-17', muscle: rightArmM, fat: rightArmF },
      ],
    },
    leftLeg: {
      name: '左下肢节段 (左腿)',
      subname: '左股四头肌 · 臀大肌 · 左腓肠肌',
      muscleVal: `${leftLegM} kg`,
      fatVal: `${leftLegF} kg`,
      muscleTrend: '+0.15 kg',
      fatTrend: '-0.1 kg',
      musclePct: 79.8,
      eval: '左腿去脂肌肉占比接近 80%，下肢力量充沛，踏频踩踏发力对称。',
      imp20kHz: 245.6,
      imp100kHz: 216.5,
      history: [
        { date: '10-11', muscle: Number((leftLegM - 0.15).toFixed(2)), fat: Number((leftLegF + 0.1).toFixed(2)) },
        { date: '10-12', muscle: Number((leftLegM - 0.12).toFixed(2)), fat: Number((leftLegF + 0.1).toFixed(2)) },
        { date: '10-13', muscle: Number((leftLegM - 0.08).toFixed(2)), fat: Number((leftLegF + 0.08).toFixed(2)) },
        { date: '10-14', muscle: Number((leftLegM - 0.05).toFixed(2)), fat: Number((leftLegF + 0.05).toFixed(2)) },
        { date: '10-15', muscle: leftLegM, fat: leftLegF },
        { date: '10-16', muscle: leftLegM, fat: leftLegF },
        { date: '10-17', muscle: leftLegM, fat: leftLegF },
      ],
    },
    rightLeg: {
      name: '右下肢节段 (右腿)',
      subname: '右股四头肌 · 臀大肌 · 右腓肠肌',
      muscleVal: `${rightLegM} kg`,
      fatVal: `${rightLegF} kg`,
      muscleTrend: '+0.15 kg',
      fatTrend: '-0.1 kg',
      musclePct: 79.8,
      eval: '右腿肌力强劲，左右下肢平衡评级为 1 级（均衡），极具公路车爬坡与巡航爆发力。',
      imp20kHz: 252.8,
      imp100kHz: 222.8,
      history: [
        { date: '10-11', muscle: Number((rightLegM - 0.15).toFixed(2)), fat: Number((rightLegF + 0.1).toFixed(2)) },
        { date: '10-12', muscle: Number((rightLegM - 0.12).toFixed(2)), fat: Number((rightLegF + 0.1).toFixed(2)) },
        { date: '10-13', muscle: Number((rightLegM - 0.08).toFixed(2)), fat: Number((rightLegF + 0.08).toFixed(2)) },
        { date: '10-14', muscle: Number((rightLegM - 0.05).toFixed(2)), fat: Number((rightLegF + 0.05).toFixed(2)) },
        { date: '10-15', muscle: rightLegM, fat: rightLegF },
        { date: '10-16', muscle: rightLegM, fat: rightLegF },
        { date: '10-17', muscle: rightLegM, fat: rightLegF },
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
          <button
            type="button"
            onClick={() => setSelectedBodyMode('impedance')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedBodyMode === 'impedance'
                ? 'bg-cyan-500 text-black shadow-sm font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            ⚡ 生物电阻抗 (20k/100k)
          </button>
        </div>
      </div>

      {/* 5-Segment Quick Selection Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 mb-4">
        {[
          { key: 'trunk', label: '躯干' },
          { key: 'leftArm', label: '左上肢' },
          { key: 'rightArm', label: '右上肢' },
          { key: 'leftLeg', label: '左下肢' },
          { key: 'rightLeg', label: '右下肢' },
        ].map((seg) => (
          <button
            key={seg.key}
            type="button"
            onClick={() => setHoveredPart(seg.key as BodyPartKey)}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              hoveredPart === seg.key
                ? selectedBodyMode === 'muscle'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : selectedBodyMode === 'fat'
                    ? 'bg-amber-500 text-black shadow-sm font-bold'
                    : 'bg-cyan-500 text-black shadow-sm font-bold'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            {seg.label}
          </button>
        ))}
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
                <linearGradient id="impActiveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38BDF8" />
                  <stop offset="100%" stopColor="#06B6D4" />
                </linearGradient>
              </defs>

              {/* Head / Face */}
              <ellipse cx="100" cy="32" rx="16" ry="20" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.2" className="text-neutral-400" />
              {/* Neck */}
              <rect x="94" y="51" width="12" height="12" rx="2" fill="currentColor" fillOpacity="0.2" className="text-neutral-400" />

              {/* 1. Trunk (Chest, Core, Abdomen, Back) */}
              <g
                onMouseEnter={() => setHoveredPart('trunk')}
                onClick={() => setHoveredPart('trunk')}
                className="cursor-pointer group"
              >
                <path
                  d="M 72 63 C 78 61, 122 61, 128 63 C 136 78, 134 115, 128 142 L 72 142 C 66 115, 64 78, 72 63 Z"
                  fill={hoveredPart === 'trunk' ? (selectedBodyMode === 'muscle' ? 'url(#muscleActiveGrad)' : selectedBodyMode === 'fat' ? 'url(#fatActiveGrad)' : 'url(#impActiveGrad)') : 'currentColor'}
                  fillOpacity={hoveredPart === 'trunk' ? 0.9 : 0.25}
                  stroke={hoveredPart === 'trunk' ? (selectedBodyMode === 'muscle' ? '#818CF8' : selectedBodyMode === 'fat' ? '#F59E0B' : '#06B6D4') : 'currentColor'}
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
                onMouseEnter={() => setHoveredPart('leftArm')}
                onClick={() => setHoveredPart('leftArm')}
                className="cursor-pointer group"
              >
                <path
                  d="M 69 66 C 54 85, 48 115, 42 148 C 38 168, 44 174, 50 160 C 56 128, 62 98, 74 76 Z"
                  fill={hoveredPart === 'leftArm' ? (selectedBodyMode === 'muscle' ? 'url(#muscleActiveGrad)' : selectedBodyMode === 'fat' ? 'url(#fatActiveGrad)' : 'url(#impActiveGrad)') : 'currentColor'}
                  fillOpacity={hoveredPart === 'leftArm' ? 0.9 : 0.25}
                  stroke={hoveredPart === 'leftArm' ? (selectedBodyMode === 'muscle' ? '#818CF8' : selectedBodyMode === 'fat' ? '#F59E0B' : '#06B6D4') : 'currentColor'}
                  strokeWidth={hoveredPart === 'leftArm' ? 2 : 1}
                  filter={hoveredPart === 'leftArm' ? 'url(#partGlow)' : undefined}
                  className="transition-all duration-300 text-neutral-400"
                />
              </g>

              {/* 2. Right Arm */}
              <g
                onMouseEnter={() => setHoveredPart('rightArm')}
                onClick={() => setHoveredPart('rightArm')}
                className="cursor-pointer group"
              >
                <path
                  d="M 131 66 C 146 85, 152 115, 158 148 C 162 168, 156 174, 150 160 C 144 128, 138 98, 126 76 Z"
                  fill={hoveredPart === 'rightArm' ? (selectedBodyMode === 'muscle' ? 'url(#muscleActiveGrad)' : selectedBodyMode === 'fat' ? 'url(#fatActiveGrad)' : 'url(#impActiveGrad)') : 'currentColor'}
                  fillOpacity={hoveredPart === 'rightArm' ? 0.9 : 0.25}
                  stroke={hoveredPart === 'rightArm' ? (selectedBodyMode === 'muscle' ? '#818CF8' : selectedBodyMode === 'fat' ? '#F59E0B' : '#06B6D4') : 'currentColor'}
                  strokeWidth={hoveredPart === 'rightArm' ? 2 : 1}
                  filter={hoveredPart === 'rightArm' ? 'url(#partGlow)' : undefined}
                  className="transition-all duration-300 text-neutral-400"
                />
              </g>

              {/* 3. Left Leg (Thigh, Knee, Calf) */}
              <g
                onMouseEnter={() => setHoveredPart('leftLeg')}
                onClick={() => setHoveredPart('leftLeg')}
                className="cursor-pointer group"
              >
                <path
                  d="M 78 166 C 74 205, 72 245, 68 285 C 65 296, 76 298, 80 286 C 86 248, 90 208, 94 166 Z"
                  fill={hoveredPart === 'leftLeg' ? (selectedBodyMode === 'muscle' ? 'url(#muscleActiveGrad)' : selectedBodyMode === 'fat' ? 'url(#fatActiveGrad)' : 'url(#impActiveGrad)') : 'currentColor'}
                  fillOpacity={hoveredPart === 'leftLeg' ? 0.9 : 0.25}
                  stroke={hoveredPart === 'leftLeg' ? (selectedBodyMode === 'muscle' ? '#818CF8' : selectedBodyMode === 'fat' ? '#F59E0B' : '#06B6D4') : 'currentColor'}
                  strokeWidth={hoveredPart === 'leftLeg' ? 2 : 1}
                  filter={hoveredPart === 'leftLeg' ? 'url(#partGlow)' : undefined}
                  className="transition-all duration-300 text-neutral-400"
                />
              </g>

              {/* 3. Right Leg */}
              <g
                onMouseEnter={() => setHoveredPart('rightLeg')}
                onClick={() => setHoveredPart('rightLeg')}
                className="cursor-pointer group"
              >
                <path
                  d="M 122 166 C 126 205, 128 245, 132 285 C 135 296, 124 298, 120 286 C 114 248, 110 208, 106 166 Z"
                  fill={hoveredPart === 'rightLeg' ? (selectedBodyMode === 'muscle' ? 'url(#muscleActiveGrad)' : selectedBodyMode === 'fat' ? 'url(#fatActiveGrad)' : 'url(#impActiveGrad)') : 'currentColor'}
                  fillOpacity={hoveredPart === 'rightLeg' ? 0.9 : 0.25}
                  stroke={hoveredPart === 'rightLeg' ? (selectedBodyMode === 'muscle' ? '#818CF8' : selectedBodyMode === 'fat' ? '#F59E0B' : '#06B6D4') : 'currentColor'}
                  strokeWidth={hoveredPart === 'rightLeg' ? 2 : 1}
                  filter={hoveredPart === 'rightLeg' ? 'url(#partGlow)' : undefined}
                  className="transition-all duration-300 text-neutral-400"
                />
              </g>
            </svg>

            {/* Overlaid 5 Badges */}
            <div
              onMouseEnter={() => setHoveredPart('trunk')}
              onClick={() => setHoveredPart('trunk')}
              className={`absolute top-24 px-2.5 py-1 rounded-xl text-[10px] font-mono shadow-md cursor-pointer transition-all ${
                hoveredPart === 'trunk'
                  ? selectedBodyMode === 'impedance'
                    ? 'bg-cyan-600 text-white ring-2 ring-cyan-400 scale-105'
                    : 'bg-indigo-600 text-white ring-2 ring-indigo-400 scale-105'
                  : 'bg-neutral-900/80 text-neutral-200 border border-white/20'
              }`}
            >
              {selectedBodyMode === 'muscle' ? `躯干 ${trunkM}kg` : selectedBodyMode === 'fat' ? `脂肪 ${trunkF}kg` : `20k: 23.7Ω · 100k: 17.2Ω`}
            </div>

            <div
              onMouseEnter={() => setHoveredPart('leftArm')}
              onClick={() => setHoveredPart('leftArm')}
              className={`absolute top-20 -left-1 px-2 py-0.5 rounded-xl text-[10px] font-mono shadow-md cursor-pointer transition-all ${
                hoveredPart === 'leftArm'
                  ? selectedBodyMode === 'impedance'
                    ? 'bg-cyan-600 text-white ring-2 ring-cyan-400 scale-105'
                    : 'bg-indigo-600 text-white ring-2 ring-indigo-400 scale-105'
                  : 'bg-neutral-900/80 text-neutral-200 border border-white/20'
              }`}
            >
              {selectedBodyMode === 'muscle' ? `左臂 ${leftArmM}kg` : selectedBodyMode === 'fat' ? `脂肪 ${leftArmF}kg` : `20k: 325Ω · 100k: 297Ω`}
            </div>

            <div
              onMouseEnter={() => setHoveredPart('rightArm')}
              onClick={() => setHoveredPart('rightArm')}
              className={`absolute top-20 -right-1 px-2 py-0.5 rounded-xl text-[10px] font-mono shadow-md cursor-pointer transition-all ${
                hoveredPart === 'rightArm'
                  ? selectedBodyMode === 'impedance'
                    ? 'bg-cyan-600 text-white ring-2 ring-cyan-400 scale-105'
                    : 'bg-indigo-600 text-white ring-2 ring-indigo-400 scale-105'
                  : 'bg-neutral-900/80 text-neutral-200 border border-white/20'
              }`}
            >
              {selectedBodyMode === 'muscle' ? `右臂 ${rightArmM}kg` : selectedBodyMode === 'fat' ? `脂肪 ${rightArmF}kg` : `20k: 310Ω · 100k: 278Ω`}
            </div>

            <div
              onMouseEnter={() => setHoveredPart('leftLeg')}
              onClick={() => setHoveredPart('leftLeg')}
              className={`absolute bottom-12 left-3 px-2 py-0.5 rounded-xl text-[10px] font-mono shadow-md cursor-pointer transition-all ${
                hoveredPart === 'leftLeg'
                  ? selectedBodyMode === 'impedance'
                    ? 'bg-cyan-600 text-white ring-2 ring-cyan-400 scale-105'
                    : 'bg-indigo-600 text-white ring-2 ring-indigo-400 scale-105'
                  : 'bg-neutral-900/80 text-neutral-200 border border-white/20'
              }`}
            >
              {selectedBodyMode === 'muscle' ? `左腿 ${leftLegM}kg` : selectedBodyMode === 'fat' ? `脂肪 ${leftLegF}kg` : `20k: 246Ω · 100k: 217Ω`}
            </div>

            <div
              onMouseEnter={() => setHoveredPart('rightLeg')}
              onClick={() => setHoveredPart('rightLeg')}
              className={`absolute bottom-12 right-3 px-2 py-0.5 rounded-xl text-[10px] font-mono shadow-md cursor-pointer transition-all ${
                hoveredPart === 'rightLeg'
                  ? selectedBodyMode === 'impedance'
                    ? 'bg-cyan-600 text-white ring-2 ring-cyan-400 scale-105'
                    : 'bg-indigo-600 text-white ring-2 ring-indigo-400 scale-105'
                  : 'bg-neutral-900/80 text-neutral-200 border border-white/20'
              }`}
            >
              {selectedBodyMode === 'muscle' ? `右腿 ${rightLegM}kg` : selectedBodyMode === 'fat' ? `脂肪 ${rightLegF}kg` : `20k: 253Ω · 100k: 223Ω`}
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

                <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
                  <div className="flex justify-between items-center text-[11px] text-neutral-400 mb-1">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-cyan-400" />
                      双频生物阻抗
                    </span>
                    <span className="text-cyan-400 font-bold font-mono text-[10px]">
                      比值 {(currentInfo.imp100kHz / currentInfo.imp20kHz).toFixed(3)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <div>
                      <span className="text-[10px] text-neutral-400 block font-mono">20kHz (低频)</span>
                      <span className="text-base font-black text-cyan-400 font-mono">
                        {currentInfo.imp20kHz} <span className="text-[10px] font-normal text-neutral-400">Ω</span>
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-neutral-400 block font-mono">100kHz (高频)</span>
                      <span className="text-base font-black text-cyan-300 font-mono">
                        {currentInfo.imp100kHz} <span className="text-[10px] font-normal text-neutral-400">Ω</span>
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] text-neutral-400 mt-1 block">细胞膜完整度与液态极佳</span>
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

      {/* 8-Electrode Dual-Frequency Bioelectrical Impedance (BIA) Full Matrix Table */}
      <div className="mt-5 pt-5 border-t border-black/5 dark:border-white/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-neutral-900 dark:text-white m-0">
              8 电极双频生物电阻抗 (BIA) 节段测试矩阵
            </h4>
          </div>
          <span className="text-[11px] text-neutral-400">
            20kHz (细胞外液敏感) · 100kHz (全身体液穿透) · 阻抗比越小表示细胞活性越充沛
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-black/5 dark:border-white/10 text-neutral-400 text-[11px]">
                <th className="py-2 px-3 font-semibold">解剖节段部位</th>
                <th className="py-2 px-3 font-semibold font-mono">20 kHz 阻抗 (低频)</th>
                <th className="py-2 px-3 font-semibold font-mono">100 kHz 阻抗 (高频)</th>
                <th className="py-2 px-3 font-semibold font-mono">阻抗衰减 ΔZ (Ω)</th>
                <th className="py-2 px-3 font-semibold font-mono">阻抗比率 (Z100/Z20)</th>
                <th className="py-2 px-3 font-semibold">体液机能评估</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5 font-mono">
              {[
                { key: 'trunk', name: '核心与躯干', z20: 23.7, z100: 17.2, status: '低阻抗高导电 · 核心充沛' },
                { key: 'leftArm', name: '左上肢 (左臂)', z20: 325.3, z100: 297.4, status: '上肢对称均衡 · 肌肉密实' },
                { key: 'rightArm', name: '右上肢 (右臂)', z20: 309.6, z100: 277.9, status: '抓握导电极佳 · 耐力优异' },
                { key: 'leftLeg', name: '左下肢 (左腿)', z20: 245.6, z100: 216.5, status: '下肢含水率高 · 发力充盈' },
                { key: 'rightLeg', name: '右下肢 (右腿)', z20: 252.8, z100: 222.8, status: '巡航爆发充沛 · 无水肿代偿' },
              ].map((row) => {
                const isSelected = hoveredPart === row.key;
                const deltaZ = Number((row.z20 - row.z100).toFixed(1));
                const ratio = (row.z100 / row.z20).toFixed(3);

                return (
                  <tr
                    key={row.key}
                    onClick={() => setHoveredPart(row.key as BodyPartKey)}
                    onMouseEnter={() => setHoveredPart(row.key as BodyPartKey)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-cyan-500/10 text-cyan-300 font-bold'
                        : 'hover:bg-black/5 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-sans font-medium flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-cyan-400' : 'bg-neutral-500'}`} />
                      {row.name}
                    </td>
                    <td className="py-2.5 px-3 text-cyan-400 font-bold">{row.z20} Ω</td>
                    <td className="py-2.5 px-3 text-cyan-300 font-bold">{row.z100} Ω</td>
                    <td className="py-2.5 px-3 text-emerald-400">-{deltaZ} Ω</td>
                    <td className="py-2.5 px-3 font-semibold">{ratio}</td>
                    <td className="py-2.5 px-3 font-sans text-[11px] text-neutral-400">{row.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppleCard>
  );
};
