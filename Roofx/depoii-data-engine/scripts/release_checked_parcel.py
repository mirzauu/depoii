"""Refresh one parcel from a saved live DCAD page and try the release gate."""

from __future__ import annotations

import os
import sqlite3
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.science.dcad_parse import parse_dcad_account
from app.science.lead_store import ensure_schema, list_released, try_release, upsert_evidence

ENGINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(ENGINE, "depoii_local.db")
LIVE = os.path.abspath(
    os.path.join(ENGINE, "..", "..", "audit", "queries", "live_pages", "DCAD-PARCEL-00000799950250000.live.html")
)
PARCEL = "DCAD-PARCEL-00000799950250000"
URL = "https://www.dallascad.org/AcctDetailCom.aspx?ID=00000799950250000"


def main() -> None:
    parsed = parse_dcad_account(open(LIVE, encoding="utf-8", errors="ignore").read())
    if parsed["roof_sqft_used"] != 11994 or parsed["stories"] != 1 or parsed["year_built"] != 1979:
        print("live page does not match the checked roof, stories, or year")
        print(parsed["roof_sqft_used"], parsed["stories"], parsed["year_built"])
        return
    if parsed["ineligible"]:
        print("live page is ineligible", parsed["ineligible"])
        return
    if not parsed["land_use_code"]:
        print("live page has no land use")
        return
    retrieved = datetime.now(timezone.utc).isoformat()
    conn = sqlite3.connect(DB_PATH)
    ensure_schema(conn)
    for name in (
        "address",
        "owner_name",
        "year_built",
        "stories",
        "market_value",
        "improvement_description",
        "land_use_code",
        "source_area",
        "source_area_kind",
        "roof_sqft_used",
    ):
        upsert_evidence(
            conn,
            PARCEL,
            name,
            parsed[name],
            source_system="dcad_account_page",
            source_url=URL,
            source_field=name,
            retrieved_at=retrieved,
            raw_excerpt=str(parsed[name]),
        )
    ok, reason = try_release(conn, PARCEL, state="TX")
    conn.commit()
    total, leads = list_released(conn)
    print("release", ok, reason)
    print("land_use", parsed["land_use_code"])
    print("released_count", total)
    for lead in leads:
        print(lead["parcel_id"], lead["address"], lead["roof_sqft_used"], lead["hail_distance_mi"], lead["exposure_score"])
        print(lead["permit_summary"])
    conn.close()


if __name__ == "__main__":
    main()
