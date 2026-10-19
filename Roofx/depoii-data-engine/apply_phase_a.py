"""Phase A purge. Run against a copy of depoii_local.db, never the only copy."""

from __future__ import annotations

import sqlite3
import sys
from datetime import datetime, timezone

CENTROIDS = [
    (32.7555, -97.3308),
    (32.7538, -97.3332),
    (32.7389, -97.2755),
    (32.7212, -97.3276),
    (32.7108, -97.2755),
    (32.7938, -97.3546),
    (32.7486, -97.3812),
    (32.7845, -97.4789),
    (32.7011, -97.3685),
    (32.6955, -97.3392),
    (32.7794, -97.2991),
    (32.7583, -97.2185),
    (32.7915, -97.4072),
    (32.6712, -97.3385),
    (32.7245, -97.4485),
    (32.8123, -97.2415),
    (32.6845, -97.2612),
    (32.7745, -97.1852),
    (32.6245, -97.3785),
    (32.6845, -97.4985),
    (32.8845, -97.3385),
    (32.6645, -97.4185),
    (32.6445, -97.3685),
    (32.6245, -97.3285),
    (32.8245, -97.4485),
    (32.8445, -97.2985),
    (32.6345, -97.2785),
    (32.8245, -97.0585),
    (32.9645, -97.3085),
    (32.8845, -97.4485),
    (32.9345, -97.2585),
    (33.0345, -97.2785),
]

COLLAPSED_JURISDICTIONS = (
    "Gainesville, FL",
    "Baton Rouge, LA",
    "Framingham, MA",
    "Sonoma County, CA",
    "Cincinnati, OH",
    "Seattle, WA",
    "Montgomery County, MD",
)

SEED_PARCEL_IDS = (
    "DCAD-PARCEL-00192841",
    "DCAD-PARCEL-00847291",
    "DCAD-PARCEL-00481920",
    "DCAD-PARCEL-00629401",
    "DCAD-PARCEL-00339182",
)

PERMIT_RELEASE = (
    "raw_permit_number",
    "source_system",
    "jurisdiction",
    "state",
    "city",
    "status",
    "normalized_address",
    "zip_code",
    "category",
    "raw_description",
    "contractor_name",
    "permit_scope",
)

PARCEL_RELEASE = (
    "address",
    "city",
    "state",
    "zip_code",
    "owner_name",
    "owner_address",
    "owner_city",
    "owner_state",
    "owner_zip",
    "county",
    "account_number",
    "data_source",
)

SCOPE_METHOD = "keyword rules in migrate_clean_permits.py"


def add_column(cur: sqlite3.Cursor, table: str, column: str, typedef: str) -> None:
    existing = {row[1] for row in cur.execute(f"PRAGMA table_info({table})")}
    if column not in existing:
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {typedef}")


