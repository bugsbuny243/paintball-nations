-- C5.1: Expiring ownership of an in-progress server-managed battle.
-- Existing OPEN records receive a grace period; never cancel them on migration.
ALTER TABLE frontline_battles
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;
UPDATE frontline_battles
SET lease_expires_at=clock_timestamp()+interval '30 seconds'
WHERE status='OPEN' AND lease_expires_at IS NULL;
CREATE INDEX IF NOT EXISTS frontline_expired_lease_lookup
  ON frontline_battles(lease_expires_at,battle_id)
  WHERE status='OPEN';
