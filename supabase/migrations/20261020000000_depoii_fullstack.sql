-- Depoii full-stack migration: warehouse (engine data) + app (tenant data)
-- Sources reconciled:
--   Roofx/depoii-data-engine/deploy_supabase_schema.py (Postgres DDL)
--   Roofx/depoii-data-engine/depoii_local.db (engine SQLite, actual columns)
--   src/lib/db.ts SCHEMA (Next.js SQLite tenant tables)
-- Access model: server-side connections only (Vercel route handlers + local
-- engine). RLS is enabled on every table with NO anon/authenticated grants,
-- so the Supabase Data API stays closed (deny-by-default).

create extension if not exists pgcrypto;
create extension if not exists postgis;

create schema if not exists warehouse;
create schema if not exists app;

-- ============================================================ warehouse

create table if not exists warehouse.states (
  code text primary key,
  name text not null,
  region text
);

create table if not exists warehouse.jurisdictions (
  id text primary key,
  state_code text references warehouse.states(code) on delete restrict,
  city_name text not null,
  county text,
  portal_type text default 'socrata',
  parcel_cad_source text,
  total_permits bigint default 0,
  total_valuation_usd numeric(18,2) default 0,
  has_active_storms boolean default false,
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint uq_warehouse_jurisdiction_state_city unique (state_code, city_name)
);

create table if not exists warehouse.canonical_contractors (
  id text primary key,
  canonical_name text not null unique,
  primary_license text,
  headquarters_city text,
  headquarters_state text,
  total_permits bigint default 0,
  total_valuation double precision default 0,
  primary_roof_system text,
  website_url text, hq_address text, phone_number text,
  year_founded integer,
  crew_capacity_estimate text,
  leadership text, manufacturer_certifications text, m_and_a_profile text,
  rcat_profile_url text, rcat_license_number text, rcat_license_type text,
  rcat_member_since integer,
  bbb_profile_url text, bbb_rating text, bbb_accredited boolean default false,
  linkedin_company_url text,
  enrichment_status text, enrichment_updated_at text,
  created_at text, updated_at text
);

create table if not exists warehouse.parcels (
  id text primary key,
  account_number text,
  jurisdiction_id text,
  jurisdiction text,
  address text not null default '',
  city text not null default '',
  county text,
  state text not null default '',
  zip_code text,
  building_sqft bigint,
  land_sqft bigint,
  year_built integer,
  property_type text,
  owner_name text,
  owner_address text, owner_city text, owner_state text, owner_zip text,
  total_valuation double precision,
  improvement_valuation double precision,
  latitude double precision,
  longitude double precision,
  geom_point geometry(Point, 4326),
  data_source text,
  is_mock boolean default false,
  geo_quality text, date_quality text, area_source text,
  year_built_source text, value_source text, source_record_id text,
  retrieved_at text,
  footprint_sqft bigint, stories integer,
  roof_age_years integer, roof_age_basis text, footprint_basis text,
  enriched_at text, data_provenance text, provenance_date text,
  building_sqft_source text, valuation_source text, improvement_sections text,
  last_reroof_date text, last_reroof_permit_no text,
  created_at timestamptz default now()
);

create table if not exists warehouse.normalized_permits (
  id text primary key,
  raw_permit_number text not null,
  jurisdiction_id text,
  parcel_id text,
  contractor_id text,
  source_system text not null default '',
  jurisdiction text not null default '',
  state text not null default '',
  city text not null default '',
  issue_date date,
  applied_date date,
  expiration_date date,
  status text default 'Active',
  normalized_address text not null default '',
  zip_code text,
  valuation double precision default 0,
  valuation_formatted text,
  category text default 'Commercial Re-Roof',
  probable_roof_system text default 'Unspecified Commercial System',
  raw_description text not null default '',
  square_footage bigint,
  contractor_name text not null default '',
  contractor_license text,
  contractor_phone text,
  is_hail_storm_window boolean default false,
  associated_storm_id text,
  is_competitor_capture boolean default false,
  confidence_score integer default 85,
  latitude double precision,
  longitude double precision,
  geom_point geometry(Point, 4326),
  normalized_at text,
  permit_scope text,
  is_pure_reroof boolean default false,
  calibrated_roof_valuation double precision,
  geo_quality text, date_quality text, area_source text,
  year_built_source text, value_source text, source_record_id text,
  retrieved_at text,
  data_source text,
  constraint uq_permit_record unique (raw_permit_number, jurisdiction, issue_date)
);

create table if not exists warehouse.storm_swaths (
  id text primary key,
  storm_name text not null default '',
  event_date date,
  max_hail_inches double precision default 0,
  max_gust_mph double precision,
  jurisdiction_id text,
  properties jsonb default '{}'::jsonb,
  created_at text
);

