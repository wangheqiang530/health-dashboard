import React, { useState } from 'react';
import type { WorkoutRecord } from '../../types/health';
import { AppleCard } from '../ui/AppleCard';
import { WorkoutDetailModal } from './WorkoutDetailModal';
import { Flame, Heart, ChevronRight, Activity, Dumbbell, Bike, Footprints } from 'lucide-react';
import { getCalorieFoodEquivalents } from '../../utils/calorieFoods';

interface WorkoutsSectionProps {
  workouts: WorkoutRecord[];
}

export const WorkoutsSection: React.FC<WorkoutsSectionProps> = ({ workouts }) => {
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutRecord | null>(null);

  const getCategoryIcon = (category: WorkoutRecord['category']) => {
    switch (category) {
      case 'running':
        return Activity;
      case 'cycling':
        return Bike;
      case 'strength':
        return Dumbbell;
      case 'walking':
        return Footprints;
      default:
        return Flame;
    }
  };

  return (
    <>
      <AppleCard className="overflow-hidden h-full flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-[#A1FF00]/20 text-[#A1FF00] border border-[#A1FF00]/30 flex-shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold tracking-wider text-neutral-500 dark:text-neutral-400 uppercase">
                  体能训练记录 · Apple Fitness
                </h3>
              </div>
            </div>
            <span className="text-xs text-neutral-400">
              共 {workouts.length} 次训练
            </span>
          </div>

          {workouts.length === 0 ? (
            <div className="py-8 text-center text-neutral-400 text-sm">
              今日暂无记录的体能训练
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {workouts.map((w) => {
                const Icon = getCategoryIcon(w.category);
                const isIgpsport = w.id.startsWith('igpsport') || w.category === 'cycling';
                const food = getCalorieFoodEquivalents(w.activeCalories);

                return (
                  <div
                    key={w.id}
                    onClick={() => setSelectedWorkout(w)}
                    className="group p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.05] dark:hover:bg-white/[0.07] border border-black/[0.05] dark:border-white/[0.05] hover:border-black/[0.1] dark:hover:border-white/[0.12] transition-all duration-200 cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-[#73A800] dark:text-[#A1FF00] group-hover:scale-105 transition-transform flex-shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-[#A1FF00] transition-colors truncate">
                            {w.name}
                          </h4>
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                            isIgpsport
                              ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          }`}>
                            {isIgpsport ? '🚴 码表' : '⌚ Watch'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
                          <span>{w.startTime}</span>
                          <span>•</span>
                          <span>{w.durationMinutes} 分钟</span>
                          {w.distanceKm && (
                            <>
                              <span>•</span>
                              <span className="text-neutral-700 dark:text-neutral-300 font-semibold">{w.distanceKm} km</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <div className="flex items-center gap-1 justify-end text-sm font-bold text-[#FA114F]">
                          <Flame className="w-3.5 h-3.5" />
                          <span>{w.activeCalories} kcal</span>
                          <span className="text-xs ml-0.5">{food.emojis}</span>
                        </div>
                        <div className="flex items-center gap-1 justify-end text-xs text-neutral-400 mt-0.5">
                          <Heart className="w-3 h-3 text-rose-500" />
                          <span>均心率 {w.avgHeartRate} bpm</span>
                        </div>
                      </div>

                      <div className="p-1.5 rounded-xl bg-black/5 dark:bg-white/5 text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white group-hover:translate-x-0.5 transition-all">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </AppleCard>

      <WorkoutDetailModal
        workout={selectedWorkout}
        onClose={() => setSelectedWorkout(null)}
      />
    </>
  );
};
