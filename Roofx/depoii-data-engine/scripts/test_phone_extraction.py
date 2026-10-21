import urllib.request
import urllib.parse
import re

def search_ddg(query):
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
            # phone regex matching formats like (214) 348-0240, 214-348-0240, 214.348.0240, 2143480240
            phones = re.findall(r'\(?\b[2-9][0-9]{2}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b', html)
            valid = []
            for p in phones:
                d = re.sub(r'\D', '', p)
                if len(d) == 10 and not d.startswith(('555', '000', '111', '123')):
                    # format nicely as (XXX) XXX-XXXX
                    formatted = f"({d[:3]}) {d[3:6]}-{d[6:]}"
                    valid.append(formatted)
            snippets = re.findall(r'<a class="result__snippet"[^>]*>(.*?)</a>', html)
            clean_s = [re.sub(r'<[^>]+>', ' ', s).strip() for s in snippets]
            return {"phones": list(dict.fromkeys(valid)), "snippets": clean_s}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    tests = [
        ("6419 Skillman St", "DAYTON HUDSON CORP"),
        ("12002 Corporate Dr", "GREENBRIAR HOLDINGS"),
        ("10305 Brockwood Rd", "WA TRIANGLE INDUSTRIAL II LLC"),
        ("8220 Ambassador Row", "BV4 8220 AMBASSADOR ROW LP")
    ]
    for addr, owner in tests:
        # Try address first
        res = search_ddg(f"{addr} Dallas TX phone")
        if not res.get("phones"):
            # Try with owner
            res = search_ddg(f"{addr} {owner} Dallas")
        print(f"[{addr} | {owner}]")
        print("  Phones:", res.get("phones")[:3] if res.get("phones") else "None found")
        if res.get("snippets"):
            print("  Top snippet:", res["snippets"][0][:130])
