import { createHash, randomUUID } from 'node:crypto';
import { config } from '../config.ts';
import { httpFetch } from '../http.ts';
import { dateInTimeZone } from '../time.ts';

export interface FitdaysCredentials {
  account: string;
  password: string;
  targetSuid?: number | null;
  syncDays: number | null;
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

export interface FitdaysProfile {
  suid: number;
  nickname: string;
  height: number | null;
  birthday: string | null;
  sex: number | null;
  isActive: boolean;
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

interface FitdaysUser {
  suid?: number;
  nickname?: string;
  height?: number;
  birthday?: string;
  sex?: number;
  is_deleted?: number;
}

interface FitdaysResponse {
  code?: number;
  msg?: string;
  data?: {
    token?: string;
    account?: { uid?: number; active_suid?: number; token?: string };
    users?: FitdaysUser[];
    devices?: unknown[];
    weight_list?: FitdaysRawRecord[];
  };
}

interface FitdaysSession {
  token: string;
  uid: number;
  activeSuid: number;
  users: FitdaysUser[];
  devices: unknown[];
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

const positiveOrNull = (value: unknown): number | null => {
  const parsed = finiteNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
};

const integerOrNull = (value: unknown): number | null => {
  const parsed = finiteNumber(value);
  return parsed === null ? null : Math.round(parsed);
};

const parseAdcList = (value: unknown): number[] | null => {
  const values = Array.isArray(value)
    ? value.map(Number)
    : typeof value === 'string'
      ? value.split(',').map((item) => Number(item.trim()))
      : [];
  return values.length === 10 && values.every((item) => Number.isFinite(item))
    ? values
    : null;
};

export const getFitdaysRecordQualityIssues = (record: FitdaysRecord): string[] => {
  const issues: string[] = [];
  if (record.weightKg === null || record.weightKg < 20 || record.weightKg > 350) {
    issues.push('体重缺失或超出合理范围');
  }
  if (
    record.bodyFatRate === null ||
    record.bodyFatRate < 1 ||
    record.bodyFatRate > 75
  ) {
    issues.push('体脂率缺失或超出合理范围');
  }
  if (
    record.skeletalMuscleRate === null ||
    record.skeletalMuscleRate < 5 ||
    record.skeletalMuscleRate > 80
  ) {
    issues.push('骨骼肌率缺失或超出合理范围');
  }
  if (
    record.waterRate === null ||
    record.waterRate < 10 ||
    record.waterRate > 80
  ) {
    issues.push('身体水分率缺失或超出合理范围');
  }
  if (record.bmrKcal === null || record.bmrKcal < 500 || record.bmrKcal > 5000) {
    issues.push('基础代谢缺失或超出合理范围');
  }

  const rawRecord =
    record.rawRecord && typeof record.rawRecord === 'object'
      ? (record.rawRecord as Record<string, unknown>)
      : {};
  const adc = parseAdcList(rawRecord.adc_list ?? rawRecord.adc);
  if (!adc || adc.some((value) => value <= 0)) {
    issues.push('十项电极阻抗数据不完整');
  }
  return issues;
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

async function loginFitdays(account: string, password: string): Promise<FitdaysSession> {
  const login = await fitdaysRequest('api/users/login', {
    email: account,
    password: hashPassword(password),
  });
  if (login.code !== 0 && login.code !== 200) {
    throw new Error(`Fitdays 登录失败: ${login.msg || login.code || '未知错误'}`);
  }

  const token = login.data?.token || login.data?.account?.token;
  const uid = login.data?.account?.uid;
  const activeSuid = login.data?.account?.active_suid;
  if (!token || !uid || !activeSuid) {
    throw new Error('Fitdays 登录响应缺少 token、uid 或档案 SUID。');
  }

  return {
    token,
    uid,
    activeSuid,
    users: login.data?.users || [],
    devices: login.data?.devices || [],
  };
}

export async function fetchFitdaysProfiles(credentials: {
  account: string;
  password: string;
}): Promise<{ profiles: FitdaysProfile[]; activeSuid: number }> {
  const session = await loginFitdays(credentials.account, credentials.password);
  const profiles = session.users
    .filter((user) => user.is_deleted !== 1 && Number(user.suid) > 0)
    .map((user) => ({
      suid: Number(user.suid),
      nickname: user.nickname?.trim() || `档案 ${user.suid}`,
      height: Number.isFinite(Number(user.height)) ? Number(user.height) : null,
      birthday: user.birthday || null,
      sex: Number.isFinite(Number(user.sex)) ? Number(user.sex) : null,
      isActive: Number(user.suid) === session.activeSuid,
    }))
    .sort((left, right) => {
      if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;
      return left.nickname.localeCompare(right.nickname, 'zh-CN');
    });

  if (profiles.length === 0) {
    throw new Error('Fitdays 账号下没有可用档案。');
  }
  return { profiles, activeSuid: session.activeSuid };
}

export async function fetchFitdaysRecords(
  credentials: FitdaysCredentials
): Promise<{
  records: FitdaysRecord[];
  activeSuid: number;
  users: FitdaysUser[];
  devices: unknown[];
}> {
  const session = await loginFitdays(credentials.account, credentials.password);
  const activeSuid = credentials.targetSuid || session.activeSuid;

  const now = Math.floor(Date.now() / 1000);
  const sync = await fitdaysRequest(
    'api/sync/syncFromServer',
    {
      end_time:
        credentials.syncDays === null ? 0 : now - credentials.syncDays * 86_400,
      start_time: now,
    },
    session.token,
    String(session.uid)
  );

  const activeUser = session.users.find(
    (user) => Number(user.suid) === activeSuid
  );
  const userHeight =
    activeUser?.height && Number(activeUser.height) > 0
      ? Number(activeUser.height)
      : null;

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
      const weight = positiveOrNull(record.weight_kg);
      const fatRate = positiveOrNull(record.bfr);
      const leanBodyMass =
        weight !== null && fatRate !== null && fatRate > 0
          ? Number((weight * (1 - fatRate / 100)).toFixed(3))
          : null;
      const bmi =
        positiveOrNull(record.bmi) ??
        (weight && userHeight
          ? Number((weight / ((userHeight / 100) ** 2)).toFixed(1))
          : null);

      return {
        externalId: `${activeSuid}:${record.measured_time}`,
        profileId: String(activeSuid),
        measuredAt: measuredAt.toISOString(),
        measuredDate: dateInTimeZone(measuredAt, config.timezone),
        weightKg: weight,
        bmi,
        bodyFatRate: fatRate,
        skeletalMuscleRate: positiveOrNull(record.rosm),
        muscleRate: positiveOrNull(record.rom),
        leanBodyMassKg: leanBodyMass,
        visceralFatLevel: positiveOrNull(record.uvi),
        waterRate: positiveOrNull(record.vwc),
        boneMassKg: positiveOrNull(record.bm),
        bmrKcal: positiveOrNull(record.bmr),
        subcutaneousFatRate: positiveOrNull(record.sfr),
        proteinRate: positiveOrNull(record.pp),
        bodyAge: positiveOrNull(record.bodyage) ? integerOrNull(record.bodyage) : null,
        heartRate: positiveOrNull(record.hr) ? integerOrNull(record.hr) : null,
        score: positiveOrNull(extension?.bodyScore),
        smi: positiveOrNull(extension?.smi),
        whr: positiveOrNull(extension?.whr),
        rawRecord: record,
      };
    });

  return {
    records,
    activeSuid,
    users: session.users,
    devices: session.devices,
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
