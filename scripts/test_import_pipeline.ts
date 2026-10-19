import AdmZip from 'adm-zip';
import { importAppleHealthZip } from '../server/appleHealthXml.ts';
import { migrate, pool, closeDatabase } from '../server/db.ts';
import { importHaePayload } from '../server/hae.ts';

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="zh_CN">
 <ExportDate value="2026-10-19 18:00:00 +0800"/>
 <ActivitySummary dateComponents="1969-12-30" activeEnergyBurned="0" activeEnergyBurnedGoal="0" activeEnergyBurnedUnit="Cal" appleMoveTime="0" appleMoveTimeGoal="0" appleExerciseTime="0" appleExerciseTimeGoal="30" appleStandHours="0" appleStandHoursGoal="12"/>
 <ActivitySummary dateComponents="2026-10-19" activeEnergyBurned="500" activeEnergyBurnedGoal="600" activeEnergyBurnedUnit="Cal" appleMoveTime="30" appleMoveTimeGoal="30" appleExerciseTime="40" appleExerciseTimeGoal="30" appleStandHours="10" appleStandHoursGoal="12"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Test Watch" sourceVersion="1" unit="count" creationDate="2026-10-19 08:00:00 +0800" startDate="2026-10-19 08:00:00 +0800" endDate="2026-10-19 08:10:00 +0800" value="1234"/>
 <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Test Watch" sourceVersion="1" unit="count/min" creationDate="2026-10-19 08:05:00 +0800" startDate="2026-10-19 08:05:00 +0800" endDate="2026-10-19 08:05:00 +0800" value="72.5"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Test Watch" sourceVersion="1" creationDate="2026-10-19 07:00:00 +0800" startDate="2026-10-19 01:00:00 +0800" endDate="2026-10-19 02:00:00 +0800" value="HKCategoryValueSleepAnalysisAsleepCore"/>
 <Workout workoutActivityType="HKWorkoutActivityTypeCycling" duration="30" durationUnit="min" sourceName="Test Watch" sourceVersion="1" creationDate="2026-10-19 18:00:00 +0800" startDate="2026-10-19 17:00:00 +0800" endDate="2026-10-19 17:30:00 +0800" totalDistance="10" totalDistanceUnit="km" totalEnergyBurned="200" totalEnergyBurnedUnit="Cal">
  <MetadataEntry key="HKAverageHeartRate" value="120"/>
  <MetadataEntry key="HKMaximumHeartRate" value="150"/>
 </Workout>
 <Correlation type="HKCorrelationTypeIdentifierBloodPressure" sourceName="Test Cuff" startDate="2026-10-19 09:00:00 +0800" endDate="2026-10-19 09:00:00 +0800">
  <Record type="HKQuantityTypeIdentifierBloodPressureSystolic" sourceName="Test Cuff" unit="mmHg" startDate="2026-10-19 09:00:00 +0800" endDate="2026-10-19 09:00:00 +0800" value="120"/>
 </Correlation>
