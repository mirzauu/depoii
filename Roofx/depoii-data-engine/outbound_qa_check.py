"""
Outbound QA Pre-Send Validator
------------------------------
Final safeguard before sending any lead, dossier, or email out to a contractor.
Asserts every field has proven live provenance, named sources, and valid timestamps.
Rejects synthetic heuristics, unverified seeds, or fabricated permit claims.
"""

import sys
import os
import sqlite3
import json
from typing import Dict, Any, Tuple

from provenance_guard import verify_outbound_ready, ALLOWED_LIVE_PROVENANCES

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "depoii_local.db")

BANNED_VALUE_PATTERNS = [
    ("sqft * 165", lambda l: abs((l.get("cad_total_valuation") or 0) - (l.get("building_sqft") or 0) * 165.0) < 1.0 and (l.get("building_sqft") or 0) > 0),
]

def check_lead_qa(parcel_id: str) -> Tuple[bool, list]:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
        SELECT 
            p.id, p.address, p.city, p.county, p.state, p.owner_name,
            p.building_sqft, p.year_built, p.total_valuation,
            p.data_provenance, p.provenance_date,
            p.building_sqft_source, p.valuation_source, p.year_built_source,
            l.outbound_ready, l.outbound_block_reason,
            l.nearest_hail_distance_mi, l.nearest_hail_size_in, l.nearest_hail_location,
            l.muni_permit_check_date, l.muni_permit_status, l.why_strong_summary
        FROM parcels p
        LEFT JOIN scored_parcel_leads l ON l.parcel_id = p.id
        WHERE p.id = ? OR p.account_number = ?
    """, (parcel_id, parcel_id))
    row = cur.fetchone()
    conn.close()

    if not row:
        return False, [f"ERROR: Parcel '{parcel_id}' not found in database."]

    (
        pid, addr, city, county, state, owner,
        bldg_sqft, y_built, total_val,
        prov, prov_date,
        sqft_src, val_src, yr_src,
        outbound_ready, outbound_block_reason,
        hail_dist, hail_size, hail_loc,
        permit_date, permit_status, why_strong
    ) = row

    logs = []
    passed = True

    logs.append(f"QA Audit Report for Lead: {addr} ({pid})")
    logs.append("=" * 60)

    # 1. Provenance Gate
    lead_dict = {
        "data_provenance": prov,
        "building_sqft": bldg_sqft,
        "building_sqft_source": sqft_src,
        "year_built": y_built,
        "year_built_source": yr_src,
        "total_valuation": total_val,
        "valuation_source": val_src,
        "owner_name": owner,
        "nearest_hail_distance_mi": hail_dist,
        "muni_permit_check_date": permit_date,
        "why_strong_summary": why_strong,
    }
    is_ready, reason = verify_outbound_ready(lead_dict)
    if is_ready:
        logs.append(f"[PASS] Provenance Guard: Cleared ({reason})")
    else:
        logs.append(f"[FAIL] Provenance Guard: BLOCKED -> {reason}")
        passed = False

    # 2. Detailed Field Checks
    # Building Area
    if bldg_sqft and bldg_sqft >= 1000 and sqft_src:
        logs.append(f"[PASS] Building Area: {bldg_sqft:,} sq ft (Source: {sqft_src})")
    else:
        logs.append(f"[FAIL] Building Area: {bldg_sqft} (Source: {sqft_src})")
        passed = False

    # Year Built
    if y_built and yr_src:
        logs.append(f"[PASS] Year Built: {y_built} (Source: {yr_src})")
    else:
        logs.append(f"[FAIL] Year Built: {y_built} (Source: {yr_src})")
        passed = False

    # Total Valuation
    if total_val and total_val > 0 and val_src:
        logs.append(f"[PASS] Total Valuation: ${total_val:,.0f} (Source: {val_src})")
    else:
        logs.append(f"[FAIL] Total Valuation: ${total_val} (Source: {val_src})")
        passed = False

    # Check for synthetic $165 heuristic
    for b_name, b_fn in BANNED_VALUE_PATTERNS:
        if b_fn(lead_dict):
            logs.append(f"[FAIL] Synthetic Heuristic Detected: {b_name} matched valuation exactly!")
            passed = False

    # Hail & Weather
    if hail_dist is not None:
        logs.append(f"[PASS] Hail Distance: {hail_dist} mi, {hail_size}\" ({hail_loc})")
    else:
        logs.append(f"[INFO] Hail Proximity: Not matched within SPC swath")

    # Permits
    if permit_date:
        logs.append(f"[PASS] Permit Portal Query: {permit_status} (Audited: {permit_date})")
    else:
        logs.append(f"[INFO] Permit Portal Query: Not yet audited (disclosure required)")

    logs.append("=" * 60)
    final_verdict = "VERIFIED OUTBOUND READY - SAFE TO SEND" if passed else "REJECTED - DO NOT SEND OUTBOUND"
    logs.append(f"FINAL VERDICT: {final_verdict}")

    return passed, logs

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python outbound_qa_check.py <parcel_id_or_account>")
        sys.exit(1)

    target_id = sys.argv[1]
    ok, lines = check_lead_qa(target_id)
    for line in lines:
        print(line)
    sys.exit(0 if ok else 1)
