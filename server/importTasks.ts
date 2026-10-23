import { pool } from './db.ts';

export type ImportTaskStatus = 'queued' | 'running' | 'success' | 'failed' | 'stalled';

interface ImportTaskRow {
  id: string;
  source_id: 'hae' | 'fitdays' | 'igpsport';
  import_kind: string;
  file_name: string | null;
  file_size_bytes: string;
  status: 'queued' | 'running' | 'success' | 'failed';
  stage: string;
  stage_label: string;
  progress: string;
  processed_count: string;
  total_count: string | null;
  bytes_processed: string;
  bytes_total: string | null;
  batch_id: string | null;
  result: unknown;
  error_message: string | null;
  failed_stage: string | null;
  metadata: Record<string, unknown>;
  started_at: Date;
  updated_at: Date;
  finished_at: Date | null;
}

export interface ImportTaskRecord {
  id: string;
  sourceId: 'hae' | 'fitdays' | 'igpsport';
  importKind: string;
  fileName: string | null;
  fileSizeBytes: number;
  status: ImportTaskStatus;
  stage: string;
  stageLabel: string;
  progress: number;
  processedCount: number;
  totalCount: number | null;
  bytesProcessed: number;
  bytesTotal: number | null;
  batchId: string | null;
  result: unknown;
  errorMessage: string | null;
  failedStage: string | null;
  metadata: Record<string, unknown>;
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
  stalled: boolean;
  elapsedMs: number;
}

export interface ImportTaskUpdate {
  status?: 'queued' | 'running';
  stage?: string;
  stageLabel?: string;
  progress?: number;
  processedCount?: number;
  totalCount?: number;
  bytesProcessed?: number;
  bytesTotal?: number;
  batchId?: string;
  metadata?: Record<string, unknown>;
}

const STALLED_AFTER_MS = 45_000;
const TASK_SELECT = `SELECT
  id::text,
  source_id,
  import_kind,
  file_name,
  file_size_bytes::text,
  status,
  stage,
  stage_label,
  progress::text,
  processed_count::text,
  total_count::text,
  bytes_processed::text,
  bytes_total::text,
  batch_id::text,
  result,
  error_message,
  failed_stage,
  metadata,
  started_at,
  updated_at,
  finished_at
FROM import_tasks`;

const toTask = (row: ImportTaskRow): ImportTaskRecord => {
  const active = row.status === 'queued' || row.status === 'running';
  const stalled = active && Date.now() - row.updated_at.getTime() > STALLED_AFTER_MS;
  return {
    id: row.id,
    sourceId: row.source_id,
    importKind: row.import_kind,
    fileName: row.file_name,
    fileSizeBytes: Number(row.file_size_bytes || 0),
    status: stalled ? 'stalled' : row.status,
    stage: row.stage,
    stageLabel: row.stage_label,
    progress: Math.min(100, Math.max(0, Number(row.progress || 0))),
    processedCount: Number(row.processed_count || 0),
    totalCount: row.total_count === null ? null : Number(row.total_count),
    bytesProcessed: Number(row.bytes_processed || 0),
    bytesTotal: row.bytes_total === null ? null : Number(row.bytes_total),
    batchId: row.batch_id,
    result: row.result,
    errorMessage: row.error_message,
    failedStage: row.failed_stage,
    metadata: row.metadata || {},
    startedAt: row.started_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    finishedAt: row.finished_at?.toISOString() || null,
    stalled,
    elapsedMs: Math.max(
      0,
      (row.finished_at?.getTime() || Date.now()) - row.started_at.getTime()
    ),
  };
};

export async function createImportTask(input: {
  sourceId: 'hae' | 'fitdays' | 'igpsport';
  importKind: string;
  fileName: string;
  fileSizeBytes: number;
  metadata?: Record<string, unknown>;
}): Promise<ImportTaskRecord> {
  const result = await pool.query<ImportTaskRow>(
    `INSERT INTO import_tasks
      (source_id, import_kind, file_name, file_size_bytes, bytes_total, metadata)
     VALUES ($1, $2, $3, $4, $4, $5::jsonb)
     RETURNING
       id::text, source_id, import_kind, file_name, file_size_bytes::text,
       status, stage, stage_label, progress::text, processed_count::text,
       total_count::text, bytes_processed::text, bytes_total::text,
       batch_id::text, result, error_message, failed_stage, metadata,
       started_at, updated_at, finished_at`,
    [
      input.sourceId,
      input.importKind,
      input.fileName,
      Math.max(0, input.fileSizeBytes),
      JSON.stringify(input.metadata || {}),
    ]
  );
  return toTask(result.rows[0]);
}

