import asyncio
from playwright.async_api import async_playwright

DALLASNOW_URL = "https://aca-prod.accela.com/DALLASTX/Cap/CapHome.aspx?module=Building"

TEST_ADDRESSES = [
    ("701", "COMMERCE"),
    ("6868", "WALLING"),
    ("9106", "CHANCELLOR"),
    ("4020", "JUNIUS"),
    ("4424", "LOVERS")
]

async def check_address(browser, num, name):
    page = await browser.new_page()
    try:
        print(f"\n==========================================")
        print(f"SEARCHING: {num} {name}")
        print(f"==========================================")
        await page.goto(DALLASNOW_URL, wait_until="networkidle", timeout=35000)
        await page.wait_for_selector("input[id*='txtGSNumber_ChildControl0']", timeout=15000)
        
        await page.fill("input[id*='txtGSNumber_ChildControl0']", num)
        await page.fill("input[id*='txtGSStreetName']", name)
        
        await page.click("a[id*='btnNewSearch']")
        await page.wait_for_load_state("networkidle", timeout=30000)
        await asyncio.sleep(2)
        
        # Check URL after search
        print(f"Current URL: {page.url}")
        
        # Check all tables with id
        tables = await page.query_selector_all("table")
        print(f"Total tables on page: {len(tables)}")
        
        # Look for permit tables or messages
        for t in tables:
            tid = await t.get_attribute("id") or ""
            if tid:
                print(f"  Table ID: {tid}")
                
        # Look for any text mentioning records or search results
        body_text = await page.inner_text("body")
        for line in body_text.splitlines():
            l_str = line.strip()
            if any(k in l_str.lower() for k in ["record", "permit", "no matching", "showing", "results", "found"]):
                if len(l_str) < 120:
                    print(f"  DOM text: {l_str}")

        # Check for rows in any grid view
        grid_rows = await page.query_selector_all("table.aca_grid tr, table[id*='gdv'] tr, table[id*='Grid'] tr")
        print(f"Grid rows found: {len(grid_rows)}")
        for i, gr in enumerate(grid_rows[:5]):
            print(f"    Row {i}: {(await gr.inner_text()).replace(chr(10), ' | ')[:120]}")

    except Exception as e:
        print(f"Error checking {num} {name}: {e}")
    finally:
        await page.close()

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for num, name in TEST_ADDRESSES:
            await check_address(browser, num, name)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
