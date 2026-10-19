import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.ts';
import { pool } from './db.ts';
import { parseFitActivity } from './fit.ts';

interface RideRow {
  id: string;
  external_id: string;
  fit_file_path: string | null;
  fit_file_name: string | null;
  raw_record: Record<string, unknown> | null;
}

const resolveFitPath = async (row: RideRow): Promise<string | null> => {
  const candidates = [
    row.fit_file_path,
    row.fit_file_name
      ? path.join(config.dataDir, 'archive', 'igpsport', 'fits', path.basename(row.fit_file_name))
      : null,
    row.fit_file_path
      ? path.join(config.dataDir, 'archive', 'igpsport', 'fits', path.basename(row.fit_file_path))
      : null,
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next normalized path.
    }
  }
  return null;
};

export async function backfillCyclingRoutes(): Promise<{
  scanned: number;
  repaired: number;
  missingFiles: number;
  failed: number;
}> {
  const result = await pool.query<RideRow>(
    `SELECT id::text, external_id, fit_file_path, fit_file_name, raw_record
     FROM cycling_activities
     WHERE fit_file_path IS NOT NULL
       AND (
         CASE
           WHEN jsonb_typeof(raw_record->'routePoints') = 'array'
             THEN jsonb_array_length(raw_record->'routePoints') = 0
               OR NOT EXISTS (
                 SELECT 1
                 FROM jsonb_array_elements(raw_record->'routePoints') AS point
                 WHERE point ? 'speedKmh'
               )
           ELSE TRUE
         END
         OR CASE
           WHEN jsonb_typeof(raw_record->'telemetry') = 'array'
             THEN jsonb_array_length(raw_record->'telemetry') < 2
           ELSE TRUE
         END
       )
     ORDER BY started_at DESC`
  );

  let repaired = 0;
  let missingFiles = 0;
  let failed = 0;

  for (const row of result.rows) {
    const fitPath = await resolveFitPath(row);
    if (!fitPath) {
      missingFiles += 1;
      continue;
    }

    try {
      const buffer = await fs.readFile(fitPath);
      const activity = parseFitActivity(
        buffer,
        row.fit_file_name || path.basename(fitPath)
      );
      if (activity.routePoints.length === 0 && activity.telemetry.length === 0) continue;

      await pool.query(
        `UPDATE cycling_activities
         SET raw_record = raw_record || $2::jsonb,
             updated_at = NOW()
         WHERE id = $1`,
        [
          row.id,
          JSON.stringify({
            routePoints: activity.routePoints,
            telemetry: activity.telemetry,
            heartRateZones: activity.heartRateZones,
          }),
        ]
      );
      repaired += 1;
    } catch (error) {
      failed += 1;
      console.warn(`[fit:backfill] ${row.external_id} 回填失败:`, error);
    }
  }

  return {
    scanned: result.rows.length,
    repaired,
    missingFiles,
    failed,
  };
}
