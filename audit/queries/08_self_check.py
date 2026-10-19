"""08 — self-check three findings, wind-file check, NYC PLUTO, Dallas permit fields."""
import csv
import io
import json
import math
import sqlite3
import urllib.parse
import urllib.request
from datetime import datetime, timezone

DB = r"d:\Depoii_nextjs\audit\depoii_local_audit_copy.db"
OUT = r"d:\Depoii_nextjs\audit\queries\08_self_check.txt"
UA = {"User-Agent": "DepoiiAudit/1.0 (read-only)"}

def now():
    return datetime.now(timezone.utc).isoformat()

def fetch(url, timeout=35):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return getattr(res, "status", 200), res.read()

def hav(a, b, c, d):
    R = 3958.8
    p1, p2 = math.radians(a), math.radians(c)
    dp, dl = math.radians(c - a), math.radians(d - b)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(h), math.sqrt(1 - h))

def wilson(k, n, z=1.959963984540054):
    p = k / n
    z2 = z * z
    den = 1 + z2 / n
    center = (p + z2 / (2 * n)) / den
    marg = z * math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / den
    return p, center - marg, center + marg

def main():
    L = [f"RUN_UTC {now()}"]
    conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    cur = conn.cursor()

    L.append("\n=== SELF-CHECK 1 exposure>=60 ===")
    row = cur.execute(
        """SELECT COUNT(*),
                  SUM(CASE WHEN state<>'TX' THEN 1 ELSE 0 END),
                  SUM(CASE WHEN data_provenance='unverified_seed' THEN 1 ELSE 0 END),
                  SUM(CASE WHEN verification_status='PERMIT_DETECTED' THEN 1 ELSE 0 END)
           FROM scored_parcel_leads WHERE exposure_score>=60 AND COALESCE(is_mock,0)=0"""
    ).fetchone()
    L.append(f"ge60 {row[0]} non_tx {row[1]} unverified_seed {row[2]} permit_detected {row[3]}")

    L.append("\n=== SELF-CHECK 2 sqft*165 on scored leads ===")
    row = cur.execute(
        """SELECT COUNT(*) FROM scored_parcel_leads
           WHERE building_sqft>0 AND ABS(cad_total_valuation - building_sqft*165.0)<1"""
    ).fetchone()
    L.append(f"scored_165 {row[0]}")
    row = cur.execute(
        """SELECT COUNT(*) FROM parcels
           WHERE building_sqft>0 AND ABS(total_valuation - building_sqft*165.0)<1"""
    ).fetchone()
    L.append(f"parcel_165 {row[0]}")

    L.append("\n=== SELF-CHECK 3 re-download 260317 hail and wind ===")
    for kind in ("hail", "wind"):
        url = f"https://www.spc.noaa.gov/climo/reports/260317_rpts_{kind}.csv"
        try:
            status, raw = fetch(url)
            text = raw.decode("utf-8", errors="replace")
            rows = list(csv.DictReader(io.StringIO(text)))
            L.append(f"{kind} http {status} bytes {len(raw)} parsed_rows {len(rows)} at {now()} url {url}")
            L.append("  head " + " | ".join(text.splitlines()[:3]))
        except Exception as e:
            L.append(f"{kind} error {e}")

    L.append("\n=== March 17 leads by state and score ===")
    for r in cur.execute(
        """SELECT state, SUM(CASE WHEN exposure_score>=60 THEN 1 ELSE 0 END), COUNT(*)
           FROM scored_parcel_leads WHERE event_date='2026-03-17' GROUP BY 1"""
    ):
        L.append(f"  {r}")

    L.append("\n=== quoted points vs stored distances ===")
    # Madison and Meacham coordinates from the outbound query
    pairs = [
        ("Madison to hardcoded 32.71,-96.95", 32.73385401620511, -96.82712790244761, 32.71, -96.95, 7.33),
        ("Meacham to hardcoded 32.79,-97.35", 32.824948969188895, -97.30340607339363, 32.79, -97.35, 3.63),
    ]
    for name, la, lo, ra, ro, stored in pairs:
        d = hav(la, lo, ra, ro)
        L.append(f"  {name} haversine {d:.2f} stored {stored} diff {abs(d-stored):.2f}")

    L.append("\n=== NYC PLUTO for the 8 stratified BBLs ===")
    bbls = ["1001510001","2024560150","3072990071","3013790055","1007640057","5054950001","5079080066","2040010054"]
    for bbl in bbls:
        url = "https://data.cityofnewyork.us/resource/64uk-42ks.json?" + urllib.parse.urlencode({"bbl": bbl})
        try:
            status, raw = fetch(url, timeout=25)
            data = json.loads(raw.decode("utf-8", errors="replace"))
            if not data:
                L.append(f"  {bbl} http {status} empty")
                continue
            a = data[0]
            L.append(
                f"  {bbl} http {status} address {a.get('address')} class {a.get('bldgclass')} "
                f"year {a.get('yearbuilt')} units {a.get('unitsres')} bldgarea {a.get('bldgarea')} "
                f"numfloors {a.get('numfloors')} owner {a.get('ownername')} at {now()}"
            )
        except Exception as e:
            L.append(f"  {bbl} error {type(e).__name__}: {e}")

    L.append("\n=== Dallas permit layer fields and a roof sample ===")
    base = "https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/T_BU_Permits_FY2023_24/FeatureServer/0/query"
    try:
        status, raw = fetch(base + "?" + urllib.parse.urlencode({"where": "1=1", "outFields": "*", "resultRecordCount": "1", "f": "json"}))
        data = json.loads(raw.decode("utf-8", errors="replace"))
        feats = data.get("features") or []
        L.append(f"  sample http {status} n {len(feats)} err {data.get('error')} keys {list((feats[0].get('attributes') or {}).keys())[:25] if feats else None}")
    except Exception as e:
        L.append(f"  layer error {e}")

    text = "\n".join(str(x) for x in L) + "\n"
    open(OUT, "w", encoding="utf-8").write(text)
    print(text)
    conn.close()

if __name__ == "__main__":
    main()
