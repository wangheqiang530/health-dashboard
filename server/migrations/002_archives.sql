CREATE TABLE IF NOT EXISTS source_archive_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL CHECK (source_id IN ('hae', 'fitdays', 'igpsport')),
  archive_kind TEXT NOT NULL,
  relative_path TEXT NOT NULL UNIQUE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  size_bytes BIGINT NOT NULL,
  sha256 TEXT NOT NULL,
  record_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS source_archive_files_source_captured_idx
  ON source_archive_files (source_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS source_archive_files_active_idx
  ON source_archive_files (deleted_at, captured_at DESC);
