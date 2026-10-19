"""09 — Dallas open-data roof permits as an independent recall set. Read-only DB."""
import json
import sqlite3
import urllib.parse
import urllib.request
from datetime import datetime, timezone

DB = r"d:\Depoii_nextjs\audit\depoii_local_audit_copy.db"
OUT = r"d:\Depoii_nextjs\audit\queries\09_dallas_permit_recall.txt"
UA = {"User-Agent": "DepoiiAudit/1.0 (read-only)"}

def now():
    return datetime.now(timezone.utc).isoformat()

def wilson(k, n, z=1.959963984540054):
    p = k / n
    z2 = z * z
    den = 1 + z2 / n
    center = (p + z2 / (2 * n)) / den
    import math
    marg = z * math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / den
    return p, center - marg, center + marg

def main():
    url = "https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/T_BU_Permits_FY2023_24/FeatureServer/0/query?" + urllib.parse.urlencode({
        "where": "UPPER(ACTIVITY) LIKE '%ROOF%'",
        "outFields": "PERMIT_No,ADDRESS,ACTIVITY,ISSUE_DATE,ZIP_CODE,VALUE",
        "returnGeometry": "false",
        "resultRecordCount": "30",
        "orderByFields": "PERMIT_No",
        "f": "json",
    })
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=40) as res:
        raw = res.read()
        status = getattr(res, "status", 200)
    open(r"d:\Depoii_nextjs\audit\queries\live_pages\dallas_roof_30.json", "wb").write(raw)
    data = json.loads(raw.decode("utf-8", errors="replace"))
    feats = data.get("features") or []
    L = [f"RUN_UTC {now()}", f"http {status} features {len(feats)} err {data.get('error')}"]
    conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    cur = conn.cursor()
    found = 0
    for f in feats:
        a = f.get("attributes") or {}
        num = str(a.get("PERMIT_No") or "")
        hit = cur.execute("SELECT COUNT(*) FROM normalized_permits WHERE raw_permit_number=?", (num,)).fetchone()[0]
        found += 1 if hit else 0
        L.append(f"  {num} in_db {hit} {a.get('ADDRESS')} {a.get('ACTIVITY')}")
    if feats:
        p, lo, hi = wilson(found, len(feats))
        L.append(f"RECALL {found}/{len(feats)} rate {p:.3f} wilson95 [{lo:.3f}, {hi:.3f}]")
    L.append(f"DONE {now()}")
    text = "\n".join(L) + "\n"
    open(OUT, "w", encoding="utf-8").write(text)
    print(text)
    conn.close()

if __name__ == "__main__":
    main()
