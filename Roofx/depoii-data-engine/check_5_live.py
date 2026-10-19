import sys
import time
from playwright.sync_api import sync_playwright

addresses = [
    ("701", "COMMERCE"),
    ("6868", "WALLING"),
    ("9106", "CHANCELLOR"),
    ("4020", "JUNIUS"),
    ("4424", "LOVERS")
]

url = "https://aca-prod.accela.com/DALLASTX/Cap/CapHome.aspx?module=Building"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for num, name in addresses:
        print(f"\n==========================================", flush=True)
        print(f"SEARCHING: {num} {name}", flush=True)
        print(f"==========================================", flush=True)
        page = browser.new_page()
        try:
            page.goto(url, wait_until="networkidle", timeout=35000)
            page.wait_for_selector("input[id*='txtGSNumber_ChildControl0']", timeout=15000)
            page.fill("input[id*='txtGSNumber_ChildControl0']", num)
            page.fill("input[id*='txtGSStreetName']", name)
            page.click("a[id*='btnNewSearch']")
            page.wait_for_load_state("networkidle", timeout=30000)
            time.sleep(2)
            
            # Check results
            rows = page.query_selector_all("table[id*='gdvPermitList'] tr")
            print(f"Rows in gdvPermitList: {len(rows)}", flush=True)
            if rows:
                for i, r in enumerate(rows[:6]):
                    tds = [td.inner_text().strip() for td in r.query_selector_all("td") if td.inner_text().strip()]
                    text = " | ".join(tds)
                    if text:
                        print(f"  Row {i}: {text[:140]}", flush=True)
            else:
                body = page.inner_text("body")
                for line in body.splitlines():
                    l_str = line.strip()
                    if any(k in l_str.lower() for k in ["no records", "not found", "search returned", "showing", "notice"]):
                        if len(l_str) < 120:
                            print(f"  Message: {l_str}", flush=True)
        except Exception as e:
            print(f"Error: {e}", flush=True)
        finally:
            page.close()
    browser.close()
print("\nDone check.", flush=True)
