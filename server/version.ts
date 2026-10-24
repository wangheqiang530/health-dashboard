import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.ts';
import { httpFetch } from './http.ts';
import { pool } from './db.ts';

interface DockerHubTag {
  name: string;
  last_updated?: string;
}

export interface SystemStatus {
  nodeVersion: string;
  uptimeSeconds: number;
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
  storage: {
    dataDir: string;
    archiveCount: number;
    archiveSizeBytes: number;
    archiveSizeFormatted: string;
  };
  database: {
    connected: boolean;
    dailySummaries: number;
    metricPoints: number;
    workouts: number;
    bodyMeasurements: number;
    cyclingActivities: number;
    rawRecords: number;
    healthSamples: number;
    importBatches: number;
  };
  backendStatus: 'healthy' | 'degraded';
}

export interface VersionInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  updateCheckStatus: 'ok' | 'cached' | 'unavailable';
  updateCheckSource: 'dockerhub' | 'github' | 'cache' | null;
  updateCheckCheckedAt: string | null;
  releaseUrl: string;
  repoUrl: string;
  dockerImage: string;
  checkedAt: string;
  system?: SystemStatus;
}

type UpdateSource = 'dockerhub' | 'github';

interface CachedVersionTag {
  latestVersion: string;
  source: UpdateSource | 'cache';
  checkedAt: string;
  expiresAt: number;
}

interface LatestVersionResult {
  latestVersion: string;
  source: UpdateSource;
}

let cachedVersionTag: CachedVersionTag | null = null;
const versionCachePath = path.join(config.dataDir, 'version-check.json');

const readCurrentVersion = async (): Promise<string> => {
  const packagePath = fileURLToPath(new URL('../package.json', import.meta.url));
  const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8')) as { version?: string };
  return packageJson.version || '0.0.0';
};

const parseSemver = (value: string): number[] | null => {
  const match = value.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/i);
  return match ? match.slice(1, 4).map(Number) : null;
};

export const compareVersions = (left: string, right: string): number => {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) return 0;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
};

const normalizeVersion = (value: string): string => value.trim().replace(/^v/i, '');

const readPersistedVersionCache = async (): Promise<CachedVersionTag | null> => {
  try {
    const payload = JSON.parse(await fs.readFile(versionCachePath, 'utf8')) as {
      latestVersion?: string;
      source?: UpdateSource;
      checkedAt?: string;
    };
    if (
      !payload.latestVersion ||
      parseSemver(payload.latestVersion) === null ||
      (payload.source !== 'dockerhub' && payload.source !== 'github')
    ) {
      return null;
    }
    return {
      latestVersion: normalizeVersion(payload.latestVersion),
      source: payload.source,
      checkedAt: payload.checkedAt || new Date().toISOString(),
      expiresAt: Date.now() + 5 * 60 * 1000,
    };
  } catch {
    return null;
  }
};

