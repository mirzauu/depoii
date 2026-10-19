"""Attach a live SPC row and a city permit search, then release only complete rows.

A parcel with no storm file, no coordinates, or a timed-out portal stays off
released_leads. A permit count of 0 is the search result. It is not a claim
that no permit exists.
"""

from __future__ import annotations

import json
import os
import sqlite3
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.science.lead_store import ensure_schema, try_release, upsert_evidence
from app.science.permit_match import addresses_match, count_matches, search_summary, street_identity
from app.science.spc_hail import attach_hail_evidence
from app.science.wilson import wilson_interval

ENGINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(ENGINE, "depoii_local.db")
SPC_DIR = os.path.abspath(os.path.join(ENGINE, "..", "..", "audit", "queries", "spc"))
AUDIT = os.path.abspath(os.path.join(ENGINE, "..", "..", "audit"))

DALLAS_URL = "https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/T_BU_Permits_FY2023_24/FeatureServer/0/query"
FORT_WORTH_URL = "https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0/query"

# Stored storm day only. A missing event_date is not filled from another day.
STORM_FILE = {
    "2026-06-02": "260602",
    "2026-05-23": "260523",
    "2026-04-26": "260425",
}

ROOF_WORDS = ("ROOF", "REROOF", "RE-ROOF", "SHINGLE", "TPO", "MEMBRANE")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get(url: str, params: dict, timeout: int = 25) -> dict:
    query = urllib.parse.urlencode(params)
    req = urllib.request.Request(
        url + "?" + query,
        headers={"User-Agent": "depoii-release-check"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", errors="replace"))


def _spc_text(stem: str, retrieved: str) -> tuple[str, str, str]:
    url = f"https://www.spc.noaa.gov/climo/reports/{stem}_rpts_hail.csv"
    os.makedirs(SPC_DIR, exist_ok=True)
    path = os.path.join(SPC_DIR, f"{stem}_rpts_hail.csv")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "depoii-release-check"})
        with urllib.request.urlopen(req, timeout=25) as resp:
            text = resp.read().decode("utf-8", errors="replace")
        open(path, "w", encoding="utf-8", newline="").write(text)
        return text, url, retrieved
    except Exception as exc:
        if os.path.exists(path):
            return open(path, encoding="utf-8").read(), url + f" (download failed: {exc}; used saved file)", retrieved
        raise


def _dallas_where(address: str) -> str:
    ident = street_identity(address)
    if not ident:
        return ""
    number, _direction, name = ident
    token = name.split()[0].replace("'", "")
    return f"ADDRESS LIKE '%{number}%' AND UPPER(ADDRESS) LIKE '%{token}%'"


def _fort_worth_where(address: str) -> str:
    ident = street_identity(address)
    if not ident:
        return ""
    number, _direction, name = ident
    token = name.split()[0].replace("'", "")
    return f"Addr_No = '{number}' AND UPPER(Street_Name) LIKE '%{token}%'"


def _portal_for(city: str) -> tuple[str, str, str] | None:
    label = (city or "").strip().lower()
    if label == "dallas":
        return "Dallas FY2023-24 permits", DALLAS_URL, "ADDRESS"
    if label == "fort worth":
        return "Fort Worth development permits", FORT_WORTH_URL, "Street_Name"
    return None


def search_permits(address: str, city: str) -> dict:
    portal = _portal_for(city)
    if portal is None:
        return {"ok": False, "reason": f"no permit portal configured for {city}"}
    name, url, _field = portal
    where = _dallas_where(address) if city.lower() == "dallas" else _fort_worth_where(address)
    if not where:
        return {"ok": False, "reason": "address has no street number and name"}
    params = {
        "where": where,
        "outFields": "*",
        "returnGeometry": "false",
        "resultRecordCount": "50",
        "f": "json",
    }
    payload = _get(url, params)
    features = payload.get("features") or []
    permit_addresses = []
    for feature in features:
        attrs = feature.get("attributes") or {}
        if city.lower() == "dallas":
            permit_addresses.append(str(attrs.get("ADDRESS") or ""))
        else:
            number = attrs.get("Addr_No") or ""
            street = attrs.get("Street_Name") or ""
            permit_addresses.append(f"{number} {street}")
    matches = count_matches(address, permit_addresses)
    return {
        "ok": True,
        "portal": name,
        "url": url,
        "where": where,
        "returned": len(features),
        "matches": matches,
        "query": search_summary(name, where, matches),
    }


