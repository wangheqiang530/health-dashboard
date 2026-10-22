import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  deleteIgnoredRule,
  listIgnoredRecords,
  restoreIgnoredRecord,
} from '../ignored.ts';

const ignoredQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(200),
});

const ignoredIdSchema = z.object({
  id: z.string().regex(/^\d+$/),
});

export async function ignoredRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/config/ignored', async (request, reply) => {
    const query = ignoredQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send({ error: '忽略列表查询参数无效。' });
    }
    return { records: await listIgnoredRecords(query.data.limit) };
  });

  app.post<{ Params: { id: string } }>(
    '/api/v1/config/ignored/:id/restore',
    async (request, reply) => {
      const params = ignoredIdSchema.safeParse(request.params);
      if (!params.success) {
        return reply.code(400).send({ error: '忽略记录 ID 无效。' });
      }
      try {
        return await restoreIgnoredRecord(params.data.id);
      } catch (error) {
        return reply.code(409).send({
          error: error instanceof Error ? error.message : '恢复忽略记录失败。',
        });
      }
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/config/ignored/:id',
    async (request, reply) => {
      const params = ignoredIdSchema.safeParse(request.params);
      if (!params.success) {
        return reply.code(400).send({ error: '忽略记录 ID 无效。' });
      }
      const deleted = await deleteIgnoredRule(params.data.id);
      if (!deleted) {
        return reply.code(404).send({ error: '忽略记录不存在。' });
      }
      return { ok: true, deletedId: params.data.id };
    }
  );
}
