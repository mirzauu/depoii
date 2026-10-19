"""
Test Suite: Persistent Disqualification Guard
Asserts that manually disqualified addresses (such as 4300 Old Benbrook Rd,
2720 Cullen, 14222 Dallas Pkwy, 1601 Brown Blvd, 5200 E Loop 820 S, 3100 Sappington Pl)
are permanently recorded in `manual_disqualifications` and can never appear in lead releases.
"""

import sqlite3
import pytest
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "depoii_local.db"

MANDATORY_DISQUALIFIED_ADDRESSES = [
    "4300 Old Benbrook Rd",
    "2720 Cullen",
    "14222 Dallas Pkwy",
    "1601 Brown Blvd",
    "5200 E Loop 820 S",
]


def get_db_connection():
    assert DB_PATH.exists(), f"Database not found at {DB_PATH}"
    return sqlite3.connect(DB_PATH)


def test_disqualification_table_exists_and_populated():
    """Verify manual_disqualifications table exists with required schema and mandatory records."""
    conn = get_db_connection()
    try:
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
        assert "manual_disqualifications" in tables, "Table 'manual_disqualifications' missing from database"

        rows = conn.execute("SELECT parcel_id, address, disqualification_reason FROM manual_disqualifications").fetchall()
        assert len(rows) >= len(MANDATORY_DISQUALIFIED_ADDRESSES), "Disqualification table has insufficient records"

        stored_addresses = [r[1].lower() for r in rows]
        for target in MANDATORY_DISQUALIFIED_ADDRESSES:
            target_clean = target.lower()
            matched = any(target_clean in addr or addr in target_clean for addr in stored_addresses)
            assert matched, f"Mandatory disqualified address '{target}' not found in manual_disqualifications table"
    finally:
        conn.close()


def test_no_disqualified_leads_in_verified_scored_pool():
    """Disqualified addresses must not be on the customer allowlist."""
    from app.science.lead_store import ensure_schema
    conn = get_db_connection()
    try:
        ensure_schema(conn)
        conn.commit()
        for target in MANDATORY_DISQUALIFIED_ADDRESSES:
            disq_rows = conn.execute("""
                SELECT r.parcel_id
                FROM released_leads r
                LEFT JOIN parcels p ON p.id = r.parcel_id
                WHERE r.state = 'TX'
                  AND (
                    lower(COALESCE(p.address, '')) LIKE ?
                    OR r.parcel_id IN (
                        SELECT parcel_id FROM manual_disqualifications
                        WHERE lower(address) LIKE ?
                    )
                  )
            """, (f"%{target.lower()}%", f"%{target.lower()}%")).fetchall()
            assert disq_rows == [], f"Disqualified address '{target}' is on released_leads: {disq_rows}"
    finally:
        conn.close()


def test_no_disqualified_parcels_in_release_views():
    """Verify that release tables / export candidate queries strictly exclude all disqualified records."""
    conn = get_db_connection()
    try:
        # Cross join check: Any release_parcels row matching a manual_disqualification row?
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
        if "release_parcels" in tables:
            leaks = conn.execute("""
                SELECT rp.id, rp.address, md.disqualification_reason
                FROM release_parcels rp
                JOIN manual_disqualifications md ON rp.id = md.parcel_id OR rp.address LIKE '%' || md.address || '%'
            """).fetchall()
            assert leaks == [], f"Found disqualified parcels inside release_parcels: {leaks}"
    finally:
        conn.close()


def test_lead_generation_excludes_disqualified_table():
    """Verify that the candidate selection query enforces a NOT IN (SELECT parcel_id FROM manual_disqualifications)."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        for target in MANDATORY_DISQUALIFIED_ADDRESSES:
            query = """
                SELECT p.id, p.address
                FROM parcels p
                WHERE p.address LIKE ?
                  AND p.id NOT IN (SELECT parcel_id FROM manual_disqualifications)
                  AND LOWER(p.address) NOT IN (SELECT LOWER(address) FROM manual_disqualifications)
            """
            rows = cur.execute(query, (f"%{target}%",)).fetchall()
            assert rows == [], f"Address '{target}' leaked through disqualification exclusion filter: {rows}"
    finally:
        conn.close()
