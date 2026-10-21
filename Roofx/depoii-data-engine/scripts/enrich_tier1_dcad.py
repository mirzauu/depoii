"""
Enrich Tier-1: DCAD Property & Valuation Re-pull
------------------------------------------------
Fetches official commercial property records directly from Dallas CAD
for all 283 released Dallas leads in depoii_local.db.

Backfills:
- market_value (total_valuation)
- improvement_valuation & land_valuation
- improvement_description & land_use_code
- year_built, stories, section breakdowns
- deed_date & legal_description
- evidence provenance in lead_evidence
"""

import os
import sys
import json
import time
import re
import urllib.request
import sqlite3
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

ENGINE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(ENGINE_DIR, "depoii_local.db")
CACHE_DIR = os.path.abspath(os.path.join(ENGINE_DIR, "..", "..", "audit", "queries", "live_pages"))
os.makedirs(CACHE_DIR, exist_ok=True)

sys.path.insert(0, ENGINE_DIR)
from app.science.dcad_parse import parse_dcad_account
from app.science.lead_store import REQUIRED_FIELDS, upsert_evidence

DCAD_BASE_URL = "https://www.dallascad.org/AcctDetailCom.aspx?ID="

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


def clean_text(fragment: str) -> str:
    text = re.sub(r"<[^>]+>", " ", fragment or "")
    text = text.replace("&nbsp;", " ").replace("&#160;", " ")
    return re.sub(r"\s+", " ", text).strip()


