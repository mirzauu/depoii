"""04 — compare every scored storm date, and every swath date, to raw SPC hail CSVs.

Read-only against the audit DB copy. Network reads SPC only.
"""
import csv
import io
import math
import sqlite3
import time
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

DB = r"d:\Depoii_nextjs\audit\depoii_local_audit_copy.db"
OUT = r"d:\Depoii_nextjs\audit\queries\04_spc_verification.txt"
SPC = "https://www.spc.noaa.gov/climo/reports/{code}_rpts_hail.csv"
UA = {"User-Agent": "DepoiiAudit/1.0 (read-only dataset audit; contact local)"}

JUR_STATE = {
    "TX-DALLAS": "TX",
    "NY-NEW_YORK_CITY": "NY",
    "WA-SEATTLE": "WA",
    "OH-CINCINNATI": "OH",
    "IL-CHICAGO": "IL",
    "MA-BOSTON": "MA",
    "MD-MONTGOMERY_COUNTY": "MD",
    "FL-GAINESVILLE": "FL",
    "FL-TAMPA": "FL",
    "LA-BATON_ROUGE": "LA",
    "CA-SONOMA_COUNTY": "CA",
}

# Metro boxes used only to test whether ANY SPC hail row falls in the named metro.
METRO_BOX = {
    "TX": (31.5, 34.0, -98.5, -95.5),
    "NY": (40.3, 41.2, -74.5, -73.5),
    "WA": (47.0, 48.0, -122.8, -121.8),
    "OH": (38.8, 39.6, -84.9, -84.0),
    "IL": (41.4, 42.2, -88.2, -87.4),
    "MA": (42.0, 42.7, -71.4, -70.8),
    "MD": (38.8, 39.4, -77.5, -76.8),
    "FL": (27.5, 30.6, -82.8, -81.4),
    "LA": (30.0, 31.0, -91.4, -90.6),
    "CA": (38.0, 38.8, -123.2, -122.3),
}

def ymd_to_code(ymd: str) -> str:
    y, m, d = ymd.split("-")
    return f"{y[2:]}{m}{d}"

def prev_code(code: str) -> str:
    y = 2000 + int(code[0:2])
    m = int(code[2:4])
    d = int(code[4:6])
    dt = datetime(y, m, d, tzinfo=timezone.utc)
    from datetime import timedelta
    p = dt - timedelta(days=1)
    return p.strftime("%y%m%d")

def fetch(code: str):
    url = SPC.format(code=code)
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=25) as res:
            raw = res.read()
            status = getattr(res, "status", 200)
        text = raw.decode("utf-8", errors="replace")
        return code, status, text, None
    except Exception as e:
        return code, 0, "", str(e)

def parse_rows(text: str):
    if not text.strip():
        return [], ""
    # SPC files sometimes start with a title line before the header.
    lines = text.splitlines()
    header_idx = 0
    for i, line in enumerate(lines[:5]):
        if "Lat" in line and "Lon" in line:
            header_idx = i
            break
    body = "\n".join(lines[header_idx:])
    reader = csv.DictReader(io.StringIO(body))
    rows = []
    for r in reader:
        if not r:
            continue
        lat = r.get("Lat") or r.get("lat")
        lon = r.get("Lon") or r.get("lon")
        try:
            lat_f = float(lat)
            lon_f = float(lon)
        except (TypeError, ValueError):
            continue
        size_raw = r.get("Size") or r.get("size") or ""
        try:
            size = float(size_raw)
        except ValueError:
            size = None
        rows.append({
            "time": (r.get("Time") or "").strip(),
            "size": size,
            "location": (r.get("Location") or "").strip(),
            "county": (r.get("County") or "").strip(),
            "state": (r.get("State") or "").strip().upper(),
            "lat": lat_f,
            "lon": lon_f,
            "comments": (r.get("Comments") or "").strip(),
        })
    header = lines[header_idx] if lines else ""
    return rows, header

def in_box(lat, lon, box):
    s, n, w, e = box
    return s <= lat <= n and w <= lon <= e

