"""06 — golden-set draw, live county/city checks, Fort Worth permit recall, link sample.

Read-only against the audit DB copy. Network reads public county and city endpoints.
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
OUT_TXT = r"d:\Depoii_nextjs\audit\queries\06_live_golden_and_recall.txt"
GOLDEN = r"d:\Depoii_nextjs\audit\golden_set.csv"
EVID = r"d:\Depoii_nextjs\audit\queries\live_pages"
os.makedirs(EVID, exist_ok=True)

UA = {"User-Agent": "Mozilla/5.0 DepoiiAudit/1.0 (read-only public-record check)"}
SEED = 20261014

def now():
    return datetime.now(timezone.utc).isoformat()

def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as res:
        raw = res.read()
        status = getattr(res, "status", 200)
    return status, raw

def wilson(k, n, z=1.959963984540054):
    if n <= 0:
        return None
    p = k / n
    z2 = z * z
    den = 1 + z2 / n
    center = (p + z2 / (2 * n)) / den
    marg = z * math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / den
    return p, center - marg, center + marg

def n_for_pm(e=0.03, p=0.5, z=1.959963984540054):
    return math.ceil((z * z * p * (1 - p)) / (e * e))

def street_num(addr):
    m = re.search(r"\b(\d{1,6})\b", addr or "")
    return m.group(1) if m else None

def city_group(city, state):
    st = (state or "").upper()
    c = (city or "").lower()
    if st == "NY":
        return "NY"
    if st == "WA":
        return "SEA"
    if "fort worth" in c:
        return "FW"
    if c == "dallas":
        return "DAL"
    return "TX_OTHER"

def size_tier(sqft):
    if sqft is None:
        return "unknown"
    if sqft < 10000:
        return "small"
    if sqft < 50000:
        return "mid"
    return "large"

def score_band(score):
    if score is None:
        return "unknown"
    if score < 60:
        return "low"
    if score < 85:
        return "mid"
    return "high"

def parse_dcad(html):
    text = html.replace("&nbsp;", " ")
    sections = re.findall(
        r"Desc:</b>\s*([^<]+).*?Total Area:</b>\s*([0-9,]+)\s*sqft.*?Year Built:</b>\s*([0-9]{4})",
        text, re.I | re.S,
    )
    areas = []
    years = []
    for desc, area, year in sections:
        areas.append(int(area.replace(",", "")))
        years.append(int(year))
    tot = re.search(r'lblTotalVal"[^>]*>\$?([0-9,]+)', text, re.I)
    owner = re.search(r'lblOwner"[^>]*>([^<]+)', text, re.I)
    addr = re.search(r'lblSiteAddress"[^>]*>([^<]+)', text, re.I)
    if not addr:
        addr = re.search(r"Site Address:?\s*</[^>]+>\s*<[^>]+>([^<]+)", text, re.I)
    stories = re.search(r"Stories:[^\d]{0,40}(\d+)", text, re.I)
    return {
        "sections": len(areas),
        "sum_area": sum(areas) if areas else None,
        "min_year": min(years) if years else None,
        "total_value": float(tot.group(1).replace(",", "")) if tot else None,
        "owner": owner.group(1).strip() if owner else None,
        "address": addr.group(1).strip() if addr else None,
        "stories": int(stories.group(1)) if stories else None,
        "bytes": len(html),
    }

def parse_tad(payload):
    data = json.loads(payload)
    feats = data.get("features") or []
    if not feats:
        return {"features": 0}
    a = feats[0].get("attributes") or {}
    return {
        "features": len(feats),
        "address": a.get("SITUS_ADDR"),
        "owner": a.get("OWNER_NAME"),
        "living": a.get("LIVING_ARE"),
        "year": a.get("YEAR_BUILT"),
        "value": a.get("TOTAL_VALU"),
        "land": a.get("LAND_SQFT"),
    }

def main():
    L = [f"RUN_UTC {now()}", f"SEED {SEED}"]
    conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    rows = cur.execute(
        """SELECT s.parcel_id, s.address, s.city, s.state, s.zip_code, s.owner_name,
                  s.property_type, s.building_sqft, s.year_built, s.cad_total_valuation,
                  s.event_date, s.storm_name, s.nearest_hail_distance_mi, s.nearest_hail_size_in,
                  s.exposure_score, s.verification_status, s.data_provenance, s.outbound_ready,
                  s.muni_permit_status, p.account_number, p.latitude, p.longitude, p.stories,
                  p.footprint_sqft, p.land_sqft, p.data_source
           FROM scored_parcel_leads s JOIN parcels p ON p.id = s.parcel_id"""
    ).fetchall()

    buckets = {}
    for r in rows:
        key = (city_group(r["city"], r["state"]), size_tier(r["building_sqft"]), score_band(r["exposure_score"]))
        buckets.setdefault(key, []).append(r)

    # Fixed allocation across city groups, then round-robin size/score inside the group.
    alloc = {"NY": 8, "SEA": 3, "FW": 7, "DAL": 6, "TX_OTHER": 6}
    rng = random.Random(SEED)
    picked = []
    for group, n_take in alloc.items():
        pool = []
        for key, items in buckets.items():
            if key[0] == group:
                pool.extend(items)
        rng.shuffle(pool)
        # stratified: walk size x score cells
        cells = {}
        for item in pool:
            cell = (size_tier(item["building_sqft"]), score_band(item["exposure_score"]))
            cells.setdefault(cell, []).append(item)
        order = sorted(cells)
        taken = 0
        guard = 0
        while taken < n_take and guard < 10000:
            guard += 1
            progressed = False
            for cell in order:
                if taken >= n_take:
                    break
                if cells[cell]:
                    picked.append(cells[cell].pop())
                    taken += 1
                    progressed = True
            if not progressed:
                break
    L.append(f"golden_n {len(picked)}")
    from collections import Counter
    L.append("strata " + str(Counter((city_group(r['city'], r['state']), size_tier(r['building_sqft']), score_band(r['exposure_score'])) for r in picked)))

    # Always include the 6 outbound-ready rows in the live check set (they may already be in the sample).
    outbound = [r for r in rows if r["outbound_ready"] == 1]
    live_set = list(picked)
    have = {r["parcel_id"] for r in live_set}
    for r in outbound:
        if r["parcel_id"] not in have:
            live_set.append(r)

    golden_rows = []
    for r in live_set:
        rec = {
            "parcel_id": r["parcel_id"],
            "in_stratified_30": r["parcel_id"] in have and r in picked,
            "city_group": city_group(r["city"], r["state"]),
            "size_tier": size_tier(r["building_sqft"]),
            "score_band": score_band(r["exposure_score"]),
            "address_db": r["address"],
            "city_db": r["city"],
            "zip_db": r["zip_code"],
            "owner_db": r["owner_name"],
            "sqft_db": r["building_sqft"],
            "year_db": r["year_built"],
            "value_db": r["cad_total_valuation"],
            "stories_db": r["stories"],
            "event_date_db": r["event_date"],
            "hail_dist_db": r["nearest_hail_distance_mi"],
            "permit_status_db": r["muni_permit_status"],
            "provenance_db": r["data_provenance"],
            "outbound_ready": r["outbound_ready"],
            "account": r["account_number"],
            "live_retrieved_at": "",
            "live_url": "",
            "live_http": "",
            "live_address": "",
            "live_owner": "",
            "live_sqft": "",
            "live_year": "",
            "live_value": "",
            "live_stories": "",
            "field_address": "UNKNOWN",
            "field_owner": "UNKNOWN",
            "field_sqft": "UNKNOWN",
            "field_year": "UNKNOWN",
            "field_value": "UNKNOWN",
            "field_stories": "UNKNOWN",
            "aerial": "UNKNOWN",
            "note": "",
        }
        acct = str(r["account_number"] or "")
        gid = rec["city_group"]
        try:
            if gid == "DAL" or str(r["parcel_id"]).startswith("DCAD"):
                url = f"https://www.dallascad.org/AcctDetailCom.aspx?ID={acct}"
                status, raw = fetch(url)
                html = raw.decode("utf-8", errors="replace")
                path = os.path.join(EVID, f"{r['parcel_id'][:40]}.html")
                open(path, "w", encoding="utf-8").write(html)
                parsed = parse_dcad(html)
                rec.update({
                    "live_retrieved_at": now(),
                    "live_url": url,
                    "live_http": status,
                    "live_address": parsed.get("address") or "",
                    "live_owner": parsed.get("owner") or "",
                    "live_sqft": parsed.get("sum_area") if parsed.get("sum_area") is not None else "",
                    "live_year": parsed.get("min_year") if parsed.get("min_year") is not None else "",
                    "live_value": parsed.get("total_value") if parsed.get("total_value") is not None else "",
                    "live_stories": parsed.get("stories") if parsed.get("stories") is not None else "",
                    "note": f"dcad_sections={parsed.get('sections')} bytes={parsed.get('bytes')}",
                })
            elif gid == "FW" or gid == "TX_OTHER" and str(r["data_source"] or "").startswith("Tarrant"):
                url = (
                    "https://mapit.tarrantcounty.com/arcgis/rest/services/Dynamic/TADParcels/MapServer/0/query?"
                    + urllib.parse.urlencode({
                        "where": f"ACCOUNT = '{acct}'",
                        "outFields": "ACCOUNT,SITUS_ADDR,OWNER_NAME,LIVING_ARE,LAND_SQFT,YEAR_BUILT,TOTAL_VALU",
                        "f": "json",
                    })
                )
                status, raw = fetch(url)
                path = os.path.join(EVID, f"{r['parcel_id'][:40]}.json")
                open(path, "wb").write(raw)
                parsed = parse_tad(raw.decode("utf-8", errors="replace"))
                rec.update({
                    "live_retrieved_at": now(),
                    "live_url": url,
                    "live_http": status,
                    "live_address": parsed.get("address") or "",
                    "live_owner": parsed.get("owner") or "",
                    "live_sqft": parsed.get("living") if parsed.get("living") is not None else "",
                    "live_year": parsed.get("year") if parsed.get("year") is not None else "",
                    "live_value": parsed.get("value") if parsed.get("value") is not None else "",
                    "note": f"tad_features={parsed.get('features')}",
                })
            else:
                rec["note"] = "no live county endpoint called for this stratum in this script"
                rec["live_retrieved_at"] = now()
        except Exception as e:
            rec["note"] = f"fetch_error {type(e).__name__}: {e}"
            rec["live_retrieved_at"] = now()

        def cmp_text(dbv, livev):
            if livev in ("", None):
                return "UNKNOWN"
            a = re.sub(r"\s+", " ", str(dbv or "")).strip().upper()
            b = re.sub(r"\s+", " ", str(livev or "")).strip().upper()
            if not b:
                return "UNKNOWN"
            return "PASS" if a == b or a in b or b in a else "FAIL"

        def cmp_num(dbv, livev, tol=0):
            if livev in ("", None):
                return "UNKNOWN"
            try:
                return "PASS" if abs(float(dbv) - float(livev)) <= tol else "FAIL"
            except (TypeError, ValueError):
                return "UNKNOWN"

        rec["field_address"] = cmp_text(r["address"], rec["live_address"])
        rec["field_owner"] = cmp_text(r["owner_name"], rec["live_owner"])
        rec["field_sqft"] = cmp_num(r["building_sqft"], rec["live_sqft"], tol=1)
        rec["field_year"] = cmp_num(r["year_built"], rec["live_year"], tol=0)
        rec["field_value"] = cmp_num(r["cad_total_valuation"], rec["live_value"], tol=1)
        if rec["live_stories"] != "":
            rec["field_stories"] = cmp_num(r["stories"], rec["live_stories"], tol=0)
        golden_rows.append(rec)
        L.append(
            f"LIVE {rec['parcel_id']} {rec['city_group']} http={rec['live_http']} "
            f"addr={rec['field_address']} owner={rec['field_owner']} sqft={rec['field_sqft']} "
            f"year={rec['field_year']} value={rec['field_value']} stories={rec['field_stories']} {rec['note'][:140]}"
        )

    # Field-level accuracy on rows where a live value was returned (stratified 30 only)
    stratified_ids = {r["parcel_id"] for r in picked}
    L.append("\n=== field accuracy on stratified sample where live value present ===")
    for field in ("field_address", "field_owner", "field_sqft", "field_year", "field_value", "field_stories"):
        subset = [g for g in golden_rows if g["parcel_id"] in stratified_ids and g[field] in ("PASS", "FAIL")]
        k = sum(1 for g in subset if g[field] == "PASS")
        n = len(subset)
        if n:
            p, lo, hi = wilson(k, n)
            L.append(f"{field} pass {k} of {n} rate {p:.3f} wilson95 [{lo:.3f}, {hi:.3f}]")
        else:
            L.append(f"{field} no comparable rows")
    L.append(f"n_needed_pm_3pct_p50 {n_for_pm(0.03, 0.5)}")
    L.append(f"n_needed_pm_3pct_p99 {n_for_pm(0.03, 0.99)}")

    # Fort Worth independent roof-permit recall
    L.append("\n=== Fort Worth live roof-permit recall ===")
    fw_url = "https://mapit.fortworthtexas.gov/ags/rest/services/CIVIC/Permits/MapServer/0/query?" + urllib.parse.urlencode({
        "where": "Permit_Type='Commercial Building Permit' AND File_Date >= DATE '2023-01-01' AND (UPPER(B1_WORK_DESC) LIKE '%ROOF%' OR UPPER(B1_WORK_DESC) LIKE '%SHINGLE%' OR UPPER(B1_WORK_DESC) LIKE '%TPO%')",
        "outFields": "Permit_No,Address,File_Date,B1_WORK_DESC",
        "returnGeometry": "false",
        "orderByFields": "Permit_No",
        "resultRecordCount": "30",
        "f": "json",
    })
    recall_k = None
    try:
        status, raw = fetch(fw_url, timeout=60)
        open(os.path.join(EVID, "fw_roof_permits_30.json"), "wb").write(raw)
        data = json.loads(raw.decode("utf-8", errors="replace"))
        feats = data.get("features") or []
        L.append(f"fw_query_http {status} features {len(feats)} retrieved {now()}")
        found = 0
        for f in feats:
            a = f.get("attributes") or {}
            num = str(a.get("Permit_No") or "")
            hit = cur.execute(
                "SELECT COUNT(*) FROM normalized_permits WHERE raw_permit_number = ?",
                (num,),
            ).fetchone()[0]
            found += 1 if hit else 0
            L.append(f"  permit {num} addr {a.get('Address')} in_db {hit} desc {(a.get('B1_WORK_DESC') or '')[:80]}")
        recall_k = found
        n = len(feats)
        if n:
            p, lo, hi = wilson(found, n)
            L.append(f"RECALL {found}/{n} rate {p:.3f} wilson95 [{lo:.3f}, {hi:.3f}]")
    except Exception as e:
        L.append(f"fw_recall_error {type(e).__name__}: {e}")

    # Linked-permit address mismatch sample of 60
    L.append("\n=== linked permit vs parcel street-number sample n=60 ===")
    linked = cur.execute(
        """SELECT n.raw_permit_number, n.jurisdiction, n.normalized_address, n.geo_quality, p.address, p.city
           FROM normalized_permits n JOIN parcels p ON p.id = n.parcel_id
           WHERE n.parcel_id IS NOT NULL AND n.parcel_id != ''
             AND n.normalized_address IS NOT NULL AND p.address IS NOT NULL"""
    ).fetchall()
    rng2 = random.Random(SEED)
    sample = linked[:]
    rng2.shuffle(sample)
    sample = sample[:60]
    mismatch = 0
    for num, jur, paddr, geo, addr, city in sample:
        pn, an = street_num(paddr), street_num(addr)
        bad = pn is not None and an is not None and pn != an
        mismatch += 1 if bad else 0
        L.append(f"  {'MISMATCH' if bad else 'same_num'} {jur} {geo} permit[{pn}] {paddr[:60]} parcel[{an}] {addr[:60]}")
    if sample:
        p, lo, hi = wilson(mismatch, len(sample))
        L.append(f"street_number_mismatch {mismatch}/{len(sample)} rate {p:.3f} wilson95 [{lo:.3f}, {hi:.3f}]")

    # zero permits by state
    z = cur.execute(
        """SELECT p.state, COUNT(*) n
           FROM parcels p
           WHERE NOT EXISTS (SELECT 1 FROM normalized_permits n WHERE n.parcel_id = p.id)
           GROUP BY 1"""
    ).fetchall()
    L.append("\n=== parcels with zero linked permits of any type ===")
    for st, n in z:
        L.append(f"{st} {n}")

    fields = list(golden_rows[0].keys()) if golden_rows else []
    with open(GOLDEN, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(golden_rows)

    L.append(f"\nDONE_UTC {now()} golden_csv_rows {len(golden_rows)}")
    text = "\n".join(L) + "\n"
    open(OUT_TXT, "w", encoding="utf-8").write(text)
    print(text[-15000:])
    print("WROTE", OUT_TXT, "rows", len(golden_rows))

if __name__ == "__main__":
    main()
