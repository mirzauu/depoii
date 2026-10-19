"""
Migration: Add provenance columns to parcels and scored_parcel_leads.
Enforces the Live-Only Verification architecture and quarantines all legacy/seed records.
"""

import sqlite3
import os
import sys

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "depoii_local.db")

def run_migration():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database file not found at {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print(f"Connected to database: {DB_PATH}")

    # Helper to check columns
    def get_columns(table_name):
        cursor.execute(f"PRAGMA table_info({table_name})")
        return [row[1] for row in cursor.fetchall()]

    # 1. PARCELS table columns
    parcels_cols = set(get_columns("parcels"))
    parcels_additions = [
        ("data_provenance", "TEXT DEFAULT 'unverified_seed'"),
        ("provenance_date", "TEXT"),
        ("building_sqft_source", "TEXT"),
        ("valuation_source", "TEXT"),
        ("year_built_source", "TEXT"),
        ("improvement_sections", "TEXT"),
        ("stories", "INTEGER"),
        ("footprint_sqft", "INTEGER"),
    ]

    for col_name, col_def in parcels_additions:
        if col_name not in parcels_cols:
            print(f"Adding column '{col_name}' to parcels...")
            cursor.execute(f"ALTER TABLE parcels ADD COLUMN {col_name} {col_def}")
        else:
            print(f"Column '{col_name}' already exists on parcels.")

    # 2. SCORED_PARCEL_LEADS table columns
    scored_cols = set(get_columns("scored_parcel_leads"))
    scored_additions = [
        ("data_provenance", "TEXT DEFAULT 'unverified_seed'"),
        ("provenance_date", "TEXT"),
        ("outbound_ready", "INTEGER DEFAULT 0"),
        ("outbound_block_reason", "TEXT"),
        ("building_sqft_source", "TEXT"),
        ("valuation_source", "TEXT"),
        ("year_built_source", "TEXT"),
    ]

    for col_name, col_def in scored_additions:
        if col_name not in scored_cols:
            print(f"Adding column '{col_name}' to scored_parcel_leads...")
            cursor.execute(f"ALTER TABLE scored_parcel_leads ADD COLUMN {col_name} {col_def}")
        else:
            print(f"Column '{col_name}' already exists on scored_parcel_leads.")

    conn.commit()

    # 3. Quarantine existing data
    print("Quarantining existing data...")
    cursor.execute("UPDATE parcels SET data_provenance = 'unverified_seed' WHERE data_provenance IS NULL")
    parcels_quarantined = cursor.rowcount

    cursor.execute("""
        UPDATE scored_parcel_leads
        SET data_provenance = 'unverified_seed',
            outbound_ready = 0,
            outbound_block_reason = 'unverified_seed legacy record'
        WHERE data_provenance IS NULL OR data_provenance = 'unverified_seed'
    """)
    scored_quarantined = cursor.rowcount

    conn.commit()
    conn.close()

    print(f"\nMigration successfully applied.")
    print(f"Parcels quarantined: {parcels_quarantined}")
    print(f"Scored leads blocked: {scored_quarantined}")

if __name__ == "__main__":
    run_migration()
