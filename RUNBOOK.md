# Depoii Operations & Engineering Runbook

## 1. System Architecture

Depoii runs as a hybrid architecture:
- **Web App (Vercel)**: Next.js 16 full-stack serverless deployment.
  - Queries Supabase Postgres directly over the Supabase transaction pooler (port `6543`) with parameterized SQL (`src/lib/pg.ts`).
  - Auth: Custom session cookie (`scrypt` password hashing + HMAC tokens) stored in `app.users` and `app.orgs`. No Supabase Auth client required.
  - Deny-by-default RLS: Anon/authenticated roles have no grants on `warehouse.*` or `app.*` schemas.
- **Database (Supabase Postgres)**:
  - `warehouse` schema: Engine data (`normalized_permits`, `parcels`, `canonical_contractors`, `storm_swaths`, `scored_parcel_leads`, `released_leads`, `lead_evidence`, `live_*`).
  - `app` schema: Tenant & system tables (`orgs`, `users`, `memberships`, `leads`, `field_outcomes`, `activity`, `engine_jobs`, `harvest_state`).
- **Data Engine & Worker (Local Machine / Server)**:
  - Local Python processes for heavy computations: GIS parcel matching, ArcGIS/Socrata municipal harvesters, NOAA SPC storm feeds, CAD live scrapers, and ESRI aerial snapshots.
  - Background worker (`python -m app.worker`) polls `app.engine_jobs` using `SELECT ... FOR UPDATE SKIP LOCKED`.

---

## 2. Environment Variables

### Next.js Full-Stack App (`.env` / Vercel Environment)

```env
# Database Connection (Transaction Pooler, port 6543)
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct Connection (Migrations & DDL only, port 5432)
DIRECT_URL="postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres"

# Backend Engine routing flag ("supabase" for direct DB reads, "fastapi" for legacy proxy)
ENGINE_BACKEND="supabase"

# Auth & Admin secrets
DEPOII_SESSION_SECRET="your-32-byte-hex-secret"
DEPOII_SUPERADMIN_EMAIL="admin@depoii.local"
DEPOII_SUPERADMIN_PASSWORD="superadmin-password"
DEPOII_INVITE_CODE="pilot-only"

# SMTP Outbound Email
SMTP_HOST="smtp.hostinger.com"
SMTP_PORT=465
SMTP_USER="hello@yourdomain.com"
SMTP_PASS="your-smtp-password"
PILOT_NOTIFY_EMAIL="hello@yourdomain.com"
```

### Local Data Engine (`Roofx/depoii-data-engine/.env`)

```env
ENVIRONMENT=development
SUPABASE_DB_URL="postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres"
SYNC_DATABASE_URL="postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres"
LOG_LEVEL=INFO
```

---

## 3. How to Run the Local Engine & Worker

### Running the Asynchronous Job Worker
The worker claims queued verification audits and municipal synchronization jobs submitted from the Next.js UI:

```bash
cd Roofx/depoii-data-engine
# Activate virtual environment if present:
# .\.venv\Scripts\Activate.ps1
python -m app.worker
```

The worker connects to Supabase, logs claims, updates step-by-step progress (0-100%) in `app.engine_jobs`, and writes verified evidence cards directly to `warehouse.scored_parcel_leads` and `warehouse.lead_evidence`.

### Running Local FastAPI (Optional / Debugging)
FastAPI can still be run locally for API introspection and legacy debugging:

```bash
cd Roofx/depoii-data-engine
python -m app.main
```

---

## 4. How to Add a New Harvest Source

When adding a municipal or county open data source:

1. **Create the Harvester Script** under `Roofx/depoii-data-engine/` (e.g. `harvest_newcity_permits.py`).
2. **Utilize `harvest_state` for Resumption**:
   ```python
   from app.core import pg

   # Read last processed OID / watermark
   last_oid = pg.get_harvest_state("newcity_source_key")

   # ... run harvest loop and batch process ...

   # Push batches directly to Supabase warehouse
   pg.upsert_rows(
       "warehouse.normalized_permits",
       cols,
       batch_rows,
       conflict=["id"],
   )

   # Update watermark
   pg.set_harvest_state("newcity_source_key", current_oid, {"scanned": count})
   ```
3. **Idempotence**: Always specify primary key conflicts (`["id"]` or `["raw_permit_number", "jurisdiction", "issue_date"]`).
4. **Schedule Execution**: Run manually or configure via Windows Task Scheduler / systemd cron on the local server.

---

## 5. Monitoring Job Health in Supabase Studio

In Supabase Studio (SQL Editor or Table Editor):

- **View Active & Queued Jobs**:
  ```sql
  SELECT id, type, status, progress, step, message, created_at, started_at
  FROM app.engine_jobs
  ORDER BY created_at DESC
  LIMIT 20;
  ```
- **Inspect Failed Jobs**:
  ```sql
  SELECT id, type, error, payload, finished_at
  FROM app.engine_jobs
  WHERE status = 'error'
  ORDER BY updated_at DESC;
  ```
- **Clear Stale Running Jobs** (e.g., if worker process died mid-flight):
  ```sql
  UPDATE app.engine_jobs
  SET status = 'error', error = 'Worker timeout / process restarted'
  WHERE status = 'running' AND updated_at < now() - interval '1 hour';
  ```

---

## 6. Rollback & Fail-Safe Procedures

1. **Per-Route Engine Fallback**:
   If an unexpected issue occurs with Supabase warehouse queries:
   - Set `ENGINE_BACKEND=fastapi` in Vercel environment variables and redeploy or restart the process.
   - The route handler `/api/engine/[...path]/route.ts` will instantly switch back to proxying requests to `DEPOII_ENGINE_URL`.
2. **Vercel Instant Rollback**:
   In Vercel Dashboard -> Project Deployments -> select previous deployment -> **Instant Rollback**.
3. **Local SQLite Cache Fallback**:
   The local SQLite databases (`Roofx/depoii-data-engine/depoii_local.db` and `data/depoii.sqlite`) remain available on the local filesystem. Running `python sync_local_db.py` pulls down warehouse updates from Postgres to refresh local SQLite if required.
