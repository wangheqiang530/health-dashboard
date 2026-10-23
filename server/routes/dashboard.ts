import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from '../config.ts';
import { pool } from '../db.ts';
import { getDashboardData } from '../dashboard.ts';
import { getWorkoutRecordById, getWorkoutRecords } from '../workouts.ts';

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const workoutQuerySchema = querySchema.extend({
  limit: z.coerce.number().int().min(1).max(10000).optional().default(5000),
});

const requestOrigin = (request: FastifyRequest): string => {
  if (config.publicBaseUrl) return config.publicBaseUrl;
  const forwardedProto = request.headers['x-forwarded-proto'];
  const protocol =
    typeof forwardedProto === 'string' ? forwardedProto.split(',')[0].trim() : request.protocol;
  return `${protocol}://${request.host}`;
};

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/dashboard', async (request, reply) => {
    const query = querySchema.safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send({ error: '日期参数必须为 YYYY-MM-DD' });
    }
    return getDashboardData({
      from: query.data.from,
      to: query.data.to,
      endpoint: requestOrigin(request),
    });
  });

  app.get('/api/v1/workouts', async (request, reply) => {
    const query = workoutQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send({ error: '日期参数必须为 YYYY-MM-DD' });
    }
    if (query.data.from && query.data.to && query.data.from > query.data.to) {
      return reply.code(400).send({ error: '开始日期不能晚于结束日期。' });
    }
    return getWorkoutRecords(query.data);
  });

  app.get<{ Params: { id: string } }>(
    '/api/v1/workouts/:id',
    async (request, reply) => {
      const params = z
        .object({ id: z.string().min(1).max(240) })
        .safeParse(request.params);
      if (!params.success) {
        return reply.code(400).send({ error: '运动记录 ID 无效。' });
      }

      const workout = await getWorkoutRecordById(params.data.id);
      if (!workout) {
        return reply.code(404).send({ error: '未找到这条运动记录。' });
      }
      return workout;
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/workouts/:id',
    async (request, reply) => {
      const params = z
        .object({ id: z.string().min(1).max(240) })
        .safeParse(request.params);
      if (!params.success) {
        return reply.code(400).send({ error: '运动记录 ID 无效。' });
      }

      const recordId = params.data.id;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        let deleted:
          | {
              source_id: string;
              tombstone_key: string;
              name: string;
              local_date: string;
              local_start_time: string | null;
              snapshot: Record<string, unknown>;
            }
          | undefined;
        let recordKind: 'health_workout' | 'cycling_activity' = 'health_workout';

        if (recordId.startsWith('hae-')) {
          const databaseId = recordId.slice(4);
          if (!/^\d+$/.test(databaseId)) {
            await client.query('ROLLBACK');
            return reply.code(400).send({ error: 'HAE 运动记录 ID 无效。' });
          }

          const result = await client.query<{
            source_id: string;
            tombstone_key: string;
            name: string;
            local_date: string;
            local_start_time: string | null;
            snapshot: Record<string, unknown>;
          }>(
            `DELETE FROM health_workouts
             WHERE id = $1::bigint
             RETURNING
               source_id,
               COALESCE(natural_key, fingerprint) AS tombstone_key,
               name,
               to_char((started_at AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS local_date,
               CASE
                 WHEN started_at IS NULL THEN NULL
                 ELSE to_char(started_at AT TIME ZONE $2, 'HH24:MI')
               END AS local_start_time,
               to_jsonb(health_workouts) AS snapshot`,
            [databaseId, config.timezone]
          );
          deleted = result.rows[0];
        } else {
          recordKind = 'cycling_activity';
          const externalId = recordId.startsWith('igpsport-')
            ? recordId.slice('igpsport-'.length)
            : recordId;
          const result = await client.query<{
            source_id: string;
            tombstone_key: string;
            name: string;
            local_date: string;
            local_start_time: string | null;
            snapshot: Record<string, unknown>;
          }>(
            `DELETE FROM cycling_activities
             WHERE external_id = $1
             RETURNING
               source_id,
               external_id AS tombstone_key,
               title AS name,
               to_char((started_at AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS local_date,
               to_char(started_at AT TIME ZONE $2, 'HH24:MI') AS local_start_time,
               to_jsonb(cycling_activities) AS snapshot`,
            [externalId, config.timezone]
          );
          deleted = result.rows[0];
        }

        if (!deleted) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: '未找到这条运动记录。' });
        }

        await client.query(
          `INSERT INTO data_tombstones
            (record_kind, source_id, external_id, metadata)
           VALUES ($1, $2, $3, $4::jsonb)
           ON CONFLICT (record_kind, source_id, external_id) DO UPDATE SET
             deleted_at = NOW(),
             metadata = EXCLUDED.metadata`,
          [
            recordKind,
            deleted.source_id,
            deleted.tombstone_key,
            JSON.stringify({
              name: deleted.name,
              date: deleted.local_date,
              startTime: deleted.local_start_time,
              reasonCode: 'manual_delete',
              reason:
                recordKind === 'cycling_activity'
                  ? '手动删除的骑行记录'
                  : '手动删除的运动记录',
              snapshot: deleted.snapshot,
            }),
          ]
        );

        if (deleted.local_start_time) {
          await client.query(
            `UPDATE daily_summaries ds
             SET
               summary = jsonb_set(
                 ds.summary,
                 '{workouts}',
                 COALESCE(
                   (
                     SELECT jsonb_agg(item.workout)
                     FROM jsonb_array_elements(
                       COALESCE(ds.summary->'workouts', '[]'::jsonb)
                     ) AS item(workout)
                     WHERE item.workout->>'startTime' IS NULL
                        OR abs(
                          extract(epoch from (
                            (item.workout->>'startTime')::time - $2::time
                          ))
                        ) > 120
                   ),
                   '[]'::jsonb
                 ),
                 true
               ),
               updated_at = NOW()
             WHERE ds.day = $1::date`,
            [deleted.local_date, deleted.local_start_time]
          );
        }

        await client.query('COMMIT');
        return {
          ok: true,
          kind: 'workout',
          deletedId: recordId,
          name: deleted.name,
          date: deleted.local_date,
          startTime: deleted.local_start_time,
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
