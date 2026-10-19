import sqlite3
import random
import json
import time
from app.science.verification_engine import VerificationEngine

def run_precision_benchmark(sample_size: int = 30):
    conn = sqlite3.connect('depoii_local.db')
    cur = conn.cursor()
    
    # Query pool of candidate parcels in Fort Worth
    cur.execute("""
        SELECT id, address, city, building_sqft, year_built, owner_name, latitude, longitude, account_number
        FROM parcels
        WHERE city = 'Fort Worth' AND is_mock = 0
          AND building_sqft BETWEEN 25000 AND 250000
          AND latitude IS NOT NULL AND longitude IS NOT NULL
          AND UPPER(COALESCE(owner_name, '')) NOT LIKE '%APARTMENT%'
          AND UPPER(COALESCE(owner_name, '')) NOT LIKE '%CHURCH%'
    """)
    candidates = cur.fetchall()
    conn.close()
    
    print(f"\n=======================================================")
    print(f"PIPELINE PRECISION BENCHMARK: SAMPLING {sample_size} PROPERTIES")
    print(f"Pool size: {len(candidates)} candidate properties")
    print(f"=======================================================")
    
    if len(candidates) < sample_size:
        sample = candidates
    else:
        random.seed(42)  # Deterministic seed for reproducible evaluation
        sample = random.sample(candidates, sample_size)
        
    results = []
    stats = {
        "VERIFIED": 0,
        "DISQUALIFIED_MFR": 0,
        "DISQUALIFIED_INSTITUTIONAL": 0,
        "PERMIT_DETECTED": 0,
        "LOW_STORM_PROXIMITY": 0,
        "UNVERIFIED": 0
    }
    
    for i, p in enumerate(sample, 1):
        pid, addr, city, sqft, yr, owner, lat, lon, acct = p
        print(f"[{i:02d}/{sample_size}] Auditing: {addr} ({sqft:,} sqft)...", end=" ", flush=True)
        
        start_t = time.time()
        audit = VerificationEngine.verify_lead(
            lead_id=pid,
            address=addr,
            city=city,
            lat=lat,
            lon=lon,
            account_number=acct
        )
        elapsed = time.time() - start_t
        
        status = audit["verification_status"]
        score = audit["verification_score"]
        hail_dist = audit["hail_proximity"]["distance_miles"]
        hail_pt = audit["hail_proximity"]["report_location"]
        muni_status = audit["municipal_permits"]["audit_status"]
        
        # Categorize low proximity if outside 2.5 miles
        if status == "UNVERIFIED" and hail_dist > 2.5:
            status = "LOW_STORM_PROXIMITY"
            
        stats[status] = stats.get(status, 0) + 1
        
        print(f"-> {status} (Score: {score}/100, Hail: {hail_dist} mi, {elapsed:.1f}s)")
        
        results.append({
            "index": i,
            "lead_id": pid,
            "address": addr,
            "city": city,
            "owner": owner,
            "building_sqft": sqft,
            "year_built": yr,
            "status": status,
            "score": score,
            "hail_dist_mi": hail_dist,
            "nearest_hail_point": hail_pt,
            "muni_permit_status": muni_status,
            "cad_account": audit["cad"].get("account"),
            "disqualify_reason": audit.get("disqualification_reason")
        })
        
    print("\n" + "="*70)
    print("EMPIRICAL BENCHMARK RESULTS")
    print("="*70)
    for k, v in stats.items():
        pct = (v / len(sample)) * 100.0
        print(f"  • {k:<25}: {v:>2}/{len(sample)} ({pct:5.1f}%)")
        
    precision = (stats.get("VERIFIED", 0) / len(sample)) * 100.0
    print(f"\nFinal Pipeline Precision Rate: {precision:.1f}% ({stats.get('VERIFIED', 0)}/{len(sample)} passed all 5 evidence hurdles)")
    
    with open("benchmark_30_results.json", "w") as f:
        json.dump({"stats": stats, "precision": precision, "properties": results}, f, indent=2)
        
    print("Benchmark saved to benchmark_30_results.json")

if __name__ == "__main__":
    run_precision_benchmark(30)
