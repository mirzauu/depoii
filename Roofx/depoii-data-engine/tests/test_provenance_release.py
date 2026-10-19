"""Released cells must be fetched, or computed with a method."""

import os
import sqlite3
from pathlib import Path

DB = Path(__file__).resolve().parents[1] / "depoii_local.db"


def test_release_fields_have_provenance():
    if not DB.exists():
        return
    conn = sqlite3.connect(DB)
    try:
        tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if "release_fields" not in tables or "field_provenance" not in tables:
            raise AssertionError("release_fields and field_provenance are missing")
        violations = conn.execute(
            """
            SELECT rf.table_name, rf.column_name, COUNT(*) AS violations
            FROM release_fields rf
            JOIN field_provenance fp
              ON fp.table_name = rf.table_name AND fp.column_name = rf.column_name
            WHERE fp.status NOT IN ('fetched', 'computed')
               OR (fp.status = 'computed' AND (fp.method IS NULL OR fp.method = ''))
            GROUP BY 1, 2
            """
        ).fetchall()
        assert violations == []
        permit_cols = {row[1] for row in conn.execute("PRAGMA table_info(release_permits)")}
        parcel_cols = {row[1] for row in conn.execute("PRAGMA table_info(release_parcels)")}
        withheld = {"phone_number", "building_sqft", "year_built", "contractor_phone", "valuation"}
        assert permit_cols.isdisjoint(withheld)
        assert parcel_cols.isdisjoint(withheld)
    finally:
        conn.close()


def test_env_override(monkeypatch, tmp_path):
    """The check reads the engine database next to the package, not an env path."""
    monkeypatch.setenv("DEPOII_DB", str(tmp_path / "other.sqlite"))
    assert os.environ["DEPOII_DB"]
    assert DB.name == "depoii_local.db"
