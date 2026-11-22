-- Paintball Nations C1: persistent pseudonymous pilot identity.
-- This is a development login prototype; not public account security.
-- Never store raw bearer secrets in the database.
CREATE TABLE IF NOT EXISTS pilots (
  id UUID PRIMARY KEY,
  display_name TEXT NOT NULL UNIQUE
    CHECK (length(display_name) BETWEEN 6 AND 32),
  faction_id TEXT NOT NULL REFERENCES factions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pilot_sessions (
  id UUID PRIMARY KEY,
  pilot_id UUID NOT NULL REFERENCES pilots(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE
    CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS pilot_sessions_by_pilot
ON pilot_sessions(pilot_id,expires_at DESC);
CREATE INDEX IF NOT EXISTS pilot_sessions_active
ON pilot_sessions(expires_at) WHERE revoked_at IS NULL;
