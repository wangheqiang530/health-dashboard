import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';

export interface RawRecordRow {
  sourceId: 'hae' | 'fitdays' | 'igpsport';
  objectType: string;
  contentHash: string;
  occurrenceIndex?: number;
  metricType?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  localDate?: string | null;
  valueText?: string | null;
  valueNum?: number | null;
  unit?: string | null;
  sourceName?: string | null;
  deviceName?: string | null;
  sourceUpdatedAt?: string | null;
  metadata?: Record<string, unknown>;
  rawAttributes?: Record<string, unknown>;
  rawPayload: unknown;
  rawXml?: string | null;
}

export interface HealthSampleRow {
  sourceId: 'hae' | 'fitdays' | 'igpsport';
  rawContentHash: string;
  naturalKey: string;
  metricName: string;
  startAt?: string | null;
  endAt?: string | null;
  localDate?: string | null;
  valueNum?: number | null;
  valueText?: string | null;
  unit?: string | null;
  sourceName?: string | null;
  deviceName?: string | null;
  sourceUpdatedAt?: string | null;
  metadata?: Record<string, unknown>;
  rawPayload: unknown;
}

export interface ImportBatchInput {
  sourceId: 'hae' | 'fitdays' | 'igpsport';
  importKind: string;
  fileName?: string | null;
  archiveId?: string | null;
  archivePath?: string | null;
  sha256?: string | null;
  sizeBytes?: number;
  metadata?: Record<string, unknown>;
}

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)])
    );
  }
  return value;
};

export const stableStringify = (value: unknown): string =>
  JSON.stringify(stableValue(value));

export const contentHash = (value: unknown): string =>
  createHash('sha256').update(stableStringify(value)).digest('hex');

export async function createImportBatch(
  client: PoolClient,
  input: ImportBatchInput
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO import_batches
      (source_id, import_kind, file_name, archive_id, archive_path, sha256, size_bytes, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     RETURNING id`,
    [
      input.sourceId,
      input.importKind,
      input.fileName || null,
      input.archiveId || null,
      input.archivePath || null,
      input.sha256 || null,
      input.sizeBytes || 0,
      JSON.stringify(input.metadata || {}),
    ]
  );
  return result.rows[0].id;
}

export async function completeImportBatch(
  client: PoolClient,
  batchId: string,
  counts: {
    rawCount: number;
    normalizedCount: number;
    skippedCount?: number;
    errorCount?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await client.query(
    `UPDATE import_batches
     SET status = 'success',
         finished_at = NOW(),
         raw_count = $2,
         normalized_count = $3,
         skipped_count = $4,
         error_count = $5,
         metadata = metadata || $6::jsonb
     WHERE id = $1`,
    [
      batchId,
      counts.rawCount,
      counts.normalizedCount,
      counts.skippedCount || 0,
      counts.errorCount || 0,
      JSON.stringify(counts.metadata || {}),
    ]
  );
}

export async function failImportBatch(
  client: PoolClient,
  batchId: string,
  error: unknown
): Promise<void> {
  await client.query(
    `UPDATE import_batches
     SET status = 'failed',
         finished_at = NOW(),
         error_message = $2
     WHERE id = $1`,
    [batchId, error instanceof Error ? error.message : String(error)]
  );
}

const chunk = <T>(rows: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
};

export async function persistRawAndSampleRows(
  client: PoolClient,
  batchId: string,
  rawRowsInput: RawRecordRow[],
  sampleRowsInput: HealthSampleRow[]
): Promise<void> {
  const rawRows = [
    ...new Map(
      rawRowsInput.map((row) => [
        `${row.contentHash}|${row.occurrenceIndex || 1}`,
        row,
      ])
    ).values(),
  ];
  const sampleRows = [
    ...new Map(
      sampleRowsInput.map((row) => [`${row.sourceId}|${row.naturalKey}`, row])
    ).values(),
  ];
  const rawIdByHash = new Map<string, number>();

  for (const rows of chunk(rawRows, 2500)) {
    const values: unknown[] = [];
    const placeholders = rows.map((row, index) => {
      const base = index * 20;
      values.push(
        batchId,
        batchId,
        row.sourceId,
        row.objectType,
        row.contentHash,
        row.occurrenceIndex || 1,
        row.metricType || null,
        row.startAt || null,
        row.endAt || null,
        row.localDate || null,
        row.valueText ?? null,
        row.valueNum ?? null,
        row.unit || null,
        row.sourceName || null,
        row.deviceName || null,
        row.sourceUpdatedAt || null,
        JSON.stringify(row.metadata || {}),
        JSON.stringify(row.rawAttributes || {}),
        JSON.stringify(row.rawPayload),
        row.rawXml || null
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}, $${base + 16}, $${base + 17}::jsonb, $${base + 18}::jsonb, $${base + 19}::jsonb, $${base + 20})`;
    });

    const result = await client.query<{ id: string; content_hash: string }>(
      `INSERT INTO health_raw_records
        (first_batch_id, last_batch_id, source_id, object_type, content_hash,
         occurrence_index,
         metric_type, start_at, end_at, local_date, value_text, value_num, unit,
         source_name, device_name, source_updated_at, metadata, raw_attributes,
         raw_payload, raw_xml)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (source_id, object_type, content_hash, occurrence_index) DO UPDATE SET
         last_batch_id = EXCLUDED.last_batch_id,
         last_seen_at = NOW(),
         seen_count = health_raw_records.seen_count + 1
       RETURNING id, content_hash`,
      values
    );
    for (const row of result.rows) {
      rawIdByHash.set(row.content_hash, Number(row.id));
    }
  }

  for (const rows of chunk(sampleRows, 2500)) {
    const values: unknown[] = [];
    const placeholders = rows.map((row, index) => {
      const base = index * 16;
      values.push(
        row.sourceId,
        batchId,
        rawIdByHash.get(row.rawContentHash) || null,
        row.naturalKey,
        row.metricName,
        row.startAt || null,
        row.endAt || null,
        row.localDate || null,
        row.valueNum ?? null,
        row.valueText ?? null,
        row.unit || null,
        row.sourceName || null,
        row.deviceName || null,
        row.sourceUpdatedAt || null,
        JSON.stringify(row.metadata || {}),
        JSON.stringify(row.rawPayload)
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}::jsonb, $${base + 16}::jsonb)`;
    });

    await client.query(
      `INSERT INTO health_samples
        (source_id, batch_id, raw_record_id, natural_key, metric_name, start_at, end_at,
         local_date, value_num, value_text, unit, source_name, device_name,
         source_updated_at, metadata, raw_payload)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (source_id, natural_key) DO UPDATE SET
         batch_id = EXCLUDED.batch_id,
         raw_record_id = EXCLUDED.raw_record_id,
         start_at = EXCLUDED.start_at,
         end_at = EXCLUDED.end_at,
         local_date = EXCLUDED.local_date,
         value_num = EXCLUDED.value_num,
         value_text = EXCLUDED.value_text,
         unit = EXCLUDED.unit,
         source_name = EXCLUDED.source_name,
         device_name = EXCLUDED.device_name,
         source_updated_at = EXCLUDED.source_updated_at,
         metadata = EXCLUDED.metadata,
         raw_payload = EXCLUDED.raw_payload,
         updated_at = NOW()`,
      values
    );
  }
}
