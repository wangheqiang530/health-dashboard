import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.ts';
import { httpFetch } from '../http.ts';
import { dateInTimeZone, timeInTimeZone } from '../time.ts';

const BASE_URL = 'https://prod.zh.igpsport.com/service';

export interface IgpsportCredentials {
  account: string;
  password: string;
  syncLimit: number;
}

export interface IgpsportRide {
  externalId: string;
  title: string;
  device: string;
  startedAt: string;
  endedAt: string | null;
  localDate: string;
  localStartTime: string;
  movingTimeSec: number | null;
  distanceKm: number | null;
  avgSpeedKmh: number | null;
  maxSpeedKmh: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  avgCadence: number | null;
  avgPower: number | null;
  maxPower: number | null;
  normalizedPower: number | null;
  tss: number | null;
  ascentM: number | null;
  calories: number | null;
  fitFilePath: string | null;
  fitFileName: string | null;
  fileSizeBytes: number;
  rawRecord: unknown;
}

interface LoginResponse {
  code?: number;
  message?: string;
  data?: { access_token?: string };
}

interface RideListResponse {
  code?: number;
  message?: string;
  data?: { rows?: Array<Record<string, unknown>>; totalRows?: number };
}

interface RideDetailResponse {
  code?: number;
  message?: string;
  data?: Record<string, unknown>;
}

const finiteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const integerOrNull = (value: unknown): number | null => {
  const parsed = finiteNumber(value);
  return parsed === null ? null : Math.round(parsed);
};

const stringValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' && value.trim() ? value : fallback;

async function requestJson<T>(
  url: string,
  init: Parameters<typeof httpFetch>[1],
  timeoutMs = 30_000
): Promise<T> {
  const response = await httpFetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) {
    throw new Error(`iGPSPORT HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function loginIgpsport(account: string, password: string): Promise<string> {
  const json = await requestJson<LoginResponse>(`${BASE_URL}/auth/account/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      Accept: 'application/json, text/plain, */*',
      Origin: 'https://login.passport.igpsport.cn',
      Referer: 'https://login.passport.igpsport.cn/',
    },
    body: JSON.stringify({ appId: 'igpsport-web', username: account, password }),
  });
  const token = json.data?.access_token;
  if (json.code !== 0 || !token) {
    throw new Error(`iGPSPORT 登录失败: ${json.message || json.code || '未知错误'}`);
  }
  return token;
}

export async function getRideList(
  token: string,
  limit: number
): Promise<{ rows: Array<Record<string, unknown>>; totalRows: number }> {
  let pageNo = 1;
  const allRows: Array<Record<string, unknown>> = [];
  let totalRows = 0;

  while (allRows.length < limit) {
    const json = await requestJson<RideListResponse>(
      `${BASE_URL}/web-gateway/web-analyze/activity/queryMyActivity?pageNo=${pageNo}&pageSize=20&reqType=0&sort=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      }
    );
    if (json.code !== 0) {
      throw new Error(`获取 iGPSPORT 活动列表失败: ${json.message || json.code}`);
    }
    const rows = json.data?.rows || [];
    totalRows = json.data?.totalRows || 0;
    if (rows.length === 0) break;
    allRows.push(...rows);
    if (allRows.length >= totalRows || rows.length < 20) break;
    pageNo += 1;
  }

  return { rows: allRows.slice(0, limit), totalRows };
}

async function getRideDetail(token: string, rideId: string): Promise<Record<string, unknown>> {
  const json = await requestJson<RideDetailResponse>(
    `${BASE_URL}/web-gateway/web-analyze/activity/queryActivityDetail/${rideId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    }
  );
  if (json.code !== 0 || !json.data) {
    throw new Error(`获取 iGPSPORT 活动详情失败 (${rideId}): ${json.message || json.code}`);
  }
  return json.data;
}

async function downloadFitFile(
  token: string,
  rideId: string,
  destination: string
): Promise<{ size: number; existed: boolean }> {
  try {
    const existing = await fs.stat(destination);
    return { size: existing.size, existed: true };
  } catch {
    // File does not exist yet.
  }

  const urlJson = await requestJson<{ data?: string }>(
    `${BASE_URL}/web-gateway/web-analyze/activity/getDownloadUrl/${rideId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    }
  );
  if (!urlJson.data) {
    throw new Error(`无法获取 iGPSPORT Ride ID ${rideId} 的 FIT 下载链接。`);
  }

  const response = await httpFetch(urlJson.data, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) {
    throw new Error(`下载 FIT 文件失败: HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, buffer);
  return { size: buffer.length, existed: false };
}

const toFitFileName = (startTime: string): string =>
  `${startTime.replace(/[^\d]/g, '-').replace(/-+$/g, '')}.fit`;

const parseIgpsportDate = (timeStr: string): Date => {
  const trimmed = timeStr.trim();
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    return new Date(trimmed.replace(' ', 'T') + '+08:00');
  }
  return new Date(trimmed);
};