create table if not exists warehouse.scored_parcel_leads (
  parcel_id text primary key,
  address text, city text, state text, zip_code text,
  owner_name text, property_type text,
  building_sqft bigint, year_built integer,
  cad_total_valuation double precision,
  storm_id text, storm_name text, event_date date,
  max_hail_inches double precision,
  kinetic_energy_joules double precision,
  exposure_score integer, lead_tier text,
  estimated_replacement_low double precision,
  estimated_replacement_high double precision,
  estimated_replacement_mid double precision,
  estimated_replacement_formatted text,
  why_strong_summary text, why_weak_summary text,
  dossier_markdown text,
  created_at text,
  is_mock boolean default false,
  verification_status text, verification_score integer,
  cad_account_id text, cad_property_class text,
  nearest_hail_distance_mi double precision,
  nearest_hail_size_in double precision,
  nearest_hail_location text,
  muni_permit_check_date text, muni_permit_status text,
  aerial_snapshot_url text, aerial_capture_date text,
  evidence_payload_json jsonb,
  footprint_sqft bigint, roof_age_years integer, roof_age_basis text,
  data_provenance text, provenance_date text,
  outbound_ready boolean default false, outbound_block_reason text,
  building_sqft_source text, valuation_source text, year_built_source text
);

create table if not exists warehouse.released_leads (
  parcel_id text primary key,
  state text not null,
  released_at text not null,
  release_reason text
);

create table if not exists warehouse.lead_evidence (
  parcel_id text not null,
  field_name text not null,
  stored_value text,
  source_system text not null,
  source_url text, source_field text,
  retrieved_at text not null,
  raw_excerpt text,
  primary key (parcel_id, field_name)
);

create table if not exists warehouse.manual_disqualifications (
  parcel_id text primary key,
  address text not null,
  disqualification_reason text not null,
  disqualified_by text not null,
  disqualified_at text not null,
  evidence_source text not null
);

create table if not exists warehouse.field_provenance (
  table_name text not null,
  row_id text not null,
  column_name text not null,
  status text not null check (status in ('fetched','computed','defaulted','generated','unknown')),
  source text, source_ref text, retrieved_at text, method text, method_ver text,
  primary key (table_name, row_id, column_name)
);

create table if not exists warehouse.release_fields (
  table_name text not null,
  column_name text not null,
  primary key (table_name, column_name)
);

create table if not exists warehouse.sync_logs (
  id bigserial primary key,
  jurisdiction_id text,
  source_system text not null,
  status text not null,
  records_fetched bigint default 0,
  records_normalized bigint default 0,
  duplicates_removed bigint default 0,
  duration_seconds numeric(10,3) default 0,
  error_message text,
  created_at timestamptz default now()
);

