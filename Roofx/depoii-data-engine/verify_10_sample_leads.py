"""
Verify 10 Sample Aging Leads against live DCAD
----------------------------------------------
Hand-checks 10 candidate 1-story commercial warehouses meeting:
- roof_area_basis = 'DCAD_ACCOUNT_FOUNDATION_SUM'
- DallasNow checked (0 reroofs or non-reroof filings only)
- Non-institutional commercial owner
- No rebuild discrepancies
"""

import sys
import sqlite3
from live_dcad_detail_fetcher import fetch_dcad_html, parse_dcad_detail

SAMPLE_ACCOUNTS = [
    ('00000399090500000', '6868 WALLING LN'),
    ('00000778921000000', '9106 CHANCELLOR ROW'),
    ('00000634651000000', '1717 LEVEE ST'),
    ('00000601466000000', '2474 MANANA DR'),
    ('00000513721000000', '3030 Glenfield Ave'),
    ('00000778342000000', '1533 PRUDENTIAL DR'),
    ('00000495127000000', '2412 W KIEST BLVD'),
    ('00805500020020000', '10660 PLANO RD'),
    ('00000634586000000', '1421 LEVEE ST'),
    ('00000503059620000', '8730 KING GEORGE DR'),
]

def main():
    print("=" * 80)
    print("VERIFYING 10 HAND-CHECKED AGING LEADS AGAINST LIVE DCAD ROLL")
    print("=" * 80)

    for idx, (acct, expected_addr) in enumerate(SAMPLE_ACCOUNTS, 1):
        print(f"\n[{idx}/10] Fetching DCAD Account: {acct} ({expected_addr})...")
        html = fetch_dcad_html(acct, timeout=15)
        if not html:
            print(f"  [!] Failed to fetch HTML for {acct}")
            continue

        parsed = parse_dcad_detail(html, acct)
        if not parsed:
            print(f"  [!] Failed to parse details for {acct}")
            continue

        addr = parsed.get("property_address") or "N/A"
        owner = parsed.get("owner_raw") or "N/A"
        sqft = parsed.get("total_building_sqft") or 0
        stories = parsed.get("stories") or 1
        year = parsed.get("earliest_year_built") or "N/A"
        val = f"${int(parsed['total_valuation']):,}" if parsed.get("total_valuation") else "N/A"
        sections = parsed.get("section_count", 0)

        print(f"  -> Address:  {addr}")
        print(f"  -> Owner:    {owner}")
        print(f"  -> Area:     {sqft:,} sq ft ({sections} section(s), {stories} story)")
        print(f"  -> Built:    {year}")
        print(f"  -> Roll Val: {val}")

if __name__ == "__main__":
    main()