const writePersistedVersionCache = async (result: LatestVersionResult): Promise<void> => {
  try {
    await fs.mkdir(path.dirname(versionCachePath), { recursive: true });
    const temporaryPath = `${versionCachePath}.tmp`;
    await fs.writeFile(
      temporaryPath,
      JSON.stringify(
        {
          latestVersion: result.latestVersion,
          source: result.source,
          checkedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
    await fs.rename(temporaryPath, versionCachePath);
  } catch {
    // The update check must never affect dashboard availability.
  }
};

const fetchLatestDockerHubVersion = async (): Promise<LatestVersionResult | null> => {
  const repository = config.dockerHubRepository;
  const response = await httpFetch(
    `https://hub.docker.com/v2/repositories/${repository}/tags?page_size=100&ordering=last_updated`,
    {
      headers: { Accept: 'application/json', 'User-Agent': 'health-dashboard-update-check' },
      signal: AbortSignal.timeout(8_000),
    }
  );
  if (!response.ok) return null;
  const payload = (await response.json()) as { results?: DockerHubTag[] };
  const versions = (payload.results || [])
    .map((tag) => tag.name)
    .filter((tag): tag is string => parseSemver(tag) !== null);
  versions.sort((left, right) => compareVersions(right, left));
  return versions[0]
    ? { latestVersion: normalizeVersion(versions[0]), source: 'dockerhub' }
    : null;
};

const fetchLatestGitHubVersion = async (): Promise<LatestVersionResult | null> => {
  const response = await httpFetch(
    `https://api.github.com/repos/${config.githubRepository}/tags?per_page=100`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'health-dashboard-update-check',
      },
      signal: AbortSignal.timeout(8_000),
    }
  );
  if (!response.ok) return null;
  const payload = (await response.json()) as Array<{ name?: string }>;
  const versions = payload
    .map((tag) => tag.name || '')
    .filter((tag) => parseSemver(tag) !== null);
  versions.sort((left, right) => compareVersions(right, left));
  return versions[0]
    ? { latestVersion: normalizeVersion(versions[0]), source: 'github' }
    : null;
};

const fetchLatestVersion = async (): Promise<LatestVersionResult | null> => {
  const sources = [fetchLatestDockerHubVersion(), fetchLatestGitHubVersion()];
  try {
    return await Promise.any(
      sources.map(async (request) => {
        const result = await request;
        if (!result) throw new Error('版本源没有可用版本');
        return result;
      })
    );
  } catch {
    return null;
  }
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export async function getVersionInfo(): Promise<VersionInfo> {
  const currentVersion = await readCurrentVersion();
  let latestVersion: string | null = null;
  let updateAvailable = false;
  let updateCheckStatus: VersionInfo['updateCheckStatus'] = 'unavailable';
  let updateCheckSource: VersionInfo['updateCheckSource'] = null;
  let updateCheckCheckedAt: string | null = null;

  if (cachedVersionTag && Date.now() < cachedVersionTag.expiresAt) {
    latestVersion = cachedVersionTag.latestVersion;
    updateCheckSource = cachedVersionTag.source;
    updateCheckCheckedAt = cachedVersionTag.checkedAt;
    updateCheckStatus = cachedVersionTag.source === 'cache' ? 'cached' : 'ok';
  } else {
    const remote = await fetchLatestVersion().catch(() => null);
    if (remote) {
      latestVersion = remote.latestVersion;
      updateCheckSource = remote.source;
      updateCheckCheckedAt = new Date().toISOString();
      updateCheckStatus = 'ok';
      cachedVersionTag = {
        latestVersion: remote.latestVersion,
        source: remote.source,
        checkedAt: updateCheckCheckedAt,
        expiresAt: Date.now() + 60 * 60 * 1000,
      };
      await writePersistedVersionCache(remote);
    } else {
      const persisted = await readPersistedVersionCache();
      if (persisted) {
        latestVersion = persisted.latestVersion;
        updateCheckSource = 'cache';
        updateCheckCheckedAt = persisted.checkedAt;
        updateCheckStatus = 'cached';
        cachedVersionTag = {
          ...persisted,
          source: 'cache',
          expiresAt: Date.now() + 5 * 60 * 1000,
        };
      } else {
        cachedVersionTag = null;
      }
    }
  }
  updateAvailable =
    latestVersion !== null && compareVersions(latestVersion, currentVersion) > 0;

  const mem = process.memoryUsage();
  const rssMb = Number((mem.rss / 1024 / 1024).toFixed(1));
  const heapUsedMb = Number((mem.heapUsed / 1024 / 1024).toFixed(1));
  const heapTotalMb = Number((mem.heapTotal / 1024 / 1024).toFixed(1));

  let dbCounts = {
    dailySummaries: 0,
    metricPoints: 0,
    workouts: 0,
    bodyMeasurements: 0,
    cyclingActivities: 0,
    rawRecords: 0,
    healthSamples: 0,
    importBatches: 0,
    archiveCount: 0,
    archiveSizeBytes: 0,
  };
  let dbConnected = false;

  try {
    const counts = await pool.query<{
      daily_summaries: number;
      metric_points: number;
      workouts: number;
      body_measurements: number;
      cycling_activities: number;
      raw_records: number;
      health_samples: number;
      import_batches: number;
      archive_count: number;
      archive_size_bytes: string | number;
    }>(`
      SELECT
        (SELECT COUNT(*) FROM daily_summaries)::int AS daily_summaries,
        (SELECT COUNT(*) FROM health_metric_points)::int AS metric_points,
        (SELECT COUNT(*) FROM health_workouts)::int AS workouts,
        (SELECT COUNT(*) FROM body_measurements)::int AS body_measurements,
        (SELECT COUNT(*) FROM cycling_activities)::int AS cycling_activities,
        (SELECT COUNT(*) FROM health_raw_records)::int AS raw_records,
        (SELECT COUNT(*) FROM health_samples)::int AS health_samples,
        (SELECT COUNT(*) FROM import_batches)::int AS import_batches,
        (SELECT COUNT(*) FROM source_archive_files WHERE deleted_at IS NULL)::int AS archive_count,
        (SELECT COALESCE(SUM(size_bytes), 0)::bigint FROM source_archive_files WHERE deleted_at IS NULL) AS archive_size_bytes
    `);
    if (counts.rows[0]) {
      const row = counts.rows[0];
      dbCounts = {
        dailySummaries: Number(row.daily_summaries || 0),
        metricPoints: Number(row.metric_points || 0),
        workouts: Number(row.workouts || 0),
        bodyMeasurements: Number(row.body_measurements || 0),
        cyclingActivities: Number(row.cycling_activities || 0),
        rawRecords: Number(row.raw_records || 0),
        healthSamples: Number(row.health_samples || 0),
        importBatches: Number(row.import_batches || 0),
        archiveCount: Number(row.archive_count || 0),
        archiveSizeBytes: Number(row.archive_size_bytes || 0),
      };
      dbConnected = true;
    }
  } catch {
    dbConnected = false;
  }

  return {
    currentVersion,
    latestVersion,
    updateAvailable,
    updateCheckStatus,
    updateCheckSource,
    updateCheckCheckedAt,
    releaseUrl: `https://github.com/${config.githubRepository}/releases`,
    repoUrl: `https://github.com/${config.githubRepository}`,
    dockerImage: `docker.io/${config.dockerHubRepository}`,
    checkedAt: new Date().toISOString(),
    system: {
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        rssMb,
        heapUsedMb,
        heapTotalMb,
      },
      storage: {
        dataDir: config.dataDir,
        archiveCount: dbCounts.archiveCount,
        archiveSizeBytes: dbCounts.archiveSizeBytes,
        archiveSizeFormatted: formatBytes(dbCounts.archiveSizeBytes),
      },
      database: {
        connected: dbConnected,
        dailySummaries: dbCounts.dailySummaries,
        metricPoints: dbCounts.metricPoints,
        workouts: dbCounts.workouts,
        bodyMeasurements: dbCounts.bodyMeasurements,
        cyclingActivities: dbCounts.cyclingActivities,
        rawRecords: dbCounts.rawRecords,
        healthSamples: dbCounts.healthSamples,
        importBatches: dbCounts.importBatches,
      },
      backendStatus: dbConnected ? 'healthy' : 'degraded',
    },
  };
}
