-- Territory + Claim-Lock schema
-- Phase 1 of the Depoii territory model implementation.
--
-- New tables:
--   app.territories            – zone definitions (ZIP clusters per market)
--   app.territory_subscriptions – which orgs subscribe to which zones
--   app.property_claims        – claim-lock with 21-day TTL, 7-day activity rule
--   app.claim_activities       – one-click activity logging on claims
--   app.claim_counters         – monthly claim usage tracking
--   app.org_ranking_profiles   – personalized ranking per org (crew location, preferences)
--
-- Altered tables:
--   app.orgs                   – adds subscription_tier, claim limits, crew preferences

-- ============================================================ app.orgs additions

ALTER TABLE app.orgs
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'shared_intelligence'
    CHECK (subscription_tier IN ('shared_intelligence', 'pro_territory', 'exclusive_zone')),
  ADD COLUMN IF NOT EXISTS max_active_claims integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_monthly_claims integer NOT NULL DEFAULT 0;

-- ============================================================ app.territories

CREATE TABLE IF NOT EXISTS app.territories (
  id text PRIMARY KEY,
  market text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  zip_codes text[] NOT NULL,
  max_subscribers integer NOT NULL DEFAULT 2,
  total_parcels integer NOT NULL DEFAULT 0,
  total_pipeline_value numeric(18,2) DEFAULT 0,
  total_sqft bigint DEFAULT 0,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'waitlist', 'retired')),
  created_at timestamptz DEFAULT now()
);

-- ============================================================ app.territory_subscriptions

CREATE TABLE IF NOT EXISTS app.territory_subscriptions (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  territory_id text NOT NULL REFERENCES app.territories(id) ON DELETE CASCADE,
  org_id text NOT NULL REFERENCES app.orgs(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('pro_territory', 'exclusive_zone')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'cancelled', 'waitlisted')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (territory_id, org_id)
);

-- An exclusive_zone tier means only one active subscriber allowed in that territory.
CREATE UNIQUE INDEX IF NOT EXISTS idx_exclusive_zone
  ON app.territory_subscriptions (territory_id)
  WHERE tier = 'exclusive_zone' AND status = 'active';

-- Fast lookup: all active subscriptions for an org.
CREATE INDEX IF NOT EXISTS idx_territory_subs_org
  ON app.territory_subscriptions (org_id, status)
  WHERE status = 'active';

-- ============================================================ app.property_claims

CREATE TABLE IF NOT EXISTS app.property_claims (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  parcel_id text NOT NULL,
  territory_id text NOT NULL REFERENCES app.territories(id),
  claimed_by_org_id text NOT NULL REFERENCES app.orgs(id),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  activity_deadline timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'released', 'expired', 'converted')),
  release_reason text,
  created_at timestamptz DEFAULT now()
);

-- Only one active claim per property at a time (across all orgs).
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_claim
  ON app.property_claims (parcel_id)
  WHERE status = 'active';

-- Fast lookup: org's active claims.
CREATE INDEX IF NOT EXISTS idx_claims_org_active
  ON app.property_claims (claimed_by_org_id, status)
  WHERE status = 'active';

-- Cron sweep target: find claims that need expiry.
CREATE INDEX IF NOT EXISTS idx_claims_expiry
  ON app.property_claims (activity_deadline, expires_at)
  WHERE status = 'active';

-- ============================================================ app.claim_activities

CREATE TABLE IF NOT EXISTS app.claim_activities (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  claim_id text NOT NULL REFERENCES app.property_claims(id) ON DELETE CASCADE,
  org_id text NOT NULL,
  user_id text NOT NULL,
  activity_type text NOT NULL
    CHECK (activity_type IN (
      'phone_call', 'email_sent', 'site_visit',
      'inspection_scheduled', 'bid_submitted', 'note_added'
    )),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_activities_claim
  ON app.claim_activities (claim_id, created_at DESC);

-- ============================================================ app.claim_counters

CREATE TABLE IF NOT EXISTS app.claim_counters (
  org_id text NOT NULL REFERENCES app.orgs(id) ON DELETE CASCADE,
  month text NOT NULL,
  claims_used integer NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, month)
);

-- ============================================================ app.org_ranking_profiles

CREATE TABLE IF NOT EXISTS app.org_ranking_profiles (
  org_id text PRIMARY KEY REFERENCES app.orgs(id) ON DELETE CASCADE,
  crew_lat double precision,
  crew_lng double precision,
  min_roof_sqft bigint DEFAULT 0,
  max_roof_sqft bigint DEFAULT 999999999,
  preferred_sectors text[] DEFAULT '{}',
  preferred_roof_systems text[] DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- ============================================================ RLS lockdown (same pattern as fullstack migration)

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT format('%I.%I', table_schema, table_name)
    FROM information_schema.tables
    WHERE table_schema = 'app'
      AND table_name IN ('territories', 'territory_subscriptions', 'property_claims',
                         'claim_activities', 'claim_counters', 'org_ranking_profiles')
      AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON %s FROM anon', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON %s FROM authenticated', t);
    END IF;
  END LOOP;
END $$;
