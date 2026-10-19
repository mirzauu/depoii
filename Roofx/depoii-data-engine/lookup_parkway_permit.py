import asyncio
from playwright.async_api import async_playwright

async def find_permit_address():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        url = "https://aca-prod.accela.com/DALLASTX/Cap/CapHome.aspx?module=Building"
        print(f"Opening {url}...")
        await page.goto(url, wait_until="networkidle", timeout=35000)
        await page.wait_for_selector("input[id*='txtGSPermitNumber']", timeout=15000)
        print("Searching for permit COM-ROOF-26-000283...")
        await page.fill("input[id*='txtGSPermitNumber']", "COM-ROOF-26-000283")
        await page.click("a[id*='btnNewSearch']")
        await page.wait_for_load_state("networkidle", timeout=30000)
        await asyncio.sleep(2)
        
        rows = await page.query_selector_all("table[id*='gdvPermitList'] tr")
        print(f"Rows found: {len(rows)}")
        for r in rows:
            tds = await r.query_selector_all("td")
            if len(tds) >= 6:
                print("Permit record:")
                for j, td in enumerate(tds):
                    text = (await td.inner_text()).strip()
                    if text:
                        print(f"  td[{j}]: {text}")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(find_permit_address())