def haversine(lat1, lon1, lat2, lon2):
    R = 3958.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def main():
    t0 = datetime.now(timezone.utc)
    conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    cur = conn.cursor()
    lead_dates = [r[0] for r in cur.execute(
        "SELECT DISTINCT event_date FROM scored_parcel_leads WHERE event_date IS NOT NULL AND event_date != ''"
    )]
    swaths = cur.execute(
        "SELECT event_date, jurisdiction_id, max_hail_inches, storm_name FROM storm_swaths"
    ).fetchall()
    leads = cur.execute(
        """SELECT s.parcel_id, s.event_date, s.nearest_hail_distance_mi, s.nearest_hail_size_in,
                  s.state, p.latitude, p.longitude
           FROM scored_parcel_leads s
           LEFT JOIN parcels p ON p.id = s.parcel_id
           WHERE s.event_date IS NOT NULL AND s.event_date != ''"""
    ).fetchall()
    conn.close()

    codes = set()
    for d in lead_dates:
        c = ymd_to_code(d)
        codes.add(c)
        codes.add(prev_code(c))
    # Known prior-failure dates even if absent from leads
    for d in ("2024-05-28", "2026-05-28", "2024-06-02", "2026-06-02", "2026-04-26", "2026-04-25"):
        c = ymd_to_code(d)
        codes.add(c)
        codes.add(prev_code(c))
    for d, jur, hail, name in swaths:
        if d:
            codes.add(ymd_to_code(d))

    L = [f"RUN_UTC {t0.isoformat()}", f"SPC_CODES {len(codes)}"]
    print(f"fetching {len(codes)} SPC files", flush=True)
    fetched = {}
    with ThreadPoolExecutor(max_workers=12) as ex:
        futs = [ex.submit(fetch, c) for c in sorted(codes)]
        done = 0
        for fut in as_completed(futs):
            code, status, text, err = fut.result()
            rows, header = parse_rows(text) if status == 200 else ([], "")
            fetched[code] = {"status": status, "n": len(rows), "rows": rows, "header": header, "err": err, "bytes": len(text)}
            done += 1
            if done % 50 == 0:
                print(f"  {done}/{len(codes)}", flush=True)

    # Scored lead dates
    L.append("\n=== scored event_date vs SPC file and previous convective-day file ===")
    for d in sorted(lead_dates):
        c = ymd_to_code(d)
        p = prev_code(c)
        a, b = fetched[c], fetched[p]
        L.append(
            f"{d} file={c} http={a['status']} rows={a['n']} bytes={a['bytes']} | prev={p} http={b['status']} rows={b['n']} header={a['header'][:80]!r} err={a['err']}"
        )

    # Swath existence: claimed state has >=1 hail row in that convective-day file
    L.append("\n=== storm_swaths vs SPC (claimed state has a hail row) ===")
    missing = []
    size_mismatch = []
    ok = 0
    http_fail = 0
    for d, jur, hail, name in swaths:
        c = ymd_to_code(d)
        info = fetched.get(c)
        st = JUR_STATE.get(jur, "")
        if not info or info["status"] != 200:
            http_fail += 1
            missing.append((d, jur, name, "http", info["status"] if info else None, info["err"] if info else None))
            continue
        state_rows = [r for r in info["rows"] if r["state"] == st]
        box = METRO_BOX.get(st)
        metro_rows = [r for r in state_rows if box and in_box(r["lat"], r["lon"], box)] if box else state_rows
        if not state_rows:
            missing.append((d, jur, name, "no_state_rows", info["n"], st))
            continue
        ok += 1
        sizes = [r["size"] for r in state_rows if r["size"] is not None]
        mx = max(sizes) if sizes else None
        if hail is not None and mx is not None and abs(float(hail) - mx) > 0.01:
            size_mismatch.append((d, jur, name, hail, mx, len(state_rows), len(metro_rows)))

    L.append(f"swaths {len(swaths)} ok_state_row {ok} missing_or_empty {len(missing)} http_fail {http_fail} size_mismatch {len(size_mismatch)}")
    L.append("-- missing sample (up to 40) --")
    for row in missing[:40]:
        L.append(" | ".join(str(x) for x in row))
    L.append(f"missing_total {len(missing)}")
    L.append("-- size mismatch sample (up to 30) --")
    for row in size_mismatch[:30]:
        L.append(" | ".join(str(x) for x in row))
    L.append(f"size_mismatch_total {len(size_mismatch)}")

    # Distance recompute for leads with coordinates, using same-day SPC file points in the lead's state
    L.append("\n=== haversine recompute vs stored nearest_hail_distance_mi ===")
    compared = 0
    gt_quarter = 0
    no_spc = 0
    no_xy = 0
    stored_null = 0
    examples = []
    by_date = defaultdict(lambda: [0, 0])
    source_flags = defaultdict(int)
    delayed_only = 0
    leads_with_only_delayed = 0

    DELAYED = ("delayed", "social", "mping", "tweet", "facebook", "instagram", "reddit")

    for pid, event_date, stored, stored_size, state, lat, lon in leads:
        c = ymd_to_code(event_date)
        info = fetched.get(c)
        if lat is None or lon is None:
            no_xy += 1
            continue
        if not info or info["status"] != 200 or not info["rows"]:
            no_spc += 1
            continue
        st = (state or "").upper()
        pts = [r for r in info["rows"] if r["state"] == st] or info["rows"]
        best = None
        best_row = None
        for r in pts:
            dmi = haversine(lat, lon, r["lat"], r["lon"])
            if best is None or dmi < best:
                best = dmi
                best_row = r
        if stored is None:
            stored_null += 1
            continue
        compared += 1
        diff = abs(best - float(stored))
        by_date[event_date][0] += 1
        if diff > 0.25:
            gt_quarter += 1
            by_date[event_date][1] += 1
            if len(examples) < 25:
                examples.append((pid, event_date, stored, round(best, 3), round(diff, 3), best_row["size"], best_row["location"], best_row["time"], best_row["comments"][:80]))
        comments = (best_row["comments"] or "").lower()
        for key in DELAYED:
            if key in comments:
                source_flags[key] += 1

    L.append(f"leads_with_date {len(leads)} no_xy {no_xy} no_spc_file {no_spc} stored_null_skipped {stored_null} compared {compared} diff_gt_0.25mi {gt_quarter}")
    for d, (n, bad) in sorted(by_date.items(), key=lambda kv: -kv[1][1]):
        L.append(f"  {d} compared {n} diff>0.25 {bad}")
    L.append("-- examples --")
    for e in examples:
        L.append(" | ".join(str(x) for x in e))

    # Source mix on the SPC files used by scored dates (same-day file, all rows)
    L.append("\n=== SPC comment source flags on scored-date files (row counts, not leads) ===")
    for d in sorted(lead_dates):
        info = fetched[ymd_to_code(d)]
        flags = defaultdict(int)
        for r in info["rows"]:
            cmt = (r["comments"] or "").lower()
            hit = False
            for key in ("mping", "social", "tweet", "facebook", "delayed", "public", "spotter", "mesonet", "broadcast", "nws"):
                if key in cmt:
                    flags[key] += 1
                    hit = True
            if not hit:
                flags["no_keyword"] += 1
        L.append(f"{d} rows={info['n']} " + " ".join(f"{k}={v}" for k, v in sorted(flags.items())))

    # Hardcoded April 26 list vs SPC
    hardcoded = [
        (32.76, -97.51, 2.75),
        (32.73, -97.46, 2.50),
        (32.72, -97.43, 2.25),
        (32.71, -97.45, 2.00),
        (32.79, -97.35, 2.75),
        (32.71, -96.95, 3.00),
        (32.69, -97.21, 2.00),
        (32.71, -97.11, 1.75),
        (32.77, -97.31, 1.75),
    ]
    L.append("\n=== hardcoded APRIL_26 points vs nearest SPC row in 260425 and 260426 ===")
    for code in ("260425", "260426"):
        info = fetched.get(code, {"rows": [], "status": 0, "n": 0})
        L.append(f"file {code} http={info['status']} rows={info['n']}")
        tx = [r for r in info["rows"] if r["state"] == "TX"]
        L.append(f"  TX rows {len(tx)} max_size {max([r['size'] or 0 for r in tx], default=None)}")
        for lat, lon, size in hardcoded:
            if not tx:
                L.append(f"  hard {lat},{lon},{size} NO_TX_ROWS")
                continue
            best = min(tx, key=lambda r: haversine(lat, lon, r["lat"], r["lon"]))
            dist = haversine(lat, lon, best["lat"], best["lon"])
            L.append(
                f"  hard {lat},{lon} size {size} -> SPC {best['lat']},{best['lon']} size {best['size']} dist_mi {dist:.3f} time {best['time']} loc {best['location']} cmt {best['comments'][:70]}"
            )

    # June 2 2026 TX detail
    L.append("\n=== 260602 and 260601 TX hail rows (full if <=40) ===")
    for code in ("260601", "260602", "260603"):
        info = fetched.get(code)
        if not info:
            continue
        tx = [r for r in info["rows"] if r["state"] == "TX"]
        L.append(f"{code} all={info['n']} TX={len(tx)} http={info['status']}")
        for r in tx[:40]:
            L.append(f"  {r['time']} {r['size']} {r['lat']} {r['lon']} {r['location']} {r['county']} {r['comments'][:90]}")

    L.append(f"\nDONE_UTC {datetime.now(timezone.utc).isoformat()}")
    text = "\n".join(L) + "\n"
    open(OUT, "w", encoding="utf-8").write(text)
    print(text[-12000:])
    print("WROTE", OUT, "chars", len(text))

if __name__ == "__main__":
    main()
