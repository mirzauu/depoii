"""04b — SPC size is hundredths of an inch. Corrected existence, size, and distance tests.

Read-only DB. Network: SPC only. Saves the scored-date CSVs under queries/spc/.
"""
import csv
import io
import math
import os
import sqlite3
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone

DB = r"d:\Depoii_nextjs\audit\depoii_local_audit_copy.db"
OUT = r"d:\Depoii_nextjs\audit\queries\04b_spc_corrected.txt"
RAW = r"d:\Depoii_nextjs\audit\queries\spc"
os.makedirs(RAW, exist_ok=True)
SPC = "https://www.spc.noaa.gov/climo/reports/{code}_rpts_hail.csv"
UA = {"User-Agent": "DepoiiAudit/1.0 (read-only dataset audit)"}

PREFIX_STATE = {
    "TX": "TX", "NY": "NY", "WA": "WA", "OH": "OH", "IL": "IL", "MA": "MA",
    "MD": "MD", "FL": "FL", "LA": "LA", "CA": "CA",
}
METRO = {
    "TX": (31.8, 33.6, -97.9, -96.2),
    "NY": (40.4, 41.0, -74.3, -73.6),
    "WA": (47.2, 47.8, -122.6, -122.0),
    "IL": (41.5, 42.2, -88.0, -87.5),
    "OH": (38.9, 39.5, -84.8, -84.1),
    "MA": (42.0, 42.7, -71.5, -70.7),
    "MD": (38.9, 39.3, -77.4, -76.8),
    "FL": (27.6, 30.5, -82.8, -81.3),
    "LA": (30.1, 30.8, -91.4, -90.7),
    "CA": (38.1, 38.7, -123.1, -122.4),
}

def code_of(ymd):
    y, m, d = ymd.split("-")
    return f"{y[2:]}{m}{d}"

def fetch(code, attempts=3):
    url = SPC.format(code=code)
    last = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=40) as res:
                raw = res.read()
                status = getattr(res, "status", 200)
            path = os.path.join(RAW, f"{code}_rpts_hail.csv")
            open(path, "wb").write(raw)
            return status, raw.decode("utf-8", errors="replace"), None
        except Exception as e:
            last = str(e)
    return 0, "", last

def parse(text):
    lines = text.splitlines()
    header_idx = 0
    for i, line in enumerate(lines[:6]):
        if "Lat" in line and "Lon" in line:
            header_idx = i
            break
    body = "\n".join(lines[header_idx:])
    rows = []
    for r in csv.DictReader(io.StringIO(body)):
        try:
            lat = float(r.get("Lat"))
            lon = float(r.get("Lon"))
            size_hund = float(r.get("Size"))
        except (TypeError, ValueError):
            continue
        rows.append({
            "time": (r.get("Time") or "").strip(),
            "size_in": size_hund / 100.0,
            "state": (r.get("State") or "").strip().upper(),
            "lat": lat,
            "lon": lon,
            "location": (r.get("Location") or "").strip(),
            "comments": (r.get("Comments") or "").strip(),
        })
    return rows

def hav(a, b, c, d):
    R = 3958.8
    p1, p2 = math.radians(a), math.radians(c)
    dp, dl = math.radians(c - a), math.radians(d - b)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(h), math.sqrt(1 - h))

def in_box(lat, lon, box):
    s, n, w, e = box
    return s <= lat <= n and w <= lon <= e

