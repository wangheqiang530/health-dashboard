import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from '../config.ts';
import { getDashboardData } from '../dashboard.ts';

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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
}
