CREATE TABLE IF NOT EXISTS import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL CHECK (source_id IN ('hae', 'fitdays', 'igpsport')),
  import_kind TEXT NOT NULL,
  file_name TEXT,
  archive_id UUID REFERENCES source_archive_files(id) ON DELETE SET NULL,
  archive_path TEXT,
  sha256 TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  raw_count BIGINT NOT NULL DEFAULT 0,
  normalized_count BIGINT NOT NULL DEFAULT 0,
  skipped_count BIGINT NOT NULL DEFAULT 0,
  error_count BIGINT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS import_batches_source_started_idx
  ON import_batches (source_id, started_at DESC);

ALTER TABLE hae_imports
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL;

ALTER TABLE daily_summaries
  ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL;

ALTER TABLE body_measurements
  ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL;

ALTER TABLE cycling_activities
  ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS health_raw_records (
  id BIGSERIAL PRIMARY KEY,
  first_batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE RESTRICT,
  last_batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE RESTRICT,
  source_id TEXT NOT NULL CHECK (source_id IN ('hae', 'fitdays', 'igpsport')),
  object_type TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  occurrence_index INTEGER NOT NULL DEFAULT 1,
  metric_type TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  local_date DATE,
  value_text TEXT,
  value_num NUMERIC,
  unit TEXT,
  source_name TEXT,
  device_name TEXT,
  source_updated_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_payload JSONB NOT NULL,
  raw_xml TEXT,
  seen_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, object_type, content_hash, occurrence_index)
);

CREATE INDEX IF NOT EXISTS health_raw_records_metric_start_idx
  ON health_raw_records (metric_type, start_at DESC);

CREATE INDEX IF NOT EXISTS health_raw_records_local_date_idx
  ON health_raw_records (local_date DESC);

CREATE INDEX IF NOT EXISTS health_raw_records_batch_idx
  ON health_raw_records (last_batch_id, object_type);

CREATE TABLE IF NOT EXISTS health_samples (
  id BIGSERIAL PRIMARY KEY,
  source_id TEXT NOT NULL CHECK (source_id IN ('hae', 'fitdays', 'igpsport')),
  batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE RESTRICT,
  raw_record_id BIGINT REFERENCES health_raw_records(id) ON DELETE SET NULL,
  natural_key TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  local_date DATE,
  value_num NUMERIC,
  value_text TEXT,
  unit TEXT,
  source_name TEXT,
  device_name TEXT,
  source_updated_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, natural_key)
);

CREATE INDEX IF NOT EXISTS health_samples_metric_start_idx
  ON health_samples (metric_name, start_at DESC);

CREATE INDEX IF NOT EXISTS health_samples_local_date_idx
  ON health_samples (local_date DESC);

ALTER TABLE health_metric_points
  ADD COLUMN IF NOT EXISTS natural_key TEXT;

UPDATE health_metric_points
SET natural_key = metric_name || '|' ||
                  COALESCE(
                    to_char(recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                    raw_point->>'date',
                    raw_point->>'startDate',
                    raw_point->>'inBedStart',
                    ''
                  ) || '|' ||
                  COALESCE(source_name, '') || '|' || COALESCE(units, '')
WHERE natural_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS health_metric_points_natural_key_idx
  ON health_metric_points (natural_key);

ALTER TABLE health_workouts
  ADD COLUMN IF NOT EXISTS source_id TEXT NOT NULL DEFAULT 'hae',
  ADD COLUMN IF NOT EXISTS natural_key TEXT,
  ADD COLUMN IF NOT EXISTS source_name TEXT,
  ADD COLUMN IF NOT EXISTS device_name TEXT,
  ADD COLUMN IF NOT EXISTS source_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS raw_record_id BIGINT REFERENCES health_raw_records(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE health_workouts
SET natural_key = 'workout|' || LOWER(name) || '|' ||
                  COALESCE(
                    to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                    ''
                  ) || '|' || COALESCE(source_name, '')
WHERE natural_key IS NULL;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY source_id, natural_key
           ORDER BY id DESC
         ) AS row_number
  FROM health_workouts
  WHERE natural_key IS NOT NULL
)
DELETE FROM health_workouts
WHERE id IN (SELECT id FROM ranked WHERE row_number > 1);

