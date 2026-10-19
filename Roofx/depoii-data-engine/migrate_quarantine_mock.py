import sqlite3

DB_PATH = "depoii_local.db"

def run_quarantine_migration():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    print("[*] Checking parcels schema...")
    cur.execute("PRAGMA table_info(parcels)")
    parcel_cols = [c[1] for c in cur.fetchall()]
    if "is_mock" not in parcel_cols:
        print("[+] Adding is_mock column to parcels table...")
        cur.execute("ALTER TABLE parcels ADD COLUMN is_mock INTEGER DEFAULT 0")
    else:
        print("[i] is_mock column already exists in parcels.")

    print("[*] Checking scored_parcel_leads schema...")
    cur.execute("PRAGMA table_info(scored_parcel_leads)")
    scored_cols = [c[1] for c in cur.fetchall()]
    if "is_mock" not in scored_cols:
        print("[+] Adding is_mock column to scored_parcel_leads table...")
        cur.execute("ALTER TABLE scored_parcel_leads ADD COLUMN is_mock INTEGER DEFAULT 0")
    else:
        print("[i] is_mock column already exists in scored_parcel_leads.")

    # Quarantine mock records
    print("[*] Tagging mock records...")
    cur.execute("UPDATE parcels SET is_mock = 1 WHERE id LIKE 'MOCK-%'")
    parcels_mock_count = cur.rowcount
    cur.execute("UPDATE parcels SET is_mock = 0 WHERE id NOT LIKE 'MOCK-%'")

    cur.execute("UPDATE scored_parcel_leads SET is_mock = 1 WHERE parcel_id LIKE 'MOCK-%'")
    scored_mock_count = cur.rowcount
    cur.execute("UPDATE scored_parcel_leads SET is_mock = 0 WHERE parcel_id NOT LIKE 'MOCK-%'")

    conn.commit()

    # Verification counts
    cur.execute("SELECT is_mock, COUNT(*) FROM parcels GROUP BY is_mock")
    parcel_audit = cur.fetchall()
    cur.execute("SELECT is_mock, COUNT(*) FROM scored_parcel_leads GROUP BY is_mock")
    scored_audit = cur.fetchall()

    conn.close()

    print("\n--- QUARANTINE AUDIT RESULTS ---")
    print("Parcels table breakdown:")
    for is_mock, count in parcel_audit:
        label = "MOCK (QUARANTINED)" if is_mock == 1 else "REAL VERIFIED"
        print(f"  • {label}: {count:,} rows")

    print("\nScored Parcel Leads breakdown:")
    for is_mock, count in scored_audit:
        label = "MOCK (QUARANTINED)" if is_mock == 1 else "REAL VERIFIED"
        print(f"  • {label}: {count:,} rows")

if __name__ == "__main__":
    run_quarantine_migration()
