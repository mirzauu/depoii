import sqlite3
from datetime import datetime

conn = sqlite3.connect(r'd:\Depoii_nextjs\Roofx\depoii-data-engine\depoii_local.db')
cur = conn.cursor()

# 1. Create table
cur.execute("""
CREATE TABLE IF NOT EXISTS manual_disqualifications (
    parcel_id TEXT PRIMARY KEY,
    address TEXT NOT NULL,
    disqualification_reason TEXT NOT NULL,
    disqualified_by TEXT NOT NULL,
    disqualified_at TEXT NOT NULL,
    evidence_source TEXT NOT NULL
);
""")

# 2. Known rejections with exact primary parcel_id from parcels table
disqualifications = [
    (
        "TAD-PARCEL-04433254",
        "4300 Old Benbrook Rd",
        "Multi-building residential community with pitched shingle roofs (multifamily/HOA layout)",
        "aerial_imagery_audit",
        datetime.now().isoformat(),
        "ESRI / Google Aerial Inspection: Pitched shingle multi-family structures, not commercial low-slope"
    ),
    (
        "TAD-PARCEL-00112046",
        "2720 Cullen St",
        "Disqualified during manual triage - industrial corridor screening failure",
        "manual_review",
        datetime.now().isoformat(),
        "Manual triage audit"
    ),
    (
        "TAD-PARCEL-00111953",
        "2720 Cullen",
        "Disqualified during manual triage",
        "manual_review",
        datetime.now().isoformat(),
        "Manual triage audit"
    ),
    (
        "DCAD-PARCEL-00000662970600000",
        "14222 Dallas Pkwy",
        "Disqualified during Dallas corridor audit",
        "manual_review",
        datetime.now().isoformat(),
        "Dallas corridor triage"
    ),
    (
        "DCAD-PARCEL-14222",
        "14222 Dallas Pkwy",
        "Disqualified during Dallas corridor audit",
        "manual_review",
        datetime.now().isoformat(),
        "Dallas corridor triage"
    ),
    (
        "TAD-PARCEL-05647290",
        "1601 Brown Blvd",
        "Multifamily apartment complex (Kv Elmsgate Apartments)",
        "property_use_audit",
        datetime.now().isoformat(),
        "TAD Property Class & Aerial Audit: Multifamily Residential"
    ),
    (
        "TAD-PARCEL-00466379",
        "5200 E Loop 820 S",
        "Permit discrepancy and corridor screening failure",
        "permit_screening_audit",
        datetime.now().isoformat(),
        "Fort Worth municipal permit audit failure"
    ),
    (
        "TAD-PARCEL-01077848",
        "3100 Sappington Pl",
        "Multifamily residential community (Marabella Apartments / HIG REFI TX1 LLC)",
        "aerial_property_audit",
        datetime.now().isoformat(),
        "TAD Appraisal / Web Audit: Residential Apartment Complex"
    ),
    (
        "TAD-PARCEL-01077600",
        "3100 Sappington Pl",
        "Multifamily residential community (Marabella Apartments / HIG REFI TX1 LLC)",
        "aerial_property_audit",
        datetime.now().isoformat(),
        "TAD Appraisal / Web Audit: Residential Apartment Complex"
    ),
    (
        "TAD-PARCEL-00813958",
        "1612 W Humbolt St",
        "Institutional medical / hospital complex (Columbia Plaza Medical Center)",
        "institutional_filter",
        datetime.now().isoformat(),
        "TAD / CFW Ownership Audit: Healthcare facility"
    )
]

for d in disqualifications:
    cur.execute("""
        INSERT OR REPLACE INTO manual_disqualifications 
        (parcel_id, address, disqualification_reason, disqualified_by, disqualified_at, evidence_source)
        VALUES (?, ?, ?, ?, ?, ?)
    """, d)

conn.commit()

# Also update status in scored_parcel_leads if present
for d in disqualifications:
    cur.execute("""
        UPDATE scored_parcel_leads 
        SET verification_status = 'DISQUALIFIED_MANUAL',
            why_weak_summary = ?
        WHERE parcel_id = ? OR address LIKE ?
    """, (d[2], d[0], f"%{d[1]}%"))

conn.commit()

print("=== MANUAL DISQUALIFICATIONS TABLE POPULATED ===")
rows = cur.execute("SELECT parcel_id, address, disqualification_reason FROM manual_disqualifications").fetchall()
for r in rows:
    print(f"[{r[0]}] {r[1]} -> {r[2]}")

conn.close()
