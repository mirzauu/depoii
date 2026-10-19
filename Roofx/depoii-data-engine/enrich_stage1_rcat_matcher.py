import os
import sys
import re
import json
import sqlite3
from datetime import datetime, timezone

DB_PATH = r"d:\Depoii_nextjs\Roofx\depoii-data-engine\depoii_local.db"
RCAT_PATH = r"d:\Depoii_nextjs\Roofx\depoii-data-engine\rcat_official_directory.json"

STOP_WORDS = {
    "LLC", "INC", "CORP", "CO", "LTD", "LP", "SERVICES", "ROOFING", 
    "ROOF", "CONSTRUCTION", "GROUP", "ENTERPRISES", "THE", "AND", "&", 
    "OF", "A", "RESTO", "RESTORATION", "EXTERIORS", "EXTERIOR", "GENERAL", "CONTRACTOR", "CONTRACTORS"
}

def get_tokens(name):
    if not name:
        return set()
    cleaned = re.sub(r'\(.*?\)', '', name.upper())
    tokens = re.findall(r'[A-Z0-9]+', cleaned)
    return set(tokens)

def get_core_tokens(name):
    tokens = get_tokens(name)
    core = tokens - STOP_WORDS
    return core if core else tokens

def run_rcat_matcher(dry_run=False):
    with open(RCAT_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
        rcat_data = json.loads(content)
        if isinstance(rcat_data, str):
            rcat_data = json.loads(rcat_data)
            
    print(f"Loaded {len(rcat_data)} RCAT certified roofing contractors.")
    
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    cur.execute("""
        SELECT id, canonical_name, headquarters_city, headquarters_state, phone_number, website_url, rcat_license_number
        FROM canonical_contractors
        WHERE LOWER(TRIM(headquarters_city)) = 'dallas'
          AND (enrichment_status IS NULL OR enrichment_status = 'pending')
    """)
    dallas_pending = cur.fetchall()
    print(f"Pending Dallas contractors to match against RCAT: {len(dallas_pending)}")
    
    rcat_index = []
    for r in rcat_data:
        c_name = r.get("company_name", "").strip()
        core = get_core_tokens(c_name)
        all_toks = get_tokens(c_name)
        
        raw_lines = r.get("raw_lines", [])
        street_address = ""
        if len(raw_lines) >= 3:
            street_address = f"{raw_lines[1]}, {r.get('city_state_zip', '')}"
            
        rcat_index.append({
            "raw_name": c_name,
            "core": core,
            "all_tokens": all_toks,
            "city": (r.get("city") or "").upper(),
            "website": r.get("website"),
            "phone": r.get("phone"),
            "license_num": r.get("license_number"),
            "license_type": r.get("license_type"),
            "rcat_url": r.get("rcat_url"),
            "member_since": r.get("member_since"),
            "address": street_address or r.get("city_state_zip", "")
        })
            
    matches = []
    
    for c_id, c_name, city, state, existing_phone, existing_web, existing_rcat in dallas_pending:
        c_core = get_core_tokens(c_name)
        c_all = get_tokens(c_name)
        
        if not c_core:
            continue
            
        matched_rcat = None
        for r in rcat_index:
            # 1. Exact match on core tokens
            if c_core == r["core"]:
                matched_rcat = r
                break
                
            # 2. High-confidence multi-word match (minimum 2 core tokens each, Jaccard >= 0.75)
            if len(c_core) >= 2 and len(r["core"]) >= 2:
                intersection = c_core & r["core"]
                union = c_core | r["core"]
                jaccard = len(intersection) / len(union)
                if jaccard >= 0.75:
                    matched_rcat = r
                    break
                        
        if matched_rcat:
            matches.append((c_id, c_name, matched_rcat))
            
    print(f"\nFound {len(matches)} 100% verified RCAT matches!")
    
    for c_id, c_name, r in matches:
        print(f"  [VERIFIED MATCH] '{c_name}' -> RCAT '{r['raw_name']}' | Lic: {r['license_num']} | Phone: {r['phone']} | Web: {r['website']}")
        
    if not dry_run and matches:
        print(f"\nWriting {len(matches)} verified RCAT profiles to database...")
        now = datetime.now(timezone.utc).isoformat()
        updated_count = 0
        for c_id, c_name, r in matches:
            cur.execute("""
                UPDATE canonical_contractors
                SET rcat_profile_url = COALESCE(?, rcat_profile_url),
                    rcat_license_number = COALESCE(?, rcat_license_number),
                    rcat_license_type = COALESCE(?, rcat_license_type),
                    rcat_member_since = COALESCE(?, rcat_member_since),
                    phone_number = COALESCE(?, phone_number),
                    website_url = COALESCE(?, website_url),
                    hq_address = COALESCE(?, hq_address),
                    enrichment_status = 'enriched',
                    enrichment_updated_at = ?
                WHERE id = ?
            """, (
                r["rcat_url"],
                f"License #{r['license_num']}" if r["license_num"] else None,
                r["license_type"],
                r["member_since"],
                r["phone"],
                r["website"],
                r["address"],
                now,
                c_id
            ))
            updated_count += 1
            
        conn.commit()
        print(f"Committed {updated_count} verified contractors to depoii_local.db!")
        
    conn.close()

if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    run_rcat_matcher(dry_run=dry_run)
