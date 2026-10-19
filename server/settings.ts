import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { config } from './config.ts';
import { decryptSecret, encryptSecret } from './crypto.ts';
import { pool } from './db.ts';

const HAE_KEY_SETTING = 'hae_api_key';
const DASHBOARD_PASSWORD_HASH_SETTING = 'dashboard_password_hash';
const DASHBOARD_SESSION_DURATION_SETTING = 'dashboard_session_duration';
const ARCHIVE_RETENTION_SETTING = 'archive_retention_days';
const INITIAL_PASSWORD_FILENAME = 'dashboard-initial-password.txt';
let cachedHaeApiKey: string | null = null;
let cachedDashboardPasswordHash: string | null = null;

export type DashboardSessionDuration = 'session' | '1h' | '1d' | '7d' | '30d' | '365d';

export const DASHBOARD_SESSION_DURATIONS: ReadonlyArray<{
  value: DashboardSessionDuration;
  label: string;
  description: string;
}> = [
  { value: 'session', label: '本次会话', description: '关闭浏览器后失效' },
  { value: '1h', label: '1 小时', description: '1 小时后需要重新登录' },
  { value: '1d', label: '1 天', description: '24 小时内免密访问' },
  { value: '7d', label: '7 天', description: '一周内免密访问' },
  { value: '30d', label: '1 个月', description: '30 天内免密访问（推荐）' },
  { value: '365d', label: '1 年', description: '仅建议在完全可信的设备上使用' },
];

const DEFAULT_SESSION_DURATION: DashboardSessionDuration = '30d';

const scrypt = promisify(scryptCallback);
const PASSWORD_SCHEME = 'scrypt-v1';

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

const generateInitialPassword = (): string => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(24);
  const characters = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]);
  return `${characters.slice(0, 6).join('')}-${characters.slice(6, 12).join('')}-${characters
    .slice(12, 18)
    .join('')}-${characters.slice(18, 24).join('')}`;
};

const hashDashboardPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${PASSWORD_SCHEME}$${salt.toString('base64')}$${derived.toString('base64')}`;
};

const verifyDashboardPasswordHash = async (
  password: string,
  storedHash: string
): Promise<boolean> => {
  const [scheme, saltValue, hashValue] = storedHash.split('$');
  if (scheme !== PASSWORD_SCHEME || !saltValue || !hashValue) return false;
  const expected = Buffer.from(hashValue, 'base64');
  const actual = (await scrypt(password, Buffer.from(saltValue, 'base64'), expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

const initialPasswordPath = (): string =>
  path.join(config.dataDir, INITIAL_PASSWORD_FILENAME);

const writeInitialPasswordFile = async (password: string): Promise<void> => {
  const passwordPath = initialPasswordPath();
  await fs.mkdir(path.dirname(passwordPath), { recursive: true });
  await fs.writeFile(passwordPath, `${password}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.chmod(passwordPath, 0o600);
};

const removeInitialPasswordFile = async (): Promise<void> => {
  try {
    await fs.unlink(initialPasswordPath());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
};

export async function getDashboardInitialPasswordPath(): Promise<string | null> {
  try {
    await fs.access(initialPasswordPath());
    return initialPasswordPath();
  } catch {
    return null;
  }
}

export async function ensureDashboardPassword(): Promise<void> {
  if (cachedDashboardPasswordHash) return;

  const existing = await pool.query<{ encrypted_value: string }>(
    'SELECT encrypted_value FROM app_settings WHERE key = $1',
    [DASHBOARD_PASSWORD_HASH_SETTING]
  );
  if (existing.rows[0]) {
    cachedDashboardPasswordHash = decryptSecret(existing.rows[0].encrypted_value);
    return;
  }

  const initialPassword = config.dashboardPassword || generateInitialPassword();
  const passwordHash = await hashDashboardPassword(initialPassword);
  await pool.query(
    `INSERT INTO app_settings (key, encrypted_value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET
       encrypted_value = EXCLUDED.encrypted_value,
       updated_at = NOW()`,
    [DASHBOARD_PASSWORD_HASH_SETTING, encryptSecret(passwordHash)]
  );
  cachedDashboardPasswordHash = passwordHash;

  if (config.dashboardPassword) {
    await removeInitialPasswordFile();
  } else {
    await writeInitialPasswordFile(initialPassword);
  }
}

export async function verifyDashboardPassword(password: string): Promise<boolean> {
  await ensureDashboardPassword();
  if (!cachedDashboardPasswordHash) return false;
  return verifyDashboardPasswordHash(password, cachedDashboardPasswordHash);
}

export async function setDashboardPassword(password: string): Promise<void> {
  const passwordHash = await hashDashboardPassword(password);
  await writeEncryptedSetting(DASHBOARD_PASSWORD_HASH_SETTING, passwordHash);
  cachedDashboardPasswordHash = passwordHash;
  await removeInitialPasswordFile();
}

export function isDashboardSessionDuration(
  value: unknown
): value is DashboardSessionDuration {
  return DASHBOARD_SESSION_DURATIONS.some((option) => option.value === value);
}

export async function getDashboardSessionDuration(): Promise<DashboardSessionDuration> {
  const saved = await readEncryptedSetting(DASHBOARD_SESSION_DURATION_SETTING);
  return isDashboardSessionDuration(saved) ? saved : DEFAULT_SESSION_DURATION;
}

export async function setDashboardSessionDuration(
  duration: DashboardSessionDuration
): Promise<DashboardSessionDuration> {
  await writeEncryptedSetting(DASHBOARD_SESSION_DURATION_SETTING, duration);
  return duration;
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
