import {
  randomBytes,
  randomUUID,
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
const PASSWORD_RECOVERY_FILENAME = 'dashboard-password.txt';
let haeApiKeysInitialized = false;
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

const DEFAULT_SESSION_DURATION: DashboardSessionDuration = '1d';

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

interface HaeApiKeyRow {
  id: string;
  device_name: string;
  encrypted_key: string;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
  last_used_at: Date | null;
  last_source_ip: string | null;
}

export interface HaeApiKeyRecord {
  id: string;
  deviceName: string;
  key: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  lastSourceIp: string | null;
}

const HAE_API_KEY_SELECT = `SELECT
  id::text,
  device_name,
  encrypted_key,
  enabled,
  created_at,
  updated_at,
  last_used_at,
  last_source_ip
FROM hae_api_keys`;

const toHaeApiKeyRecord = (row: HaeApiKeyRow): HaeApiKeyRecord => ({
  id: row.id,
  deviceName: row.device_name,
  key: decryptSecret(row.encrypted_key),
  enabled: row.enabled,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  lastUsedAt: row.last_used_at?.toISOString() || null,
  lastSourceIp: row.last_source_ip,
});

const ensureHaeApiKeyTable = async (): Promise<void> => {
  if (haeApiKeysInitialized) return;

  const count = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM hae_api_keys'
  );
  if (Number(count.rows[0]?.count || 0) > 0) {
    haeApiKeysInitialized = true;
    return;
  }

  let legacyKey = config.haeApiKey;
  if (!legacyKey) {
    const existing = await pool.query<{ encrypted_value: string }>(
      'SELECT encrypted_value FROM app_settings WHERE key = $1',
      [HAE_KEY_SETTING]
    );
    if (existing.rows[0]) {
      legacyKey = decryptSecret(existing.rows[0].encrypted_value);
    }
  }
  if (!legacyKey) {
    legacyKey = randomBytes(24).toString('hex');
  }

  const encryptedKey = encryptSecret(legacyKey);
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO hae_api_keys (id, device_name, encrypted_key, enabled)
     SELECT $1, $2, $3, TRUE
     WHERE NOT EXISTS (SELECT 1 FROM hae_api_keys)
     RETURNING id`,
    [randomUUID(), '默认设备', encryptedKey]
  );

  if (inserted.rows[0]) {
    await pool.query(
      `INSERT INTO app_settings (key, encrypted_value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET
         encrypted_value = EXCLUDED.encrypted_value,
         updated_at = NOW()`,
      [HAE_KEY_SETTING, encryptedKey]
    );
  }

  haeApiKeysInitialized = true;
};

export async function ensureHaeApiKey(): Promise<string> {
  await ensureHaeApiKeyTable();
  const enabled = await pool.query<HaeApiKeyRow>(
    `${HAE_API_KEY_SELECT}
     WHERE enabled = TRUE
     ORDER BY created_at ASC, id ASC
     LIMIT 1`
  );
  const fallback =
    enabled.rows[0] ||
    (
      await pool.query<HaeApiKeyRow>(
        `${HAE_API_KEY_SELECT}
         ORDER BY created_at ASC, id ASC
         LIMIT 1`
      )
    ).rows[0];
  return fallback ? decryptSecret(fallback.encrypted_key) : '';
}

export async function getHaeApiKey(): Promise<string> {
  return ensureHaeApiKey();
}

export async function listHaeApiKeys(): Promise<HaeApiKeyRecord[]> {
  await ensureHaeApiKeyTable();
  const result = await pool.query<HaeApiKeyRow>(
    `${HAE_API_KEY_SELECT}
     ORDER BY created_at ASC, id ASC`
  );
  return result.rows.map(toHaeApiKeyRecord);
}

export async function createHaeApiKey(deviceName: string): Promise<HaeApiKeyRecord> {
  await ensureHaeApiKeyTable();
  const normalizedName = deviceName.trim() || '未命名设备';
  const key = randomBytes(24).toString('hex');
  const result = await pool.query<HaeApiKeyRow>(
    `INSERT INTO hae_api_keys (id, device_name, encrypted_key, enabled)
     VALUES ($1, $2, $3, TRUE)
     RETURNING
       id::text,
       device_name,
       encrypted_key,
       enabled,
       created_at,
       updated_at,
       last_used_at,
       last_source_ip`,
    [randomUUID(), normalizedName, encryptSecret(key)]
  );
  return toHaeApiKeyRecord(result.rows[0]);
}

export async function updateHaeApiKey(
  id: string,
  updates: { deviceName?: string; enabled?: boolean }
): Promise<HaeApiKeyRecord | null> {
  await ensureHaeApiKeyTable();
  const result = await pool.query<HaeApiKeyRow>(
    `UPDATE hae_api_keys
     SET
       device_name = COALESCE($2, device_name),
       enabled = COALESCE($3, enabled),
       updated_at = NOW()
     WHERE id = $1::uuid
     RETURNING
       id::text,
       device_name,
       encrypted_key,
       enabled,
       created_at,
       updated_at,
       last_used_at,
       last_source_ip`,
    [
      id,
      updates.deviceName === undefined ? null : updates.deviceName.trim() || '未命名设备',
      updates.enabled === undefined ? null : updates.enabled,
    ]
  );
  return result.rows[0] ? toHaeApiKeyRecord(result.rows[0]) : null;
}

export async function deleteHaeApiKey(
  id: string
): Promise<{ id: string; deviceName: string } | null> {
  await ensureHaeApiKeyTable();
  const result = await pool.query<{ id: string; device_name: string }>(
    `DELETE FROM hae_api_keys
     WHERE id = $1::uuid
     RETURNING id::text, device_name`,
    [id]
  );
  const row = result.rows[0];
  return row ? { id: row.id, deviceName: row.device_name } : null;
}

export async function authenticateHaeApiKey(
  providedKey: string,
  sourceIp: string | null
): Promise<{ id: string; deviceName: string } | null> {
  await ensureHaeApiKeyTable();
  const result = await pool.query<HaeApiKeyRow>(
    `${HAE_API_KEY_SELECT}
     WHERE enabled = TRUE
     ORDER BY created_at ASC, id ASC`
  );

  let matched: HaeApiKeyRow | null = null;
  for (const row of result.rows) {
    const candidate = decryptSecret(row.encrypted_key);
    if (secureCompare(providedKey, candidate)) {
      matched = row;
    }
  }
  if (!matched) return null;

  await pool.query(
    `UPDATE hae_api_keys
     SET last_used_at = NOW(), last_source_ip = $2, updated_at = NOW()
     WHERE id = $1::uuid`,
    [matched.id, sourceIp]
  );
  return { id: matched.id, deviceName: matched.device_name };
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

const passwordRecoveryPath = (): string =>
  path.join(config.dataDir, PASSWORD_RECOVERY_FILENAME);

const writePasswordFile = async (filePath: string, password: string): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${password}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.chmod(filePath, 0o600);
};

const writePasswordRecoveryFile = async (password: string): Promise<void> =>
  writePasswordFile(passwordRecoveryPath(), password);

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

export async function getDashboardPasswordRecoveryPath(): Promise<string | null> {
  try {
    await fs.access(passwordRecoveryPath());
    return passwordRecoveryPath();
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
    try {
      await fs.access(passwordRecoveryPath());
    } catch {
      try {
        const initialPassword = (await fs.readFile(initialPasswordPath(), 'utf8')).trim();
        if (initialPassword) {
          await writePasswordRecoveryFile(initialPassword);
        }
      } catch {
        // Existing custom passwords created before v0.0.11 cannot be recovered.
      }
    }
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

  await writePasswordRecoveryFile(initialPassword);
  if (!config.dashboardPassword) {
    await writePasswordFile(initialPasswordPath(), initialPassword);
  } else {
    await removeInitialPasswordFile();
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
  await writePasswordRecoveryFile(password);
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
  if (Number.isFinite(parsed) && parsed >= 0) {
    return Math.min(Math.floor(parsed), 3650);
  }
  return config.archiveRetentionDays;
}

export async function setArchiveRetentionDays(days: number): Promise<number> {
  const normalized = Math.min(Math.max(Math.floor(days), 0), 3650);
  await writeEncryptedSetting(ARCHIVE_RETENTION_SETTING, String(normalized));
  return normalized;
}

export function secureCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
