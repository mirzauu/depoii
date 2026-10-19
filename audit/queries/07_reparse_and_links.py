"""07 — reparse saved DCAD HTML, 0.65 footprint, street-name links, convective-day distances.

Read-only DB. Uses HTML/JSON already saved by script 06, plus a few live lookups.
"""
import csv
import json
import math
import os
import random
import re
import sqlite3
import urllib.parse
import urllib.request
from datetime import datetime, timezone

DB = r"d:\Depoii_nextjs\audit\depoii_local_audit_copy.db"
EVID = r"d:\Depoii_nextjs\audit\queries\live_pages"
OUT = r"d:\Depoii_nextjs\audit\queries\07_reparse_and_links.txt"
GOLDEN = r"d:\Depoii_nextjs\audit\golden_set.csv"
UA = {"User-Agent": "Mozilla/5.0 DepoiiAudit/1.0 (read-only public-record check)"}

def now():
    return datetime.now(timezone.utc).isoformat()

def fetch(url, timeout=40):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return getattr(res, "status", 200), res.read()

def hav(a, b, c, d):
    R = 3958.8
    p1, p2 = math.radians(a), math.radians(c)
    dp, dl = math.radians(c - a), math.radians(d - b)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(h), math.sqrt(1 - h))

def parse_dcad(html):
    addr_m = re.search(r'id="PropAddr1_lblPropAddr"[^>]*>(.*?)</span>', html, re.I | re.S)
    address = re.sub(r"&nbsp;", " ", addr_m.group(1) if addr_m else "")
    address = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", address)).strip()
    owner_m = re.search(r'id="lblOwner"[^>]*>.*?</span>\s*([^<]+)', html, re.I | re.S)
    owner = re.sub(r"\s+", " ", owner_m.group(1)).strip() if owner_m else ""
    val_m = re.search(r'lblTotalVal"[^>]*>\$?([0-9,]+)', html, re.I)
    value = float(val_m.group(1).replace(",", "")) if val_m else None
    descs = re.findall(r"<b>Desc:</b>(?:&nbsp;|\s)*([^<]+)", html, re.I)
    areas = [int(x.replace(",", "")) for x in re.findall(r"<b>Total Area:</b>(?:&nbsp;|\s)*([0-9,]+)", html, re.I)]
    years = [int(y) for y in re.findall(r"<b>Year Built:</b>(?:&nbsp;|\s)*([0-9]{4})", html, re.I)]
    stories = [int(s) for s in re.findall(r"#(?:&nbsp;|\s)*Stories:</TH>\s*<TD>\s*(\d+)", html, re.I)]
    units = [int(s) for s in re.findall(r"#(?:&nbsp;|\s)*Units:</TH>\s*<TD>\s*(\d+)", html, re.I)]
    foundations = re.findall(r"Foundation(?:&nbsp;|\s)*\(Area\):</TH>\s*<TD>[^(]*\(\s*([0-9,]+)\s*sqft", html, re.I)
    foundations = [int(x.replace(",", "")) for x in foundations]
    return {
        "address": address,
        "owner": owner,
        "value": value,
        "descs": [re.sub(r"\s+", " ", d).strip() for d in descs],
        "sum_area": sum(areas) if areas else None,
        "min_year": min(years) if years else None,
        "stories": stories[0] if stories else None,
        "units": units[0] if units else None,
        "foundation": foundations[0] if foundations else None,
    }

def street_core(addr):
    text = (addr or "").upper()
    text = text.split(",")[0]
    text = re.sub(r"[^A-Z0-9 ]", " ", text)
    drop = {"N","S","E","W","NE","NW","SE","SW","ST","STREET","DR","DRIVE","RD","ROAD","AVE","AVENUE","BLVD","BOULEVARD","LN","LANE","CT","COURT","WAY","PKWY","PARKWAY","PL","PLACE","HWY","HIGHWAY"}
    toks = [t for t in text.split() if t and not t.isdigit() and t not in drop]
    return " ".join(toks[:3])

def street_num(addr):
    m = re.search(r"\b(\d{1,6})\b", addr or "")
    return m.group(1) if m else None

