"""
Step 2: Live DallasNow Automated Search Pass
Performs live searches against the City of Dallas Accela portal
(https://aca-prod.accela.com/DALLASTX/Cap/CapHome.aspx?module=Building)
with date fields EMPTY for each address in `staged_aging_commercial_leads`.

Rules:
1. Records retrieval date and filings count (including 0).
2. If a permit returned after last_reroof_date contains a full replacement description
   (reroof, re-roof, TPO, EPDM, roof replacement, new roof, layover, tear-off):
   - Updates `parcels.last_reroof_date` and `parcels.last_reroof_permit_no` in depoii_local.db.
   - Deletes the building from `staged_aging_commercial_leads` (building has been re-roofed).
3. Non-roof trades (rooftop HVAC, mechanical, electrical, plumbing, accessory, CO)
   stay off the roof date and do NOT remove the building from the aging list.
"""
import os
import sys
import asyncio
import sqlite3
import re
from datetime import datetime, timezone
from playwright.async_api import async_playwright

DB_PATH = os.path.join(os.path.dirname(__file__), "depoii_local.db")
DALLASNOW_URL = "https://aca-prod.accela.com/DALLASTX/Cap/CapHome.aspx?module=Building"

PURE_REROOF_PATTERNS = [
    r"\breroof\b", r"\bre-roof\b", r"\broof replacement\b", r"\bnew roof\b",
    r"\btear[- ]?off\b", r"\btpo\b", r"\bepdm\b", r"\bsingle[- ]?ply\b",
    r"\bbuilt[- ]?up\b", r"\bmodified bitumen\b", r"\bshingle\b",
    r"\bremove existing roof\b", r"\binstall new roof\b", r"\broof layover\b",
    r"\broof recover\b"
]

NON_ROOF_EXCLUDES = [
    r"\bhvac\b", r"\brtu\b", r"\bair condition", r"\bplumbing\b",
    r"\belectrical\b", r"\bantenna\b", r"\bcell\b", r"\bexhaust fan\b",
    r"\bchiller\b", r"\bcompressor\b", r"\bcertificate of occupancy\b",
    r"\bwater and wastewater\b", r"\bfire prevention\b", r"\baccessory\b"
]

def parse_street_tokens(addr: str):
    if not addr:
        return ("", "")
    clean = re.sub(r"[^\w\s]", " ", addr.upper())
    parts = clean.split()
    if not parts:
        return ("", "")
    num = parts[0] if parts[0].isdigit() else ""
    rem = parts[1:] if num else parts
    if rem and rem[0] in ["N", "S", "E", "W", "NORTH", "SOUTH", "EAST", "WEST"]:
        rem = rem[1:]
    name = rem[0] if rem else ""
    return (num, name)

def parse_date(date_str: str) -> str:
    if not date_str:
        return ""
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})", date_str.strip())
    if m:
        month, day, year = m.groups()
        return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"
    return ""

def is_full_replacement(desc: str) -> bool:
    if not desc:
        return False
    d = desc.lower()
    has_reroof = any(re.search(pat, d) for pat in PURE_REROOF_PATTERNS)
    if not has_reroof:
        return False
    has_exclude = any(re.search(pat, d) for pat in NON_ROOF_EXCLUDES)
    if has_exclude:
        # Require strong positive override
        strong = any(re.search(pat, d) for pat in [
            r"\btpo\b", r"\bepdm\b", r"\breroof\b", r"\bre-roof\b",
            r"\btear[- ]?off\b", r"\bnew roof\b", r"\broof replacement\b",
            r"\broof layover\b", r"\broof recover\b"
        ])
        return bool(strong)
    return True
async def search_dallasnow(browser, street_num: str, street_name: str):
    page = await browser.new_page()
    try:
        await page.goto(DALLASNOW_URL, wait_until="networkidle", timeout=35000)
        await page.wait_for_selector("input[id*='txtGSNumber_ChildControl0']", timeout=15000)

        # Fill Street Number and Street Name, leave dates empty
        await page.fill("input[id*='txtGSNumber_ChildControl0']", street_num)
        await page.fill("input[id*='txtGSStreetName']", street_name)
        
        # Submit search
        await page.click("a[id*='btnNewSearch']")
        await page.wait_for_load_state("networkidle", timeout=30000)
        await asyncio.sleep(1.5)
        
        # Check if table exists
        rows = await page.query_selector_all("table[id*='gdvPermitList'] tr")
        if not rows:
            return []
        
        permits = []
        for r in rows:
            tds = await r.query_selector_all("td")
            if len(tds) >= 6:
                # Accela Citizen Access column layout:
                # tds[0]: Checkbox/Empty selector
                # tds[1]: Date (MM/DD/YYYY)
                # tds[2]: Permit Number
                # tds[3]: Permit Type
                # tds[4]: Address
                # tds[5]: Description
                p_date_raw = (await tds[1].inner_text()).strip()
                p_no = (await tds[2].inner_text()).strip()
                p_type = (await tds[3].inner_text()).strip()
                p_addr = (await tds[4].inner_text()).strip()
                p_desc = (await tds[5].inner_text()).strip()
                
                p_date = parse_date(p_date_raw)
                if p_no and p_date:
                    permits.append({
                        "permit_no": p_no,
                        "date": p_date,
                        "type": p_type,
                        "address": p_addr,
                        "description": f"{p_type}: {p_desc}".strip(": ")
                    })
        return permits
    finally:
        await page.close()

