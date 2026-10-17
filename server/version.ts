import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { config } from './config.ts';

interface DockerHubTag {
  name: string;
  last_updated?: string;
}

interface VersionInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string;
  dockerImage: string;
  checkedAt: string;
}

let cachedVersionInfo: VersionInfo | null = null;
let cacheExpiresAt = 0;

const readCurrentVersion = async (): Promise<string> => {
  const packagePath = fileURLToPath(new URL('../package.json', import.meta.url));
  const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8')) as { version?: string };
  return packageJson.version || '0.0.0';
};

const parseSemver = (value: string): number[] | null => {
  const match = value.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/i);
  return match ? match.slice(1, 4).map(Number) : null;
};

const compareVersions = (left: string, right: string): number => {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) return 0;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
};

const fetchLatestDockerHubVersion = async (): Promise<string | null> => {
  const repository = config.dockerHubRepository;
  const response = await fetch(
    `https://hub.docker.com/v2/repositories/${repository}/tags?page_size=50&ordering=last_updated`,
    {
      headers: { Accept: 'application/json', 'User-Agent': 'health-dashboard-update-check' },
      signal: AbortSignal.timeout(10_000),
    }
  );
  if (!response.ok) return null;
  const payload = (await response.json()) as { results?: DockerHubTag[] };
  const versions = (payload.results || [])
    .map((tag) => tag.name)
    .filter((tag): tag is string => parseSemver(tag) !== null);
  versions.sort((left, right) => compareVersions(right, left));
  return versions[0]?.replace(/^v/i, '') || null;
};

export async function getVersionInfo(): Promise<VersionInfo> {
  if (cachedVersionInfo && Date.now() < cacheExpiresAt) {
    return cachedVersionInfo;
  }

  const currentVersion = await readCurrentVersion();
  const latestVersion = await fetchLatestDockerHubVersion().catch(() => null);
  const updateAvailable =
    latestVersion !== null && compareVersions(latestVersion, currentVersion) > 0;

  cachedVersionInfo = {
    currentVersion,
    latestVersion,
    updateAvailable,
    releaseUrl: `https://github.com/${config.githubRepository}/releases`,
    dockerImage: `docker.io/${config.dockerHubRepository}`,
    checkedAt: new Date().toISOString(),
  };
  cacheExpiresAt = Date.now() + 60 * 60 * 1000;
  return cachedVersionInfo;
}
