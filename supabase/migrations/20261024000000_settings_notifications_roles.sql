-- Migration: 20261024000000_settings_notifications_roles.sql
-- Description: Custom organization roles, granular permissions (including sidebar visibility), and user notification preferences.

-- 1. Create app.org_roles table
create table if not exists app.org_roles (
  id text primary key,
  org_id text not null references app.orgs(id) on delete cascade,
  name text not null,
  description text not null default '',
  color text not null default '#38bdf8',
  is_system boolean not null default false,
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_org_roles_org_name unique (org_id, name)
);

create index if not exists idx_org_roles_org on app.org_roles (org_id);

-- 2. Add role_id to app.memberships
alter table app.memberships add column if not exists role_id text references app.org_roles(id) on delete set null;

-- 3. Create app.user_notification_settings table
create table if not exists app.user_notification_settings (
  user_id text primary key references app.users(id) on delete cascade,
  org_id text not null references app.orgs(id) on delete cascade,
  email_enabled boolean not null default true,
  frequency text not null default 'daily_digest',
  alert_hail_reports boolean not null default true,
  min_hail_size numeric(4,2) not null default 1.50,
  alert_new_leads boolean not null default true,
  min_lead_score integer not null default 80,
  alert_roof_aging boolean not null default true,
  alert_claim_deadlines boolean not null default true,
  alert_contractor_activity boolean not null default false,
  quiet_hours_enabled boolean not null default false,
  quiet_hours_start text not null default '21:00',
  quiet_hours_end text not null default '07:00',
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_notif_org on app.user_notification_settings (org_id);
