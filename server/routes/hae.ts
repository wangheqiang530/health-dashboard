import type { FastifyInstance } from 'fastify';
import { importHaePayload } from '../hae.ts';
import { getHaeApiKey, secureCompare } from '../settings.ts';

const extractApiKey = (headers: Record<string, string | string[] | undefined>): string => {
  const direct = headers['x-api-key'];
  if (typeof direct === 'string') return direct.trim();

  const authorization = headers.authorization;
  if (typeof authorization === 'string' && authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }
  return '';
};

export async function haeRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/v1/health-auto-export', async (request, reply) => {
    const expectedKey = await getHaeApiKey();
    const providedKey = extractApiKey(request.headers);
    if (!providedKey || !secureCompare(providedKey, expectedKey)) {
      return reply.code(401).send({ error: 'X-Api-Key 无效' });
    }

    const contentLength = Number(request.headers['content-length'] || 0);
    const payloadSizeBytes =
      contentLength > 0 ? contentLength : Buffer.byteLength(JSON.stringify(request.body || {}));

    try {
      const result = await importHaePayload(request.body, {
        payloadSizeBytes,
        sourceIp: request.ip,
      });
      request.log.info(
        {
          importId: result.importId,
          dateFrom: result.dateFrom,
          dateTo: result.dateTo,
          metricCount: result.metricCount,
          workoutCount: result.workoutCount,
        },
        'HAE payload imported'
      );
      return {
        ok: true,
        importId: result.importId,
        dateFrom: result.dateFrom,
        dateTo: result.dateTo,
        metricCount: result.metricCount,
        workoutCount: result.workoutCount,
        dailySummaryCount: result.dailySummaryCount,
        archivePath: result.archivePath,
      };
    } catch (error) {
      request.log.error({ err: error }, 'HAE payload import failed');
      return reply.code(422).send({
        error: error instanceof Error ? error.message : 'HAE 数据导入失败',
      });
    }
  });
}
