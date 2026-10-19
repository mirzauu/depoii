"""
Live DCAD Detail Scraper / Fetcher
----------------------------------
Fetches genuine commercial improvement sections, valuations, and owner details
directly from live Dallas CAD: https://www.dallascad.org/AcctDetailCom.aspx?ID={account}

Stores genuine building sqft (sum of improvement sections), year built, and roll valuation
with strict provenance tags ('live_dcad_scrape').
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

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "depoii_local.db")
DCAD_BASE_URL = "https://www.dallascad.org/AcctDetailCom.aspx?ID="

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii-DCAD-LiveVerifier/2.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

def clean_text(html_fragment: str) -> str:
    cleaned = re.sub(r"<[^>]+>", " ", html_fragment)
    return " ".join(cleaned.replace("&nbsp;", " ").split())

def fetch_dcad_html(account_number: str, timeout: int = 20) -> Optional[str]:
    clean_acct = str(account_number).strip().replace("-", "")
    url = f"{DCAD_BASE_URL}{clean_acct}"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.read().decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"[!] HTTP error fetching DCAD account {clean_acct}: {e}")
        return None

def parse_dcad_detail(html: str, account_number: str) -> Optional[Dict[str, Any]]:
    if not html or "AcctDetailCom" not in html and "Dallas Central Appraisal District" not in html:
        return None
    from app.science.dcad_parse import parse_dcad_account
    parsed = parse_dcad_account(html)
    if not parsed.get("source_area") and not parsed.get("address"):
        return None
    sections = []
    for section in parsed["sections"]:
        if section.get("area_sqft") is None or section.get("year_built") is None:
            continue
        sections.append({
            "description": section["description"],
            "area_sqft": section["area_sqft"],
            "year_built": section["year_built"],
            "foundation_sqft": section.get("foundation_sqft"),
        })
    return {
        "account_number": account_number,
        "property_address": parsed["address"] or None,
        "sections": sections,
        "section_count": len(parsed["sections"]),
        "total_building_sqft": parsed["source_area"],
        "earliest_year_built": parsed["year_built"],
        "stories": parsed["stories"],
        "footprint_sqft": parsed["roof_sqft_used"],
        "total_valuation": parsed["market_value"],
        "improvement_valuation": None,
        "land_valuation": None,
        "owner_raw": parsed["owner_name"] or None,
        "land_use_code": parsed["land_use_code"],
        "improvement_description": parsed["improvement_description"],
        "unit_count": parsed["unit_count"],
        "ineligible": parsed["ineligible"],
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
    }


def _legacy_parse_removed(html: str, account_number: str) -> Optional[Dict[str, Any]]:
    raise RuntimeError("use app.science.dcad_parse.parse_dcad_account")
    clean_html = html.replace("&nbsp;", " ")

    # 1. Parse Improvement Sections
    # Format typically: 
    # <td><b>Desc:</b> STORAGE WAREHOUSE</td>
    # <td><b>Total Area:</b> 29,362 sqft</td>
    # <td><b>Year Built:</b> 1952</td>
    sections: List[Dict[str, Any]] = []
    imp_pattern = re.compile(
        r"Desc:</b>\s*([^<]+).*?Total Area:</b>\s*([0-9,]+)\s*sqft.*?Year Built:</b>\s*([0-9]{4})",
        re.DOTALL | re.IGNORECASE
    )
    for m in imp_pattern.finditer(clean_html):
        desc = m.group(1).strip()
        try:
            sqft = int(m.group(2).replace(",", ""))
            year = int(m.group(3))
            sections.append({
                "description": desc,
                "area_sqft": sqft,
                "year_built": year
            })
        except ValueError:
            continue

    total_building_sqft = sum(s["area_sqft"] for s in sections) if sections else None
    earliest_year_built = min(s["year_built"] for s in sections) if sections else None

    # 2. Parse Valuation
    # Match ASP.NET elements: lblImpVal, lblLandVal, lblTotalVal
    impr_val: Optional[float] = None
    land_val: Optional[float] = None
    tot_val: Optional[float] = None

    tot_m = re.search(r'lblTotalVal"[^>]*>\$?([0-9,]+)', clean_html, re.IGNORECASE)
    if tot_m:
        try:
            tot_val = float(tot_m.group(1).replace(",", ""))
        except ValueError:
            pass

    imp_m = re.search(r'lblImpVal"[^>]*>\$?([0-9,]+)', clean_html, re.IGNORECASE)
    if imp_m:
        try:
            impr_val = float(imp_m.group(1).replace(",", ""))
        except ValueError:
            pass

    land_m = re.search(r'lblLandVal"[^>]*>\$?([0-9,]+)', clean_html, re.IGNORECASE)
    if land_m:
        try:
            land_val = float(land_m.group(1).replace(",", ""))
        except ValueError:
            pass

    # Fallback to textual match if element IDs changed
    if tot_val is None:
        val_pattern = re.compile(
            r"Market Value:\s*<[^>]*>\$?([0-9,]+)\s*<[^>]*>\s*\+\s*<[^>]*>\$?([0-9,]+)\s*<[^>]*>\s*=\s*<[^>]*>\$?([0-9,]+)",
            re.IGNORECASE
        )
        val_m = val_pattern.search(clean_html)
        if val_m:
            try:
                tot_val = float(val_m.group(3).replace(",", ""))
            except ValueError:
                pass

    # 3. Parse Stories and Footprint
    stories = 1
    stories_m = re.search(r"Stories:[^\d]{1,40}(\d+)", clean_html, re.IGNORECASE)
    if stories_m:
        try:
            stories = max(1, int(stories_m.group(1)))
        except ValueError:
            pass

    footprint_sqft = (total_building_sqft // stories) if (total_building_sqft and stories > 1) else total_building_sqft

    # 4. Parse Property Address & Owner Name
    property_address = None
    addr_m = re.search(r'id="PropAddr1_lblPropAddr"[^>]*>([^<]+)</span>', clean_html)
    if addr_m:
        property_address = clean_text(addr_m.group(1))

    owner_name = None
    owner_m = re.search(r'id="lblOwner"[^>]*>[^<]*</span>\s*([^<]+)', clean_html)
    if owner_m:
        owner_name = clean_text(owner_m.group(1))
    if not owner_name:
        owner_m2 = re.search(
            r"Owner\s*\(Current\s*[0-9]{4}\)\s*([A-Za-z0-9\s,\.\-&#]+?)(?:<span|<td|Owner Name|Multi-Owner)",
            clean_html
        )
        if owner_m2:
            owner_name = clean_text(owner_m2.group(1))

    return {
        "account_number": account_number,
        "property_address": property_address,
        "sections": sections,
        "section_count": len(sections),
        "total_building_sqft": total_building_sqft,
        "earliest_year_built": earliest_year_built,
        "stories": stories,
        "footprint_sqft": footprint_sqft,
        "total_valuation": tot_val,
        "improvement_valuation": impr_val,
        "land_valuation": land_val,
        "owner_raw": owner_name,
        "retrieved_at": datetime.now(timezone.utc).isoformat()
    }

def update_parcel_with_live_dcad(account_number: str, parcel_id: Optional[str] = None) -> bool:
    html = fetch_dcad_html(account_number)
    if not html:
        return False

    parsed = parse_dcad_detail(html, account_number)
    if not parsed or parsed.get("total_building_sqft") is None:
        print(f"[-] No valid building sections parsed for DCAD acct {account_number}")
        return False

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    provenance_tag = "live_dcad_scrape"
    prov_date = parsed["retrieved_at"]
    sqft_source = "DCAD AcctDetailCom.aspx improvement sections"
    val_source = "DCAD AcctDetailCom.aspx roll"
    yr_source = "DCAD AcctDetailCom.aspx roll"
    sections_json = json.dumps(parsed["sections"])

    pid_target = parcel_id or f"DCAD-PARCEL-{account_number}"

    if parcel_id:
        cur.execute("""
            UPDATE parcels
            SET building_sqft = ?,
                year_built = ?,
                stories = ?,
                footprint_sqft = ?,
                owner_name = COALESCE(?, owner_name),
                total_valuation = COALESCE(?, total_valuation),
                improvement_valuation = COALESCE(?, improvement_valuation),
                improvement_sections = ?,
                data_provenance = ?,
                provenance_date = ?,
                building_sqft_source = ?,
                valuation_source = ?,
                year_built_source = ?
            WHERE id = ?
        """, (
            parsed["total_building_sqft"],
            parsed["earliest_year_built"],
            parsed["stories"],
            parsed["footprint_sqft"],
            parsed["owner_raw"],
            parsed["total_valuation"],
            parsed["improvement_valuation"],
            sections_json,
            provenance_tag,
            prov_date,
            sqft_source,
            val_source,
            yr_source,
            parcel_id
        ))
    else:
        cur.execute("""
            UPDATE parcels
            SET building_sqft = ?,
                year_built = ?,
                stories = ?,
                footprint_sqft = ?,
                owner_name = COALESCE(?, owner_name),
                total_valuation = COALESCE(?, total_valuation),
                improvement_valuation = COALESCE(?, improvement_valuation),
                improvement_sections = ?,
                data_provenance = ?,
                provenance_date = ?,
                building_sqft_source = ?,
                valuation_source = ?,
                year_built_source = ?
            WHERE account_number = ? OR id = ?
        """, (
            parsed["total_building_sqft"],
            parsed["earliest_year_built"],
            parsed["stories"],
            parsed["footprint_sqft"],
            parsed["owner_raw"],
            parsed["total_valuation"],
            parsed["improvement_valuation"],
            sections_json,
            provenance_tag,
            prov_date,
            sqft_source,
            val_source,
            yr_source,
            account_number,
            pid_target
        ))

    if cur.rowcount == 0:
        conn.close()
        print(f"[-] No parcel row for DCAD acct {account_number}; not inserting a stand-in address or ZIP")
        return False

    conn.commit()
    conn.close()

    val_disp = f"${int(parsed['total_valuation']):,}" if parsed.get('total_valuation') else "N/A"
    print(f"[+] Synced parcel {account_number}: {parsed['total_building_sqft']:,} sqft ({parsed['section_count']} sections), built {parsed['earliest_year_built']}, val {val_disp}")
    return True

if __name__ == "__main__":
    if len(sys.argv) > 1:
        target = sys.argv[1]
        print(f"Fetching live DCAD details for account: {target}")
        update_parcel_with_live_dcad(target)
    else:
        print("Usage: python live_dcad_detail_fetcher.py <account_number>")
