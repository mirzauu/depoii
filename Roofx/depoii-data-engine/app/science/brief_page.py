"""Build a Monday brief from local storm swaths and one shared lead score."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from shapely.geometry import Point
from shapely.strtree import STRtree

from app.schemas.brief_schema import (
    BriefSummary,
    CompetitorBrief,
    MondayBriefResponse,
    OpportunityItem,
    PitchBrief,
    StormSummary,
    TopOwner,
)
from app.science.brief_service import (
    _detect_corridor,
    _detect_membrane,
    _get_competitor_for_market,
    _get_ro_connection,
    ensure_indexes,
)
from app.science.lead_quality import (
    exposure_score,
    is_placeholder_address,
    is_public_owner,
    owner_mailing_line,
    replacement_cost,
    swath_polygon,
    zip_matches_city,
)
from app.core.logging import logger


def _empty(jurisdiction: str, as_of: str, storm: StormSummary, competitor: CompetitorBrief, deadline: str, days: int) -> MondayBriefResponse:
    return MondayBriefResponse(
        jurisdiction=jurisdiction,
        as_of=as_of,
        storm=storm,
        summary=BriefSummary(
            exposed_buildings=0,
            unresolved_buildings=0,
            core_unresolved=0,
            pipeline_value_usd=0,
            top_corridor="",
            claim_deadline=deadline,
            days_remaining=days,
        ),
        top_owner=TopOwner(name="", address="", parcel_id=""),
        pitch=PitchBrief(address="", hail_inches=0.0, year_built=None, membrane=""),
        competitor=competitor,
        opportunities=[],
        total_opportunities=0,
        offset=0,
    )


def _deadline(event_date: str, now: datetime) -> Tuple[str, int]:
    try:
        ev = datetime.strptime(event_date, "%Y-%m-%d")
        deadline = ev.replace(year=ev.year + 2)
        return deadline.strftime("%Y-%m-%d"), max(0, (deadline.date() - now.date()).days)
    except Exception:
        return event_date, 0


def _parcel_columns(cur: sqlite3.Cursor) -> set:
    return {row[1] for row in cur.execute("PRAGMA table_info(parcels)")}


def _brief_from_released(conn, jurisdiction: str, city: str, as_of: str) -> MondayBriefResponse:
    """The call list is released_leads only. Prices and permit absence are not filled in."""
    from app.science.lead_quality import exposure_score
    from app.science.lead_store import evidence_map

    try:
        rows = conn.execute(
            """
            SELECT r.parcel_id, p.city, p.latitude, p.longitude
            FROM released_leads r
            LEFT JOIN parcels p ON p.id = r.parcel_id
            WHERE r.state = 'TX'
            """
        ).fetchall()
    except sqlite3.OperationalError:
        rows = []
    leads = []
    for parcel_id, parcel_city, latitude, longitude in rows:
        evidence = evidence_map(conn, parcel_id)
        try:
            hail = float(evidence.get("spc_size_in") or 0)
            miles = float(evidence.get("hail_distance_mi") or 0)
            roof = int(float(evidence.get("roof_sqft_used") or 0))
            year = int(float(evidence.get("year_built") or 0))
            age = max(0, datetime.now(timezone.utc).year - year) if year else None
            score = exposure_score(hail, miles, "envelope", age, roof)
        except (TypeError, ValueError):
            score = 0
        try:
            lat = float(latitude) if latitude is not None else None
            lng = float(longitude) if longitude is not None else None
        except (TypeError, ValueError):
            lat, lng = None, None
        leads.append(
            {
                "parcel_id": parcel_id,
                "address": evidence.get("address") or "",
                "city": parcel_city or "",
                "exposure_score": score,
                "evidence": evidence,
                "latitude": lat,
                "longitude": lng,
            }
        )
    wanted = (city or "").strip().lower()
    chosen = []
    for lead in leads:
        parcel_city = str(lead.get("city") or "")
        address = str(lead.get("address") or "")
        if wanted and wanted not in parcel_city.lower() and wanted not in address.lower():
            continue
        chosen.append((lead, parcel_city, lead["evidence"]))
    if not chosen:
        storm = StormSummary(id="NONE", name="No released lead", event_date="", max_hail_inches=0.0, report_count=0)
        return _empty(
            jurisdiction,
            as_of,
            storm,
            CompetitorBrief(name="", share_pct=0.0, storm_chasers=[]),
            "",
            0,
        )
    lead, parcel_city, evidence = chosen[0]
    storm_file = str(evidence.get("spc_file") or "")
    storm = StormSummary(
        id=storm_file or "SPC",
        name=f"Nearest Texas SPC report in {storm_file}" if storm_file else "SPC point report",
        event_date="",
        max_hail_inches=float(evidence.get("spc_size_in") or 0),
        report_count=1,
    )
    opportunities = []
    for item, item_city, item_evidence in chosen:
        roof = int(float(item_evidence.get("roof_sqft_used") or 0))
        year = item_evidence.get("year_built")
        opportunities.append(
            OpportunityItem(
                parcel_id=item["parcel_id"],
                address=str(item_evidence.get("address") or item.get("address") or ""),
                city=item_city,
                owner=str(item_evidence.get("owner_name") or ""),
                year_built=int(float(year)) if year else None,
                sqft=roof,
                roof_sqft=roof,
                hail_inches=float(item_evidence.get("spc_size_in") or 0),
                tier="envelope",
                score=int(item.get("exposure_score") or 0),
                pipeline_value_usd=0,
                unresolved=False,
                storm_id=str(item_evidence.get("spc_file") or ""),
                permit_status=str(item_evidence.get("permit_query") or ""),
                latitude=item.get("latitude"),
                longitude=item.get("longitude"),
            )
        )
    first = opportunities[0]
    return MondayBriefResponse(
        jurisdiction=jurisdiction,
        as_of=as_of,
        storm=storm,
        summary=BriefSummary(
            exposed_buildings=len(opportunities),
            unresolved_buildings=0,
            core_unresolved=0,
            pipeline_value_usd=0,
            top_corridor="",
            claim_deadline="",
            days_remaining=0,
        ),
        top_owner=TopOwner(name=first.owner, address=first.address, parcel_id=first.parcel_id),
        pitch=PitchBrief(address=first.address, hail_inches=first.hail_inches, year_built=first.year_built, membrane=""),
        competitor=CompetitorBrief(name="", share_pct=0.0, storm_chasers=[]),
        opportunities=opportunities,
        total_opportunities=len(opportunities),
        offset=0,
    )


def build_full_brief(jurisdiction: str, city: str, state: str) -> MondayBriefResponse:
    now = datetime.now(timezone.utc)
    as_of = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    conn = _get_ro_connection()
    if not conn:
        storm = StormSummary(id="NONE", name="No Storm Data Available", event_date=now.strftime("%Y-%m-%d"), max_hail_inches=0.0, report_count=0)
        return _empty(jurisdiction, as_of, storm, CompetitorBrief(name="", share_pct=0.0, storm_chasers=[]), "", 0)
    try:
        return _brief_from_released(conn, jurisdiction, city, as_of)
    finally:
        conn.close()


def _unused_scored_brief(jurisdiction: str, city: str, state: str) -> MondayBriefResponse:
    """The scored-parcel call list is not served."""
    raise RuntimeError("scored brief is not served")
    ensure_indexes()
    now = datetime.now(timezone.utc)
    as_of = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    conn = _get_ro_connection()
    if not conn:
        storm = StormSummary(id="NONE", name="No Storm Data Available", event_date=now.strftime("%Y-%m-%d"), max_hail_inches=0.0, report_count=0)
        return _empty(jurisdiction, as_of, storm, CompetitorBrief(name="", share_pct=0.0, storm_chasers=[]), as_of[:10], 0)

    cur = conn.cursor()
    cols = _parcel_columns(cur)
    extra = []
    for name in ("total_valuation", "improvement_valuation", "land_sqft", "stories", "footprint_sqft", "owner_address", "owner_city", "owner_state", "owner_zip"):
        if name in cols:
            extra.append(name)
    extra_sql = (", " + ", ".join(extra)) if extra else ""
    city_param = f"%{city}%"
    parcels = cur.execute(
        f"""
        SELECT id, address, city, state, zip_code, building_sqft, year_built, owner_name, latitude, longitude{extra_sql}
        FROM parcels
        WHERE state = ? AND (LOWER(city) LIKE LOWER(?) OR LOWER(COALESCE(jurisdiction, '')) LIKE LOWER(?))
          AND COALESCE(is_mock, 0) = 0
          AND id NOT IN (SELECT parcel_id FROM manual_disqualifications)
          AND LOWER(COALESCE(address, '')) NOT IN (SELECT LOWER(address) FROM manual_disqualifications)
          AND LOWER(COALESCE(address, '')) NOT LIKE '%no name%'
          AND UPPER(COALESCE(owner_name, '')) NOT LIKE '%APARTMENT%'
          AND UPPER(COALESCE(owner_name, '')) NOT LIKE '%CHURCH%'
          AND UPPER(COALESCE(owner_name, '')) NOT LIKE '%ISD%'
          AND UPPER(COALESCE(owner_name, '')) NOT LIKE '%CITY OF%'
          AND UPPER(COALESCE(owner_name, '')) NOT LIKE '%UNIVERSITY%'
        """,
        (state, city_param, city_param),
    ).fetchall()
    competitor = _get_competitor_for_market(conn, city, state)

    swaths = cur.execute(
        """
        SELECT id, storm_name, event_date, max_hail_inches, properties
        FROM storm_swaths
        WHERE jurisdiction_id LIKE ? OR UPPER(COALESCE(storm_name, '')) LIKE ?
        ORDER BY event_date DESC
        LIMIT 60
        """,
        (f"{state}-%", f"%{city.upper()}%"),
    ).fetchall()

    usable = []
    points = []
    for row in parcels:
        lat, lon = row[8], row[9]
        if lat is None or lon is None:
            continue
        points.append(Point(float(lon), float(lat)))
        usable.append(row)
    tree = STRtree(points) if points else None

    # Load building-specific graduated hail measurements to avoid uniform stamping
    specific_hail_map = {
        r[0]: float(r[1])
        for r in cur.execute(
            "SELECT parcel_id, nearest_hail_size_in FROM scored_parcel_leads WHERE nearest_hail_size_in IS NOT NULL"
        ).fetchall()
        if r[1] is not None
    }

    chosen = None
    hits: Dict[str, Dict[str, Any]] = {}
    for sid, sname, sdate, shail, props in swaths:
        if tree is None:
            break
        poly = swath_polygon(props)
        if poly is None:
            continue
        event_hits = {}
        swath_hail = float(shail or 1.0)
        for index in tree.query(poly, predicate="intersects"):
            row = usable[int(index)]
            pid = row[0]
            lead_hail = specific_hail_map.get(pid, swath_hail)
            tier = "core" if lead_hail >= 1.75 else "envelope"
            event_hits[pid] = {"row": row, "hail": lead_hail, "tier": tier}
        if len(event_hits) > len(hits):
            chosen = (sid, sname, sdate, swath_hail, len(event_hits))
            hits = event_hits

    if not chosen:
        conn.close()
        if swaths:
            sid, sname, sdate, shail, _props = swaths[0]
            storm = StormSummary(id=str(sid), name=sname or "Storm", event_date=str(sdate)[:10], max_hail_inches=float(shail or 0), report_count=0)
            deadline, days = _deadline(storm.event_date, now)
            return _empty(jurisdiction, as_of, storm, competitor, deadline, days)
        storm = StormSummary(id="NONE", name=f"No stored storm covers {city}", event_date=now.strftime("%Y-%m-%d"), max_hail_inches=0.0, report_count=0)
        return _empty(jurisdiction, as_of, storm, competitor, now.strftime("%Y-%m-%d"), 0)

    storm_id, storm_name, storm_date, storm_hail, _hit_count = chosen
    storm_date = str(storm_date)[:10]
    permitted: set = set()
    non_roof_activity: Dict[str, str] = {}
    muni_status_map: Dict[str, str] = {}
    roof_year: Dict[str, int] = {}
    hit_ids = list(hits)
    for start in range(0, len(hit_ids), 400):
        chunk = hit_ids[start:start + 400]
        marks = ",".join("?" * len(chunk))
        # Only post-storm ROOF permits mean the building roof has been resolved/repaired
        permitted.update(
            r[0]
            for r in cur.execute(
                f"""
                SELECT DISTINCT parcel_id FROM normalized_permits
                WHERE parcel_id IN ({marks})
                  AND (issue_date >= ? OR applied_date >= ?)
                  AND (
                    LOWER(COALESCE(category, '')) LIKE '%roof%'
                    OR LOWER(COALESCE(probable_roof_system, '')) LIKE '%roof%'
                    OR LOWER(COALESCE(probable_roof_system, '')) IN ('tpo', 'epdm', 'mod_bit', 'pvc', 'metal', 'built_up')
                    OR LOWER(COALESCE(raw_description, '')) LIKE '%roof%'
                    OR LOWER(COALESCE(raw_description, '')) LIKE '%reroof%'
                    OR LOWER(COALESCE(raw_description, '')) LIKE '%re-roof%'
                    OR LOWER(COALESCE(raw_description, '')) LIKE '%tear off%'
                    OR LOWER(COALESCE(raw_description, '')) LIKE '%tear-off%'
                    OR LOWER(COALESCE(raw_description, '')) LIKE '%membrane%'
                    OR LOWER(COALESCE(raw_description, '')) LIKE '%shingle%'
                    OR LOWER(COALESCE(raw_description, '')) LIKE '%tpo%'
                    OR LOWER(COALESCE(raw_description, '')) LIKE '%epdm%'
                    OR LOWER(COALESCE(raw_description, '')) LIKE '%coating%'
                  )
                """,
                (*chunk, storm_date, storm_date),
            )
        )
        # Buildings verified as ROOF_PERMIT_DETECTED in scored_parcel_leads
        permitted.update(
            r[0]
            for r in cur.execute(
                f"""
                SELECT parcel_id FROM scored_parcel_leads
                WHERE parcel_id IN ({marks})
                  AND (
                    verification_status = 'ROOF_PERMIT_DETECTED'
                    OR (verification_status = 'PERMIT_DETECTED' AND muni_permit_status != 'NON_ROOF_PERMIT_DETECTED')
                  )
                """,
                tuple(chunk),
            )
        )
        # Track non-roof commercial permits (closet, racking, interior remodel)
        for pid, desc in cur.execute(
            f"""
            SELECT parcel_id, raw_description FROM normalized_permits
            WHERE parcel_id IN ({marks})
              AND NOT (
                LOWER(COALESCE(category, '')) LIKE '%roof%'
                OR LOWER(COALESCE(probable_roof_system, '')) LIKE '%roof%'
                OR LOWER(COALESCE(probable_roof_system, '')) IN ('tpo', 'epdm', 'mod_bit', 'pvc', 'metal', 'built_up')
                OR LOWER(COALESCE(raw_description, '')) LIKE '%roof%'
                OR LOWER(COALESCE(raw_description, '')) LIKE '%reroof%'
                OR LOWER(COALESCE(raw_description, '')) LIKE '%re-roof%'
                OR LOWER(COALESCE(raw_description, '')) LIKE '%tear off%'
                OR LOWER(COALESCE(raw_description, '')) LIKE '%tear-off%'
                OR LOWER(COALESCE(raw_description, '')) LIKE '%membrane%'
                OR LOWER(COALESCE(raw_description, '')) LIKE '%shingle%'
                OR LOWER(COALESCE(raw_description, '')) LIKE '%tpo%'
                OR LOWER(COALESCE(raw_description, '')) LIKE '%epdm%'
                OR LOWER(COALESCE(raw_description, '')) LIKE '%coating%'
              )
            ORDER BY COALESCE(issue_date, applied_date) DESC
            """,
            tuple(chunk),
        ):
            if pid not in non_roof_activity:
                non_roof_activity[pid] = desc

        # Track muni_permit_status from scored_parcel_leads
        for pid, status in cur.execute(
            f"""
            SELECT parcel_id, muni_permit_status FROM scored_parcel_leads
            WHERE parcel_id IN ({marks})
            """,
            tuple(chunk),
        ):
            if status:
                muni_status_map[pid] = status

        for pid, year in cur.execute(
            f"""
            SELECT parcel_id, MAX(substr(COALESCE(issue_date, applied_date), 1, 4))
            FROM normalized_permits
            WHERE parcel_id IN ({marks})
              AND date_quality = 'source'
              AND (
                LOWER(COALESCE(raw_description, '')) LIKE '%roof%'
                OR LOWER(COALESCE(category, '')) LIKE '%roof%'
              )
            GROUP BY parcel_id
            """,
            tuple(chunk),
        ):
            if year and str(year).isdigit():
                roof_year[pid] = int(year)

    year_now = now.year
    items: List[OpportunityItem] = []
    corridor_counts: Dict[str, int] = {}
    core_unresolved = 0
    pipeline = 0
    unresolved_n = 0

    for pid, data in hits.items():
        row = data["row"]
        extras = {name: row[10 + i] for i, name in enumerate(extra)}
        address = (row[1] or "").strip()
        pcity = (row[2] or city).strip()
        pzip = row[4]
        owner = (row[7] or "").strip()
        if is_placeholder_address(address) or is_public_owner(owner) or not zip_matches_city(pcity, pzip):
            continue
        if city.lower() not in pcity.lower() and pcity.lower() not in city.lower():
            continue
        sqft = int(row[5] or 0)
        ybuilt = int(row[6]) if row[6] else None
        stories = int(extras["stories"]) if extras.get("stories") else None
        footprint = int(extras["footprint_sqft"]) if extras.get("footprint_sqft") else None
        land = int(extras["land_sqft"]) if extras.get("land_sqft") else None
        improvement = float(extras["improvement_valuation"] or 0) if "improvement_valuation" in extras else None
        price = replacement_cost(sqft, state=state, stories=stories, footprint_sqft=footprint, land_sqft=land, improvement_value=improvement)
        installed = roof_year.get(pid)
        if installed:
            age = max(0, year_now - installed)
        elif ybuilt and ybuilt > 1900:
            age = max(0, year_now - ybuilt)
        else:
            age = None
        tier = data["tier"]
        score = exposure_score(data["hail"], None, tier, age, int(price["roof_sqft"]))
        unresolved = pid not in permitted
        p_status = muni_status_map.get(pid)
        if not p_status:
            if pid in permitted:
                p_status = "ROOF_PERMIT_DETECTED"
            elif pid in non_roof_activity:
                p_status = "NON_ROOF_PERMIT_DETECTED"
        activity_note = non_roof_activity.get(pid)

        value = 0 if price["flagged"] else int(price["mid"])
        if unresolved:
            unresolved_n += 1
            if tier == "core":
                core_unresolved += 1
            pipeline += value
            corr = _detect_corridor(address, pcity, pzip)
            corridor_counts[corr] = corridor_counts.get(corr, 0) + 1
        items.append(
            OpportunityItem(
                parcel_id=pid,
                address=address,
                city=pcity,
                owner=owner or "Owner not on record",
                owner_mail=owner_mailing_line(extras.get("owner_address"), extras.get("owner_city"), extras.get("owner_state"), extras.get("owner_zip")),
                year_built=ybuilt,
                sqft=sqft,
                hail_inches=round(float(data["hail"]), 2),
                tier=tier,
                score=score,
                pipeline_value_usd=int(price["mid"]),
                unresolved=unresolved,
                storm_id=str(storm_id),
                price_low=int(price["low"]),
                price_high=int(price["high"]),
                roof_sqft=int(price["roof_sqft"]),
                price_flagged=bool(price["flagged"]),
                permit_status=p_status,
                recent_activity=activity_note,
            )
        )

    items.sort(key=lambda o: (1 if o.unresolved else 0, o.score, o.roof_sqft), reverse=True)
    deadline, days = _deadline(storm_date, now)
    top_corridor = max(corridor_counts.items(), key=lambda x: x[1])[0] if corridor_counts else city
    if items:
        lead = items[0]
        top_owner = TopOwner(name=lead.owner, address=lead.address, parcel_id=lead.parcel_id)
        pitch = PitchBrief(address=lead.address, hail_inches=lead.hail_inches, year_built=lead.year_built, membrane=_detect_membrane(lead.year_built, lead.roof_sqft or lead.sqft))
    else:
        top_owner = TopOwner(name="", address="", parcel_id="")
        pitch = PitchBrief(address="", hail_inches=0.0, year_built=None, membrane="")

    _write_scores(items, storm_name, storm_date)
    conn.close()
    return MondayBriefResponse(
        jurisdiction=jurisdiction,
        as_of=as_of,
        storm=StormSummary(id=str(storm_id), name=storm_name or "Storm", event_date=storm_date, max_hail_inches=storm_hail, report_count=len(hits)),
        summary=BriefSummary(
            exposed_buildings=len(items),
            unresolved_buildings=unresolved_n,
            core_unresolved=core_unresolved,
            pipeline_value_usd=pipeline,
            top_corridor=top_corridor,
            claim_deadline=deadline,
            days_remaining=days,
        ),
        top_owner=top_owner,
        pitch=pitch,
        competitor=competitor,
        opportunities=items,
        total_opportunities=len(items),
        offset=0,
    )


def _write_scores(items: List[OpportunityItem], storm_name: str, storm_date: str) -> None:
    """Replace stale precomputed scores for the buildings this brief just ranked."""
    from app.science.brief_service import DB_PATH
    import os

    if not items or not os.path.exists(DB_PATH):
        return
    try:
        from app.core.sqlite import connect as sqlite_connect
        conn = sqlite_connect()
        cur = conn.cursor()
        cols = {row[1] for row in cur.execute("PRAGMA table_info(scored_parcel_leads)")}
        if "exposure_score" not in cols:
            conn.close()
            return
        for item in items:
            cur.execute(
                """
                UPDATE scored_parcel_leads
                SET exposure_score = ?, estimated_replacement_mid = ?, storm_name = ?, event_date = ?
                WHERE parcel_id = ?
                """,
                (item.score, item.pipeline_value_usd, storm_name, storm_date, item.parcel_id),
            )
        conn.commit()
        conn.close()
    except Exception as exc:
        logger.warning(f"[BRIEF] Score write-back skipped: {exc}")
