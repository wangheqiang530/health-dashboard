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
        const skeletalMusclePercent = numberOrNull(row.skeletal_muscle_rate);
        const bodyFatPercent = numberOrNull(row.body_fat_rate);
        const skeletalMuscleKg =
          weight !== null && skeletalMusclePercent !== null
            ? Number((weight * (skeletalMusclePercent / 100)).toFixed(2))
            : null;
        return {
          id: row.id,
          measuredAt: row.measured_at.toISOString(),
          measuredDate: row.measured_date,
          weightKg: weight,
          bmi: numberOrNull(row.bmi),
          bodyFatPercent,
          skeletalMuscleKg,
          skeletalMusclePercent,
          musclePercent: numberOrNull(row.muscle_rate),
          leanMassKg: numberOrNull(row.lean_body_mass_kg),
          visceralFatLevel: numberOrNull(row.visceral_fat_level),
          waterPercent: numberOrNull(row.water_rate),
          boneMassKg: numberOrNull(row.bone_mass_kg),
          bmrKcal: numberOrNull(row.bmr_kcal),
          subcutaneousFatPercent: numberOrNull(row.subcutaneous_fat_rate),
          proteinPercent: numberOrNull(row.protein_rate),
          bodyAge: row.body_age,
          heartRate: row.heart_rate,
          bodyScore: numberOrNull(row.score),
          smi: numberOrNull(row.smi),
          whr: numberOrNull(row.whr),
          segments: buildBodySegments(weight, skeletalMuscleKg, bodyFatPercent, row.raw_record),
          segmentMuscleEstimated: true,
        };
      }),
    };
  });
}
