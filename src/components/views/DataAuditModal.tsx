import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Bike,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Database,
  LoaderCircle,
  Scale,
  Trash2,
  X,
} from 'lucide-react';
import type { BodyMeasurement, WorkoutRecord } from '../../types/health';
import {
  deleteBodyMeasurement,
  deleteWorkoutRecord,
  fetchBodyMeasurements,
  fetchWorkouts,
} from '../../api/healthApi';

interface DataAuditModalProps {
  defaultDate: string;
  onClose: () => void;
  onDataChanged: () => void | Promise<void>;
}

type AuditRecord =
  | { key: string; kind: 'body'; record: BodyMeasurement }
  | { key: string; kind: 'workout'; record: WorkoutRecord };

const formatTime = (value: string): string =>
  new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));

const formatNumber = (
  value: number | null | undefined,
  unit: string,
  decimals = 1
): string =>
  typeof value === 'number' && Number.isFinite(value)
    ? `${value.toFixed(decimals)} ${unit}`
    : '—';

const rawRecordOf = (measurement: BodyMeasurement): Record<string, unknown> =>
  measurement.rawRecord && typeof measurement.rawRecord === 'object'
    ? measurement.rawRecord
    : {};

const rawNumber = (raw: Record<string, unknown>, key: string): number | null => {
  const value = raw[key];
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const bodyIssues = (measurement: BodyMeasurement): string[] => {
  const issues: string[] = [];
  const raw = rawRecordOf(measurement);
  const bodyFat = rawNumber(raw, 'bfr') ?? measurement.bodyFatPercent;
  const skeletalMuscle = rawNumber(raw, 'rosm') ?? measurement.skeletalMusclePercent;
  const water = rawNumber(raw, 'vwc') ?? measurement.waterPercent;
  const bmr = rawNumber(raw, 'bmr') ?? measurement.bmrKcal;
  if (!bodyFat || bodyFat <= 0) {
    issues.push('体脂率缺失或为 0');
  }
  if (!skeletalMuscle || skeletalMuscle <= 0) {
    issues.push('骨骼肌率缺失或为 0');
  }
  if (!water || water <= 0) {
    issues.push('水分率缺失或为 0');
  }
  if (!bmr || bmr <= 0) {
    issues.push('基础代谢缺失或为 0');
  }
  return issues;
};

const workoutSourceLabel = (workout: WorkoutRecord): string => {
  if (workout.source === 'igpsport') return 'iGPSPORT';
  if (workout.source === 'fit') return 'FIT 文件';
  return 'Apple Watch';
};

const Metric: React.FC<{ label: string; value: string; accent?: string }> = ({
  label,
  value,
  accent = 'text-neutral-900 dark:text-white',
}) => (
  <div className="rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 dark:border-white/5 dark:bg-white/[0.03]">
    <span className="block text-[10px] text-neutral-400">{label}</span>
    <span className={`mt-0.5 block font-mono text-sm font-bold ${accent}`}>{value}</span>
  </div>
);

export const DataAuditModal: React.FC<DataAuditModalProps> = ({
  defaultDate,
  onClose,
  onDataChanged,
}) => {
  const [date, setDate] = useState(defaultDate);
  const [bodyRecords, setBodyRecords] = useState<BodyMeasurement[]>([]);
  const [workoutRecords, setWorkoutRecords] = useState<WorkoutRecord[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadRecords = useCallback(async (targetDate: string, clearSuccess = true) => {
    setLoading(true);
    setError(null);
    if (clearSuccess) setSuccess(null);
    try {
      const [bodyResponse, workoutResponse] = await Promise.all([
        fetchBodyMeasurements(),
        fetchWorkouts({ from: targetDate, to: targetDate, limit: 10000 }),
      ]);
      const nextBody = bodyResponse.measurements
        .filter((measurement) => measurement.measuredDate === targetDate)
        .sort((left, right) => right.measuredAt.localeCompare(left.measuredAt));
      const nextWorkouts = workoutResponse.workouts
        .filter((workout) => (workout.date || targetDate) === targetDate)
        .sort((left, right) => right.startTime.localeCompare(left.startTime));

      setBodyRecords(nextBody);
      setWorkoutRecords(nextWorkouts);
      setPendingDeleteKey(null);
      const nextKeys = [
        ...nextBody.map((measurement) => `body:${measurement.id}`),
        ...nextWorkouts.map((workout) => `workout:${workout.id}`),
      ];
      setSelectedKey((current) =>
        current && nextKeys.includes(current) ? current : nextKeys[0] || null
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '读取数据失败。');
      setBodyRecords([]);
      setWorkoutRecords([]);
      setSelectedKey(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Loading is intentionally toggled around the asynchronous audit query.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadRecords(date);
  }, [date, loadRecords]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleting, onClose]);

  const records = useMemo<AuditRecord[]>(
    () => [
      ...bodyRecords.map((record) => ({
        key: `body:${record.id}`,
        kind: 'body' as const,
        record,
      })),
      ...workoutRecords.map((record) => ({
        key: `workout:${record.id}`,
        kind: 'workout' as const,
        record,
      })),
    ],
    [bodyRecords, workoutRecords]
  );

  const selectedRecord = records.find((record) => record.key === selectedKey) || null;
  const pendingDeleteRecord =
    records.find((record) => record.key === pendingDeleteKey) || null;

  const handleDelete = async () => {
    if (!pendingDeleteRecord) return;
    setDeleting(true);
    setError(null);
    try {
      if (pendingDeleteRecord.kind === 'body') {
        await deleteBodyMeasurement(pendingDeleteRecord.record.id);
        setSuccess('这条体测记录已删除，并加入同步忽略列表。');
      } else {
        await deleteWorkoutRecord(pendingDeleteRecord.record.id);
        setSuccess('这条运动记录已删除，并加入同步忽略列表。');
      }
      setPendingDeleteKey(null);
      await onDataChanged();
      await loadRecords(date, false);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除失败。');
    } finally {
      setDeleting(false);
    }
  };

  const renderBodyDetails = (measurement: BodyMeasurement) => {
    const issues = bodyIssues(measurement);
    const raw = rawRecordOf(measurement);
    const bodyFat = rawNumber(raw, 'bfr') ?? measurement.bodyFatPercent;
    const skeletalMuscle =
      rawNumber(raw, 'rosm') ?? measurement.skeletalMusclePercent;
    const water = rawNumber(raw, 'vwc') ?? measurement.waterPercent;
    const bmr = rawNumber(raw, 'bmr') ?? measurement.bmrKcal;
    const visceralFat = rawNumber(raw, 'uvi') ?? measurement.visceralFatLevel;
    const boneMass = rawNumber(raw, 'bm') ?? measurement.boneMassKg;
    const protein = rawNumber(raw, 'pp') ?? measurement.proteinPercent;
    return (
      <>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-indigo-500" />
              <span className="text-xs font-semibold text-indigo-500">体脂秤测量</span>
            </div>
            <h3 className="mt-1 text-lg font-bold text-neutral-900 dark:text-white">
              {formatTime(measurement.measuredAt)} · {measurement.measuredDate}
            </h3>
          </div>
          <span className="rounded-full border border-black/10 bg-black/5 px-2.5 py-1 font-mono text-[10px] text-neutral-500 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300">
            ID {measurement.id}
          </span>
        </div>

        {issues.length > 0 && (
          <div className="mb-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              这组数据存在疑似未完成测量字段
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {issues.map((issue) => (
                <span
                  key={issue}
                  className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-200"
                >
                  {issue}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Metric label="体重" value={formatNumber(measurement.weightKg, 'kg', 2)} />
          <Metric label="体脂率" value={formatNumber(bodyFat, '%', 1)} accent="text-amber-500" />
          <Metric label="骨骼肌率" value={formatNumber(skeletalMuscle, '%', 1)} accent="text-indigo-500" />
          <Metric label="水分率" value={formatNumber(water, '%', 1)} accent="text-sky-500" />
          <Metric label="基础代谢" value={formatNumber(bmr, 'kcal', 0)} accent="text-rose-500" />
          <Metric label="内脏脂肪" value={formatNumber(visceralFat, '级', 0)} accent="text-orange-500" />
          <Metric label="骨量" value={formatNumber(boneMass, 'kg', 2)} />
          <Metric label="蛋白质率" value={formatNumber(protein, '%', 1)} />
          <Metric label="身体评分" value={formatNumber(measurement.bodyScore, '分', 0)} accent="text-emerald-500" />
        </div>

        <div className="mt-4 rounded-2xl border border-black/5 bg-black/[0.02] p-3 dark:border-white/5 dark:bg-white/[0.03]">
          <div className="mb-2 text-[11px] font-bold text-neutral-700 dark:text-neutral-200">
            原始上游字段
          </div>
          <div className="grid grid-cols-1 gap-2 text-[10px] sm:grid-cols-2">
            <div>
              <span className="text-neutral-400">data_calc_type</span>
              <span className="ml-2 font-mono text-neutral-700 dark:text-neutral-200">
                {String(raw.data_calc_type ?? '—')}
              </span>
            </div>
            <div>
              <span className="text-neutral-400">imp_data_id</span>
              <span className="ml-2 font-mono text-neutral-700 dark:text-neutral-200">
                {String(raw.imp_data_id || '空')}
              </span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-neutral-400">adc_list</span>
              <span className="ml-2 break-all font-mono text-neutral-700 dark:text-neutral-200">
                {String(raw.adc_list ?? '—')}
              </span>
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderWorkoutDetails = (workout: WorkoutRecord) => (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Bike className="h-4 w-4 text-sky-500" />
            <span className="text-xs font-semibold text-sky-500">{workoutSourceLabel(workout)}</span>
          </div>
          <h3 className="mt-1 text-lg font-bold text-neutral-900 dark:text-white">
            {workout.name}
          </h3>
          <p className="mt-0.5 text-xs text-neutral-400">
            {workout.date || '—'} · {workout.startTime}
          </p>
        </div>
        <span className="rounded-full border border-black/10 bg-black/5 px-2.5 py-1 font-mono text-[10px] text-neutral-500 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300">
          ID {workout.id}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Metric label="时长" value={`${workout.durationMinutes} 分钟`} />
        <Metric label="动态消耗" value={`${workout.activeCalories} kcal`} accent="text-rose-500" />
        <Metric label="平均心率" value={`${workout.avgHeartRate || 0} bpm`} accent="text-rose-500" />
        <Metric label="最高心率" value={`${workout.maxHeartRate || 0} bpm`} />
        <Metric label="距离" value={formatNumber(workout.distanceKm, 'km', 2)} />
        <Metric label="爬升" value={formatNumber(workout.elevationGainM, 'm', 0)} />
      </div>
    </>
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-5">
        <motion.button
          type="button"
          aria-label="关闭数据审计"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-md"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 12 }}
          role="dialog"
          aria-modal="true"
          aria-label="数据审计与异常记录清理"
          className="relative z-10 flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-black/10 bg-white/95 text-neutral-900 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-[#11141b]/95 dark:text-white"
        >
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 px-4 py-4 dark:border-white/5 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">数据审计与异常记录清理</h2>
                <p className="text-[11px] text-neutral-400">
                  按日期查阅单条体测或运动记录，确认后永久删除
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex h-9 items-center gap-2 rounded-xl border border-black/10 bg-white/70 px-3 text-xs text-neutral-700 dark:border-white/10 dark:bg-black/30 dark:text-neutral-200">
                <CalendarDays className="h-3.5 w-3.5 text-sky-500" />
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="bg-transparent outline-none"
                  aria-label="选择审计日期"
                />
              </label>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-black/5 p-2 text-neutral-500 transition-colors hover:bg-black/10 hover:text-neutral-900 dark:bg-white/10 dark:text-neutral-300 dark:hover:bg-white/20 dark:hover:text-white"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          {error && (
            <div className="mx-4 mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-500 sm:mx-6">
              {error}
            </div>
          )}
          {success && (
            <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-300 sm:mx-6">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {success}
            </div>
          )}

          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-12">
            <section className="border-b border-black/5 p-4 dark:border-white/5 sm:p-5 lg:col-span-4 lg:border-b-0 lg:border-r">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold">查询结果</span>
                <span className="font-mono text-[10px] text-neutral-400">
                  {records.length} 条
                </span>
              </div>

              {loading ? (
                <div className="flex items-center gap-2 py-8 text-xs text-neutral-400">
                  <LoaderCircle className="h-4 w-4 animate-spin text-sky-500" />
                  正在读取 {date} 的记录...
                </div>
              ) : records.length === 0 ? (
                <div className="py-10 text-center text-xs text-neutral-400">
                  这一天没有可审计的体测或运动记录。
                </div>
              ) : (
                <div className="space-y-2">
                  {bodyRecords.length > 0 && (
                    <div>
                      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                        体脂秤测量 · {bodyRecords.length}
                      </div>
                      <div className="space-y-1.5">
                        {bodyRecords.map((measurement) => {
                          const key = `body:${measurement.id}`;
                          const issues = bodyIssues(measurement);
                          const raw = rawRecordOf(measurement);
                          const bodyFat =
                            rawNumber(raw, 'bfr') ?? measurement.bodyFatPercent;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                setSelectedKey(key);
                                setPendingDeleteKey(null);
                              }}
                              className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors ${
                                selectedKey === key
                                  ? 'border-indigo-500/35 bg-indigo-500/10'
                                  : 'border-black/5 bg-black/[0.02] hover:bg-black/[0.04] dark:border-white/5 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]'
                              }`}
                            >
                              <Scale className="h-4 w-4 shrink-0 text-indigo-500" />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5 text-xs font-semibold">
                                  {formatTime(measurement.measuredAt)}
                                  {issues.length > 0 && (
                                    <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[9px] text-amber-600 dark:text-amber-300">
                                      异常
                                    </span>
                                  )}
                                </span>
                                <span className="mt-0.5 block text-[10px] text-neutral-400">
                                  {formatNumber(measurement.weightKg, 'kg', 1)} ·{' '}
                                  {formatNumber(bodyFat, '%', 1)} 体脂
                                </span>
                              </span>
                              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {workoutRecords.length > 0 && (
                    <div>
                      <div className="mb-1.5 mt-3 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                        运动记录 · {workoutRecords.length}
                      </div>
                      <div className="space-y-1.5">
                        {workoutRecords.map((workout) => {
                          const key = `workout:${workout.id}`;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                setSelectedKey(key);
                                setPendingDeleteKey(null);
                              }}
                              className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors ${
                                selectedKey === key
                                  ? 'border-sky-500/35 bg-sky-500/10'
                                  : 'border-black/5 bg-black/[0.02] hover:bg-black/[0.04] dark:border-white/5 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]'
                              }`}
                            >
                              <Bike className="h-4 w-4 shrink-0 text-sky-500" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-semibold">
                                  {workout.name}
                                </span>
                                <span className="mt-0.5 block text-[10px] text-neutral-400">
                                  {workout.startTime} · {workout.durationMinutes} 分钟 ·{' '}
                                  {workout.activeCalories} kcal
                                </span>
                              </span>
                              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="min-h-[320px] p-4 sm:p-6 lg:col-span-8">
              {!selectedRecord ? (
                <div className="flex h-full min-h-[260px] flex-col items-center justify-center text-center">
                  <Database className="mb-2 h-8 w-8 text-neutral-300 dark:text-neutral-700" />
                  <p className="text-xs text-neutral-400">选择左侧记录查看完整详情</p>
                </div>
              ) : (
                <>
                  {selectedRecord.kind === 'body'
                    ? renderBodyDetails(selectedRecord.record)
                    : renderWorkoutDetails(selectedRecord.record)}

                  <div className="mt-5 border-t border-black/5 pt-4 dark:border-white/5">
                    {pendingDeleteRecord?.key === selectedRecord.key ? (
                      <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-rose-600 dark:text-rose-300">
                              确认永久删除这条记录？
                            </p>
                            <p className="mt-0.5 text-[10px] text-rose-500/80 dark:text-rose-300/80">
                              删除后看板与趋势会刷新；该记录会加入忽略列表，后续同步不会重新导入。原始归档文件不会被一并删除。
                            </p>
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                onClick={() => setPendingDeleteKey(null)}
                                disabled={deleting}
                                className="rounded-lg bg-black/5 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-600 hover:bg-black/10 dark:bg-white/10 dark:text-neutral-300 dark:hover:bg-white/15"
                              >
                                取消
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDelete()}
                                disabled={deleting}
                                className="flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                              >
                                {deleting ? (
                                  <LoaderCircle className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3 w-3" />
                                )}
                                确认删除
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPendingDeleteKey(selectedRecord.key)}
                        className="flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs font-semibold text-rose-500 transition-colors hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除这条记录
                      </button>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
