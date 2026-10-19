import sqlite3

def run_migration():
    conn = sqlite3.connect('depoii_local.db')
    cur = conn.cursor()
    
    cur.execute("PRAGMA table_info(scored_parcel_leads)")
    existing_cols = [c[1] for c in cur.fetchall()]
    
    new_cols = [
        ("verification_status", "TEXT DEFAULT 'UNVERIFIED'"),
        ("verification_score", "INTEGER DEFAULT 0"),
        ("cad_account_id", "TEXT"),
        ("cad_property_class", "TEXT"),
        ("nearest_hail_distance_mi", "REAL"),
        ("nearest_hail_size_in", "REAL"),
        ("nearest_hail_location", "TEXT"),
        ("muni_permit_check_date", "TEXT"),
        ("muni_permit_status", "TEXT"),
        ("aerial_snapshot_url", "TEXT"),
        ("aerial_capture_date", "TEXT"),
        ("evidence_payload_json", "TEXT")
    ]
    
    added = []
    for col_name, col_def in new_cols:
        if col_name not in existing_cols:
            cur.execute(f"ALTER TABLE scored_parcel_leads ADD COLUMN {col_name} {col_def}")
            added.append(col_name)
            
    conn.commit()
    conn.close()
    print(f"Migration completed successfully. Added columns: {added}")

if __name__ == "__main__":
    run_migration()
