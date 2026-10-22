CREATE TABLE IF NOT EXISTS data_tombstones (
  id BIGSERIAL PRIMARY KEY,
  record_kind TEXT NOT NULL CHECK (
    record_kind IN ('body_measurement', 'health_workout', 'cycling_activity')
  ),
  source_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (record_kind, source_id, external_id)
);

CREATE INDEX IF NOT EXISTS data_tombstones_lookup_idx
  ON data_tombstones (record_kind, source_id, external_id);
