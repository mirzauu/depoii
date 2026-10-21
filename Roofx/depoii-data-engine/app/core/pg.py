"""Supabase Postgres write access for the local data engine.

The engine runs locally and pushes results up to Supabase; the hosted
Next.js app reads from there. Connection comes from SUPABASE_DB_URL
(direct/session connection, port 5432) — never commit it.

All helpers are optional: when SUPABASE_DB_URL is unset the engine keeps
working against local SQLite exactly as before (dual-write transition).
"""
from __future__ import annotations

import os
from typing import Any, Iterable, Optional, Sequence

_conn = None


def pg_url() -> str:
    url = os.environ.get("SUPABASE_DB_URL") or os.environ.get("DIRECT_URL") or ""
    # SQLAlchemy-style URLs -> plain psycopg DSN
    return url.replace("postgresql+asyncpg://", "postgresql://").replace("postgresql+psycopg2://", "postgresql://")


def available() -> bool:
    return bool(pg_url())


def connect():
    """Process-wide psycopg2 connection (autocommit off; callers commit)."""
    global _conn
    if _conn is not None and not _conn.closed:
        return _conn
    import psycopg2

    _conn = psycopg2.connect(pg_url())
    return _conn


def upsert_rows(table: str, columns: Sequence[str], rows: Iterable[Sequence[Any]], conflict: Sequence[str], chunk: int = 1000) -> int:
    """INSERT ... ON CONFLICT (conflict) DO UPDATE for all non-conflict cols."""
    rows = list(rows)
    if not rows:
        return 0
    from psycopg2.extras import execute_values

    updates = [c for c in columns if c not in conflict]
    set_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in updates) or "DO NOTHING"
    verb = "DO UPDATE SET " + set_clause if updates else "DO NOTHING"
    sql = f"INSERT INTO {table} ({', '.join(columns)}) VALUES %s ON CONFLICT ({', '.join(conflict)}) {verb}"
    conn = connect()
    with conn.cursor() as cur:
        for i in range(0, len(rows), chunk):
            execute_values(cur, sql, rows[i : i + chunk])
    conn.commit()
    return len(rows)


def get_harvest_state(source: str) -> int:
    if not available():
        return 0
    conn = connect()
    with conn.cursor() as cur:
        cur.execute("SELECT last_oid FROM warehouse.harvest_state WHERE source = %s", (source,))
        row = cur.fetchone()
    return int(row[0]) if row else 0


def set_harvest_state(source: str, last_oid: int, detail: Optional[dict] = None) -> None:
    if not available():
        return
    import json

    conn = connect()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO warehouse.harvest_state (source, last_oid, last_run_at, detail, updated_at)
            VALUES (%s, %s, now(), %s::jsonb, now())
            ON CONFLICT (source) DO UPDATE SET
              last_oid = EXCLUDED.last_oid, last_run_at = now(),
              detail = EXCLUDED.detail, updated_at = now()
            """,
            (source, int(last_oid), json.dumps(detail or {})),
        )
    conn.commit()
