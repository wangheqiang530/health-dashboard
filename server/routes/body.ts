import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db.ts';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(2000).optional().default(1000),
});

interface BodyMeasurementRow {
  id: string;
  measured_at: Date;
  measured_date: string;
  weight_kg: string | null;
  bmi: string | null;
  body_fat_rate: string | null;
  skeletal_muscle_rate: string | null;
  muscle_rate: string | null;
  lean_body_mass_kg: string | null;
  visceral_fat_level: string | null;
  water_rate: string | null;
  bone_mass_kg: string | null;
  bmr_kcal: string | null;
  subcutaneous_fat_rate: string | null;
  protein_rate: string | null;
  body_age: number | null;
  heart_rate: number | null;
  score: string | null;
  smi: string | null;
  whr: string | null;
  raw_record: {
    adc_list?: unknown;
  } | null;
}

const numberOrNull = (value: string | number | null): number | null => {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

type BodySegmentKey = 'trunk' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';

const MUSCLE_DISTRIBUTION: Record<BodySegmentKey, number> = {
  trunk: 0.515,
  leftArm: 0.066,
  rightArm: 0.067,
  leftLeg: 0.176,
  rightLeg: 0.176,
};

const FAT_DISTRIBUTION: Record<BodySegmentKey, number> = {
  trunk: 0.51,
  leftArm: 0.068,
  rightArm: 0.068,
  leftLeg: 0.177,
  rightLeg: 0.177,
};

const IMPEDANCE_INDEXES: Record<BodySegmentKey, [number, number]> = {
  trunk: [0, 5],
  rightArm: [1, 6],
  leftArm: [2, 7],
  rightLeg: [3, 8],
  leftLeg: [4, 9],
};

const parseImpedanceList = (rawRecord: BodyMeasurementRow['raw_record']): number[] | null => {
  const rawList = rawRecord?.adc_list;
  if (typeof rawList !== 'string') return null;
  const values = rawList.split(',').map((value) => Number(value.trim()));
  if (values.length !== 10 || values.some((value) => !Number.isFinite(value))) return null;
  return values;
};

const buildBodySegments = (
  weightKg: number | null,
  skeletalMuscleKg: number | null,
  bodyFatPercent: number | null,
  rawRecord: BodyMeasurementRow['raw_record']
) => {
  const impedance = parseImpedanceList(rawRecord);
  const fatMassKg =
    weightKg !== null && bodyFatPercent !== null
      ? weightKg * (bodyFatPercent / 100)
      : null;

  return (Object.keys(MUSCLE_DISTRIBUTION) as BodySegmentKey[]).reduce(
    (segments, key) => {
      const [frequency20Index, frequency100Index] = IMPEDANCE_INDEXES[key];
      const impedance20 = impedance?.[frequency20Index] ?? null;
      const impedance100 = impedance?.[frequency100Index] ?? null;
      segments[key] = {
        muscleKg:
          skeletalMuscleKg === null || skeletalMuscleKg <= 0
            ? null
            : Number((skeletalMuscleKg * MUSCLE_DISTRIBUTION[key]).toFixed(2)),
        fatKg:
          fatMassKg === null || fatMassKg <= 0
            ? null
            : Number((fatMassKg * FAT_DISTRIBUTION[key]).toFixed(2)),
        impedance20kHz: impedance20 !== null && impedance20 > 0 ? impedance20 : null,
        impedance100kHz: impedance100 !== null && impedance100 > 0 ? impedance100 : null,
      };
      return segments;
    },
    {} as Record<
      BodySegmentKey,
      {
        muscleKg: number | null;
        fatKg: number | null;
        impedance20kHz: number | null;
        impedance100kHz: number | null;
      }
    >
  );
};

export async function bodyRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/body/measurements', async (request, reply) => {
    const query = querySchema.safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send({ error: '查询参数无效。' });
    }

    const result = await pool.query<BodyMeasurementRow>(
      `SELECT
         id::text,
         measured_at,
         to_char(measured_date, 'YYYY-MM-DD') AS measured_date,
         weight_kg, bmi, body_fat_rate, skeletal_muscle_rate, muscle_rate,
         lean_body_mass_kg, visceral_fat_level, water_rate, bone_mass_kg,
         bmr_kcal, subcutaneous_fat_rate, protein_rate, body_age, heart_rate,
         score, smi, whr, raw_record
       FROM body_measurements
       ORDER BY measured_at DESC
       LIMIT $1`,
      [query.data.limit]
    );

    return {
      measurements: result.rows.map((row) => {
        const weight = numberOrNull(row.weight_kg);
        const rawFat = numberOrNull(row.body_fat_rate);
        const bodyFatPercent =
          rawFat !== null && rawFat > 0 ? rawFat : null;
        const rawSkeletal = numberOrNull(row.skeletal_muscle_rate);
        const skeletalMusclePercent =
          rawSkeletal !== null && rawSkeletal > 0 ? rawSkeletal : null;
        const skeletalMuscleKg =
          weight !== null && skeletalMusclePercent !== null && skeletalMusclePercent > 0
            ? Number((weight * (skeletalMusclePercent / 100)).toFixed(2))
            : null;
        const leanMassKg =
          weight !== null && bodyFatPercent !== null && bodyFatPercent > 0
            ? Number((weight * (1 - bodyFatPercent / 100)).toFixed(2))
            : numberOrNull(row.lean_body_mass_kg);
        const rawBmi = numberOrNull(row.bmi);
        const bmi =
          rawBmi !== null && rawBmi > 0
            ? rawBmi
            : null;
        const rawWater = numberOrNull(row.water_rate);
        const waterPercent =
          rawWater !== null && rawWater > 0 ? rawWater : null;
        const rawVisceral = numberOrNull(row.visceral_fat_level);
        const visceralFatLevel =
          rawVisceral !== null && rawVisceral > 0 ? rawVisceral : null;
        const rawBmr = numberOrNull(row.bmr_kcal);
        const bmrKcal =
          rawBmr !== null && rawBmr > 0 ? rawBmr : null;
        const rawBone = numberOrNull(row.bone_mass_kg);
        const boneMassKg =
          rawBone !== null && rawBone > 0 ? rawBone : null;
        const rawProtein = numberOrNull(row.protein_rate);
        const proteinPercent =
          rawProtein !== null && rawProtein > 0 ? rawProtein : null;
        const bodyAge =
          row.body_age && row.body_age > 0 ? row.body_age : null;
        const rawScore = numberOrNull(row.score);
        const bodyScore =
          rawScore !== null && rawScore > 0 ? rawScore : null;

        return {
          id: row.id,
          measuredAt: row.measured_at.toISOString(),
          measuredDate: row.measured_date,
          weightKg: weight,
          bmi,
          bodyFatPercent,
          skeletalMuscleKg,
          skeletalMusclePercent,
          musclePercent: numberOrNull(row.muscle_rate),
          leanMassKg,
          visceralFatLevel,
          waterPercent,
          boneMassKg,
          bmrKcal,
          subcutaneousFatPercent: numberOrNull(row.subcutaneous_fat_rate),
          proteinPercent,
          bodyAge,
          heartRate: row.heart_rate,
          bodyScore,
          smi: numberOrNull(row.smi),
          whr: numberOrNull(row.whr),
          segments: buildBodySegments(weight, skeletalMuscleKg, bodyFatPercent, row.raw_record),
          segmentMuscleEstimated: true,
          rawRecord: row.raw_record,
        };
      }),
    };
  });

  app.delete<{ Params: { id: string } }>(
    '/api/v1/body/measurements/:id',
    async (request, reply) => {
      const params = z.object({ id: z.string().regex(/^\d+$/) }).safeParse(request.params);
      if (!params.success) {
        return reply.code(400).send({ error: '体测记录 ID 无效。' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query<{
          id: string;
          source_id: string;
          external_id: string;
          measured_at: Date;
          measured_date: string;
          raw_record: Record<string, unknown> | null;
          snapshot: Record<string, unknown>;
        }>(
          `DELETE FROM body_measurements
           WHERE id = $1::bigint
           RETURNING
             id::text,
             source_id,
             external_id,
             measured_at,
             to_char(measured_date, 'YYYY-MM-DD') AS measured_date,
             raw_record,
             to_jsonb(body_measurements) AS snapshot`,
          [params.data.id]
        );

        const deleted = result.rows[0];
        if (!deleted) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: '未找到这条体测记录。' });
        }

        await client.query(
          `INSERT INTO data_tombstones
            (record_kind, source_id, external_id, metadata)
           VALUES ('body_measurement', $1, $2, $3::jsonb)
           ON CONFLICT (record_kind, source_id, external_id) DO UPDATE SET
             deleted_at = NOW(),
             metadata = EXCLUDED.metadata`,
          [
            deleted.source_id,
            deleted.external_id,
            JSON.stringify({
              measuredAt: deleted.measured_at.toISOString(),
              measuredDate: deleted.measured_date,
              rawRecord: deleted.raw_record,
              reasonCode: 'manual_delete',
              reason: '手动删除的体测记录',
              snapshot: deleted.snapshot,
            }),
          ]
        );

        await client.query('COMMIT');
        return {
          ok: true,
          kind: 'body',
          deletedId: deleted.id,
          measuredAt: deleted.measured_at.toISOString(),
          measuredDate: deleted.measured_date,
          ignoredFromFutureSync: true,
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  );
}
