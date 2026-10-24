-- Migration: 20261024000001_link_org_contractor.sql
-- Description: Link tenant organizations (app.orgs) with canonical contractor profiles (warehouse.canonical_contractors)

ALTER TABLE app.orgs 
ADD COLUMN IF NOT EXISTS contractor_id TEXT REFERENCES warehouse.canonical_contractors(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS contractor_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS contractor_matched_via TEXT DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_app_orgs_contractor ON app.orgs(contractor_id);

-- Update warehouse.normalized_permits.contractor_id foreign keys where matching canonical names
UPDATE warehouse.normalized_permits p
SET contractor_id = c.id
FROM warehouse.canonical_contractors c
WHERE (lower(p.contractor_name) = lower(c.canonical_name) 
   OR lower(p.contractor_name) = lower(split_part(c.canonical_name, ' (', 1))
   OR lower(p.contractor_name) LIKE lower(c.canonical_name) || '%')
  AND p.contractor_id IS NULL;
