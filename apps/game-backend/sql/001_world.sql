-- Paintball Nations: A1 persistent world schema (idempotent initial migration).
-- Assumes one logical world and a transactional PostgreSQL writer.
CREATE TABLE IF NOT EXISTS world_meta (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  world_id TEXT NOT NULL UNIQUE CHECK (world_id = 'paintball-nations'),
  version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0)
);
INSERT INTO world_meta(id,world_id,version)
VALUES(TRUE,'paintball-nations',0)
ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS factions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
INSERT INTO factions(id,name) VALUES
('TR','Türkiye'),('DE','Almanya')
ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS sectors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_faction_id TEXT NOT NULL REFERENCES factions(id),
  state TEXT NOT NULL DEFAULT 'OWNED' CHECK (state IN ('OWNED','CONTESTED','RESOLVING')),
  version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
  osm_source TEXT,
  last_production_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO sectors(id,name,owner_faction_id,state,osm_source)
VALUES('TR-MACKA','İstanbul Maçka','TR','OWNED','maps/istanbul-macka.json')
ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS resource_balances (
  faction_id TEXT NOT NULL REFERENCES factions(id),
  resource TEXT NOT NULL CHECK(resource IN ('pigment','material')),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
  capacity INTEGER NOT NULL DEFAULT 1000 CHECK(capacity > 0 AND quantity <= capacity),
  PRIMARY KEY(faction_id,resource)
);
INSERT INTO resource_balances(faction_id,resource,quantity,capacity)
VALUES('TR','pigment',100,1000),('TR','material',100,1000),
      ('DE','pigment',100,1000),('DE','material',100,1000)
ON CONFLICT(faction_id,resource) DO NOTHING;

CREATE TABLE IF NOT EXISTS base_structures (
  sector_id TEXT NOT NULL REFERENCES sectors(id),
  kind TEXT NOT NULL CHECK(kind IN ('depot','paint_factory','defense_tower')),
  level SMALLINT NOT NULL CHECK(level BETWEEN 1 AND 5),
  PRIMARY KEY(sector_id,kind)
);
CREATE TABLE IF NOT EXISTS world_operations (
  operation_id TEXT PRIMARY KEY,
  input_hash TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS resource_ledger (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  operation_id TEXT NOT NULL,
  faction_id TEXT NOT NULL REFERENCES factions(id),
  resource TEXT NOT NULL CHECK(resource IN ('pigment','material')),
  delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL CHECK(balance_after >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(operation_id,faction_id,resource)
);
CREATE TABLE IF NOT EXISTS world_events (
  version BIGINT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK(event_type IN ('structure.upgraded','sector.production')),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS world_events_recent ON world_events(created_at DESC);
-- A1: No player sessions or trusted battle-room records yet.
-- Sector transfers require a verified multiplayer battle protocol in A3.