create table if not exists warehouse.harvest_state (
  source text primary key,
  last_oid bigint not null default 0,
  last_run_at timestamptz,
  detail jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Next.js live-cache tables (src/lib/db.ts), moved verbatim into warehouse
-- to avoid the name clash with warehouse.parcels.
create table if not exists warehouse.live_parcels (
  account text primary key,
  owner text not null, address text not null, city text not null,
  year_built integer not null, sqft bigint not null,
  lat double precision not null, lng double precision not null,
  owner_address text not null, record_url text not null, updated_at text not null
);
create table if not exists warehouse.live_permits (
  permit_no text primary key,
  kind text not null, address text not null, city text not null,
  contractor_name text not null, contractor_state text not null,
  issued text not null, valuation bigint not null, scope text not null,
  membrane text, lat double precision not null, lng double precision not null,
  parcel_ids jsonb not null default '[]'::jsonb,
  record_url text not null, portal text not null, updated_at text not null
);
create table if not exists warehouse.permit_contacts (
  id text primary key,
  permit_no text not null, role text not null, name text not null,
  company text, phone text, phone_formatted text, email text,
  email_type text, deliverability text, source text not null, created_at text not null
);
create table if not exists warehouse.hail_reports (
  id text primary key,
  storm_date text not null, valid text not null,
  lat double precision not null, lng double precision not null,
  inches double precision not null, qualifier text not null,
  city text not null, county text not null, source text not null, remark text not null
);
create table if not exists warehouse.warnings (
  storm_date text not null, event_id bigint not null, issue text not null,
  hail_tag double precision not null, wind_tag double precision not null,
  tier text not null, basis text not null, href text not null, expire text not null,
  geometry jsonb not null,
  primary key (storm_date, event_id, issue)
);
create table if not exists warehouse.score_snapshots (
  id bigserial primary key,
  storm_date text not null, account text not null,
  scored_on text not null, scored_at text not null, tier text not null,
  hail_inches double precision not null, hail_basis text not null,
  score integer not null, factors jsonb not null,
  unresolved integer not null, pipeline_value bigint not null, roof_age integer not null,
  unique (storm_date, account, scored_on)
);

create index if not exists idx_np_jurisdiction_date on warehouse.normalized_permits (jurisdiction, issue_date desc);
create index if not exists idx_np_state_city on warehouse.normalized_permits (state, city);
create index if not exists idx_np_valuation on warehouse.normalized_permits (valuation desc);
create index if not exists idx_np_contractor on warehouse.normalized_permits (contractor_name);
create index if not exists idx_np_raw_no on warehouse.normalized_permits (raw_permit_number);
create index if not exists idx_np_parcel on warehouse.normalized_permits (parcel_id, issue_date desc);
create index if not exists idx_parcels_addr_city on warehouse.parcels (lower(address), lower(city));
create index if not exists idx_parcels_city_state on warehouse.parcels (city, state);
create index if not exists idx_parcels_account on warehouse.parcels (account_number);
create index if not exists idx_scored_tier on warehouse.scored_parcel_leads (lead_tier, exposure_score desc);
create index if not exists idx_permit_contacts_permit on warehouse.permit_contacts (permit_no);
create index if not exists idx_storm_swaths_date on warehouse.storm_swaths (event_date desc);

-- ============================================================ app (tenant)

create table if not exists app.orgs (
  id text primary key,
  name text not null,
  disabled integer not null default 0,
  created_at text not null default ''
);
create table if not exists app.users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  name text not null,
  platform_role text not null default '',
  disabled integer not null default 0,
  created_at text not null default '',
  last_login_at text not null default '',
  last_seen_at text not null default ''
);
create table if not exists app.memberships (
  org_id text not null,
  user_id text not null,
  role text not null,
  primary key (org_id, user_id)
);
create table if not exists app.login_links (
  user_id text primary key,
  token_hash text not null unique,
  created_at text not null,
  expires_at text not null
);
create table if not exists app.login_otps (
  email text primary key,
  code_hash text not null,
  created_at text not null,
  expires_at text not null,
  attempts integer not null default 0
);
create table if not exists app.team_invites (
  id text primary key,
  org_id text not null, email text not null, name text not null, role text not null,
  token_hash text not null unique,
  status text not null default 'pending',
  invited_by text not null, created_at text not null, expires_at text not null
);
create index if not exists idx_team_invites_org on app.team_invites (org_id, status);
create table if not exists app.activity (
  id bigserial primary key,
  at text not null, actor_id text, org_id text,
  action text not null, target_type text not null, target_id text not null,
  detail text not null
);
create index if not exists idx_activity_org_at on app.activity (org_id, at desc);
create table if not exists app.leads (
  id text primary key,
  org_id text not null, parcel_id text not null, storm_id text not null,
  address text not null, city text not null, stage text not null,
  assignee text not null, notes text not null,
  score integer not null, hail double precision not null, price double precision not null,
  updated_at text not null,
  unique (org_id, parcel_id, storm_id)
);
create index if not exists idx_leads_org_updated on app.leads (org_id, updated_at desc);
create table if not exists app.field_outcomes (
  id text primary key,
  parcel_id text not null, storm_id text not null, logged_at text not null,
  predicted_score integer not null, factors text not null,
  moisture_verified integer not null, scope text not null,
  contract_value double precision not null, notes text not null,
  org_id text not null default '',
  unique (parcel_id, storm_id)
);
create table if not exists app.pilot_requests (
  id bigserial primary key,
  name text not null default '',
  company text not null default '',
  email text not null default '',
  territory text not null default '',
  size_range text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at text not null default ''
);

create table if not exists app.engine_jobs (
  id text primary key,
  org_id text not null default '',
  requested_by text not null default '',
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','running','complete','error')),
  progress integer not null default 0,
  step text not null default '',
  message text not null default '',
  result jsonb,
  error text,
  created_at timestamptz default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz default now()
);
create index if not exists idx_engine_jobs_queue on app.engine_jobs (status, created_at) where status = 'queued';
create index if not exists idx_engine_jobs_org on app.engine_jobs (org_id, created_at desc);

-- ============================================================ RLS lockdown
-- Server connections (postgres / service role via DATABASE_URL) bypass RLS.
-- anon + authenticated get nothing: the Data API cannot reach these schemas.

do $$
declare t text;
begin
  for t in
    select format('%I.%I', table_schema, table_name)
    from information_schema.tables
    where table_schema in ('warehouse','app') and table_type = 'BASE TABLE'
  loop
    execute format('alter table %s enable row level security', t);
    -- Supabase provides anon/authenticated; plain Postgres may not.
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on %s from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on %s from authenticated', t);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke usage on schema warehouse, app from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke usage on schema warehouse, app from authenticated;
  end if;
end $$;
