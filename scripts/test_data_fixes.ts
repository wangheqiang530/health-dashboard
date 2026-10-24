import { migrate, pool, closeDatabase } from '../server/db.ts';
import { importHaePayload, mergeDailySummary } from '../server/hae.ts';
import { listIgnoredRecords, restoreIgnoredRecord } from '../server/ignored.ts';
import {
  getFitdaysRecordCriticalIssues,
  getFitdaysRecordQualityIssues,
  type FitdaysRecord,
} from '../server/sources/fitdays.ts';
import { parseHealthAutoExportJSON } from '../src/utils/haeParser.ts';
import { createEmptyDailySummary } from '../src/utils/emptyData.ts';

const weightOnlyRecord: FitdaysRecord = {
  externalId: '10000001:1760000000',
  profileId: '10000001',
  measuredAt: '2026-01-15T08:00:00.000Z',
  measuredDate: '2026-01-15',
  weightKg: 72.5,
  bmi: null,
  bodyFatRate: null,
  skeletalMuscleRate: null,
  muscleRate: null,
  leanBodyMassKg: null,
  visceralFatLevel: null,
  waterRate: null,
  boneMassKg: null,
  bmrKcal: null,
  subcutaneousFatRate: null,
  proteinRate: null,
  bodyAge: 30,
  heartRate: null,
  score: null,
  smi: null,
  whr: null,
  rawRecord: {
    weight_kg: 72.5,
    bfr: 0,
    rosm: 0,
    vwc: 0,
    bmr: 0,
    adc_list: '20,300,310,240,230,10,260,280,200,190',
  },
};

const duplicateWorkoutPayload = {
  data: {
    metrics: [],
    workouts: [
      {
        name: '室内 骑行',
        start: '2026-01-15 12:32:00 +0800',
        end: '2026-01-15 13:11:00 +0800',
        duration: 2340,
        activeEnergy: { qty: 380, units: 'kcal' },
        avgHeartRate: { qty: 117, units: 'bpm' },
        source: { name: 'Apple Watch' },
      },
      {
        name: '户外骑行',
        start: '2026-01-15 12:32:00 +0800',
        end: '2026-01-15 13:11:00 +0800',
        duration: 2340,
        activeEnergy: { qty: 0, units: 'kcal' },
        source: { name: 'iPhone' },
      },
    ],
  },
};

