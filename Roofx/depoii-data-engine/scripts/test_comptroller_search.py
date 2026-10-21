import urllib.request
import json

url = "https://comptroller.texas.gov/data-search/franchise-tax/32037492082"
req = urllib.request.Request(url, headers={
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Referer": "https://comptroller.texas.gov/taxes/franchise/account-status/search/32037492082",
    "Origin": "https://comptroller.texas.gov"
})
try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        print("Detail JSON response keys:", list(data.keys()))
        print(json.dumps(data, indent=2))
except Exception as e:
    print("Error:", e)