def main():
    L = [f"RUN_UTC {now()}"]
    conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    cur = conn.cursor()

    # footprint = round(land * 0.65)
    n_parcels, n_fp, n_scored_cost = cur.execute(
        """SELECT
             (SELECT COUNT(*) FROM parcels),
             (SELECT COUNT(*) FROM parcels WHERE land_sqft>0 AND footprint_sqft = CAST(ROUND(land_sqft*0.65) AS INT)),
             (SELECT COUNT(*) FROM scored_parcel_leads s JOIN parcels p ON p.id=s.parcel_id
               WHERE p.land_sqft>0 AND p.footprint_sqft = CAST(ROUND(p.land_sqft*0.65) AS INT)
                 AND ABS(s.estimated_replacement_mid - p.footprint_sqft*9.4) < 1.5)
        """
    ).fetchone()
    L.append(f"parcels {n_parcels} footprint_eq_round_land_x_0.65 {n_fp} scored_cost_eq_that_footprint_x_9.4 {n_scored_cost}")

    L.append("\n=== outbound six vs land*0.65 and DCAD/TAD HTML ===")
    outbound = cur.execute(
        """SELECT s.parcel_id, s.address, s.city, s.zip_code, s.owner_name, s.building_sqft, s.year_built,
                  s.cad_total_valuation, s.footprint_sqft, s.estimated_replacement_mid, s.property_type,
                  s.why_strong_summary, p.land_sqft, p.footprint_sqft, p.stories, p.latitude, p.longitude
           FROM scored_parcel_leads s JOIN parcels p ON p.id=s.parcel_id WHERE s.outbound_ready=1"""
    ).fetchall()
    for row in outbound:
        pid, addr, city, zipc, owner, sqft, year, val, sfp, mid, ptype, why, land, pfp, stories, lat, lon = row
        pred = round(land * 0.65) if land else None
        L.append(
            f"{pid} | {addr} | zip {zipc} | type {ptype!r} | bldg {sqft} year {year} val {val} stories {stories} "
            f"parcel_fp {pfp} scored_fp {sfp} land {land} round(land*0.65) {pred} "
            f"fp_is_065 {pfp==pred} cost {mid} cost_over_pfp {None if not pfp else round(mid/pfp, 4)}"
        )
        html_path = os.path.join(EVID, f"{pid[:40]}.html")
        if os.path.exists(html_path):
            parsed = parse_dcad(open(html_path, encoding="utf-8").read())
            L.append(
                f"  LIVE addr={parsed['address']!r} owner={parsed['owner']!r} area={parsed['sum_area']} year={parsed['min_year']} "
                f"value={parsed['value']} stories={parsed['stories']} units={parsed['units']} foundation={parsed['foundation']} desc={parsed['descs']}"
            )

    # Update golden csv from reparsed HTML where a file exists
    if os.path.exists(GOLDEN):
        with open(GOLDEN, newline="", encoding="utf-8") as f:
            golden = list(csv.DictReader(f))
        for g in golden:
            path = os.path.join(EVID, f"{g['parcel_id'][:40]}.html")
            if not os.path.exists(path):
                continue
            parsed = parse_dcad(open(path, encoding="utf-8").read())
            g["live_address"] = parsed["address"]
            g["live_owner"] = parsed["owner"]
            g["live_sqft"] = parsed["sum_area"] if parsed["sum_area"] is not None else ""
            g["live_year"] = parsed["min_year"] if parsed["min_year"] is not None else ""
            g["live_value"] = parsed["value"] if parsed["value"] is not None else ""
            g["live_stories"] = parsed["stories"] if parsed["stories"] is not None else ""
            g["note"] = (g.get("note") or "") + f" | reparse desc={parsed['descs'][:1]} units={parsed['units']} foundation={parsed['foundation']}"

            def cmp_text(dbv, livev):
                if not str(livev).strip():
                    return "UNKNOWN"
                a = re.sub(r"\s+", " ", str(dbv or "")).upper()
                b = re.sub(r"\s+", " ", str(livev or "")).upper()
                return "PASS" if a == b or a in b or b in a else "FAIL"

            def cmp_num(dbv, livev):
                if livev in ("", None):
                    return "UNKNOWN"
                try:
                    return "PASS" if abs(float(dbv) - float(livev)) <= 1 else "FAIL"
                except (TypeError, ValueError):
                    return "UNKNOWN"

            g["field_address"] = cmp_text(g["address_db"], g["live_address"])
            g["field_owner"] = cmp_text(g["owner_db"], g["live_owner"])
            g["field_sqft"] = cmp_num(g["sqft_db"], g["live_sqft"])
            g["field_year"] = cmp_num(g["year_db"], g["live_year"])
            g["field_value"] = cmp_num(g["value_db"], g["live_value"])
            g["field_stories"] = cmp_num(g["stories_db"], g["live_stories"])
        with open(GOLDEN, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=golden[0].keys())
            w.writeheader()
            w.writerows(golden)
        L.append("\n=== reparsed DCAD field results (all golden rows with saved HTML) ===")
        for g in golden:
            if "DCAD" not in g["parcel_id"]:
                continue
            L.append(
                f"{g['parcel_id']} addr={g['field_address']} owner={g['field_owner']} sqft={g['field_sqft']} "
                f"year={g['field_year']} value={g['field_value']} stories={g['field_stories']} live_stories={g['live_stories']} db_stories={g['stories_db']} {g['note'][-180:]}"
            )

    # Street-name comparison, same seed and same SQL order as script 06
    L.append("\n=== street name AND number on the same 60-link sample ===")
    linked = cur.execute(
        """SELECT n.raw_permit_number, n.jurisdiction, n.normalized_address, p.address
           FROM normalized_permits n JOIN parcels p ON p.id = n.parcel_id
           WHERE n.parcel_id IS NOT NULL AND n.parcel_id != ''
             AND n.normalized_address IS NOT NULL AND p.address IS NOT NULL"""
    ).fetchall()
    rng = random.Random(20261014)
    sample = linked[:]
    rng.shuffle(sample)
    sample = sample[:60]
    bad = 0
    for num, jur, paddr, addr in sample:
        pn, an = street_num(paddr), street_num(addr)
        pc, ac = street_core(paddr), street_core(addr)
        mismatch = (pn and an and pn != an) or (pc and ac and pc != ac)
        bad += 1 if mismatch else 0
        if mismatch:
            L.append(f"  FALSE {jur} permit {paddr[:70]} || parcel {addr[:70]}")
    L.append(f"false_links {bad} of {len(sample)}")

    # Convective-day file 260425 vs the two outbound distances
    L.append("\n=== outbound haversine to 260425 TX rows and to 260426 TX rows ===")
    import io
    for code in ("260425", "260426"):
        text = open(os.path.join(r"d:\Depoii_nextjs\audit\queries\spc", f"{code}_rpts_hail.csv"), encoding="utf-8").read()
        pts = []
        for r in csv.DictReader(io.StringIO(text)):
            if (r.get("State") or "").upper() != "TX":
                continue
            pts.append((float(r["Lat"]), float(r["Lon"]), float(r["Size"]) / 100.0, r["Time"], r["Location"], r["Comments"][:80]))
        for row in outbound:
            pid, addr, city, zipc, owner, sqft, year, val, sfp, mid, ptype, why, land, pfp, stories, lat, lon = row
            if lat is None:
                L.append(f"  {code} {pid} no coordinates")
                continue
            best = min(pts, key=lambda p: hav(lat, lon, p[0], p[1]))
            dist = hav(lat, lon, best[0], best[1])
            L.append(f"  {code} {addr} stored_compare_later dist {dist:.2f} size {best[2]} time {best[3]} {best[4]} {best[5]}")

    # SPC html timezone words
    html = open(r"d:\Depoii_nextjs\audit\queries\spc\260425_rpts.html", encoding="utf-8", errors="replace").read()
    L.append("\n=== timezone words in 260425 HTML ===")
    for word in ("CST", "CDT", "UTC", "Central", "All times", "time zone"):
        L.append(f"  {word} count {html.upper().count(word.upper()) if word != 'All times' else html.lower().count('all times')}")
    m = re.search(r".{0,80}(CST|CDT|Central Time).{0,80}", html, re.I)
    L.append("  snippet " + (m.group(0).replace("\n", " ") if m else "NONE"))

    # Census ZCTA for the two coordinate outbound leads
    L.append("\n=== census coordinate geocode ===")
    for row in outbound:
        pid, addr, city, zipc, owner, sqft, year, val, sfp, mid, ptype, why, land, pfp, stories, lat, lon = row
        if lat is None:
            continue
        url = "https://geocoding.geo.census.gov/geocoder/geographies/coordinates?" + urllib.parse.urlencode({
            "x": lon, "y": lat, "benchmark": "Public_AR_Current", "vintage": "Current_Current", "format": "json",
        })
        try:
            status, raw = fetch(url, timeout=40)
            data = json.loads(raw.decode("utf-8", errors="replace"))
            geos = data.get("result", {}).get("geographies", {})
            zcta = (geos.get("2020 Census ZIP Code Tabulation Areas") or [{}])[0].get("ZCTA5")
            county = (geos.get("Counties") or [{}])[0].get("NAME")
            L.append(f"  {addr} db_zip {zipc} census_zcta {zcta} county {county} http {status} at {now()}")
        except Exception as e:
            L.append(f"  {addr} geocode_error {e}")

    # One Dallas permit search for the apartment address
    L.append("\n=== Dallas FY23-24 permits at 14222 ===")
    try:
        url = "https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/T_BU_Permits_FY2023_24/FeatureServer/0/query?" + urllib.parse.urlencode({
            "where": "ADDRESS LIKE '%14222%DALLAS%'",
            "outFields": "PERMIT_No,ADDRESS,ISSUE_DATE,DESCRIPTION,VALUE",
            "returnGeometry": "false",
            "f": "json",
        })
        status, raw = fetch(url, timeout=40)
        open(os.path.join(EVID, "dallas_14222.json"), "wb").write(raw)
        data = json.loads(raw.decode("utf-8", errors="replace"))
        feats = data.get("features") or []
        L.append(f"  http {status} features {len(feats)} at {now()} err {data.get('error')}")
        for f in feats[:15]:
            a = f.get("attributes") or {}
            L.append(f"  {a}")
    except Exception as e:
        L.append(f"  dallas_query_error {e}")

    text = "\n".join(L) + "\n"
    open(OUT, "w", encoding="utf-8").write(text)
    print(text)

if __name__ == "__main__":
    main()
