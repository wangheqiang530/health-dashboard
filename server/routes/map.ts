import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { ProxyAgent } from 'proxy-agent';
import { z } from 'zod';
import { config } from '../config.ts';
import { httpFetch } from '../http.ts';
import { getMapProxyUrl } from '../settings.ts';

const tileParamsSchema = z.object({
  provider: z.enum(['osm', 'topo', 'carto-light', 'carto-dark']),
  z: z.coerce.number().int().min(0).max(19),
  x: z.coerce.number().int().min(0),
  y: z.preprocess(
    (value) => (typeof value === 'string' ? value.replace(/\.png$/i, '') : value),
    z.coerce.number().int().min(0)
  ),
});

const upstreamTileUrl = (
  provider: 'osm' | 'topo' | 'carto-light' | 'carto-dark',
  z: number,
  x: number,
  y: number
): string => {
  if (provider === 'osm') {
    return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  }
  if (provider === 'topo') {
    return `https://a.tile.opentopomap.org/${z}/${x}/${y}.png`;
  }
  const style = provider === 'carto-dark' ? 'dark_all' : 'rastertiles/voyager';
  return `https://a.basemaps.cartocdn.com/${style}/${z}/${x}/${y}.png`;
};

const fetchTileWithProxy = (
  targetUrl: string,
  proxyUrl: string,
  redirectCount = 0
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const target = new URL(targetUrl);
    const client = target.protocol === 'https:' ? https : http;
    const agent = new ProxyAgent({
      getProxyForUrl: () => proxyUrl,
    });
    const request = client.get(
      target,
      {
        agent,
        headers: {
          Accept: 'image/png,image/*;q=0.8',
          'User-Agent': 'health-dashboard-map-proxy/1.0',
        },
      },
      (response) => {
        const status = response.statusCode || 0;
        const location = response.headers.location;
        if (status >= 300 && status < 400 && location && redirectCount < 2) {
          response.resume();
          agent.destroy();
          void fetchTileWithProxy(
            new URL(location, target).toString(),
            proxyUrl,
            redirectCount + 1
          ).then(resolve, reject);
          return;
        }
        if (status < 200 || status >= 300) {
          response.resume();
          agent.destroy();
          reject(new Error(`地图服务 HTTP ${status}`));
          return;
        }
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          agent.destroy();
          resolve(Buffer.concat(chunks));
        });
        response.on('error', (error) => {
          agent.destroy();
          reject(error);
        });
      }
    );
    request.setTimeout(12_000, () => {
      request.destroy(new Error('地图代理请求超时。'));
    });
    request.on('error', (error) => {
      agent.destroy();
      reject(error);
    });
  });

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
        const tileUrl = upstreamTileUrl(provider, z, x, y);
        const proxyUrl = await getMapProxyUrl();
        const buffer = proxyUrl
          ? await fetchTileWithProxy(tileUrl, proxyUrl)
          : await httpFetch(tileUrl, {
              headers: {
                Accept: 'image/png,image/*;q=0.8',
                'User-Agent': 'health-dashboard-map-proxy/1.0',
              },
              signal: AbortSignal.timeout(12_000),
            }).then(async (response) => {
              if (!response.ok) {
                throw new Error(`地图服务 HTTP ${response.status}`);
              }
              return Buffer.from(await response.arrayBuffer());
            });
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
