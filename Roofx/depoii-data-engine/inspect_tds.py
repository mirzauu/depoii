import sys
import time
from playwright.sync_api import sync_playwright

url = "https://aca-prod.accela.com/DALLASTX/Cap/CapHome.aspx?module=Building"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(url, wait_until="networkidle", timeout=35000)
    page.wait_for_selector("input[id*='txtGSNumber_ChildControl0']", timeout=15000)
    page.fill("input[id*='txtGSNumber_ChildControl0']", "701")
    page.fill("input[id*='txtGSStreetName']", "COMMERCE")
    page.click("a[id*='btnNewSearch']")
    page.wait_for_load_state("networkidle", timeout=30000)
    time.sleep(2)
    
    rows = page.query_selector_all("table[id*='gdvPermitList'] tr")
    print(f"Total rows in table: {len(rows)}", flush=True)
    for i, r in enumerate(rows[:6]):
        tds = r.query_selector_all("td")
        print(f"Row {i}: {len(tds)} tds", flush=True)
        for j, td in enumerate(tds):
            print(f"   td[{j}]: {repr(td.inner_text().strip())}", flush=True)
    browser.close()
