import type { AutoExportSyncInfo, BodyMeasurement, DailySummary } from '../types/health';

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
  coverage: {
    dailySummaries: DataCoverage;
    bodyMeasurements: DataCoverage;
    cyclingActivities: DataCoverage;
    healthWorkouts: DataCoverage;
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

export interface DataCoverage {
  count: number;
  earliest: string | null;
  latest: string | null;
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
  };
  backendStatus: 'healthy' | 'degraded';
}

export interface VersionInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string;
  repoUrl?: string;
  dockerImage: string;
  checkedAt: string;
  system?: SystemStatus;
}

export interface DashboardResponse {
  days: Record<string, DailySummary>;
  dates: string[];
  selectedDate: string | null;
  syncInfo: AutoExportSyncInfo;
}

export type DashboardSessionDuration = 'session' | '1h' | '1d' | '7d' | '30d' | '365d';

export interface DashboardSessionOption {
  value: DashboardSessionDuration;
  label: string;
  description: string;
}

export interface AuthStatus {
  authenticated: boolean;
  expiresAt: string | null;
  sessionDuration: DashboardSessionDuration | null;
  defaultSessionDuration: DashboardSessionDuration;
  passwordRecoveryFile: string | null;
  sessionDurations: DashboardSessionOption[];
}

export interface AuthSettings {
  defaultSessionDuration: DashboardSessionDuration;
  passwordRecoveryFile: string | null;
  sessionDurations: DashboardSessionOption[];
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

const apiFetch = (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
  return fetch(input, {
    credentials: 'same-origin',
    ...init,
    headers: new Headers(init.headers),
  }).then((response) => {
    if (response.status === 401) {
      window.dispatchEvent(new Event('health-dashboard:unauthorized'));
    }
    return response;
  });
};

export async function fetchAuthStatus(): Promise<AuthStatus> {
  const response = await fetch('/api/v1/auth/status', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  return parseResponse<AuthStatus>(response);
}

export async function loginDashboard(
  password: string,
  duration?: DashboardSessionDuration
): Promise<{ ok: true; expiresAt: string; duration: DashboardSessionDuration }> {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ password, duration }),
  });
  return parseResponse(response);
}

export async function logoutDashboard(): Promise<void> {
  await fetch('/api/v1/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  }).catch(() => undefined);
}

export async function fetchAuthSettings(): Promise<AuthSettings> {
  const response = await apiFetch('/api/v1/auth/settings', {
    headers: { Accept: 'application/json' },
  });
  return parseResponse<AuthSettings>(response);
}

export async function changeDashboardPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: true; message: string }> {
  const response = await apiFetch('/api/v1/auth/password', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return parseResponse(response);
}

export async function updateDashboardSessionDuration(
  duration: DashboardSessionDuration
): Promise<{ ok: true; defaultSessionDuration: DashboardSessionDuration }> {
  const response = await apiFetch('/api/v1/auth/session-duration', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ duration }),
  });
  return parseResponse(response);
}

const parseResponse = async <T>(response: Response): Promise<T> => {
  const body = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('UNAUTHORIZED');
    }
    throw new Error(body.error || `请求失败 (HTTP ${response.status})`);
  }
  return body;
};

export async function fetchDashboard(): Promise<DashboardResponse> {
  const response = await apiFetch('/api/v1/dashboard', {
    headers: { Accept: 'application/json' },
  });
  return parseResponse<DashboardResponse>(response);
}

export async function fetchBodyMeasurements(): Promise<{ measurements: BodyMeasurement[] }> {
  const response = await apiFetch('/api/v1/body/measurements', {
    headers: { Accept: 'application/json' },
  });
  return parseResponse<{ measurements: BodyMeasurement[] }>(response);
}

export async function fetchWorkouts(options: {
  from?: string;
  to?: string;
  limit?: number;
} = {}): Promise<{ workouts: DailySummary['workouts']; total: number; from: string | null; to: string | null }> {
  const query = new URLSearchParams();
  if (options.from) query.set('from', options.from);
  if (options.to) query.set('to', options.to);
  if (options.limit) query.set('limit', String(options.limit));
  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  const response = await apiFetch(`/api/v1/workouts${suffix}`, {
    headers: { Accept: 'application/json' },
  });
  return parseResponse(response);
}

export async function fetchBackendConfig(): Promise<BackendConfig> {
  const response = await apiFetch('/api/v1/config', {
    headers: { Accept: 'application/json' },
  });
  return parseResponse<BackendConfig>(response);
}