</HealthData>`;

await migrate();

const zip = new AdmZip();
zip.addFile('apple_health_export/导出.xml', Buffer.from(xml, 'utf8'));
const buffer = zip.toBuffer();
const result = await importAppleHealthZip(buffer, 'test-export.zip');

const checks = await Promise.all([
  pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM health_raw_records'),
  pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM health_raw_records
     WHERE object_type = 'ActivitySummary'
       AND raw_attributes->>'dateComponents' = '1969-12-30'`
  ),
  pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM health_samples'),
  pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM health_workouts'),
  pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM daily_summaries WHERE day < DATE '2000-01-01'`
  ),
  pool.query<{ distance_km: string; duration_sec: number; source_name: string | null }>(
    `SELECT distance_km::text, duration_sec, source_name
     FROM health_workouts
     WHERE source_id = 'hae' AND natural_key LIKE 'workout|户外骑行|%'
     LIMIT 1`
  ),
  pool.query<{ status: string; raw_count: string; normalized_count: string }>(
    `SELECT status, raw_count::text, normalized_count::text
     FROM import_batches ORDER BY started_at DESC LIMIT 1`
  ),
]);

const summary = {
  result,
  rawRecords: Number(checks[0].rows[0].count),
  rawEpochActivitySummaries: Number(checks[1].rows[0].count),
  samples: Number(checks[2].rows[0].count),
  workouts: Number(checks[3].rows[0].count),
  epochDailySummaries: Number(checks[4].rows[0].count),
  workout: checks[5].rows[0],
  batch: checks[6].rows[0],
};

console.log(JSON.stringify(summary, null, 2));

if (
  result.importedDays !== 1 ||
  summary.rawRecords < 8 ||
  summary.rawEpochActivitySummaries !== 1 ||
  summary.samples < 3 ||
  summary.workouts !== 1 ||
  summary.epochDailySummaries !== 0 ||
  Number(summary.workout.distance_km) !== 10 ||
  summary.workout.duration_sec !== 1800 ||
  summary.workout.source_name !== 'Test Watch' ||
  summary.batch.status !== 'success'
) {
  throw new Error('Raw import pipeline verification failed.');
}

const repeatResult = await importAppleHealthZip(buffer, 'test-export-repeat.zip');
const repeatCounts = await pool.query<{
  raw_records: string;
  samples: string;
  workouts: string;
  batches: string;
}>(
  `SELECT
     (SELECT COUNT(*)::text FROM health_raw_records) AS raw_records,
     (SELECT COUNT(*)::text FROM health_samples) AS samples,
     (SELECT COUNT(*)::text FROM health_workouts) AS workouts,
     (SELECT COUNT(*)::text FROM import_batches
      WHERE import_kind = 'apple-health-export') AS batches`
);
const repeated = repeatCounts.rows[0];
console.log(
  JSON.stringify(
    {
      repeatedImport: {
        result: repeatResult,
        rawRecords: Number(repeated.raw_records),
        samples: Number(repeated.samples),
        workouts: Number(repeated.workouts),
        batches: Number(repeated.batches),
      },
    },
    null,
    2
  )
);
if (
  Number(repeated.raw_records) !== summary.rawRecords ||
  Number(repeated.samples) !== summary.samples ||
  Number(repeated.workouts) !== summary.workouts ||
  Number(repeated.batches) !== 2
) {
  throw new Error('Repeated Apple Health import idempotency verification failed.');
}

const haePayload = (value: number, reversed = false) => ({
  data: {
    metrics: [
      {
        name: 'heart_rate',
        units: 'count/min',
        data: [
          reversed
            ? {
                source: 'Test HAE',
                date: '2026-10-20 10:00:00 +0800',
                qty: value,
              }
            : {
                qty: value,
                date: '2026-10-20 10:00:00 +0800',
                source: 'Test HAE',
              },
        ],
      },
    ],
    workouts: [],
  },
});

await importHaePayload(haePayload(70), {
  payloadSizeBytes: 256,
  sourceIp: '127.0.0.1',
});
await importHaePayload(haePayload(75, true), {
  payloadSizeBytes: 256,
  sourceIp: '127.0.0.1',
});

const conflictCheck = await pool.query<{
  metric_rows: string;
  metric_value: string;
  sample_rows: string;
  sample_value: string;
  raw_rows: string;
}>(
  `SELECT
     (SELECT COUNT(*)::text FROM health_metric_points
      WHERE metric_name = 'heart_rate' AND recorded_at = TIMESTAMPTZ '2026-10-20 10:00:00+08') AS metric_rows,
     (SELECT value::text FROM health_metric_points
      WHERE metric_name = 'heart_rate' AND recorded_at = TIMESTAMPTZ '2026-10-20 10:00:00+08' LIMIT 1) AS metric_value,
     (SELECT COUNT(*)::text FROM health_samples
      WHERE metric_name = 'heart_rate' AND start_at = TIMESTAMPTZ '2026-10-20 10:00:00+08') AS sample_rows,
     (SELECT value_num::text FROM health_samples
      WHERE metric_name = 'heart_rate' AND start_at = TIMESTAMPTZ '2026-10-20 10:00:00+08' LIMIT 1) AS sample_value,
     (SELECT COUNT(*)::text FROM health_raw_records
      WHERE object_type = 'HaeMetricPoint' AND metric_type = 'heart_rate') AS raw_rows`
);
const conflict = conflictCheck.rows[0];
console.log(JSON.stringify({ latestImportWins: conflict }, null, 2));
if (
  Number(conflict.metric_rows) !== 1 ||
  Number(conflict.metric_value) !== 75 ||
  Number(conflict.sample_rows) !== 1 ||
  Number(conflict.sample_value) !== 75 ||
  Number(conflict.raw_rows) !== 2
) {
  throw new Error('Latest-import conflict resolution verification failed.');
}

await closeDatabase();
