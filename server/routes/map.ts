import fs from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config.ts';
import { httpFetch } from '../http.ts';

const tileParamsSchema = z.object({
  provider: z.enum(['osm', 'carto-light', 'carto-dark']),
  z: z.coerce.number().int().min(0).max(19),
  x: z.coerce.number().int().min(0),
  y: z.coerce.number().int().min(0),
});

const upstreamTileUrl = (
  provider: 'osm' | 'carto-light' | 'carto-dark',
  z: number,
  x: number,
  y: number
): string => {
  if (provider === 'osm') {
    return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  }
  const style = provider === 'carto-dark' ? 'dark_all' : 'rastertiles/voyager';
  return `https://a.basemaps.cartocdn.com/${style}/${z}/${x}/${y}.png`;
};

export async function mapRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { provider: string; z: string; x: string; y: string } }>(
    '/api/v1/map/tiles/:provider/:z/:x/:y',
    async (request, reply) => {
      const params = tileParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.code(400).send({ error: '地图瓦片参数无效。' });
      }

      const { provider, z, x, y } = params.data;
      const tileLimit = 2 ** z;
      if (x >= tileLimit || y >= tileLimit) {
        return reply.code(400).send({ error: '地图瓦片坐标超出范围。' });
      }

      const cachePath = path.join(
        config.dataDir,
        'map-tiles',
        provider,
        String(z),
        String(x),
        `${y}.png`
      );
      try {
        const cached = await fs.readFile(cachePath);
        reply.header('Cache-Control', 'public, max-age=604800, immutable');
        return reply.type('image/png').send(cached);
      } catch {
        // Cache miss.
      }

      try {
        const response = await httpFetch(upstreamTileUrl(provider, z, x, y), {
          headers: {
            Accept: 'image/png,image/*;q=0.8',
            'User-Agent': 'health-dashboard-map-proxy/1.0',
          },
          signal: AbortSignal.timeout(12_000),
        });
        if (!response.ok) {
          throw new Error(`地图服务 HTTP ${response.status}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        await fs.mkdir(path.dirname(cachePath), { recursive: true });
        await fs.writeFile(cachePath, buffer);
        reply.header('Cache-Control', 'public, max-age=604800, immutable');
        return reply.type('image/png').send(buffer);
      } catch (error) {
        return reply.code(502).send({
          error: error instanceof Error ? error.message : '地图瓦片加载失败。',
        });
      }
    }
  );
}
