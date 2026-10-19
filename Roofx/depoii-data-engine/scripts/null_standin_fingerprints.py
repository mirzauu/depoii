"""Null known stand-in values. Refuses the canonical depoii_local.db path.

Run only against a dated backup. Nulling a cell is not a true replacement value.
"""

from __future__ import annotations

import os
import sqlite3
import sys
from datetime import datetime, timezone


def _refuse_canonical(db_path: str) -> None:
    name = os.path.basename(os.path.abspath(db_path)).lower()
    parent = os.path.basename(os.path.dirname(os.path.abspath(db_path))).lower()
    if name == "depoii_local.db" and parent == "depoii-data-engine":
        raise SystemExit("Refusing to edit the canonical depoii_local.db. Pass a dated backup path.")


def null_standins(conn: sqlite3.Connection) -> dict:
    counts = {}
    statements = [
        (
            "scored_valuation_times_165",
            """
            UPDATE scored_parcel_leads
            SET cad_total_valuation = NULL
            WHERE building_sqft > 0
              AND ABS(cad_total_valuation - building_sqft * 165) < 1
            """,
        ),
        (
            "dallas_year_1996_missing",
            """
            UPDATE parcels
            SET year_built = NULL
            WHERE year_built = 1996 AND lower(COALESCE(year_built_source, '')) = 'missing'
            """,
        ),
        (
            "footprint_land_times_065",
            """
            UPDATE parcels
            SET footprint_sqft = NULL
            WHERE land_sqft > 0
              AND footprint_sqft = CAST(ROUND(land_sqft * 0.65) AS INT)
            """,
        ),
        (
            "replacement_from_065_footprint",
            """
            UPDATE scored_parcel_leads
            SET estimated_replacement_mid = NULL,
                estimated_replacement_low = NULL,
                estimated_replacement_high = NULL,
                estimated_replacement_formatted = NULL
            WHERE parcel_id IN (
                SELECT s.parcel_id
                FROM scored_parcel_leads s
                JOIN parcels p ON p.id = s.parcel_id
                WHERE p.land_sqft > 0
                  AND s.footprint_sqft = CAST(ROUND(p.land_sqft * 0.65) AS INT)
                  AND ABS(s.estimated_replacement_mid - s.footprint_sqft * 9.4) < 1.5
            )
            """,
        ),
            (
            "scored_footprint_land_times_065",
            """
            UPDATE scored_parcel_leads
            SET footprint_sqft = NULL
            WHERE parcel_id IN (
                SELECT s.parcel_id FROM scored_parcel_leads s
                JOIN parcels p ON p.id = s.parcel_id
                WHERE p.land_sqft > 0
                  AND s.footprint_sqft = CAST(ROUND(p.land_sqft * 0.65) AS INT)
            )
            """,
        ),
        (
            "distance_exactly_1_5",
            """
            UPDATE scored_parcel_leads
            SET nearest_hail_distance_mi = NULL
            WHERE ABS(nearest_hail_distance_mi - 1.5) < 0.001
            """,
        ),
        (
            "event_date_2026_03_17",
            """
            UPDATE scored_parcel_leads
            SET event_date = NULL, storm_name = NULL, max_hail_inches = NULL
            WHERE event_date = '2026-03-17'
            """,
        ),
        (
            "dallas_default_permit_value",
            """
            UPDATE normalized_permits
            SET valuation = NULL
            WHERE source_system = 'DALLAS_ARCGIS_FY24'
              AND valuation IN (20000, 75000)
            """,
        ),
        (
            "substituted_issue_date",
            """
            UPDATE normalized_permits
            SET issue_date = NULL
            WHERE date_quality = 'substituted'
            """,
        ),
    ]
    for name, sql in statements:
        try:
            cur = conn.execute(sql)
            counts[name] = cur.rowcount
        except sqlite3.OperationalError as exc:
            counts[name] = f"skipped: {exc}"
    return counts


def main(db_path: str) -> None:
    _refuse_canonical(db_path)
    conn = sqlite3.connect(db_path)
    try:
        counts = null_standins(conn)
        conn.commit()
    finally:
        conn.close()
    stamp = datetime.now(timezone.utc).isoformat()
    print(f"RUN_UTC {stamp}")
    print(f"db {db_path}")
    for key, value in counts.items():
        print(f"{key} {value}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("Usage: null_standin_fingerprints.py <backup.db>")
    main(sys.argv[1])