CREATE UNIQUE INDEX IF NOT EXISTS health_workouts_natural_key_idx
  ON health_workouts (source_id, natural_key);

INSERT INTO import_batches (
  id, source_id, import_kind, file_name, archive_path, size_bytes, status,
  started_at, finished_at, raw_count, normalized_count, metadata
)
SELECT
  id,
  'hae',
  'health-auto-export-backfill',
  NULL,
  NULL,
  payload_size_bytes,
  'success',
  received_at,
  received_at,
  metric_count + workout_count,
  metric_count + workout_count,
  jsonb_build_object('backfilledFromHaeImport', id)
FROM hae_imports
ON CONFLICT (id) DO NOTHING;

UPDATE hae_imports
SET batch_id = id
WHERE batch_id IS NULL;

INSERT INTO health_raw_records (
  first_batch_id, last_batch_id, source_id, object_type, content_hash,
  metric_type, start_at, end_at, local_date, value_text, value_num, unit,
  source_name, metadata, raw_payload
)
SELECT
  hi.id,
  hi.id,
  'hae',
  'HaeMetricPoint',
  MD5(COALESCE(m->>'name', '') || '|' || COALESCE(p::text, '')),
  m->>'name',
  CASE
    WHEN COALESCE(p->>'date', p->>'startDate', p->>'inBedStart') IS NULL THEN NULL
    ELSE (COALESCE(p->>'date', p->>'startDate', p->>'inBedStart'))::timestamptz
  END,
  CASE
    WHEN COALESCE(p->>'endDate', p->>'sleepEnd', p->>'inBedEnd') IS NULL THEN NULL
    ELSE (COALESCE(p->>'endDate', p->>'sleepEnd', p->>'inBedEnd'))::timestamptz
  END,
  CASE
    WHEN COALESCE(p->>'date', p->>'startDate', p->>'inBedStart') IS NULL THEN NULL
    ELSE ((COALESCE(p->>'date', p->>'startDate', p->>'inBedStart'))::timestamptz AT TIME ZONE 'Asia/Shanghai')::date
  END,
  COALESCE(p->>'value', p->>'qty'),
  CASE
    WHEN COALESCE(p->>'qty', p->>'avg', p->>'sum', p->>'Avg', p->>'min', p->>'max')
      ~ '^-?[0-9]+([.][0-9]+)?$'
    THEN COALESCE(p->>'qty', p->>'avg', p->>'sum', p->>'Avg', p->>'min', p->>'max')::numeric
    ELSE NULL
  END,
  m->>'units',
  p->>'source',
  jsonb_build_object('metricName', m->>'name', 'units', m->>'units'),
  p
FROM hae_imports hi
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(hi.raw_payload->'data'->'metrics', '[]'::jsonb)) m
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(m->'data', '[]'::jsonb)) p
ON CONFLICT (source_id, object_type, content_hash, occurrence_index) DO NOTHING;

INSERT INTO health_raw_records (
  first_batch_id, last_batch_id, source_id, object_type, content_hash,
  metric_type, start_at, end_at, local_date, value_num, unit,
  metadata, raw_payload
)
SELECT
  hi.id,
  hi.id,
  'hae',
  'HaeWorkout',
  MD5(COALESCE(w::text, '')),
  w->>'name',
  CASE WHEN w->>'start' IS NULL THEN NULL ELSE (w->>'start')::timestamptz END,
  CASE WHEN w->>'end' IS NULL THEN NULL ELSE (w->>'end')::timestamptz END,
  CASE
    WHEN w->>'start' IS NULL THEN NULL
    ELSE ((w->>'start')::timestamptz AT TIME ZONE 'Asia/Shanghai')::date
  END,
  NULL,
  NULL,
  jsonb_build_object('workoutName', w->>'name'),
  w
