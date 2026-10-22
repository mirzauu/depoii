-- Login link deactivation, click limits, and usage tracking
alter table app.login_links add column if not exists is_active boolean not null default true;
alter table app.login_links add column if not exists max_uses integer null;
alter table app.login_links add column if not exists use_count integer not null default 0;
alter table app.login_links add column if not exists last_used_at text null;
alter table app.login_links add column if not exists created_by text null;
