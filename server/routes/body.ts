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
}

const numberOrNull = (value: string | number | null): number | null => {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
         score, smi, whr
       FROM body_measurements
       ORDER BY measured_at DESC
       LIMIT $1`,
      [query.data.limit]
    );

    return {
      measurements: result.rows.map((row) => {
        const weight = numberOrNull(row.weight_kg);
        const skeletalMusclePercent = numberOrNull(row.skeletal_muscle_rate);
        return {
          id: row.id,
          measuredAt: row.measured_at.toISOString(),
          measuredDate: row.measured_date,
          weightKg: weight,
          bmi: numberOrNull(row.bmi),
          bodyFatPercent: numberOrNull(row.body_fat_rate),
          skeletalMuscleKg:
            weight !== null && skeletalMusclePercent !== null
              ? Number((weight * (skeletalMusclePercent / 100)).toFixed(2))
              : null,
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
        };
      }),
    };
  });
}