export async function syncRecentRides(
  credentials: IgpsportCredentials
): Promise<{ rides: IgpsportRide[]; totalAccountRides: number; outputDirectory: string }> {
  const token = await loginIgpsport(credentials.account, credentials.password);
  const activityList = await getRideList(token, credentials.syncLimit);
  const outputDirectory = path.join(config.dataDir, 'archive', 'igpsport', 'fits');
  await fs.mkdir(outputDirectory, { recursive: true });

  const rides: IgpsportRide[] = [];
  for (const row of activityList.rows) {
    const rideId = String(row.rideId || '');
    if (!rideId) continue;

    const detail = await getRideDetail(token, rideId);
    const startTime = stringValue(detail.startTime, stringValue(row.startTime));
    if (!startTime) continue;
    const endTime = stringValue(detail.endTime) || null;
    const startDate = parseIgpsportDate(startTime);
    if (Number.isNaN(startDate.getTime())) {
      throw new Error(`iGPSPORT 活动 ${rideId} 的开始时间无效: ${startTime}`);
    }
    const parsedEndDate = endTime ? parseIgpsportDate(endTime) : null;

    const fitFileName = toFitFileName(startTime);
    const fitFilePath = path.join(outputDirectory, fitFileName);
    let fileSizeBytes = 0;
    let savedFitFilePath: string | null = fitFilePath;
    let savedFitFileName: string | null = fitFileName;
    try {
      const file = await downloadFitFile(token, rideId, fitFilePath);
      fileSizeBytes = file.size;
    } catch (fitError) {
      console.warn(`[igpsport] 下载 FIT 文件失败 (${rideId})，保留活动基础数据:`, fitError);
      savedFitFilePath = null;
      savedFitFileName = null;
    }
    const deviceInfo = detail.deviceInfo as Record<string, unknown> | undefined;

    rides.push({
      externalId: rideId,
      title: stringValue(detail.title, stringValue(row.title, '骑行活动')),
      device: stringValue(deviceInfo?.deviceName, stringValue(row.productName, 'iGPSPORT')),
      startedAt: startDate.toISOString(),
      endedAt: parsedEndDate && !Number.isNaN(parsedEndDate.getTime()) ? parsedEndDate.toISOString() : null,
      localDate: dateInTimeZone(startDate, config.timezone),
      localStartTime: timeInTimeZone(startDate, config.timezone),
      movingTimeSec: integerOrNull(detail.totalMovingTime),
      distanceKm:
        finiteNumber(detail.rideDistance) === null
          ? null
          : Number(((detail.rideDistance as number) / 1000).toFixed(3)),
      avgSpeedKmh:
        finiteNumber(detail.avgSpeed) === null
          ? null
          : Number(((detail.avgSpeed as number) * 3.6).toFixed(2)),
      maxSpeedKmh:
        finiteNumber(detail.maxSpeed) === null
          ? null
          : Number(((detail.maxSpeed as number) * 3.6).toFixed(2)),
      avgHeartRate: integerOrNull(detail.avgHrm),
      maxHeartRate: integerOrNull(detail.maxHrm),
      avgCadence: integerOrNull(detail.avgCad),
      avgPower: integerOrNull(detail.avgPower),
      maxPower: integerOrNull(detail.maxPower),
      normalizedPower: integerOrNull(detail.pwrNP),
      tss: finiteNumber(detail.pwrTSS),
      ascentM: finiteNumber(detail.totalAscent),
      calories: finiteNumber(detail.calorie),
      fitFilePath: savedFitFilePath,
      fitFileName: savedFitFileName,
      fileSizeBytes,
      rawRecord: detail,
    });
  }

  return { rides, totalAccountRides: activityList.totalRows, outputDirectory };
}

export async function testIgpsportConnection(
  credentials: IgpsportCredentials
): Promise<{ ok: true; message: string; details: Record<string, unknown> }> {
  const token = await loginIgpsport(credentials.account, credentials.password);
  const list = await getRideList(token, 1);
  const firstRide = list.rows[0];
  return {
    ok: true,
    message:
      list.totalRows > 0
        ? `iGPSPORT 登录成功，账号共有 ${list.totalRows} 次骑行，已读取最近活动。`
        : 'iGPSPORT 登录成功，账号暂无骑行记录。',
    details: {
      totalAccountRides: list.totalRows,
      latestRideTitle: firstRide?.title || null,
      latestRideStartTime: firstRide?.startTime || null,
    },
  };
}
