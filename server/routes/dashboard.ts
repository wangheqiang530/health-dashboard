import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from '../config.ts';
import { getDashboardData } from '../dashboard.ts';
import { getWorkoutRecords } from '../workouts.ts';

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
}
