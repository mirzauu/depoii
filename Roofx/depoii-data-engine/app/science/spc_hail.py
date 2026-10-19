"""Nearest Texas hail report from an SPC convective-day CSV.

Size in the file is hundredths of an inch. Coordinates are the report point,
rounded by SPC to two decimals. The distance is to that point, not a swath
on a roof.
"""

from __future__ import annotations

import csv
import math
import re
from io import StringIO
from typing import Any, Dict, Iterable, List, Optional

EARTH_RADIUS_MI = 3958.8
_DELAYED = re.compile(r"delayed|facebook|mping|social", re.I)


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    h = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * EARTH_RADIUS_MI * math.atan2(math.sqrt(h), math.sqrt(1 - h))


def parse_hail_csv(text: str) -> List[Dict[str, Any]]:
    sample = text.lstrip("\ufeff")
    if not sample.strip():
        return []
    reader = csv.DictReader(StringIO(sample))
    rows: List[Dict[str, Any]] = []
    for raw in reader:
        if not raw or not any(raw.values()):
            continue
        state = (raw.get("State") or "").strip().upper()
        try:
            lat = float(raw.get("Lat") or "")
            lon = float(raw.get("Lon") or "")
            size = float(raw.get("Size") or "") / 100.0
        except ValueError:
            continue
        comment = (raw.get("Comments") or "").strip()
        rows.append(
            {
                "time": (raw.get("Time") or "").strip(),
                "size_in": size,
                "location": (raw.get("Location") or "").strip(),
                "county": (raw.get("County") or "").strip(),
                "state": state,
                "lat": lat,
                "lon": lon,
                "comment": comment,
                "delayed_or_social": bool(_DELAYED.search(comment)),
            }
        )
    return rows


def nearest_report(
    lat: float,
    lon: float,
    rows: Iterable[Dict[str, Any]],
    state: str = "TX",
) -> Optional[Dict[str, Any]]:
    wanted = (state or "").upper()
    best: Optional[Dict[str, Any]] = None
    best_dist = None
    for row in rows:
        if wanted and row.get("state") != wanted:
            continue
        dist = haversine_miles(lat, lon, float(row["lat"]), float(row["lon"]))
        if best_dist is None or dist < best_dist:
            best_dist = dist
            best = dict(row)
            best["distance_mi"] = round(dist, 2)
    return best


def attach_hail_evidence(
    conn,
    parcel_id: str,
    lat: float,
    lon: float,
    csv_text: str,
    spc_file: str,
    source_url: str,
    retrieved_at: str,
) -> Optional[str]:
    """Write SPC evidence for the nearest Texas row. Returns a block reason, or None."""
    from app.science.lead_store import upsert_evidence

    rows = parse_hail_csv(csv_text)
    report = nearest_report(lat, lon, rows, state="TX")
    if report is None:
        return "no Texas hail row in the SPC file"
    distance = haversine_miles(lat, lon, report["lat"], report["lon"])
    if abs(distance - report["distance_mi"]) > 0.25 and abs(distance - round(distance, 2)) > 0.25:
        return "stored distance does not match haversine"
    fields = {
        "spc_file": spc_file,
        "spc_time_utc": report["time"],
        "spc_lat": f"{report['lat']:.2f}",
        "spc_lon": f"{report['lon']:.2f}",
        "spc_size_in": f"{report['size_in']:.2f}",
        "spc_comment": report["comment"] or report["location"],
        "hail_distance_mi": f"{report['distance_mi']:.2f}",
    }
    for name, value in fields.items():
        upsert_evidence(
            conn,
            parcel_id,
            name,
            value,
            source_system="spc_csv",
            source_url=source_url,
            source_field=name,
            retrieved_at=retrieved_at,
            raw_excerpt=report["comment"] or report["location"],
        )
    return None
