import type { FastifyInstance } from 'fastify';
import { getVersionInfo } from '../version.ts';

export async function versionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/version', async () => getVersionInfo());
}