def measure_dallas_recall(path: str) -> str:
    lines = []
    try:
        grouped = _get(
            DALLAS_URL,
            {
                "where": "1=1",
                "outStatistics": json.dumps(
                    [{"statisticType": "count", "onStatisticField": "OBJECTID", "outStatisticFieldName": "cnt"}]
                ),
                "groupByFieldsForStatistics": "ACTIVITY",
                "returnGeometry": "false",
                "f": "json",
            },
            timeout=40,
        )
    except Exception as exc:
        text = f"recall UNKNOWN\nDallas ACTIVITY query failed: {exc}\n"
        open(path, "w", encoding="utf-8").write(text)
        return text
    activities = []
    for row in grouped.get("features") or []:
        attrs = row.get("attributes") or {}
        label = str(attrs.get("ACTIVITY") or "")
        if any(word in label.upper() for word in ROOF_WORDS):
            activities.append(label)
    lines.append(f"roof_activity_values {len(activities)}")
    lines.append("activities: " + " | ".join(activities[:40]))
    if not activities:
        lines.append("recall UNKNOWN")
        lines.append("The Dallas layer returned no ACTIVITY value containing a roof word.")
        text = "\n".join(lines) + "\n"
        open(path, "w", encoding="utf-8").write(text)
        return text
    escaped = activities[0].replace("'", "''")
    try:
        sample = _get(
            DALLAS_URL,
            {
                "where": f"ACTIVITY = '{escaped}'",
                "outFields": "PERMIT_No,ACTIVITY,ADDRESS",
                "returnGeometry": "false",
                "resultRecordCount": "30",
                "f": "json",
            },
        )
    except Exception as exc:
        lines.append(f"recall UNKNOWN\nsample query failed: {exc}")
        text = "\n".join(lines) + "\n"
        open(path, "w", encoding="utf-8").write(text)
        return text
    found = 0
    checked = 0
    for feature in (sample.get("features") or [])[:30]:
        attrs = feature.get("attributes") or {}
        address = str(attrs.get("ADDRESS") or "")
        if not street_identity(address):
            continue
        checked += 1
        where = _dallas_where(address)
        try:
            back = _get(
                DALLAS_URL,
                {
                    "where": where,
                    "outFields": "ADDRESS",
                    "returnGeometry": "false",
                    "resultRecordCount": "20",
                    "f": "json",
                },
                timeout=20,
            )
        except Exception:
            continue
        backs = [str((f.get("attributes") or {}).get("ADDRESS") or "") for f in back.get("features") or []]
        if any(addresses_match(address, item) for item in backs):
            found += 1
    if checked == 0:
        lines.append("recall UNKNOWN")
        lines.append("The activity sample had no parseable street addresses.")
    else:
        low, high = wilson_interval(found, checked)
        lines.append(f"recall_hits {found}")
        lines.append(f"recall_n {checked}")
        lines.append(f"wilson_95 {low:.3f} {high:.3f}")
        lines.append("This is search recall on the same Dallas layer, not a claim about every roof permit in the city.")
    text = "\n".join(lines) + "\n"
    open(path, "w", encoding="utf-8").write(text)
    return text


def main() -> None:
    retrieved = _now()
    conn = sqlite3.connect(DB_PATH)
    ensure_schema(conn)
    rows = conn.execute(
        """
        SELECT p.id, p.address, p.city, p.latitude, p.longitude, s.event_date
        FROM parcels p
        LEFT JOIN scored_parcel_leads s ON s.parcel_id = p.id
        WHERE p.id IN (
            SELECT parcel_id FROM lead_evidence
        )
        """
    ).fetchall()
    for parcel_id, address, city, lat, lon, event_date in rows:
        stem = STORM_FILE.get(event_date or "")
        if lat is None or lon is None or not stem:
            print(f"spc skip {parcel_id} date={event_date} coords={lat},{lon}")
            continue
        try:
            text, url, stamp = _spc_text(stem, retrieved)
        except Exception as exc:
            print(f"spc fail {parcel_id} {exc}")
            continue
        reason = attach_hail_evidence(conn, parcel_id, float(lat), float(lon), text, f"{stem}_rpts_hail.csv", url, stamp)
        print(f"spc {parcel_id} {reason or 'attached'} file={stem}")

    recall_path = os.path.join(AUDIT, "permit_recall.txt")
    print(measure_dallas_recall(recall_path))

    for parcel_id, address, city, lat, lon, event_date in rows:
        try:
            result = search_permits(address or "", city or "")
        except Exception as exc:
            print(f"permit fail {parcel_id} {exc}")
            continue
        if not result.get("ok"):
            print(f"permit skip {parcel_id} {result.get('reason')}")
            continue
        for field, value in (
            ("permit_query", result["query"]),
            ("permit_match_count", str(result["matches"])),
            ("permit_portal", result["portal"]),
        ):
            upsert_evidence(
                conn,
                parcel_id,
                field,
                value,
                source_system=result["portal"],
                source_url=result["url"],
                source_field=result["where"],
                retrieved_at=retrieved,
            )
        print(f"permit {parcel_id} {result['query']}")

    conn.commit()
    released = []
    for parcel_id, *_rest in rows:
        ok, reason = try_release(conn, parcel_id, state="TX")
        print(f"release {parcel_id} {ok} {reason}")
        if ok:
            released.append(parcel_id)
    conn.commit()
    count = conn.execute("SELECT COUNT(*) FROM released_leads").fetchone()[0]
    print(f"released_leads {count}")
    print("released_ids " + ",".join(released))
    conn.close()


if __name__ == "__main__":
    main()