export async function getImportTask(id: string): Promise<ImportTaskRecord | null> {
  const result = await pool.query<ImportTaskRow>(
    `${TASK_SELECT}
     WHERE id = $1::uuid
     LIMIT 1`,
    [id]
  );
  return result.rows[0] ? toTask(result.rows[0]) : null;
}

export async function updateImportTask(
  id: string,
  update: ImportTaskUpdate
): Promise<ImportTaskRecord | null> {
  const result = await pool.query<ImportTaskRow>(
    `UPDATE import_tasks
     SET status = COALESCE($2, status),
         stage = COALESCE($3, stage),
         stage_label = COALESCE($4, stage_label),
         progress = COALESCE($5, progress),
         processed_count = COALESCE($6, processed_count),
         total_count = COALESCE($7, total_count),
         bytes_processed = COALESCE($8, bytes_processed),
         bytes_total = COALESCE($9, bytes_total),
         batch_id = COALESCE($10::uuid, batch_id),
         metadata = metadata || COALESCE($11::jsonb, '{}'::jsonb),
         updated_at = NOW()
     WHERE id = $1::uuid
     RETURNING
       id::text, source_id, import_kind, file_name, file_size_bytes::text,
       status, stage, stage_label, progress::text, processed_count::text,
       total_count::text, bytes_processed::text, bytes_total::text,
       batch_id::text, result, error_message, failed_stage, metadata,
       started_at, updated_at, finished_at`,
    [
      id,
      update.status || null,
      update.stage || null,
      update.stageLabel || null,
      update.progress === undefined
        ? null
        : Math.min(100, Math.max(0, update.progress)),
      update.processedCount ?? null,
      update.totalCount ?? null,
      update.bytesProcessed ?? null,
      update.bytesTotal ?? null,
      update.batchId || null,
      update.metadata ? JSON.stringify(update.metadata) : null,
    ]
  );
  return result.rows[0] ? toTask(result.rows[0]) : null;
}

export async function completeImportTask(
  id: string,
  resultPayload: unknown,
  batchId?: string | null
): Promise<ImportTaskRecord | null> {
  const result = await pool.query<ImportTaskRow>(
    `UPDATE import_tasks
     SET status = 'success',
         stage = 'completed',
         stage_label = '导入完成',
         progress = 100,
         processed_count = COALESCE(
           ($2::jsonb->>'normalizedRecordCount')::bigint,
           processed_count
         ),
         total_count = COALESCE(
           ($2::jsonb->>'rawRecordCount')::bigint,
           total_count
         ),
         result = $2::jsonb,
         batch_id = COALESCE($3::uuid, batch_id),
         error_message = NULL,
         failed_stage = NULL,
         finished_at = NOW(),
         updated_at = NOW()
     WHERE id = $1::uuid
     RETURNING
       id::text, source_id, import_kind, file_name, file_size_bytes::text,
       status, stage, stage_label, progress::text, processed_count::text,
       total_count::text, bytes_processed::text, bytes_total::text,
       batch_id::text, result, error_message, failed_stage, metadata,
       started_at, updated_at, finished_at`,
    [id, JSON.stringify(resultPayload), batchId || null]
  );
  return result.rows[0] ? toTask(result.rows[0]) : null;
}

export async function failImportTask(
  id: string,
  error: unknown,
  failedStage: string
): Promise<ImportTaskRecord | null> {
  const message = error instanceof Error ? error.message : String(error);
  const result = await pool.query<ImportTaskRow>(
    `UPDATE import_tasks
     SET status = 'failed',
         error_message = $2,
         failed_stage = $3,
         finished_at = NOW(),
         updated_at = NOW()
     WHERE id = $1::uuid
     RETURNING
       id::text, source_id, import_kind, file_name, file_size_bytes::text,
       status, stage, stage_label, progress::text, processed_count::text,
       total_count::text, bytes_processed::text, bytes_total::text,
       batch_id::text, result, error_message, failed_stage, metadata,
       started_at, updated_at, finished_at`,
    [id, message, failedStage]
  );
  return result.rows[0] ? toTask(result.rows[0]) : null;
}
