import asyncio
from playwright.async_api import async_playwright

DALLASNOW_URL = "https://aca-prod.accela.com/DALLASTX/Cap/CapHome.aspx?module=Building"

async def test_search():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        print("Navigating to DallasNow...")
        await page.goto(DALLASNOW_URL, wait_until="networkidle", timeout=40000)
        
        # Test 10900 Shady Trail
        print("Entering 10900 SHADY...")
        await page.fill("input[id*='txtGSNumber_ChildControl0']", "10900")
        await page.fill("input[id*='txtGSStreetName']", "SHADY")
        
        print("Submitting search...")
        await page.click("a[id*='btnNewSearch']")
        await page.wait_for_load_state("networkidle", timeout=35000)
        await asyncio.sleep(2)
        
        # Check results table
        rows = await page.query_selector_all("table[id*='gdvPermitList'] tr")
        print(f"Result table rows returned: {len(rows)}")
        for r in rows[:10]:
            txt = (await r.inner_text()).strip().replace("\t", " | ").replace("\n", " | ")
            if txt:
                print("  ", txt[:120])
                
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_search())