async def process_batch(batch_size=10):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    # Fetch unsearched rows from staged_aging_commercial_leads
    cur.execute("""
        SELECT id, parcel_id, address, last_reroof_date, last_reroof_permit_no
        FROM staged_aging_commercial_leads
        WHERE dallasnow_checked_at IS NULL
        LIMIT ?
    """, (batch_size,))
    leads = cur.fetchall()
    
    if not leads:
        print("No unsearched leads remaining in staged_aging_commercial_leads.")
        conn.close()
        return 0

    print(f"Starting DallasNow live search batch for {len(leads)} leads...")
    retrieval_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        dropped_count = 0
        retained_count = 0
        
        for lead in leads:
            lid, pid, addr, stored_date, stored_pno = lead
            num, name = parse_street_tokens(addr)
            
            if not num or not name:
                cur.execute("""
                    UPDATE staged_aging_commercial_leads
                    SET dallasnow_checked_at = ?, dallasnow_filings_count = 0
                    WHERE id = ?
                """, (retrieval_date, lid))
                conn.commit()
                continue
                
            print(f"Searching: {num} {name} (Parcel: {pid}, Stored Date: {stored_date})...")
            try:
                filings = await search_dallasnow(browser, num, name)
                filings_count = len(filings)
                print(f"  -> Found {filings_count} filings on DallasNow.")
                
                # Check for newer reroof
                newer_reroof = None
                newest_filing = filings[0] if filings else None
                
                for f in filings:
                    f_date = f["date"]
                    f_desc = f["description"]
                    if f_date > stored_date and is_full_replacement(f_desc):
                        if not newer_reroof or f_date > newer_reroof["date"]:
                            newer_reroof = f
                            
                if newer_reroof:
                    print(f"  [OVERRIDE] Newer reroof found: {newer_reroof['date']} ({newer_reroof['permit_no']})")
                    print(f"    Scope: {newer_reroof['description'][:80]}")
                    
                    # Update parcels table
                    cur.execute("""
                        UPDATE parcels
                        SET last_reroof_date = ?, last_reroof_permit_no = ?
                        WHERE id = ?
                    """, (newer_reroof["date"], newer_reroof["permit_no"], pid))
                    
                    # Remove from staged_aging_commercial_leads
                    cur.execute("DELETE FROM staged_aging_commercial_leads WHERE id = ?", (lid,))
                    conn.commit()
                    dropped_count += 1
                else:
                    # Update search audit metadata on staged row
                    newest_no = newest_filing["permit_no"] if newest_filing else None
                    newest_d = newest_filing["date"] if newest_filing else None
                    newest_desc = newest_filing["description"][:120] if newest_filing else None
                    
                    cur.execute("""
                        UPDATE staged_aging_commercial_leads
                        SET dallasnow_checked_at = ?,
                            dallasnow_filings_count = ?,
                            dallasnow_newest_filing_no = ?,
                            dallasnow_newest_filing_date = ?,
                            dallasnow_newest_filing_desc = ?
                        WHERE id = ?
                    """, (retrieval_date, filings_count, newest_no, newest_d, newest_desc, lid))
                    conn.commit()
                    retained_count += 1
            except Exception as e:
                print(f"  Error searching {addr}: {e}")
                
        await browser.close()
        
    conn.close()
    print(f"\nBatch completed: {dropped_count} dropped (newer reroof), {retained_count} retained with search metadata.")
    return len(leads)

async def run_daemon(chunk_size=15, max_batches=None):
    batch_num = 0
    while True:
        batch_num += 1
        processed = await process_batch(chunk_size)
        if processed == 0:
            print("All aging leads have been searched on DallasNow!")
            break
        if max_batches and batch_num >= max_batches:
            print(f"Reached max batches limit ({max_batches}). Stopping daemon.")
            break
        await asyncio.sleep(1.0)

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--daemon":
        max_b = int(sys.argv[2]) if len(sys.argv) > 2 else None
        asyncio.run(run_daemon(chunk_size=15, max_batches=max_b))
    else:
        limit = int(sys.argv[1]) if len(sys.argv) > 1 else 5
        asyncio.run(process_batch(limit))
