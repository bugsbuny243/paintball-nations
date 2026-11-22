-- Paintball Nations C3: a server-authoritative battle may settle a single
-- persistent sector, exactly once. Client HTTP routes have no write access.
-- Idempotent CREATE/ALTER so the migration can run twice on an existing world.
CREATE TABLE IF NOT EXISTS frontline_battles (
  battle_id UUID PRIMARY KEY,
  sector_id TEXT NOT NULL REFERENCES sectors(id),
  source_room_id TEXT NOT NULL CHECK(length(source_room_id) BETWEEN 2 AND 100),
  attacker_faction_id TEXT NOT NULL REFERENCES factions(id),
  defender_faction_id TEXT NOT NULL REFERENCES factions(id),
  expected_sector_version BIGINT NOT NULL CHECK(expected_sector_version >= 0),
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK(status IN ('OPEN','SETTLED','CANCELLED')),
  result JSONB,
  result_hash CHAR(64) CHECK (result_hash IS NULL OR result_hash ~ '^[0-9a-f]{64} TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  CONSTRAINT frontline_distinct_factions CHECK(attacker_faction_id <> defender_faction_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_frontline_per_sector
  ON frontline_battles(sector_id) WHERE status='OPEN';
CREATE INDEX IF NOT EXISTS frontline_battle_sector_history
  ON frontline_battles(sector_id,created_at DESC);

CREATE TABLE IF NOT EXISTS sector_ownership_history (
  battle_id UUID PRIMARY KEY REFERENCES frontline_battles(battle_id),
  sector_id TEXT NOT NULL REFERENCES sectors(id),
  previous_faction_id TEXT NOT NULL REFERENCES factions(id),
  new_faction_id TEXT NOT NULL REFERENCES factions(id),
  world_version BIGINT NOT NULL UNIQUE CHECK(world_version >= 0),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ownership_changed CHECK(previous_faction_id <> new_faction_id)
);

-- Extend the shared durable event journal while retaining A1 event kinds.
ALTER TABLE world_events DROP CONSTRAINT IF EXISTS world_events_event_type_check;
ALTER TABLE world_events ADD CONSTRAINT world_events_event_type_check
  CHECK(event_type IN ('structure.upgraded','sector.production','frontline.opened','frontline.settled','frontline.cancelled'));
),
  opened_world_version BIGINT CHECK(opened_world_version >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  CONSTRAINT frontline_distinct_factions CHECK(attacker_faction_id <> defender_faction_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_frontline_per_sector
  ON frontline_battles(sector_id) WHERE status='OPEN';
CREATE INDEX IF NOT EXISTS frontline_battle_sector_history
  ON frontline_battles(sector_id,created_at DESC);

CREATE TABLE IF NOT EXISTS sector_ownership_history (
  battle_id UUID PRIMARY KEY REFERENCES frontline_battles(battle_id),
  sector_id TEXT NOT NULL REFERENCES sectors(id),
  previous_faction_id TEXT NOT NULL REFERENCES factions(id),
  new_faction_id TEXT NOT NULL REFERENCES factions(id),
  world_version BIGINT NOT NULL UNIQUE CHECK(world_version >= 0),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ownership_changed CHECK(previous_faction_id <> new_faction_id)
);

-- Extend the shared durable event journal while retaining A1 event kinds.
ALTER TABLE world_events DROP CONSTRAINT IF EXISTS world_events_event_type_check;
ALTER TABLE world_events ADD CONSTRAINT world_events_event_type_check
  CHECK(event_type IN ('structure.upgraded','sector.production','frontline.settled'));
