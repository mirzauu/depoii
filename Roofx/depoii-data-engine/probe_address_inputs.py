import asyncio
from playwright.async_api import async_playwright

DALLASNOW_URL = "https://aca-prod.accela.com/DALLASTX/Cap/CapHome.aspx?module=Building"

async def test_address_search(street_num, street_name):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        print(f"Navigating to DallasNow: {DALLASNOW_URL}")
        await page.goto(DALLASNOW_URL, wait_until="networkidle", timeout=40000)
        
        # Look for street number and street name inputs
        inputs = await page.eval_on_selector_all("input", "els => els.map(e => ({id: e.id, name: e.name, placeholder: e.placeholder}))")
        addr_inputs = [i for i in inputs if any(k in i['id'].lower() for k in ['street', 'addr', 'num', 'name'])]
        print("Address-related inputs found on DallasNow search page:")
        for ai in addr_inputs:
            print("  ", ai)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_address_search("10900", "SHADY"))
