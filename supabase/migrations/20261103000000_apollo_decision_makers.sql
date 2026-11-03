-- Migration: Apollo Decision Maker Discovery & Unlocked Contacts Cache
-- Schema: app
-- Ensures 0-credit searches can be saved/deduplicated and 1-credit revealed contacts
-- are permanently cached per organization so credits are never consumed twice.

create table if not exists app.apollo_revealed_contacts (
  id uuid primary key default gen_random_uuid(),
  apollo_person_id text not null,
  org_id text not null default '',
  parcel_id text,
  organization_name text,
  organization_domain text,
  full_name text not null,
  first_name text,
  last_name text,
  title text,
  linkedin_url text,
  city text,
  state text,
  photo_url text,
  email text,
  email_status text,
  phone text,
  phone_type text,
  credits_spent integer default 1,
  revealed_by_user_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint uq_apollo_revealed_org_person unique (org_id, apollo_person_id)
);

create index if not exists idx_apollo_revealed_domain on app.apollo_revealed_contacts (org_id, organization_domain);
create index if not exists idx_apollo_revealed_parcel on app.apollo_revealed_contacts (parcel_id);
create index if not exists idx_apollo_revealed_created on app.apollo_revealed_contacts (org_id, created_at desc);

-- Enable RLS and lock down according to project standard
alter table app.apollo_revealed_contacts enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on app.apollo_revealed_contacts from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on app.apollo_revealed_contacts from authenticated;
  end if;
end $$;

