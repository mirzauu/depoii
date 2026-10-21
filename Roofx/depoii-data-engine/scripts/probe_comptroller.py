import urllib.request
import re

url = "https://mycpa.cpa.state.tx.us/coa/"
req = urllib.request.Request(url, headers={
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
})
try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        html = resp.read().decode("utf-8", errors="ignore")
        print("HTTP 200, length:", len(html))
        forms = re.findall(r'<form[^>]*action="([^"]*)"', html)
        print("Form actions:", forms)
        inputs = re.findall(r'<input[^>]*name="([^"]*)"', html)
        print("Inputs:", inputs[:15])
except Exception as e:
    print("Error:", e)
