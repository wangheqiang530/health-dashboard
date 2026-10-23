CREATE TABLE IF NOT EXISTS import_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL CHECK (source_id IN ('hae', 'fitdays', 'igpsport')),
  import_kind TEXT NOT NULL,
  file_name TEXT,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'success', 'failed')),
  stage TEXT NOT NULL DEFAULT 'queued',
  stage_label TEXT NOT NULL DEFAULT '等待处理',
  progress NUMERIC(5, 2) NOT NULL DEFAULT 0,
  processed_count BIGINT NOT NULL DEFAULT 0,
  total_count BIGINT,
  bytes_processed BIGINT NOT NULL DEFAULT 0,
  bytes_total BIGINT,
  batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL,
  result JSONB,
  error_message TEXT,
  failed_stage TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS import_tasks_source_started_idx
  ON import_tasks (source_id, started_at DESC);

CREATE INDEX IF NOT EXISTS import_tasks_active_updated_idx
  ON import_tasks (status, updated_at DESC);