FROM hae_imports hi
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(hi.raw_payload->'data'->'workouts', '[]'::jsonb)) w
ON CONFLICT (source_id, object_type, content_hash, occurrence_index) DO NOTHING;

INSERT INTO health_samples (
  source_id, batch_id, raw_record_id, natural_key, metric_name, start_at, end_at,
  local_date, value_num, value_text, unit, source_name, metadata, raw_payload
)
WITH ranked AS (
  SELECT
    r.*,
    r.metric_type || '|' ||
      COALESCE(
        to_char(r.start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        r.raw_payload->>'date',
        r.raw_payload->>'startDate',
        r.raw_payload->>'inBedStart',
        ''
      ) || '|' || COALESCE(r.source_name, '') || '|' || COALESCE(r.unit, '') AS sample_key,
    ROW_NUMBER() OVER (
      PARTITION BY
        r.source_id,
        r.metric_type,
        COALESCE(
          to_char(r.start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          r.raw_payload->>'date',
          r.raw_payload->>'startDate',
          r.raw_payload->>'inBedStart',
          ''
        ),
        COALESCE(r.source_name, ''),
        COALESCE(r.unit, '')
      ORDER BY r.id DESC
    ) AS row_number
  FROM health_raw_records r
  WHERE r.object_type = 'HaeMetricPoint'
)
SELECT
  source_id,
  last_batch_id,
  id,
  sample_key,
  metric_type,
  start_at,
  end_at,
  local_date,
  value_num,
  value_text,
  unit,
  source_name,
  metadata,
  raw_payload
FROM ranked
WHERE row_number = 1
ON CONFLICT (source_id, natural_key) DO UPDATE SET
  batch_id = EXCLUDED.batch_id,
  raw_record_id = EXCLUDED.raw_record_id,
  value_num = EXCLUDED.value_num,
  value_text = EXCLUDED.value_text,
  unit = EXCLUDED.unit,
  source_name = EXCLUDED.source_name,
  metadata = EXCLUDED.metadata,
  raw_payload = EXCLUDED.raw_payload,
  updated_at = NOW();

INSERT INTO import_batches (
  id, source_id, import_kind, status, started_at, finished_at, raw_count,
  normalized_count, metadata
)
SELECT
    '00000000-0000-0000-0000-000000000401',
    'fitdays',
    'fitdays-raw-backfill',
    'success',
    NOW(),
    NOW(),
    (SELECT COUNT(*) FROM body_measurements),
    (SELECT COUNT(*) FROM body_measurements),
    '{"backfilledFrom":"body_measurements"}'::jsonb
WHERE EXISTS (SELECT 1 FROM body_measurements)
ON CONFLICT (id) DO NOTHING;

INSERT INTO import_batches (
  id, source_id, import_kind, status, started_at, finished_at, raw_count,
  normalized_count, metadata
)
SELECT
    '00000000-0000-0000-0000-000000000402',
    'igpsport',
    'igpsport-raw-backfill',
    'success',
    NOW(),
    NOW(),
    (SELECT COUNT(*) FROM cycling_activities),
    (SELECT COUNT(*) FROM cycling_activities),
    '{"backfilledFrom":"cycling_activities"}'::jsonb
WHERE EXISTS (SELECT 1 FROM cycling_activities)
ON CONFLICT (id) DO NOTHING;

INSERT INTO health_raw_records (
  first_batch_id, last_batch_id, source_id, object_type, content_hash,
  occurrence_index, metric_type, start_at, local_date, value_num, unit,
  source_name, metadata, raw_payload
)
SELECT
  '00000000-0000-0000-0000-000000000401',
  '00000000-0000-0000-0000-000000000401',
  'fitdays',
  'FitdaysRecord',
  MD5(raw_record::text),
  1,
  'body_measurement',
  measured_at,
  measured_date,
  weight_kg,
  'kg',
  'Fitdays',
  jsonb_build_object('externalId', external_id, 'profileId', profile_id),
  raw_record
FROM body_measurements
ON CONFLICT (source_id, object_type, content_hash, occurrence_index) DO NOTHING;

INSERT INTO health_raw_records (
  first_batch_id, last_batch_id, source_id, object_type, content_hash,
  occurrence_index, metric_type, start_at, end_at, local_date, value_num, unit,
  source_name, metadata, raw_payload
)
SELECT
  '00000000-0000-0000-0000-000000000402',
  '00000000-0000-0000-0000-000000000402',
  'igpsport',
  'CyclingActivity',
  MD5(raw_record::text),
  1,
  'cycling_activity',
  started_at,
  ended_at,
  (started_at AT TIME ZONE 'Asia/Shanghai')::date,
  distance_km,
  'km',
  device,
  jsonb_build_object('externalId', external_id),
  raw_record
FROM cycling_activities
ON CONFLICT (source_id, object_type, content_hash, occurrence_index) DO NOTHING;

INSERT INTO health_samples (
  source_id, batch_id, raw_record_id, natural_key, metric_name, start_at,
  local_date, value_num, unit, source_name, metadata, raw_payload
)
SELECT DISTINCT ON (r.source_id, 'body_mass|' || COALESCE(r.metadata->>'externalId', r.content_hash))
  'fitdays',
  '00000000-0000-0000-0000-000000000401',
  r.id,
  'body_mass|' || COALESCE(r.metadata->>'externalId', r.content_hash),
  'body_mass',
  r.start_at,
  r.local_date,
  r.value_num,
  'kg',
  r.source_name,
  r.metadata,
  r.raw_payload
FROM health_raw_records r
WHERE r.source_id = 'fitdays' AND r.object_type = 'FitdaysRecord'
ORDER BY r.source_id, 'body_mass|' || COALESCE(r.metadata->>'externalId', r.content_hash), r.id DESC
ON CONFLICT (source_id, natural_key) DO UPDATE SET
  batch_id = EXCLUDED.batch_id,
  raw_record_id = EXCLUDED.raw_record_id,
  value_num = EXCLUDED.value_num,
  raw_payload = EXCLUDED.raw_payload,
  updated_at = NOW();

INSERT INTO health_samples (
  source_id, batch_id, raw_record_id, natural_key, metric_name, start_at,
  end_at, local_date, value_num, unit, source_name, metadata, raw_payload
)
SELECT DISTINCT ON (r.source_id, 'cycling_distance|' || COALESCE(r.metadata->>'externalId', r.content_hash))
  'igpsport',
  '00000000-0000-0000-0000-000000000402',
  r.id,
  'cycling_distance|' || COALESCE(r.metadata->>'externalId', r.content_hash),
  'cycling_distance',
  r.start_at,
  r.end_at,
  r.local_date,
  r.value_num,
  'km',
  r.source_name,
  r.metadata,
  r.raw_payload
FROM health_raw_records r
WHERE r.source_id = 'igpsport' AND r.object_type = 'CyclingActivity'
ORDER BY r.source_id, 'cycling_distance|' || COALESCE(r.metadata->>'externalId', r.content_hash), r.id DESC
ON CONFLICT (source_id, natural_key) DO UPDATE SET
  batch_id = EXCLUDED.batch_id,
  raw_record_id = EXCLUDED.raw_record_id,
  start_at = EXCLUDED.start_at,
  end_at = EXCLUDED.end_at,
  local_date = EXCLUDED.local_date,
  value_num = EXCLUDED.value_num,
  raw_payload = EXCLUDED.raw_payload,
  updated_at = NOW();