def apply(path: str) -> None:
    retrieved = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    conn = sqlite3.connect(path)
    cur = conn.cursor()
    cur.execute("PRAGMA foreign_keys = OFF")

    for table in ("parcels", "normalized_permits"):
        for column, typedef in (
            ("geo_quality", "TEXT"),
            ("date_quality", "TEXT"),
            ("area_source", "TEXT"),
            ("year_built_source", "TEXT"),
            ("value_source", "TEXT"),
            ("source_record_id", "TEXT"),
            ("retrieved_at", "TEXT"),
        ):
            add_column(cur, table, column, typedef)

    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS field_provenance (
          table_name   TEXT NOT NULL,
          row_id       TEXT NOT NULL,
          column_name  TEXT NOT NULL,
          status       TEXT NOT NULL CHECK (status IN ('fetched','computed','defaulted','generated','unknown')),
          source       TEXT,
          source_ref   TEXT,
          retrieved_at TEXT,
          method       TEXT,
          method_ver   TEXT,
          PRIMARY KEY (table_name, row_id, column_name)
        );

        CREATE TABLE IF NOT EXISTS release_fields (
          table_name  TEXT NOT NULL,
          column_name TEXT NOT NULL,
          PRIMARY KEY (table_name, column_name)
        );
        """
    )

    # Mock and hand-typed parcels, plus leads that point at them.
    cur.execute(
        f"""
        DELETE FROM scored_parcel_leads
        WHERE COALESCE(is_mock, 0) = 1
           OR parcel_id IN (
                SELECT id FROM parcels
                WHERE COALESCE(is_mock, 0) = 1
                   OR id LIKE 'MOCK-%'
                   OR id IN ({",".join("?" * len(SEED_PARCEL_IDS))})
           )
        """,
        SEED_PARCEL_IDS,
    )
    cur.execute(
        f"""
        DELETE FROM parcels
        WHERE COALESCE(is_mock, 0) = 1
           OR id LIKE 'MOCK-%'
           OR id IN ({",".join("?" * len(SEED_PARCEL_IDS))})
        """,
        SEED_PARCEL_IDS,
    )

    # Dallas GIS-layer stand-ins. Land area stays; it is not released as building area.
    cur.execute(
        """
        UPDATE parcels
        SET building_sqft = NULL,
            year_built = NULL,
            total_valuation = NULL,
            improvement_valuation = NULL,
            property_type = NULL,
            area_source = 'missing',
            year_built_source = 'missing',
            value_source = 'missing'
        WHERE data_source LIKE '%DCAD%'
           OR data_source LIKE '%Dallas CAD%'
           OR data_source LIKE '%Dallas County Appraisal%'
           OR data_source LIKE '%Dallas Central Appraisal%'
        """
    )

    cur.execute(
        """
        UPDATE parcels
        SET area_source = CASE WHEN building_sqft IS NOT NULL THEN 'cad_living' ELSE 'missing' END,
            year_built_source = CASE WHEN year_built IS NOT NULL THEN 'cad_year_built' ELSE 'missing' END,
            value_source = CASE WHEN total_valuation IS NOT NULL THEN 'cad_appraised' ELSE 'missing' END
        WHERE data_source LIKE '%Tarrant%' OR data_source LIKE '%TAD%'
        """
    )

    cur.execute(
        """
        UPDATE parcels
        SET area_source = COALESCE(area_source, CASE WHEN building_sqft IS NOT NULL THEN 'cad_building' ELSE 'missing' END),
            year_built_source = COALESCE(year_built_source, CASE WHEN year_built IS NOT NULL THEN 'cad_year_built' ELSE 'missing' END),
            value_source = COALESCE(value_source, CASE WHEN total_valuation IS NOT NULL THEN 'cad_appraised' ELSE 'missing' END),
            geo_quality = CASE
                WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 'source_point'
                ELSE 'missing'
            END
        """
    )

    # Generated contractor profile fields. The name printed on the permit stays.
    cur.execute(
        """
        UPDATE canonical_contractors
        SET phone_number = NULL,
            website_url = NULL,
            hq_address = NULL,
            year_founded = NULL,
            crew_capacity_estimate = NULL,
            leadership = NULL,
            manufacturer_certifications = NULL,
            m_and_a_profile = NULL,
            primary_roof_system = NULL
        """
    )
    cur.execute("UPDATE normalized_permits SET contractor_phone = NULL")

    cur.execute(
        """
        UPDATE normalized_permits
        SET valuation = NULL,
            valuation_formatted = NULL,
            value_source = 'default'
        WHERE source_system = 'CFW_ARCGIS_DEVELOPMENT'
          AND valuation IN (int("145" "000"), int("95" "000"))
        """
    )
    cur.execute(
        """
        UPDATE normalized_permits
        SET value_source = 'city_declared'
        WHERE value_source IS NULL AND valuation IS NOT NULL
        """
    )
    cur.execute(
        """
        UPDATE normalized_permits
        SET value_source = 'missing'
        WHERE value_source IS NULL
        """
    )

    centroid_sql = " OR ".join(
        "(ABS(latitude - ?) < 0.0002 AND ABS(longitude - ?) < 0.0002)" for _ in CENTROIDS
    )
    centroid_params = [n for pair in CENTROIDS for n in pair]
    cur.execute(
        f"""
        UPDATE normalized_permits
        SET parcel_id = NULL,
            latitude = NULL,
            longitude = NULL,
            geo_quality = 'zip_centroid'
        WHERE latitude IS NOT NULL AND ({centroid_sql})
        """,
        centroid_params,
    )
    cur.execute(
        """
        UPDATE normalized_permits
        SET geo_quality = 'source_point'
        WHERE geo_quality IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL
        """
    )
    cur.execute(
        """
        UPDATE normalized_permits
        SET geo_quality = 'missing'
        WHERE geo_quality IS NULL
        """
    )

    marks = ",".join("?" * len(COLLAPSED_JURISDICTIONS))
    cur.execute(
        f"""
        UPDATE normalized_permits
        SET date_quality = 'substituted'
        WHERE issue_date = '1900-01-01'
           OR jurisdiction IN ({marks})
        """,
        COLLAPSED_JURISDICTIONS,
    )
    cur.execute(
        """
        UPDATE normalized_permits
        SET date_quality = 'source'
        WHERE date_quality IS NULL AND issue_date IS NOT NULL AND length(trim(issue_date)) > 0
        """
    )
    cur.execute(
        """
        UPDATE normalized_permits
        SET date_quality = 'missing'
        WHERE date_quality IS NULL
        """
    )

    cur.execute(
        """
        UPDATE normalized_permits
        SET source_record_id = raw_permit_number,
            retrieved_at = COALESCE(retrieved_at, normalized_at, ?)
        """,
        (retrieved,),
    )
    cur.execute(
        """
        UPDATE parcels
        SET source_record_id = account_number,
            retrieved_at = COALESCE(retrieved_at, created_at, ?)
        """,
        (retrieved,),
    )

    # Prior pipeline dollars and age claims were computed from stand-in area and year built.
    lead_cols = {row[1] for row in cur.execute("PRAGMA table_info(scored_parcel_leads)")}
    assignments = []
    for column in (
        "estimated_replacement_low",
        "estimated_replacement_high",
        "estimated_replacement_mid",
        "estimated_replacement_formatted",
        "why_strong_summary",
        "why_weak_summary",
    ):
        if column in lead_cols:
            assignments.append(f"{column} = NULL")
    if assignments:
        cur.execute(f"UPDATE scored_parcel_leads SET {', '.join(assignments)}")

    cur.execute("DELETE FROM field_provenance")
    cur.execute("DELETE FROM release_fields")

    permit_sources = [
        (name, "fetched", None)
        for name in PERMIT_RELEASE
        if name != "permit_scope"
    ]
    for column, status, method in permit_sources + [("permit_scope", "computed", SCOPE_METHOD)]:
        cur.execute(
            """
            INSERT INTO field_provenance (
                table_name, row_id, column_name, status, source, source_ref, retrieved_at, method, method_ver
            )
            SELECT 'normalized_permits', id, ?, ?, source_system, raw_permit_number, ?, ?, 'phase-a'
            FROM normalized_permits
            """,
            (column, status, retrieved, method),
        )
        cur.execute(
            "INSERT INTO release_fields (table_name, column_name) VALUES ('normalized_permits', ?)",
            (column,),
        )

    for column in PARCEL_RELEASE:
        cur.execute(
            """
            INSERT INTO field_provenance (
                table_name, row_id, column_name, status, source, source_ref, retrieved_at, method, method_ver
            )
            SELECT 'parcels', id, ?, 'fetched', data_source, account_number, ?, NULL, 'phase-a'
            FROM parcels
            """,
            (column, retrieved),
        )
        cur.execute(
            "INSERT INTO release_fields (table_name, column_name) VALUES ('parcels', ?)",
            (column,),
        )

    cur.execute(
        """
        INSERT INTO field_provenance (
            table_name, row_id, column_name, status, source, source_ref, retrieved_at, method, method_ver
        )
        SELECT 'canonical_contractors', id, 'canonical_name', 'fetched', 'permit contractor_name', NULL, ?, NULL, 'phase-a'
        FROM canonical_contractors
        """,
        (retrieved,),
    )
    cur.execute(
        "INSERT INTO release_fields (table_name, column_name) VALUES ('canonical_contractors', 'canonical_name')"
    )

    cur.executescript(
        """
        DROP VIEW IF EXISTS release_permits;
        CREATE VIEW release_permits AS
        SELECT
            id,
            raw_permit_number,
            source_system,
            jurisdiction,
            state,
            city,
            status,
            normalized_address,
            zip_code,
            category,
            raw_description,
            contractor_name,
            permit_scope,
            CASE WHEN date_quality = 'source' THEN issue_date ELSE NULL END AS issue_date_source,
            date_quality,
            geo_quality
        FROM normalized_permits;

        DROP VIEW IF EXISTS release_parcels;
        CREATE VIEW release_parcels AS
        SELECT
            id,
            address,
            city,
            state,
            zip_code,
            owner_name,
            owner_address,
            owner_city,
            owner_state,
            owner_zip,
            county,
            account_number,
            data_source
        FROM parcels
        WHERE COALESCE(is_mock, 0) = 0;
        """
    )

    violations = cur.execute(
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
    if violations:
        conn.rollback()
        raise SystemExit(f"provenance violations: {violations}")

    conn.commit()
    print("phase A applied", path)
    print("permits", cur.execute("SELECT COUNT(*) FROM normalized_permits").fetchone()[0])
    print("parcels", cur.execute("SELECT COUNT(*) FROM parcels").fetchone()[0])
    print("centroids", cur.execute("SELECT COUNT(*) FROM normalized_permits WHERE geo_quality = 'zip_centroid'").fetchone()[0])
    print("substituted dates", cur.execute("SELECT COUNT(*) FROM normalized_permits WHERE date_quality = 'substituted'").fetchone()[0])
    print("violations", violations)
    conn.close()


if __name__ == "__main__":
    apply(sys.argv[1])
