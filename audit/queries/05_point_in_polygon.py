"""05 — point-in-polygon versus a 45 m offset from the parcel centroid. Read-only."""
import json
import math
import sqlite3
from datetime import datetime, timezone

DB = r"d:\Depoii_nextjs\audit\depoii_local_audit_copy.db"
OUT = r"d:\Depoii_nextjs\audit\queries\05_point_in_polygon.txt"

def pip(x, y, ring):
    """Ray cast. x=lon, y=lat. ring is list of [lon, lat]."""
    inside = False
    n = len(ring)
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-15) + xi):
            inside = not inside
        j = i
    return inside

def offset_north(lat, lon, meters):
    return lat + meters / 111320.0, lon

def main():
    t0 = datetime.now(timezone.utc)
    conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    cur = conn.cursor()
    swaths = cur.execute("SELECT id, event_date, storm_name, properties FROM storm_swaths").fetchall()
    polys = []
    bad_json = 0
    for sid, edate, name, props in swaths:
        try:
            obj = json.loads(props or "{}")
        except json.JSONDecodeError:
            bad_json += 1
            continue
        ring = obj.get("polygon")
        if isinstance(ring, list) and len(ring) >= 3:
            polys.append((sid, edate, name, ring))
    leads = cur.execute(
        """SELECT s.parcel_id, s.event_date, s.city, s.state, p.latitude, p.longitude
           FROM scored_parcel_leads s JOIN parcels p ON p.id=s.parcel_id
           WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL"""
    ).fetchall()
    conn.close()

    # Index swaths by date
    by_date = {}
    for sid, edate, name, ring in polys:
        by_date.setdefault(edate, []).append((sid, name, ring))

    assigned_inside = 0
    assigned_outside = 0
    no_poly_for_date = 0
    flip_45 = 0
    tested = 0
    any_swath_inside = 0
    any_swath_outside = 0
    examples = []

    for pid, edate, city, state, lat, lon in leads:
        lat45, lon45 = offset_north(lat, lon, 45.0)
        # any swath
        inside_any = False
        inside_any_45 = False
        for sid, name, ring in ((s, n, r) for group in by_date.values() for s, n, r in group):
            pass
        # Don't test every parcel against every polygon (11k * 692). Test assigned date only,
        # plus a count of assigned-date disagreements.
        rings = by_date.get(edate) or []
        if not rings:
            no_poly_for_date += 1
            continue
        tested += 1
        cin = any(pip(lon, lat, ring) for _, _, ring in rings)
        cin45 = any(pip(lon45, lat45, ring) for _, _, ring in rings)
        if cin:
            assigned_inside += 1
        else:
            assigned_outside += 1
            if len(examples) < 8:
                examples.append((pid, edate, city, round(lat, 5), round(lon, 5)))
        if cin != cin45:
            flip_45 += 1

    L = [f"RUN_UTC {t0.isoformat()}"]
    L.append(f"polygons {len(polys)} bad_json {bad_json} leads_with_xy {len(leads)}")
    L.append(f"tested_against_assigned_event_date {tested}")
    L.append(f"centroid_inside_assigned_date_polygon {assigned_inside}")
    L.append(f"centroid_outside_assigned_date_polygon {assigned_outside}")
    L.append(f"no_polygon_for_assigned_date {no_poly_for_date}")
    L.append(f"45m_north_disagrees_with_centroid {flip_45}")
    L.append("outside examples:")
    for e in examples:
        L.append(" | ".join(str(x) for x in e))
    text = "\n".join(L) + "\n"
    open(OUT, "w", encoding="utf-8").write(text)
    print(text)

if __name__ == "__main__":
    main()