def fetch_dcad_html(account_number: str, retries: int = 3, delay: float = 1.0) -> Optional[str]:
    clean_acct = str(account_number).strip().replace("-", "")
    cache_path = os.path.join(CACHE_DIR, f"DCAD-PARCEL-{clean_acct}.live.html")

    # Use cache if already retrieved recently and has valid content
    if os.path.exists(cache_path) and os.path.getsize(cache_path) > 5000:
        try:
            with open(cache_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                if "Dallas Central Appraisal District" in content or "AcctDetailCom" in content:
                    return content
        except Exception:
            pass

    url = f"{DCAD_BASE_URL}{clean_acct}"
    req = urllib.request.Request(url, headers=HEADERS)

    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                html = resp.read().decode("utf-8", errors="ignore")
                if "Dallas Central Appraisal District" in html or "AcctDetailCom" in html:
                    with open(cache_path, "w", encoding="utf-8") as f:
                        f.write(html)
                    return html
        except Exception as e:
            if attempt < retries:
                time.sleep(2.0 * attempt)
            else:
                print(f"[!] Failed to fetch DCAD account {clean_acct} after {retries} attempts: {e}")
                return None
    return None


def extract_extended_dcad(html: str) -> Dict[str, Any]:
    """Extracts valuation breakdown, deed date, and legal description from DCAD HTML."""
    imp_m = re.search(r'lblImpVal"[^>]*>\$?([0-9,]+)', html, re.I)
    land_m = re.search(r'lblLandVal"[^>]*>\$?([0-9,]+)', html, re.I)
    tot_m = re.search(r'lblTotalVal"[^>]*>\$?([0-9,]+)', html, re.I)
    deed_m = re.search(r'lblSaleDate"[^>]*>([0-9/]+)', html, re.I)

    legal_parts = []
    for i in range(1, 6):
        lm = re.search(rf'lblLegal{i}"[^>]*>(.*?)</span>', html, re.I)
        if lm and lm.group(1).strip():
            legal_parts.append(clean_text(lm.group(1)))

    return {
        "market_value": float(tot_m.group(1).replace(",", "")) if tot_m else None,
        "improvement_valuation": float(imp_m.group(1).replace(",", "")) if imp_m else None,
        "land_valuation": float(land_m.group(1).replace(",", "")) if land_m else None,
        "deed_date": deed_m.group(1) if deed_m else None,
        "legal_description": " ".join(legal_parts) if legal_parts else None,
    }


def enrich_dcad_leads(force: bool = False, limit: Optional[int] = None):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    c.execute("""
        SELECT rl.parcel_id, p.account_number, p.address, p.owner_name, p.total_valuation
        FROM released_leads rl
        JOIN parcels p ON rl.parcel_id = p.id
        WHERE rl.state = 'TX'
        ORDER BY rl.parcel_id
    """)
    leads = c.fetchall()
    total_leads = len(leads)
    print(f"[*] Found {total_leads} released Texas leads.")

    succeeded = 0
    skipped = 0
    failed = 0
    total_value_added = 0.0

    start_time = time.time()

    for idx, lead in enumerate(leads, 1):
        if limit and idx > limit:
            break

        parcel_id = lead["parcel_id"]
        account_number = lead["account_number"]
        addr = lead["address"] or ""

        # Check if already enriched with market_value
        if not force and lead["total_valuation"] and lead["total_valuation"] > 0:
            c.execute("SELECT stored_value FROM lead_evidence WHERE parcel_id = ? AND field_name = 'market_value'", (parcel_id,))
            mv_row = c.fetchone()
            if mv_row and mv_row[0]:
                skipped += 1
                continue

        # Fetch HTML
        html = fetch_dcad_html(account_number)
        if not html:
            failed += 1
            print(f"[{idx}/{total_leads}] FAILED to fetch: {account_number} ({addr})")
            continue

        # Parse standard DCAD science format
        parsed = parse_dcad_account(html)
        ext = extract_extended_dcad(html)

        market_val = ext["market_value"] or parsed.get("market_value")
        imp_val = ext["improvement_valuation"]
        land_val = ext["land_valuation"]
        year_built = parsed.get("year_built")
        stories = parsed.get("stories")
        imp_desc = parsed.get("improvement_description")
        land_use = parsed.get("land_use_code")
        source_area = parsed.get("source_area")
        sections = parsed.get("sections") or []
        roof_sqft = parsed.get("roof_sqft_used")
        deed_date = ext.get("deed_date")

        retrieved_at = datetime.now(timezone.utc).isoformat()
        dcad_url = f"{DCAD_BASE_URL}{account_number.strip().replace('-', '')}"

        # 1. Update parcels table
        conn.execute("""
            UPDATE parcels
            SET total_valuation = COALESCE(?, total_valuation),
                improvement_valuation = COALESCE(?, improvement_valuation),
                year_built = COALESCE(?, year_built),
                stories = COALESCE(?, stories),
                improvement_sections = ?,
                valuation_source = 'live_dcad_scrape',
                enriched_at = ?
            WHERE id = ?
        """, (
            market_val,
            imp_val,
            year_built,
            stories,
            json.dumps(sections) if sections else None,
            retrieved_at,
            parcel_id
        ))

        # 2. Write provenance evidence into lead_evidence
        evidence_updates = {
            "market_value": market_val,
            "improvement_description": imp_desc,
            "land_use_code": land_use,
            "year_built": year_built,
            "source_area": source_area,
            "source_area_kind": "dcad_improvement_total_area" if source_area else None,
        }
        if stories is not None:
            evidence_updates["stories"] = stories
        if roof_sqft is not None:
            evidence_updates["roof_sqft_used"] = roof_sqft

        for field_name, val in evidence_updates.items():
            if val is not None and str(val).strip() != "":
                upsert_evidence(
                    conn=conn,
                    parcel_id=parcel_id,
                    field_name=field_name,
                    stored_value=val,
                    source_system="dcad_account_page",
                    source_url=dcad_url,
                    source_field=field_name,
                    retrieved_at=retrieved_at,
                    raw_excerpt=f"Extracted from DCAD Account {account_number}: {field_name}={val}"
                )

        conn.commit()
        succeeded += 1
        if market_val:
            total_value_added += market_val

        if idx % 10 == 0 or idx == total_leads:
            elapsed = time.time() - start_time
            rate = idx / elapsed if elapsed > 0 else 0
            val_str = f"${market_val:,.0f}" if market_val else "N/A"
            print(f"[{idx}/{total_leads}] {account_number} ({addr}) -> {val_str} | YB: {year_built} | {land_use} ({rate:.1f} leads/sec)")

        # Polite delay to avoid stressing the CAD portal
        time.sleep(0.8)

    conn.close()
    elapsed = time.time() - start_time
    print("\n" + "="*60)
    print("DCAD ENRICHMENT SUMMARY")
    print(f"Total Leads Processed: {total_leads}")
    print(f"Succeeded: {succeeded}")
    print(f"Skipped (already enriched): {skipped}")
    print(f"Failed: {failed}")
    print(f"Total Valuation Documented: ${total_value_added:,.2f}")
    print(f"Elapsed Time: {elapsed:.1f} seconds")
    print("="*60)


if __name__ == "__main__":
    force_run = "--force" in sys.argv
    limit_val = None
    for arg in sys.argv:
        if arg.startswith("--limit="):
            limit_val = int(arg.split("=")[1])
        elif arg == "--limit" and sys.argv.index(arg) + 1 < len(sys.argv):
            limit_val = int(sys.argv[sys.argv.index(arg) + 1])
    enrich_dcad_leads(force=force_run, limit=limit_val)
