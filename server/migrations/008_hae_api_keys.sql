CREATE TABLE IF NOT EXISTS hae_api_keys (
  id UUID PRIMARY KEY,
  device_name TEXT NOT NULL CHECK (length(trim(device_name)) > 0),
  encrypted_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  last_source_ip TEXT
);

CREATE INDEX IF NOT EXISTS hae_api_keys_enabled_idx
  ON hae_api_keys (enabled, created_at ASC);
