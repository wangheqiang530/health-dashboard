import { createHash, randomUUID } from 'node:crypto';
import { config } from '../config.ts';
import { httpFetch } from '../http.ts';
import { dateInTimeZone } from '../time.ts';

export interface FitdaysCredentials {
  account: string;
  password: string;
  targetSuid?: number | null;
  syncDays: number;
}

export interface FitdaysRecord {
  externalId: string;
  profileId: string;
  measuredAt: string;
  measuredDate: string;
  weightKg: number | null;
  bmi: number | null;
  bodyFatRate: number | null;
  skeletalMuscleRate: number | null;
  muscleRate: number | null;
  leanBodyMassKg: number | null;
  visceralFatLevel: number | null;
  waterRate: number | null;
  boneMassKg: number | null;
  bmrKcal: number | null;
  subcutaneousFatRate: number | null;
  proteinRate: number | null;
  bodyAge: number | null;
  heartRate: number | null;
  score: number | null;
  smi: number | null;
  whr: number | null;
  rawRecord: unknown;
}

interface FitdaysRawRecord {
  suid?: number;
  measured_time: number;
  weight_kg?: number;
  bmi?: number;
  bfr?: number;
  rosm?: number;
  rom?: number;
  uvi?: number;
  vwc?: number;
  bm?: number;
  bmr?: number;
  sfr?: number;
  pp?: number;
  bodyage?: number;
  hr?: number;
  ext_data?: string;
  [key: string]: unknown;
}

interface FitdaysResponse {
  code?: number;
  msg?: string;
  data?: {
    token?: string;
    account?: { uid?: number; active_suid?: number; token?: string };
    users?: unknown[];
    devices?: unknown[];
    weight_list?: FitdaysRawRecord[];
  };
}

const md5Hex = (input: string): string => createHash('md5').update(input, 'utf8').digest('hex');
const hashPassword = (plaintext: string): string =>
  md5Hex(md5Hex(`${plaintext}hx`).toUpperCase()).toUpperCase();
const newClientId = (): string => md5Hex(randomUUID()).toUpperCase();
const newRequestId = (): string => md5Hex(randomUUID());

const javaUrlEncode = (value: string): string =>
  encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(/[!'()~]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);

const buildSign = (params: Record<string, string>): string => {
  const raw = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return md5Hex(javaUrlEncode(`${raw}hxsign`));
};

const finiteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const integerOrNull = (value: unknown): number | null => {
  const parsed = finiteNumber(value);
  return parsed === null ? null : Math.round(parsed);
};

async function fitdaysRequest(
  path: string,
  body: unknown,
  token = '',
  uid = '0'
): Promise<FitdaysResponse> {
  const signParams: Record<string, string> = {
    app_ver: '1.21.0',
    client_id: newClientId(),
    country: 'CN',
    device_model: 'AndroidSDKbuiltforarm64-6.0',
    language: 'zh',
    os_type: '0',
    request_id: newRequestId(),
    source: '0',
    timestamp: String(Math.floor(Date.now() / 1000)),
    token,
    uid,
  };
  const query = new URLSearchParams({ ...signParams, sign: buildSign(signParams), capp_ver: '1.21.0' });
  const response = await httpFetch(`https://online.fitdays.cn/${path.replace(/^\//, '')}?${query}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json;charset=UTF-8',
      'user-agent': 'okhttp/4.9.3',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Fitdays HTTP ${response.status}`);
  }
  return (await response.json()) as FitdaysResponse;
}

export async function fetchFitdaysRecords(
  credentials: FitdaysCredentials
): Promise<{ records: FitdaysRecord[]; activeSuid: number; users: unknown[]; devices: unknown[] }> {
  const login = await fitdaysRequest('api/users/login', {
    email: credentials.account,
    password: hashPassword(credentials.password),
  });
  if (login.code !== 0 && login.code !== 200) {
    throw new Error(`Fitdays 登录失败: ${login.msg || login.code || '未知错误'}`);
  }

  const token = login.data?.token || login.data?.account?.token;
  const uid = login.data?.account?.uid;
  const activeSuid = credentials.targetSuid || login.data?.account?.active_suid;
  if (!token || !uid || !activeSuid) {
    throw new Error('Fitdays 登录响应缺少 token、uid 或档案 SUID。');
  }

  const now = Math.floor(Date.now() / 1000);
  const sync = await fitdaysRequest(
    'api/sync/syncFromServer',
    {
      end_time: now - credentials.syncDays * 86_400,
      start_time: now,
    },
    token,
    String(uid)
  );

  const records = (sync.data?.weight_list || [])
    .filter((record) => record.suid === activeSuid && record.is_deleted !== 1)
    .sort((left, right) => right.measured_time - left.measured_time)
    .map((record): FitdaysRecord => {
      let extension: Record<string, unknown> | null = null;
      if (typeof record.ext_data === 'string') {
        try {
          extension = JSON.parse(record.ext_data) as Record<string, unknown>;
        } catch {
          extension = null;
        }
      }

      const measuredAt = new Date(record.measured_time * 1000);
      const weight = finiteNumber(record.weight_kg);
      const fatRate = finiteNumber(record.bfr);
      const leanBodyMass =
        weight !== null && fatRate !== null
          ? Number((weight * (1 - fatRate / 100)).toFixed(3))
          : null;

      return {
        externalId: `${activeSuid}:${record.measured_time}`,
        profileId: String(activeSuid),
        measuredAt: measuredAt.toISOString(),
        measuredDate: dateInTimeZone(measuredAt, config.timezone),
        weightKg: weight,
        bmi: finiteNumber(record.bmi),
        bodyFatRate: fatRate,
        skeletalMuscleRate: finiteNumber(record.rosm),
        muscleRate: finiteNumber(record.rom),
        leanBodyMassKg: leanBodyMass,
        visceralFatLevel: finiteNumber(record.uvi),
        waterRate: finiteNumber(record.vwc),
        boneMassKg: finiteNumber(record.bm),
        bmrKcal: finiteNumber(record.bmr),
        subcutaneousFatRate: finiteNumber(record.sfr),
        proteinRate: finiteNumber(record.pp),
        bodyAge: integerOrNull(record.bodyage),
        heartRate: integerOrNull(record.hr),
        score: finiteNumber(extension?.bodyScore),
        smi: finiteNumber(extension?.smi),
        whr: finiteNumber(extension?.whr),
        rawRecord: record,
      };
    });

  return {
    records,
    activeSuid,
    users: login.data?.users || [],
    devices: login.data?.devices || [],
  };
}

export async function testFitdaysConnection(
  credentials: FitdaysCredentials
): Promise<{ ok: true; message: string; details: Record<string, unknown> }> {
  const result = await fetchFitdaysRecords({
    ...credentials,
    syncDays: 1,
  });
  return {
    ok: true,
    message: `Fitdays 登录成功，最近一天读取到 ${result.records.length} 条体测记录。`,
    details: {
      activeSuid: result.activeSuid,
      profileCount: result.users.length,
      deviceCount: result.devices.length,
      recentRecordCount: result.records.length,
    },
  };
}
