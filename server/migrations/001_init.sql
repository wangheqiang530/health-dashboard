CREATE TABLE IF NOT EXISTS data_sources (
  id TEXT PRIMARY KEY CHECK (id IN ('hae', 'fitdays', 'igpsport')),
  display_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  account TEXT,
  encrypted_password TEXT,
  cron_expression TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO data_sources (id, display_name, cron_expression)
VALUES
  ('hae', 'iOS 健康 (Health Auto Export)', NULL),
  ('fitdays', 'Fitdays 体脂秤', '15 */6 * * *'),
  ('igpsport', 'iGPSPORT 码表', '30 */6 * * *')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'cron')),
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  records_count INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS sync_runs_source_started_idx
  ON sync_runs (source_id, started_at DESC);

CREATE TABLE IF NOT EXISTS body_measurements (
  id BIGSERIAL PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  profile_id TEXT,
  measured_at TIMESTAMPTZ NOT NULL,
  measured_date DATE NOT NULL,
  weight_kg NUMERIC(7, 3),
  bmi NUMERIC(6, 2),
  body_fat_rate NUMERIC(6, 2),
  skeletal_muscle_rate NUMERIC(6, 2),
  muscle_rate NUMERIC(6, 2),
  lean_body_mass_kg NUMERIC(7, 3),
  visceral_fat_level NUMERIC(7, 2),
  water_rate NUMERIC(6, 2),
  bone_mass_kg NUMERIC(7, 3),
  bmr_kcal NUMERIC(9, 2),
  subcutaneous_fat_rate NUMERIC(6, 2),
  protein_rate NUMERIC(6, 2),
  body_age INTEGER,
  heart_rate INTEGER,
  score NUMERIC(6, 2),
  smi NUMERIC(7, 3),
  whr NUMERIC(7, 4),
  raw_record JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, external_id)
);

CREATE INDEX IF NOT EXISTS body_measurements_date_idx
  ON body_measurements (measured_date DESC, measured_at DESC);

CREATE TABLE IF NOT EXISTS cycling_activities (
  id BIGSERIAL PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  device TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  moving_time_sec INTEGER,
  distance_km NUMERIC(9, 3),
  avg_speed_kmh NUMERIC(7, 2),
  max_speed_kmh NUMERIC(7, 2),
  avg_heart_rate INTEGER,
  max_heart_rate INTEGER,
  avg_cadence INTEGER,
  avg_power INTEGER,
  max_power INTEGER,
  normalized_power INTEGER,
  tss NUMERIC(8, 2),
  ascent_m NUMERIC(9, 2),
  calories NUMERIC(9, 2),
  fit_file_path TEXT,
  fit_file_name TEXT,
  file_size_bytes BIGINT,
  raw_record JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, external_id)
);

CREATE INDEX IF NOT EXISTS cycling_activities_started_idx
  ON cycling_activities (started_at DESC);

CREATE TABLE IF NOT EXISTS hae_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload_size_bytes BIGINT NOT NULL,
  source_ip TEXT,
  date_from DATE,
  date_to DATE,
  metric_count INTEGER NOT NULL DEFAULT 0,
  workout_count INTEGER NOT NULL DEFAULT 0,
  daily_summary_count INTEGER NOT NULL DEFAULT 0,
  raw_payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS hae_imports_received_idx
  ON hae_imports (received_at DESC);

CREATE TABLE IF NOT EXISTS health_metric_points (
  id BIGSERIAL PRIMARY KEY,
  import_id UUID NOT NULL REFERENCES hae_imports(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL UNIQUE,
  metric_name TEXT NOT NULL,
  units TEXT,
  source_name TEXT NOT NULL DEFAULT '',
  recorded_at TIMESTAMPTZ,
  local_date DATE,
  value NUMERIC,
  raw_point JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS health_metric_points_lookup_idx
  ON health_metric_points (metric_name, recorded_at DESC);

CREATE INDEX IF NOT EXISTS health_metric_points_date_idx
  ON health_metric_points (local_date DESC);

CREATE TABLE IF NOT EXISTS health_workouts (
  id BIGSERIAL PRIMARY KEY,
  import_id UUID NOT NULL REFERENCES hae_imports(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_sec INTEGER,
  active_energy_kcal NUMERIC(9, 2),
  distance_km NUMERIC(9, 3),
  avg_heart_rate INTEGER,
  max_heart_rate INTEGER,
  elevation_gain_m NUMERIC(9, 2),
  raw_workout JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS health_workouts_started_idx
  ON health_workouts (started_at DESC);

CREATE TABLE IF NOT EXISTS daily_summaries (
  day DATE PRIMARY KEY,
  summary JSONB NOT NULL,
  hae_import_id UUID REFERENCES hae_imports(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  encrypted_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

UPDATE sync_runs
SET
  status = 'failed',
  finished_at = NOW(),
  message = '服务重启，任务已中断'
WHERE status = 'running';