export async function updateDataSource(
  sourceId: 'fitdays' | 'igpsport',
  payload: SourceUpdatePayload
): Promise<{ source: DataSourceConfig }> {
  const response = await apiFetch(`/api/v1/config/sources/${sourceId}`, {
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
  sourceId: 'fitdays' | 'igpsport',
  full = false
): Promise<{ runId: string; status: 'running' }> {
  const response = await apiFetch(`/api/v1/config/sources/${sourceId}/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ full }),
  });
  return parseResponse<{ runId: string; status: 'running' }>(response);
}

export async function fetchSourceRuns(
  sourceId: 'fitdays' | 'igpsport'
): Promise<{ runs: SyncRun[] }> {
  const response = await apiFetch(`/api/v1/config/sources/${sourceId}/runs`, {
    headers: { Accept: 'application/json' },
  });
  return parseResponse(response);
}

export async function triggerSyncAllDevices(): Promise<{
  syncedSources: Array<'fitdays' | 'igpsport'>;
  errors: string[];
}> {
  const config = await fetchBackendConfig().catch(() => null);
  const syncedSources: Array<'fitdays' | 'igpsport'> = [];
  const errors: string[] = [];

  const sourcesToSync: Array<'fitdays' | 'igpsport'> = [];
  const fitdays = config?.sources.find((s) => s.id === 'fitdays');
  if (fitdays && (fitdays.passwordConfigured || fitdays.enabled)) {
    sourcesToSync.push('fitdays');
  }
  const igp = config?.sources.find((s) => s.id === 'igpsport');
  if (igp && (igp.passwordConfigured || igp.enabled)) {
    sourcesToSync.push('igpsport');
  }

  // If neither has configured credentials yet, try triggering both or return informative note
  const targets = sourcesToSync.length > 0 ? sourcesToSync : (['fitdays', 'igpsport'] as const);

  for (const src of targets) {
    try {
      await triggerSourceSync(src, false);
      syncedSources.push(src);
    } catch (err) {
      errors.push(`${src}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { syncedSources, errors };
}

export async function testDataSource(
  sourceId: 'hae' | 'fitdays' | 'igpsport'
): Promise<SourceTestResult> {
  const response = await apiFetch(`/api/v1/config/sources/${sourceId}/test`, {
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
  const response = await apiFetch('/api/v1/config/storage', {
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
  const response = await apiFetch('/api/v1/version', {
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
  const response = await apiFetch('/api/v1/health-auto-export', {
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

export async function importAppleHealthZip(file: File): Promise<{
  ok: true;
  importedDays: number;
  earliestDate: string;
  latestDate: string;
  totalWorkouts: number;
  archivePath: string;
  archiveSizeBytes: number;
}> {
  const formData = new FormData();
  formData.append('file', file, file.name);

  const response = await apiFetch('/api/v1/config/import/apple-health-zip', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    body: formData,
  });
  return parseResponse(response);
}

export async function deleteArchiveFile(archiveId: string): Promise<{ ok: true; deletedArchiveId: string }> {
  const response = await apiFetch(`/api/v1/config/archives/${archiveId}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });
  return parseResponse(response);
}

export async function downloadArchiveFile(
  archiveId: string
): Promise<{ blob: Blob; filename: string }> {
  const response = await apiFetch(`/api/v1/config/archives/${archiveId}/download`, {
    headers: { Accept: 'application/octet-stream' },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(response.status === 401 ? 'UNAUTHORIZED' : body.error || '下载备份失败');
  }
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  return {
    blob: await response.blob(),
    filename: match?.[1] || `health-dashboard-${archiveId}`,
  };
}

export async function fetchSystemLogs(): Promise<{ lines: string[]; totalBytes: number; logFilePath: string }> {
  const response = await apiFetch('/api/v1/config/logs', {
    headers: { Accept: 'application/json' },
  });
  return parseResponse(response);
}

export async function clearSystemLogs(): Promise<{ ok: boolean }> {
  const response = await apiFetch('/api/v1/config/logs', {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });
  return parseResponse(response);
}

export async function uploadFitFile(file: File): Promise<{
  ok: true;
  message: string;
  filename: string;
  fileSizeBytes: number;
  startedAt: string;
}> {
  const formData = new FormData();
  formData.append('file', file, file.name);

  const response = await apiFetch('/api/v1/workouts/upload-fit', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: formData,
  });
  return parseResponse(response);
}