def main():
    t0 = datetime.now(timezone.utc)
    conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    cur = conn.cursor()
    swaths = cur.execute("SELECT event_date, jurisdiction_id, max_hail_inches, storm_name FROM storm_swaths").fetchall()
    leads = cur.execute(
        """SELECT s.parcel_id, s.address, s.city, s.state, s.event_date, s.storm_name,
                  s.nearest_hail_distance_mi, s.nearest_hail_size_in, s.nearest_hail_location,
                  s.outbound_ready, p.latitude, p.longitude
           FROM scored_parcel_leads s LEFT JOIN parcels p ON p.id=s.parcel_id
           WHERE s.event_date IS NOT NULL AND trim(s.event_date) != ''"""
    ).fetchall()
    conn.close()

    codes = set()
    for d, *_ in swaths:
        if d:
            codes.add(code_of(d))
    for row in leads:
        codes.add(code_of(row[5] if False else row[4]))
    for extra in ("240528", "260528", "260524", "260317", "260425", "260426"):
        codes.add(extra)

    print(f"fetch {len(codes)}", flush=True)
    cache = {}
    # sequential enough with a small pool would be faster; do batches of threads
    from concurrent.futures import ThreadPoolExecutor, as_completed
    with ThreadPoolExecutor(max_workers=10) as ex:
        futs = {ex.submit(fetch, c): c for c in codes}
        n = 0
        for fut in as_completed(futs):
            c = futs[fut]
            status, text, err = fut.result()
            cache[c] = (status, parse(text) if status == 200 else [], err, len(text))
            n += 1
            if n % 80 == 0:
                print(n, flush=True)

    L = [f"RUN_UTC {t0.isoformat()}", "SIZE_SCALE SPC Size column divided by 100 to inches"]

    # Swath audit
    buckets = defaultdict(int)
    size_bad = []
    metro_empty = []
    no_state = []
    for d, jur, hail, name in swaths:
        prefix = (jur or "").split("-")[0]
        st = PREFIX_STATE.get(prefix)
        if not st:
            buckets["unmapped_jurisdiction"] += 1
            continue
        status, rows, err, nbytes = cache[code_of(d)]
        if status != 200:
            buckets["http_fail"] += 1
            no_state.append((d, jur, name, "http", status, err))
            continue
        state_rows = [r for r in rows if r["state"] == st]
        if not state_rows:
            buckets["no_hail_in_claimed_state"] += 1
            no_state.append((d, jur, name, "no_state_rows", len(rows), st))
            continue
        buckets["state_has_hail"] += 1
        mx = max(r["size_in"] for r in state_rows)
        if hail is not None and abs(float(hail) - mx) > 0.26:
            buckets["max_size_diff_gt_0.25_in"] += 1
            if len(size_bad) < 20:
                size_bad.append((d, name, hail, round(mx, 2), len(state_rows)))
        box = METRO.get(st)
        metro_n = sum(1 for r in state_rows if in_box(r["lat"], r["lon"], box)) if box else None
        if metro_n == 0:
            buckets["state_hail_but_none_in_metro_box"] += 1
            if len(metro_empty) < 15:
                metro_empty.append((d, name, hail, round(mx, 2), len(state_rows)))
    L.append("\n=== swath vs SPC after /100 ===")
    L.append(f"swaths {len(swaths)}")
    for k, v in sorted(buckets.items()):
        L.append(f"{k} {v}")
    L.append("-- size mismatches (stored max vs SPC state max, inches) --")
    for row in size_bad:
        L.append(" | ".join(str(x) for x in row))
    L.append("-- state hail but metro box empty sample --")
    for row in metro_empty:
        L.append(" | ".join(str(x) for x in row))
    L.append(f"no_state_or_http_examples {len(no_state)}")

    # Lead dates: state of the LEAD, nearest SPC point in that state. No cross-country fallback.
    L.append("\n=== lead distance recompute, same-state SPC points only, size in inches ===")
    stats = defaultdict(lambda: {"cmp": 0, "gt025": 0, "gt1": 0, "gt5": 0, "no_state_pts": 0, "no_xy": 0, "null_stored": 0})
    examples = []
    outbound = []
    only_weak = 0
    weak_checked = 0
    WEAK = ("delayed", "social media", "facebook", "mping", "tweet", "instagram")

    for pid, addr, city, state, event_date, storm, stored, ssize, sloc, ready, lat, lon in leads:
        st = (state or "").upper()
        key = event_date
        status, rows, err, nbytes = cache.get(code_of(event_date), (0, [], "missing", 0))
        if lat is None or lon is None:
            stats[key]["no_xy"] += 1
            continue
        pts = [r for r in rows if r["state"] == st]
        if not pts:
            stats[key]["no_state_pts"] += 1
            continue
        best = min(pts, key=lambda r: hav(lat, lon, r["lat"], r["lon"]))
        dist = hav(lat, lon, best["lat"], best["lon"])
        cmt = best["comments"].lower()
        weak = any(w in cmt for w in WEAK)
        # only-weak: every SPC point within 15 miles is delayed/social/mping
        near = [r for r in pts if hav(lat, lon, r["lat"], r["lon"]) <= 15]
        if near:
            weak_checked += 1
            if all(any(w in r["comments"].lower() for w in WEAK) for r in near):
                only_weak += 1
        if stored is None:
            stats[key]["null_stored"] += 1
            continue
        diff = abs(dist - float(stored))
        stats[key]["cmp"] += 1
        if diff > 0.25:
            stats[key]["gt025"] += 1
        if diff > 1:
            stats[key]["gt1"] += 1
        if diff > 5:
            stats[key]["gt5"] += 1
        if diff > 1 and len(examples) < 12:
            examples.append((pid, event_date, stored, round(dist, 2), round(diff, 2), round(best["size_in"], 2), best["location"], best["time"], best["comments"][:70]))
        if ready == 1:
            outbound.append((pid, addr, event_date, stored, round(dist, 2), ssize, round(best["size_in"], 2), best["location"], best["time"], best["comments"][:90], sloc))

    tot = defaultdict(int)
    for d, s in sorted(stats.items()):
        L.append(f"{d} " + " ".join(f"{k}={v}" for k, v in s.items()))
        for k, v in s.items():
            tot[k] += v
    L.append("TOTAL " + " ".join(f"{k}={v}" for k, v in tot.items()))
    L.append(f"leads_with_a_report_within_15mi {weak_checked} of_which_every_such_report_is_delayed_social_or_mping {only_weak}")
    L.append("-- examples diff>1mi --")
    for e in examples:
        L.append(" | ".join(str(x) for x in e))
    L.append("-- outbound ready vs SPC same-state nearest --")
    for e in outbound:
        L.append(" | ".join(str(x) for x in e))

    # Specific files
    L.append("\n=== retry and empty files ===")
    for c in ("260524", "260317", "260528", "240528"):
        status, rows, err, nbytes = cache[c]
        tx = [r for r in rows if r["state"] == "TX"]
        dfw = [r for r in tx if in_box(r["lat"], r["lon"], METRO["TX"])]
        mx = max((r["size_in"] for r in tx), default=None)
        L.append(f"{c} http={status} bytes~{nbytes} rows={len(rows)} TX={len(tx)} dfw_box={len(dfw)} tx_max_in={mx} err={err}")
        for r in (dfw or tx)[:8]:
            L.append(f"  {r['time']} {r['size_in']} {r['lat']} {r['lon']} {r['location']} {r['comments'][:80]}")

    # April 25 file timezone quote from HTML
    html_url = "https://www.spc.noaa.gov/climo/reports/260425_rpts.html"
    try:
        req = urllib.request.Request(html_url, headers=UA)
        with urllib.request.urlopen(req, timeout=40) as res:
            html = res.read().decode("utf-8", errors="replace")
        open(os.path.join(RAW, "260425_rpts.html"), "w", encoding="utf-8").write(html)
        # pull a short snippet that mentions time zone
        low = html.lower()
        idx = low.find("time")
        snippet = " ".join(html[max(0, idx-80):idx+180].split()) if idx >= 0 else html[:300]
        L.append("\n=== SPC HTML 260425 timezone snippet ===")
        L.append(f"url {html_url} retrieved {datetime.now(timezone.utc).isoformat()}")
        L.append(snippet[:400])
    except Exception as e:
        L.append(f"html_fetch_fail {e}")

    L.append(f"\nDONE_UTC {datetime.now(timezone.utc).isoformat()}")
    text = "\n".join(L) + "\n"
    open(OUT, "w", encoding="utf-8").write(text)
    print(text)
    print("WROTE", len(text))

if __name__ == "__main__":
    main()
