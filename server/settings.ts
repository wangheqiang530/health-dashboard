import { randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.ts';
import { decryptSecret, encryptSecret } from './crypto.ts';
import { pool } from './db.ts';

const HAE_KEY_SETTING = 'hae_api_key';
const DASHBOARD_ACCESS_TOKEN_SETTING = 'dashboard_access_token';
const ARCHIVE_RETENTION_SETTING = 'archive_retention_days';
let cachedHaeApiKey: string | null = null;
let cachedDashboardAccessToken: string | null = null;

const readEncryptedSetting = async (key: string): Promise<string | null> => {
  const result = await pool.query<{ encrypted_value: string }>(
    'SELECT encrypted_value FROM app_settings WHERE key = $1',
    [key]
  );
  return result.rows[0] ? decryptSecret(result.rows[0].encrypted_value) : null;
};

const writeEncryptedSetting = async (key: string, value: string): Promise<void> => {
  await pool.query(
    `INSERT INTO app_settings (key, encrypted_value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET
       encrypted_value = EXCLUDED.encrypted_value,
       updated_at = NOW()`,
    [key, encryptSecret(value)]
  );
};

export async function ensureHaeApiKey(): Promise<string> {
  if (cachedHaeApiKey) return cachedHaeApiKey;

  if (config.haeApiKey) {
    await pool.query(
      `INSERT INTO app_settings (key, encrypted_value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET
         encrypted_value = EXCLUDED.encrypted_value,
         updated_at = NOW()`,
      [HAE_KEY_SETTING, encryptSecret(config.haeApiKey)]
    );
    cachedHaeApiKey = config.haeApiKey;
    return cachedHaeApiKey;
  }

  const existing = await pool.query<{ encrypted_value: string }>(
    'SELECT encrypted_value FROM app_settings WHERE key = $1',
    [HAE_KEY_SETTING]
  );
  if (existing.rows[0]) {
    cachedHaeApiKey = decryptSecret(existing.rows[0].encrypted_value);
    return cachedHaeApiKey;
  }

  const generated = randomBytes(24).toString('hex');
  await pool.query(
    `INSERT INTO app_settings (key, encrypted_value, updated_at)
     VALUES ($1, $2, NOW())`,
    [HAE_KEY_SETTING, encryptSecret(generated)]
  );
  cachedHaeApiKey = generated;
  return cachedHaeApiKey;
}

export async function getHaeApiKey(): Promise<string> {
  return ensureHaeApiKey();
}

const writeDashboardAccessTokenFile = async (token: string): Promise<void> => {
  const tokenPath = path.join(config.dataDir, 'dashboard-access-token.txt');
  await fs.mkdir(path.dirname(tokenPath), { recursive: true });
  await fs.writeFile(tokenPath, `${token}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.chmod(tokenPath, 0o600);
};

export async function ensureDashboardAccessToken(): Promise<string> {
  if (cachedDashboardAccessToken) return cachedDashboardAccessToken;

  if (config.dashboardAccessToken) {
    await pool.query(
      `INSERT INTO app_settings (key, encrypted_value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET
         encrypted_value = EXCLUDED.encrypted_value,
         updated_at = NOW()`,
      [DASHBOARD_ACCESS_TOKEN_SETTING, encryptSecret(config.dashboardAccessToken)]
    );
    cachedDashboardAccessToken = config.dashboardAccessToken;
    await writeDashboardAccessTokenFile(cachedDashboardAccessToken);
    return cachedDashboardAccessToken;
  }

  const existing = await pool.query<{ encrypted_value: string }>(
    'SELECT encrypted_value FROM app_settings WHERE key = $1',
    [DASHBOARD_ACCESS_TOKEN_SETTING]
  );
  if (existing.rows[0]) {
    cachedDashboardAccessToken = decryptSecret(existing.rows[0].encrypted_value);
    await writeDashboardAccessTokenFile(cachedDashboardAccessToken);
    return cachedDashboardAccessToken;
  }

  const generated = randomBytes(24).toString('hex');
  await pool.query(
    `INSERT INTO app_settings (key, encrypted_value, updated_at)
     VALUES ($1, $2, NOW())`,
    [DASHBOARD_ACCESS_TOKEN_SETTING, encryptSecret(generated)]
  );
  cachedDashboardAccessToken = generated;
  await writeDashboardAccessTokenFile(generated);
  return cachedDashboardAccessToken;
}

export async function getArchiveRetentionDays(): Promise<number> {
  const saved = await readEncryptedSetting(ARCHIVE_RETENTION_SETTING);
  const parsed = Number(saved);
  if (Number.isFinite(parsed) && parsed >= 1) {
    return Math.min(Math.floor(parsed), 3650);
  }
  return config.archiveRetentionDays;
}

export async function setArchiveRetentionDays(days: number): Promise<number> {
  const normalized = Math.min(Math.max(Math.floor(days), 1), 3650);
  await writeEncryptedSetting(ARCHIVE_RETENTION_SETTING, String(normalized));
  return normalized;
}

export function secureCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