async function main(): Promise<void> {
  await migrate();

  const previousSummary = createEmptyDailySummary();
  previousSummary.date = '2026-01-15';
  previousSummary.rings.move.current = 100;
  previousSummary.rings.exercise.current = 20;
  previousSummary.rings.stand.current = 5;
  previousSummary.steps.count = 1000;
  const partialSummary = createEmptyDailySummary();
  partialSummary.date = '2026-01-15';
  partialSummary.rings.move.current = 60;
  partialSummary.rings.exercise.current = 2;
  partialSummary.rings.stand.current = 1;
  partialSummary.steps.count = 300;
  const partialMerge = mergeDailySummary(previousSummary, partialSummary, {
    rings: true,
    steps: true,
    vitals: false,
    sleep: false,
    body: false,
    mobility: false,
    environment: false,
    heartRate: false,
  });
  const completeSummary = createEmptyDailySummary();
  completeSummary.date = '2026-01-15';
  completeSummary.rings.move.current = 900;
  completeSummary.rings.exercise.current = 45;
  completeSummary.rings.stand.current = 8;
  completeSummary.steps.count = 5000;
  const completeMerge = mergeDailySummary(partialMerge, completeSummary, {
    rings: true,
    steps: true,
    vitals: false,
    sleep: false,
    body: false,
    mobility: false,
    environment: false,
    heartRate: false,
  });
  if (
    partialMerge.rings.move.current !== 100 ||
    partialMerge.steps.count !== 1000 ||
    completeMerge.rings.move.current !== 900 ||
    completeMerge.rings.exercise.current !== 45 ||
    completeMerge.rings.stand.current !== 8 ||
    completeMerge.steps.count !== 5000
  ) {
    throw new Error('Cumulative HAE summary merge verification failed.');
  }

  const criticalIssues = getFitdaysRecordCriticalIssues(weightOnlyRecord);
  const qualityIssues = getFitdaysRecordQualityIssues(weightOnlyRecord);
  if (criticalIssues.length !== 0 || qualityIssues.length === 0) {
    throw new Error('Fitdays weight-only quality classification failed.');
  }

  const tombstone = await pool.query<{ id: string }>(
    `INSERT INTO data_tombstones
      (record_kind, source_id, external_id, metadata)
     VALUES ('body_measurement', 'fitdays', $1, $2::jsonb)
     ON CONFLICT (record_kind, source_id, external_id) DO UPDATE SET
       metadata = EXCLUDED.metadata,
       deleted_at = NOW()
     RETURNING id::text`,
    [
      weightOnlyRecord.externalId,
      JSON.stringify({
        reasonCode: 'auto_incomplete_body',
        reason: '自动忽略：体脂率缺失',
        autoIgnored: true,
        measuredAt: weightOnlyRecord.measuredAt,
        measuredDate: weightOnlyRecord.measuredDate,
        rawRecord: weightOnlyRecord.rawRecord,
      }),
    ]
  );
  const ignoredRecord = (await listIgnoredRecords(20)).find(
    (record) => record.id === tombstone.rows[0].id
  );
  if (!ignoredRecord?.canRestore || !ignoredRecord.rawRecordAvailable) {
    throw new Error('Auto-ignored body record is not restorable.');
  }
  const restored = await restoreIgnoredRecord(tombstone.rows[0].id);
  const restoredBody = await pool.query<{
    weight_kg: string;
    body_fat_rate: string | null;
  }>(
    `SELECT weight_kg::text, body_fat_rate::text
     FROM body_measurements
     WHERE external_id = $1`,
    [weightOnlyRecord.externalId]
  );
  if (
    !restored.restored ||
    restoredBody.rows[0]?.weight_kg !== '72.500' ||
    restoredBody.rows[0]?.body_fat_rate !== null
  ) {
    throw new Error('Auto-ignored body record restore failed.');
  }

  const parsed = parseHealthAutoExportJSON(duplicateWorkoutPayload);
  const parsedWorkoutCount = parsed.days['2026-01-15']?.workouts.length || 0;
  await importHaePayload(duplicateWorkoutPayload, {
    payloadSizeBytes: 1024,
    sourceIp: '127.0.0.1',
  });
  const storedWorkouts = await pool.query<{ count: string; name: string }>(
    `SELECT COUNT(*)::text AS count, MAX(name) AS name
     FROM health_workouts
     WHERE started_at = TIMESTAMPTZ '2026-01-15 12:32:00+08'`
  );
  const summary = await pool.query<{ count: string }>(
    `SELECT jsonb_array_length(summary->'workouts')::text AS count
     FROM daily_summaries
     WHERE day = DATE '2026-01-15'`
  );
  const storedWorkoutCount = Number(storedWorkouts.rows[0]?.count || 0);
  const summaryWorkoutCount = Number(summary.rows[0]?.count || 0);
  const result = {
    cumulativeMerge: {
      partial: {
        move: partialMerge.rings.move.current,
        steps: partialMerge.steps.count,
      },
      complete: {
        move: completeMerge.rings.move.current,
        exercise: completeMerge.rings.exercise.current,
        stand: completeMerge.rings.stand.current,
        steps: completeMerge.steps.count,
      },
    },
    criticalIssues,
    qualityIssues,
    canRestore: ignoredRecord.canRestore,
    restored,
    parsedWorkoutCount,
    storedWorkoutCount,
    summaryWorkoutCount,
    storedWorkoutName: storedWorkouts.rows[0]?.name,
  };
  console.log(JSON.stringify(result, null, 2));
  if (
    parsedWorkoutCount !== 1 ||
    storedWorkoutCount !== 1 ||
    summaryWorkoutCount !== 1 ||
    storedWorkouts.rows[0]?.name !== '室内 骑行'
  ) {
    throw new Error('Workout duplicate merge verification failed.');
  }
}

try {
  await main();
} finally {
  await closeDatabase();
}
