"""Load saved DCAD HTML and TAD JSON into lead_evidence. Does not release a lead."""

from __future__ import annotations

import json
import os
import sqlite3
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.science.dcad_parse import parse_dcad_account
from app.science.lead_store import REQUIRED_FIELDS, ensure_schema, try_release, upsert_evidence

PAGES = os.path.abspath(os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "audit", "queries", "live_pages"
))


def _write_fields(conn, parcel_id, fields, source_system, source_url, retrieved_at):
    for name, value in fields.items():
        if name not in REQUIRED_FIELDS:
            continue
        if value is None or value == "":
            conn.execute(
                "DELETE FROM lead_evidence WHERE parcel_id = ? AND field_name = ?",
                (parcel_id, name),
            )
            continue
        upsert_evidence(
            conn,
            parcel_id,
            name,
            value,
            source_system=source_system,
            source_url=source_url,
            source_field=name,
            retrieved_at=retrieved_at,
        )


def ingest_dcad(conn, path, retrieved_at):
    parcel_id = os.path.splitext(os.path.basename(path))[0]
    html = open(path, encoding="utf-8", errors="ignore").read()
    parsed = parse_dcad_account(html)
    account = parcel_id.replace("DCAD-PARCEL-", "")
    _write_fields(
        conn,
        parcel_id,
        parsed,
        "dcad_account_page",
        f"https://www.dallascad.org/AcctDetailCom.aspx?ID={account}",
        retrieved_at,
    )


def ingest_tad(conn, path, retrieved_at):
    parcel_id = os.path.splitext(os.path.basename(path))[0]
    payload = json.load(open(path, encoding="utf-8"))
    features = payload.get("features") or []
    if not features:
        return
    attrs = features[0].get("attributes") or {}
    account = str(attrs.get("ACCOUNT") or parcel_id.replace("TAD-PARCEL-", ""))
    fields = {
        "address": (attrs.get("SITUS_ADDR") or "").strip(),
        "owner_name": (attrs.get("OWNER_NAME") or "").strip(),
        "year_built": attrs.get("YEAR_BUILT"),
        "market_value": attrs.get("TOTAL_VALU"),
        "source_area": attrs.get("LIVING_ARE"),
        "source_area_kind": "tad_living_are",
    }
    _write_fields(
        conn,
        parcel_id,
        fields,
        "tad_feature_service",
        "https://mapit.tarrantcounty.com/arcgis/rest/services/Dynamic/TADParcels/MapServer/0/query",
        retrieved_at,
    )
    # Living area is not a roof. Do not write roof_sqft_used.


def main(db_path: str) -> None:
    retrieved_at = datetime.now(timezone.utc).isoformat()
    conn = sqlite3.connect(db_path)
    try:
        ensure_schema(conn)
        if os.path.isdir(PAGES):
            for name in os.listdir(PAGES):
                path = os.path.join(PAGES, name)
                if name.startswith("DCAD-PARCEL-") and name.endswith(".html"):
                    ingest_dcad(conn, path, retrieved_at)
                elif name.startswith("TAD-PARCEL-") and name.endswith(".json"):
                    ingest_tad(conn, path, retrieved_at)
        released_before = conn.execute("SELECT COUNT(*) FROM released_leads").fetchone()[0]
        for (parcel_id,) in conn.execute("SELECT DISTINCT parcel_id FROM lead_evidence"):
            try_release(conn, parcel_id, state="TX")
        conn.commit()
        evidence = conn.execute("SELECT COUNT(*) FROM lead_evidence").fetchone()[0]
        released = conn.execute("SELECT COUNT(*) FROM released_leads").fetchone()[0]
    finally:
        conn.close()
    print(f"lead_evidence {evidence}")
    print(f"released_before {released_before}")
    print(f"released_leads {released}")


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "depoii_local.db",
    )
    main(target)
