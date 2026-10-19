import urllib.request
import urllib.parse
import json

nums = ['14222', '15702']

print("=== LIVE CITY OF DALLAS OPEN DATA PERMIT SEARCH ===")
for num in nums:
    query = f"street_number='{num}'"
    url = f"https://data.dallasopendata.com/resource/ydr8-5enu.json?$where={urllib.parse.quote(query)}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 Depoii/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            permits = json.loads(res.read().decode())
            print(f"\nResults for Street Number {num}: {len(permits)} permits found")
            for p in permits:
                p_num = p.get('permit_number')
                dt = p.get('issue_date')
                addr = f"{p.get('street_number', '')} {p.get('street_name', '')} {p.get('street_type', '')}".strip()
                desc = p.get('description') or p.get('work_description') or ''
                print(f"  • [{dt}] Permit #{p_num} at {addr} | Desc: {desc[:80]}")
    except Exception as e:
        print(f"Error for #{num}: {e}")
