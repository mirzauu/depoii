import sqlite3
import urllib.request
import urllib.parse
import json
import time
from datetime import datetime, timezone

TAD_PARCELS_URL = "https://mapit.tarrantcounty.com/arcgis/rest/services/Dynamic/TADParcels/MapServer/0/query"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii/2.0", "Accept": "application/json"}

def run_stage3_cad_validation():
    print("=" * 70)
    print("STAGE 3: CHUNKED COUNTY CAD BATCH VALIDATOR (TARRANT COUNTY / TAD)")
    print("=" * 70)
    
    start_t = time.time()
    conn = sqlite3.connect('depoii_local.db')
    cur = conn.cursor()
    
    # Select Texas unverified leads that passed Stage 1 & Stage 2
    cur.execute("""
        SELECT l.parcel_id, l.address, l.city, p.account_number, l.verification_score
        FROM scored_parcel_leads l
        JOIN parcels p ON p.id = l.parcel_id
        WHERE l.state = 'TX'
          AND l.verification_status = 'UNVERIFIED'
    """)
    leads = cur.fetchall()
    print(f"Total Tarrant County commercial leads to validate against live TAD: {len(leads):,}")
    
    # Clean and organize accounts into chunks of 30
    chunk_size = 30
    chunks = [leads[i:i + chunk_size] for i in range(0, len(leads), chunk_size)]
    print(f"Divided into {len(chunks)} batch requests (size {chunk_size})...\n")
    
    verified_cad_count = 0
    disqualified_cad_count = 0
    unmatched_cad_count = 0
    
    for c_idx, chunk in enumerate(chunks, 1):
        acct_map = {}
        for pid, addr, city, acct, cur_score in chunk:
            clean_acct = (acct or "").replace("TAD-PARCEL-", "").strip()
            if clean_acct and clean_acct.isdigit():
                acct_map[clean_acct] = (pid, addr, cur_score)
                
        if not acct_map:
            continue
            
        where_clause = f"ACCOUNT IN ({','.join([repr(a) for a in acct_map.keys()])})"
        params = {
            "where": where_clause,
            "outFields": "ACCOUNT,SITUS_ADDR,OWNER_NAME,LIVING_ARE,YEAR_BUILT,TOTAL_VALU,LEGAL_1,MAPSCO",
            "f": "json"
        }
        url = f"{TAD_PARCELS_URL}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers=HEADERS)
        
        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                data = json.loads(res.read().decode())
                features = data.get("features", [])
                
                matched_accts = set()
                for f in features:
                    attr = f["attributes"]
                    ret_acct = attr.get("ACCOUNT")
                    matched_accts.add(ret_acct)
                    
                    if ret_acct in acct_map:
                        pid, addr, cur_score = acct_map[ret_acct]
                        owner = (attr.get("OWNER_NAME") or "").strip().upper()
                        living_raw = attr.get("LIVING_ARE")
                        live_bldg_sqft = int(float(living_raw)) if living_raw else None
                        year_raw = attr.get("YEAR_BUILT")
                        live_year_built = int(year_raw) if year_raw and int(year_raw) > 1850 else None
                        total_raw = attr.get("TOTAL_VALU")
                        live_total_val = float(total_raw) if total_raw else None
                        legal = (attr.get("LEGAL_1") or "").strip()
                        mapsco = (attr.get("MAPSCO") or "").strip()
                        now_iso = datetime.now(timezone.utc).isoformat()

                        # Write back verified live TAD data into parcels table
                        cur.execute("""
                            UPDATE parcels
                            SET building_sqft = COALESCE(?, building_sqft),
                                year_built = COALESCE(?, year_built),
                                total_valuation = COALESCE(?, total_valuation),
                                owner_name = COALESCE(?, owner_name),
                                data_provenance = 'live_tad_api',
                                provenance_date = ?,
                                building_sqft_source = 'TAD LIVING_ARE',
                                year_built_source = 'TAD YEAR_BUILT',
                                valuation_source = 'TAD TOTAL_VALU'
                            WHERE id = ?
                        """, (
                            live_bldg_sqft, live_year_built, live_total_val,
                            owner.title() if owner else None, now_iso, pid
                        ))
                        
                        # Live CAD check: verify owner
                        if any(kw in owner for kw in ['CHURCH', 'BAPTIST', 'ISD', 'APARTMENT', 'HOUSING AUTH']):
                            cur.execute("""
                                UPDATE scored_parcel_leads
                                SET verification_status = 'DISQUALIFIED_INSTITUTIONAL',
                                    cad_account_id = ?,
                                    data_provenance = 'live_tad_api',
                                    provenance_date = ?,
                                    outbound_ready = 0,
                                    outbound_block_reason = 'Institutional owner disqualified'
                                WHERE parcel_id = ?
                            """, (ret_acct, now_iso, pid))
                            disqualified_cad_count += 1
                        else:
                            new_score = cur_score + 30  # CAD verified bonus
                            cur.execute("""
                                UPDATE scored_parcel_leads
                                SET cad_account_id = ?,
                                    owner_name = COALESCE(?, owner_name),
                                    building_sqft = COALESCE(?, building_sqft),
                                    year_built = COALESCE(?, year_built),
                                    cad_total_valuation = COALESCE(?, cad_total_valuation),
                                    data_provenance = 'live_tad_api',
                                    provenance_date = ?,
                                    building_sqft_source = 'TAD LIVING_ARE',
                                    year_built_source = 'TAD YEAR_BUILT',
                                    valuation_source = 'TAD TOTAL_VALU',
                                    verification_score = ?
                                WHERE parcel_id = ?
                            """, (
                                ret_acct, owner.title() if owner else None,
                                live_bldg_sqft, live_year_built, live_total_val,
                                now_iso, new_score, pid
                            ))
                            verified_cad_count += 1
                            
                # Check unmatched accounts in chunk
                for a in acct_map.keys():
                    if a not in matched_accts:
                        unmatched_cad_count += 1
                        
                print(f"Batch {c_idx:02d}/{len(chunks)}: Queried {len(acct_map)} accounts -> {len(features)} live CAD matches")
                conn.commit()
                time.sleep(0.3)  # Polite pacing
                
        except Exception as e:
            print(f"Batch {c_idx:02d} error: {e}")
            
    conn.close()
    elapsed = time.time() - start_t
    print("\nSTAGE 3 RESULTS:")
    print(f"  • Confirmed on Live TAD Server (+30 score): {verified_cad_count:,}")
    print(f"  • Disqualified by Live TAD Owner          : {disqualified_cad_count:,}")
    print(f"  • Unmatched / Historical Account IDs      : {unmatched_cad_count:,}")
    print(f"Stage 3 completed in {elapsed:.2f} seconds.")

if __name__ == "__main__":
    run_stage3_cad_validation()
