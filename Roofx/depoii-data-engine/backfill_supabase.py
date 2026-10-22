"""Idempotent SQLite -> Supabase backfill (Phase 2).

Reads both local SQLite databases and upserts into the warehouse/app
schemas created by supabase/migrations/20261020000000_depoii_fullstack.sql.

Usage:
  SUPABASE_DB_URL=postgresql://... py backfill_supabase.py [--skip-provenance] [--tables a,b]

Safe to re-run: every write is INSERT ... ON CONFLICT DO UPDATE.
Type conversion is driven by the live Postgres column types.
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from datetime import datetime

try:
    from dotenv import load_dotenv
    root_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
    load_dotenv(root_env)
    if not os.environ.get("SUPABASE_DB_URL") and os.environ.get("DIRECT_URL"):
        os.environ["SUPABASE_DB_URL"] = os.environ["DIRECT_URL"]
except ImportError:
    pass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.core import pg  # noqa: E402

ENGINE_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "depoii_local.db")
NEXT_DB = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "depoii.sqlite"))

# sqlite table -> (pg table, conflict keys, {sqlite_col: pg_col})
ENGINE_TABLES = {
    "normalized_permits": ("warehouse.normalized_permits", ["raw_permit_number", "jurisdiction", "issue_date"], {}),
    "canonical_contractors": ("warehouse.canonical_contractors", ["id"], {}),
    "storm_swaths": ("warehouse.storm_swaths", ["id"], {}),
    "parcels": ("warehouse.parcels", ["id"], {}),
    "scored_parcel_leads": ("warehouse.scored_parcel_leads", ["parcel_id"], {}),
    "released_leads": ("warehouse.released_leads", ["parcel_id"], {}),
    "lead_evidence": ("warehouse.lead_evidence", ["parcel_id", "field_name"], {}),
    "manual_disqualifications": ("warehouse.manual_disqualifications", ["parcel_id"], {}),
    "field_provenance": ("warehouse.field_provenance", ["table_name", "row_id", "column_name"], {}),
    "release_fields": ("warehouse.release_fields", ["table_name", "column_name"], {}),
}
NEXT_TABLES = {
    "orgs": ("app.orgs", ["id"], {}),
    "users": ("app.users", ["email"], {}),
    "memberships": ("app.memberships", ["org_id", "user_id"], {}),
    "login_links": ("app.login_links", ["user_id"], {}),
    "login_otps": ("app.login_otps", ["email"], {}),
    "team_invites": ("app.team_invites", ["id"], {}),
    "activity": ("app.activity", ["id"], {}),
    "leads": ("app.leads", ["id"], {}),
    "field_outcomes": ("app.field_outcomes", ["id"], {}),
    "parcels": ("warehouse.live_parcels", ["account"], {}),
    "permits": ("warehouse.live_permits", ["permit_no"], {}),
    "permit_contacts": ("warehouse.permit_contacts", ["id"], {}),
    "hail_reports": ("warehouse.hail_reports", ["id"], {}),
    "warnings": ("warehouse.warnings", ["storm_date", "event_id", "issue"], {}),
    "score_snapshots": ("warehouse.score_snapshots", ["id"], {}),
}

BOOL_COLS = {"is_hail_storm_window", "is_competitor_capture", "is_pure_reroof", "is_mock", "outbound_ready", "bbb_accredited", "has_active_storms"}


def pg_columns(cur, table: str) -> dict[str, tuple[str, bool]]:
    schema, name = table.split(".")
    cur.execute(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema=%s AND table_name=%s",
        (schema, name),
    )
    return {r[0]: (r[1], r[2] == "YES") for r in cur.fetchall()}


def convert(value, col_meta: tuple[str, bool], col: str):
    pg_type, is_nullable = col_meta
    if value is None or value == "":
        if not is_nullable:
            if col in ("created_at", "updated_at", "issue_date", "filing_date"):
                return datetime.now().isoformat()
            if pg_type in ("text", "character varying"):
                return ""
            if pg_type in ("bigint", "integer", "smallint"):
                return 0
            if pg_type in ("double precision", "numeric", "real"):
                return 0.0
            if col in BOOL_COLS or pg_type == "boolean":
                return False
        return None
    if col in BOOL_COLS or pg_type == "boolean":
        return bool(int(value)) if isinstance(value, (int, float, str)) and str(value).strip() in ("0", "1") else bool(value)
    if pg_type in ("jsonb", "json"):
        if isinstance(value, (dict, list)):
            return json.dumps(value)
        try:
            json.loads(str(value))
            return value
        except Exception:
            return json.dumps(str(value))
    if pg_type == "date":
        text = str(value)[:10]
        try:
            datetime.strptime(text, "%Y-%m-%d")
            return text
        except Exception:
            return None if is_nullable else "2026-01-01"
    if pg_type in ("double precision", "numeric", "real"):
        try:
            return float(value)
        except Exception:
            return None if is_nullable else 0.0
    if pg_type in ("bigint", "integer", "smallint"):
        try:
            return int(float(value))
        except Exception:
            return None if is_nullable else 0
    return value


def copy_table(sqlite_path: str, sqlite_table: str, spec, pg_cur, chunk=2500) -> int:
    pg_table, conflict, rename = spec
    if not os.path.exists(sqlite_path):
        print(f"  skip {sqlite_table}: {sqlite_path} missing")
        return 0
    cols_meta = pg_columns(pg_cur, pg_table)
    if not cols_meta:
        print(f"  skip {sqlite_table}: PG table {pg_table} not found (run migrations first)")
        return 0
    conn = sqlite3.connect(f"file:{sqlite_path}?mode=ro", uri=True)
    try:
        sqlite_cols = [r[1] for r in conn.execute(f"PRAGMA table_info({sqlite_table})")]
        pairs = [(s, rename.get(s, s)) for s in sqlite_cols if rename.get(s, s) in cols_meta and rename.get(s, s) != "geom_point"]
        if not pairs:
            print(f"  skip {sqlite_table}: no shared columns")
            return 0
        total = conn.execute(f"SELECT COUNT(*) FROM {sqlite_table}").fetchone()[0]
        print(f"  {sqlite_table} -> {pg_table}: {total:,} rows")
        done = 0
        offset = 0
        select_cols = ", ".join(f'"{s}"' for s, _ in pairs)
        while True:
            rows = conn.execute(f"SELECT {select_cols} FROM {sqlite_table} LIMIT {chunk} OFFSET {offset}").fetchall()
            if not rows:
                break
            converted = [tuple(convert(v, cols_meta[p], p) for (s, p), v in zip(pairs, row)) for row in rows]
            pg.upsert_rows(pg_table, [p for _, p in pairs], converted, conflict, chunk=chunk)
            done += len(rows)
            offset += chunk
            print(f"    {done:,}/{total:,}")
        return done
    finally:
        conn.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-provenance", action="store_true", help="skip the 1.3M-row field_provenance table")
    ap.add_argument("--tables", default="", help="comma-separated sqlite table names to limit to")
    args = ap.parse_args()
    if not pg.available():
        raise SystemExit("SUPABASE_DB_URL is not set.")
    conn = pg.connect()
    cur = conn.cursor()
    only = {t.strip() for t in args.tables.split(",") if t.strip()}
    grand = 0
    for label, path, mapping in (("engine", ENGINE_DB, ENGINE_TABLES), ("next", NEXT_DB, NEXT_TABLES)):
        print(f"[{label}] {path}")
        for sqlite_table, spec in mapping.items():
            if only and sqlite_table not in only:
                continue
            if args.skip_provenance and sqlite_table == "field_provenance":
                continue
            grand += copy_table(path, sqlite_table, spec, cur)
    # QA target from the harvester
    cur.execute("SELECT raw_permit_number, issue_date::text, permit_scope, is_pure_reroof FROM warehouse.normalized_permits WHERE raw_permit_number='1601191013'")
    qa = cur.fetchone()
    print(f"QA permit 1601191013: {'FOUND ' + str(qa) if qa else 'NOT FOUND'}")
    print(f"Backfill complete: {grand:,} rows upserted.")


if __name__ == "__main__":
    main()
