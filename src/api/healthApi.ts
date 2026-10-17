import type { AutoExportSyncInfo, DailySummary } from '../types/health';

export interface DataSourceConfig {
  id: 'hae' | 'fitdays' | 'igpsport';
  displayName: string;
  enabled: boolean;
  account: string;
  passwordConfigured: boolean;
  cronExpression: string;
  targetSuid: number | null;
  syncDays: number;
  syncLimit: number;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  running: boolean;
  nextRunAt: string | null;
}

export interface SyncRun {
  id: string;
  sourceId: 'fitdays' | 'igpsport';
  triggerType: 'manual' | 'cron';
  status: 'running' | 'success' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  recordsCount: number;
  message: string | null;
  details: Record<string, unknown>;
}

export interface BackendConfig {
  sources: DataSourceConfig[];
  hae: {
    endpoint: string;
    apiKey: string;
  };
  database: {
    connected: boolean;
    dailySummaries: number;
    metricPoints: number;
    workouts: number;
    bodyMeasurements: number;
    cyclingActivities: number;
  };
  storage: {
    retentionDays: number;
    archiveCount: number;
    archiveSizeBytes: number;
    totalArchiveCount: number;
    archives: ArchiveItem[];
  };
  recentRuns: SyncRun[];
  timezone: string;
}

export interface ArchiveItem {
  id: string;
  sourceId: 'hae' | 'fitdays' | 'igpsport';
  archiveKind: string;
  relativePath: string;
  capturedAt: string;
  sizeBytes: number;
  recordCount: number;
  deletedAt: string | null;
}

export interface SourceTestResult {
  ok: boolean;
  message: string;
  details: Record<string, unknown>;
}

export interface VersionInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string;
  dockerImage: string;
  checkedAt: string;
}

export interface DashboardResponse {
  days: Record<string, DailySummary>;
  dates: string[];
  selectedDate: string | null;
  syncInfo: AutoExportSyncInfo;
}

export interface SourceUpdatePayload {
  account: string;
  password?: string;
  cronExpression: string;
  enabled: boolean;
  targetSuid?: number | null;
  syncDays?: number;
  syncLimit?: number;
}

const parseResponse = async <T>(response: Response): Promise<T> => {
  const body = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) {
    throw new Error(body.error || `请求失败 (HTTP ${response.status})`);
  }
  return body;
};

export async function fetchDashboard(): Promise<DashboardResponse> {
  const response = await fetch('/api/v1/dashboard', {
    headers: { Accept: 'application/json' },
  });
  return parseResponse<DashboardResponse>(response);
}

export async function fetchBackendConfig(): Promise<BackendConfig> {
  const response = await fetch('/api/v1/config', {
    headers: { Accept: 'application/json' },
  });
  return parseResponse<BackendConfig>(response);
}

export async function updateDataSource(
  sourceId: 'fitdays' | 'igpsport',
  payload: SourceUpdatePayload
): Promise<{ source: DataSourceConfig }> {
  const response = await fetch(`/api/v1/config/sources/${sourceId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return parseResponse<{ source: DataSourceConfig }>(response);
}

export async function triggerSourceSync(
  sourceId: 'fitdays' | 'igpsport'
): Promise<{ runId: string; status: 'running' }> {
  const response = await fetch(`/api/v1/config/sources/${sourceId}/sync`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  return parseResponse<{ runId: string; status: 'running' }>(response);
}

export async function testDataSource(
  sourceId: 'hae' | 'fitdays' | 'igpsport'
): Promise<SourceTestResult> {
  const response = await fetch(`/api/v1/config/sources/${sourceId}/test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: '{}',
  });
  return parseResponse<SourceTestResult>(response);
}

export async function updateArchiveRetention(retentionDays: number): Promise<{
  retentionDays: number;
  storage: BackendConfig['storage'];
}> {
  const response = await fetch('/api/v1/config/storage', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ retentionDays }),
  });
  return parseResponse(response);
}

export async function fetchVersionInfo(): Promise<VersionInfo> {
  const response = await fetch('/api/v1/version', {
    headers: { Accept: 'application/json' },
  });
  return parseResponse<VersionInfo>(response);
}

export async function importHaePayload(payload: unknown): Promise<{
  ok: true;
  importId: string;
  dateFrom: string;
  dateTo: string;
  metricCount: number;
  workoutCount: number;
  dailySummaryCount: number;
  archivePath: string;
}> {
  const config = await fetchBackendConfig();
  const response = await fetch('/api/v1/health-auto-export', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': config.hae.apiKey,
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}
