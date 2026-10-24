import React, { useEffect, useState } from 'react';
import { Check, Flame, LoaderCircle, PersonStanding, Save, Target, Timer } from 'lucide-react';
import { fetchActivityGoals, updateActivityGoals, type ActivityGoals } from '../../api/healthApi';
import { AppleCard } from '../ui/AppleCard';

interface ActivityGoalsSettingsProps {
  onGoalsChanged?: () => void | Promise<void>;
}

const DEFAULT_GOALS: ActivityGoals = {
  moveKcal: 440,
  exerciseMinutes: 30,
  standHours: 12,
};

export const ActivityGoalsSettings: React.FC<ActivityGoalsSettingsProps> = ({
  onGoalsChanged,
}) => {
  const [goals, setGoals] = useState<ActivityGoals>(DEFAULT_GOALS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  useEffect(() => {
    let active = true;
    void fetchActivityGoals()
      .then(({ goals: savedGoals }) => {
        if (active) setGoals(savedGoals);
      })
      .catch((error) => {
        if (active) {
          setStatus({
            type: 'error',
            message: error instanceof Error ? error.message : '读取圆环目标失败。',
          });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const setGoal = (key: keyof ActivityGoals, value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    setGoals((current) => ({ ...current, [key]: Math.round(parsed) }));
    setStatus(null);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const result = await updateActivityGoals(goals);
      setGoals(result.goals);
      setStatus({ type: 'success', message: '圆环目标已保存。' });
      await onGoalsChanged?.();
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : '保存圆环目标失败。',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppleCard>
      <form onSubmit={save}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                健身圆环目标
              </h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                与 Apple Fitness 中的三项圆环目标保持一致
              </p>
            </div>
          </div>
          {status?.type === 'success' && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
              <Check className="w-3.5 h-3.5" />
              {status.message}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.03] p-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              <Flame className="w-3.5 h-3.5 text-[#FA114F]" />
              动态能量
            </span>
            <span className="mt-2 flex items-baseline gap-1.5">
              <input
                type="number"
                min={1}
                max={5000}
                step={1}
                value={goals.moveKcal}
                disabled={loading || saving}
                onChange={(event) => setGoal('moveKcal', event.target.value)}
                className="w-full bg-transparent text-xl font-bold tabular-nums text-neutral-900 dark:text-white outline-none disabled:opacity-50"
                aria-label="动态能量目标"
              />
              <span className="text-[11px] text-neutral-400 whitespace-nowrap shrink-0">kcal</span>
            </span>
          </label>

          <label className="rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.03] p-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              <Timer className="w-3.5 h-3.5 text-[#A1FF00]" />
              锻炼时间
            </span>
            <span className="mt-2 flex items-baseline gap-1.5">
              <input
                type="number"
                min={1}
                max={1440}
                step={1}
                value={goals.exerciseMinutes}
                disabled={loading || saving}
                onChange={(event) => setGoal('exerciseMinutes', event.target.value)}
                className="w-full bg-transparent text-xl font-bold tabular-nums text-neutral-900 dark:text-white outline-none disabled:opacity-50"
                aria-label="锻炼时间目标"
              />
              <span className="text-[11px] text-neutral-400 whitespace-nowrap shrink-0">分钟</span>
            </span>
          </label>

          <label className="rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.03] p-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              <PersonStanding className="w-3.5 h-3.5 text-[#00C7B7]" />
              站立时间
            </span>
            <span className="mt-2 flex items-baseline gap-1.5">
              <input
                type="number"
                min={1}
                max={24}
                step={1}
                value={goals.standHours}
                disabled={loading || saving}
                onChange={(event) => setGoal('standHours', event.target.value)}
                className="w-full bg-transparent text-xl font-bold tabular-nums text-neutral-900 dark:text-white outline-none disabled:opacity-50"
                aria-label="站立时间目标"
              />
              <span className="text-[11px] text-neutral-400 whitespace-nowrap shrink-0">小时</span>
            </span>
          </label>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-rose-500 dark:text-rose-400">
            {status?.type === 'error' ? status.message : ''}
          </p>
          <button
            type="submit"
            disabled={loading || saving}
            className="px-3.5 py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{saving ? '保存中' : '保存目标'}</span>
          </button>
        </div>
      </form>
    </AppleCard>
  );
};
