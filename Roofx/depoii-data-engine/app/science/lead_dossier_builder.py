import os
import json
import sqlite3
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from shapely.geometry import Point, Polygon

from app.schemas.lead_dossier_schema import LeadDossier, ScorePillar
from app.extraction.noaa_client import calculate_hail_physics
from app.science.lead_quality import owner_mailing_line
from app.science.spatial_queries import estimate_nrca_replacement_cost, calculate_months_unrepaired

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "depoii_local.db")


def _outside_storm(pid, addr, city, state, zip_c, owner, ptype, sqft, y_built, total_val, storm_id: Optional[str], owner_mail: str = "") -> LeadDossier:
    """The building is not inside the storm the call list used. Do not borrow another storm."""
    name = "Not inside the selected storm" if storm_id else "Not inside a stored storm swath"
    return LeadDossier(
        parcel_id=pid,
        address=addr,
        city=city or "",
        state=state or "",
        zip_code=zip_c or "",
        owner_name=str(owner or ""),
        owner_mail=owner_mail,
        property_type=str(ptype or ""),
        building_sqft=0,
        year_built=None,
        cad_total_valuation=0,
        storm_id=storm_id or "",
        storm_name=name,
        event_date="",
        max_hail_inches=0,
        max_gust_mph=0,
        kinetic_energy_joules=0,
        terminal_velocity_mph=0,
        damage_severity_tier="OUTSIDE",
        estimated_replacement_low=0,
        estimated_replacement_high=0,
        estimated_replacement_mid=0,
        estimated_replacement_formatted="Not priced — outside the storm",
        unresolved_exposure_score=0,
        lead_classification="OUTSIDE_STORM",
        lead_badge="Outside this storm",
        scorecard_pillars=[],
        why_strong_reasons=[],
        why_weak_reasons=["This building is not inside the storm polygon on the call list."],
        cold_call_opening_hook="",
        insurance_urgency_angle="",
        recommended_inspection_offer="",
        recommended_roof_system="",
        markdown_dossier=f"# {addr}\n\n{name}. No hail size or price is shown, because this dossier will not substitute a different storm.\n",
    )


def _released_dossier(parcel_id: str) -> Optional[LeadDossier]:
    """Dossier only for a parcel on released_leads. Otherwise the caller returns 404."""
    from app.science.lead_quality import exposure_score
    from app.science.lead_store import evidence_map

    if not os.path.exists(DB_PATH):
        return None
    from app.core.sqlite import connect as sqlite_connect
    conn = sqlite_connect(readonly=True)
    try:
        try:
            released = conn.execute(
                """
                SELECT parcel_id FROM released_leads
                WHERE state = 'TX' AND (
                    parcel_id = ?
                    OR parcel_id IN (SELECT id FROM parcels WHERE account_number = ?)
                )
                """,
                (parcel_id, parcel_id),
            ).fetchone()
        except sqlite3.OperationalError:
            return None
        if not released:
            return None
        evidence = evidence_map(conn, released[0])
    finally:
        conn.close()
    if not evidence:
        return None
    address = evidence.get("address") or ""
    year = evidence.get("year_built")
    year_n = int(float(year)) if year else None
    roof = int(float(evidence["roof_sqft_used"])) if evidence.get("roof_sqft_used") else 0
    hail = float(evidence["spc_size_in"]) if evidence.get("spc_size_in") else 0.0
    distance = float(evidence["hail_distance_mi"]) if evidence.get("hail_distance_mi") else None
    age = max(0, datetime.now(timezone.utc).year - year_n) if year_n else None
    score = exposure_score(hail, distance, "envelope", age, roof)
    permit = evidence.get("permit_query") or "Permit search has not been logged."
    comment = evidence.get("spc_comment") or ""
    markdown = "\n".join([
        f"# {address}",
        "",
        f"Owner: {evidence.get('owner_name') or ''}",
        f"Year built: {year or ''}",
        f"Market value: {evidence.get('market_value') or ''}",
        f"Improvement: {evidence.get('improvement_description') or ''}",
        f"Roof sq ft used: {evidence.get('roof_sqft_used') or ''}",
        f"Nearest Texas SPC report in {evidence.get('spc_file') or ''}: {hail} in at {distance} miles. {comment}",
        "This distance is to a point report, not a measurement on this roof.",
        permit,
        "",
    ])
    return LeadDossier(
        parcel_id=released[0],
        address=address,
        city="",
        state="TX",
        zip_code="",
        owner_name=evidence.get("owner_name") or "",
        property_type=evidence.get("improvement_description") or "",
        building_sqft=roof,
        year_built=year_n,
        cad_total_valuation=float(evidence["market_value"]) if evidence.get("market_value") else 0,
        storm_id=evidence.get("spc_file") or "",
        storm_name=f"Nearest Texas SPC report {evidence.get('spc_file') or ''}",
        event_date="",
        max_hail_inches=hail,
        max_gust_mph=0,
        kinetic_energy_joules=0,
        terminal_velocity_mph=0,
        damage_severity_tier="POINT_REPORT",
        estimated_replacement_low=0,
        estimated_replacement_high=0,
        estimated_replacement_mid=0,
        estimated_replacement_formatted="Not priced",
        unresolved_exposure_score=score,
        lead_classification="RELEASED_EVIDENCE",
        lead_badge="Evidence on file",
        scorecard_pillars=[],
        why_strong_reasons=[
            f"Nearest Texas SPC report is {distance} miles from the parcel centroid."
        ] if distance is not None else [],
        why_weak_reasons=[
            "Hail distance is to an SPC point report, not proof this roof was hit.",
            permit,
        ],
        cold_call_opening_hook="",
        insurance_urgency_angle="",
        recommended_inspection_offer="",
        recommended_roof_system="",
        markdown_dossier=markdown,
    )


def build_lead_dossier(parcel_id: str, storm_id: Optional[str] = None) -> Optional[LeadDossier]:
    """
    Returns a dossier only when the parcel is on released_leads.
    """
    _ = storm_id
    return _released_dossier(parcel_id)


def _unused_legacy_dossier_removed(parcel_id: str, storm_id: Optional[str] = None) -> Optional[LeadDossier]:
    """Kept out of the customer path. The body below is not called."""
    raise RuntimeError("legacy dossier is not served")
    if not os.path.exists(DB_PATH):
        return None

    from app.core.sqlite import connect as sqlite_connect
    conn = sqlite_connect(readonly=True)
    cur = conn.cursor()

    # 1. Fetch parcel with live provenance & permit status
    cur.execute("""
        SELECT 
            p.id, p.address, p.city, p.state, p.zip_code, p.building_sqft, p.year_built,
            p.property_type, p.owner_name, p.total_valuation, p.latitude, p.longitude,
            p.owner_address, p.owner_city, p.owner_state, p.owner_zip,
            p.data_provenance, p.provenance_date, p.building_sqft_source, p.valuation_source, p.year_built_source,
            l.muni_permit_check_date, l.muni_permit_status, l.nearest_hail_distance_mi, l.nearest_hail_size_in, l.nearest_hail_location
        FROM parcels p
        LEFT JOIN scored_parcel_leads l ON l.parcel_id = p.id
        WHERE p.id = ? OR p.account_number = ?
    """, (parcel_id, parcel_id))
    p_row = cur.fetchone()

    if not p_row:
        conn.close()
        return None

    (
        pid, addr, city, state, zip_c, sqft, y_built, ptype, owner, total_val, lat, lon,
        mail_street, mail_city, mail_state, mail_zip,
        prov, prov_date, sqft_source, val_source, yr_source,
        permit_check_date, permit_status, nearest_hail_dist, nearest_hail_size, nearest_hail_loc
    ) = p_row

    owner_mail = owner_mailing_line(mail_street, mail_city, mail_state, mail_zip)
    sqft = int(sqft or 0)
    total_val = float(total_val or 0.0)
    state = state or "TX"
    addr = addr or "Commercial Facility"
    owner = owner or "Commercial Property Owner"
    ptype = ptype or "Commercial Asset"

    # Newest containing storm, or the storm id the call list already chose.
    if storm_id:
        cur.execute("""
            SELECT id, storm_name, event_date, max_hail_inches, max_gust_mph, properties
            FROM storm_swaths
            WHERE id = ? OR id = ?
        """, (storm_id, storm_id if str(storm_id).startswith("STORM-") else f"STORM-{storm_id}"))
    else:
        cur.execute("""
            SELECT id, storm_name, event_date, max_hail_inches, max_gust_mph, properties
            FROM storm_swaths
            ORDER BY event_date DESC
            LIMIT 40
        """)
    storms_rows = cur.fetchall()

    pt = Point(lon, lat) if (lat and lon) else None
    matched_storm = None

    for sid, sname, edate, hail, gust, props_str in storms_rows:
        try:
            props = json.loads(props_str or "{}")
            poly_coords = props.get("polygon")
            if poly_coords and len(poly_coords) >= 3 and pt:
                poly = Polygon(poly_coords)
                if poly.is_valid and poly.contains(pt):
                    matched_storm = {
                        "id": sid,
                        "name": sname,
                        "date": edate,
                        "hail": float(hail) if hail not in (None, "") else 0.0,
                        "gust": float(gust or 60.0),
                        "radar": props.get("radar_signature", "NEXRAD Dual-Pol"),
                        "severity_tier": props.get("severity_tier", "SEVERE_MEMBRANE_IMPACT")
                    }
                    break
        except Exception:
            continue

    conn.close()
    if not matched_storm:
        return _outside_storm(pid, addr, city, state, zip_c, owner, ptype, sqft, y_built, total_val, storm_id, owner_mail)

    hail_in = matched_storm["hail"]
    gust_mph = matched_storm["gust"]
    storm_date = matched_storm["date"]
    storm_name = matched_storm["name"]

    physics = calculate_hail_physics(hail_in)
    months_unrepaired = calculate_months_unrepaired(storm_date)
    from app.science.lead_quality import exposure_score, replacement_cost
    tier = "core" if hail_in >= 1.75 else "envelope"
    roof_age = None
    val_info = replacement_cost(0, state=state)

    # 3. Calculate 5-Pillar Scorecard
    # Base score
    score = 40.0
    pillars: List[ScorePillar] = []

    # Pillar 1: Hail Severity & Kinetic Puncture
    hail_pts = round(hail_in * 11.5, 1)
    score += hail_pts
    p1_status = "STRONG" if hail_in >= 1.75 else ("MODERATE" if hail_in >= 1.25 else "LOW")
    pillars.append(ScorePillar(
        name="Meteorological Hail Severity & Kinetic Impact",
        weight_score=hail_pts,
        status=p1_status,
        metric_value=f"{hail_in:.2f} inches ({physics['kinetic_energy_joules']:.1f} Joules, {physics['terminal_velocity_mph']} mph)",
        justification=f"Hail size is the stored value for this storm ({hail_in:.2f} in). It is a model, not a core sample. Confirm on the roof."
    ))

    # Pillar 2: Deal Scale & Valuation
    sqft_pts = round(min(20.0, sqft / 15000.0), 1) if sqft else 0.0
    score += sqft_pts
    p2_status = "STRONG" if sqft >= 40000 else ("MODERATE" if sqft >= 15000 else "LOW")
    if sqft_source and sqft > 0:
        p2_metric = f"{sqft:,} sq ft (per {sqft_source})"
        p2_just = f"Public roll records {sqft:,} sq ft building area. NRCA replacement range is {val_info['formatted']} (estimate only)."
    else:
        p2_metric = "Building area: not available from public roll"
        p2_just = "Building area is not recorded on the queried public roll."
    pillars.append(ScorePillar(
        name="Scale & Commercial Deal Valuation",
        weight_score=sqft_pts,
        status=p2_status,
        metric_value=p2_metric,
        justification=p2_just
    ))

    # Pillar 3: Substrate Age & Vulnerability
    age_pts = 0.0
    if y_built and yr_source:
        roof_age = max(0, 2026 - y_built)
        roof_age_str = f"Built {y_built} ({roof_age} yrs old, per {yr_source})"
        p3_status = "STRONG" if roof_age >= 20 else ("MODERATE" if roof_age >= 10 else "LOW")
        age_pts = round(min(15.0, roof_age * 0.5), 1)
        age_just = f"Building constructed {y_built}. Sourced from official county roll."
    else:
        roof_age = None
        roof_age_str = "Year built: not stated on the county roll"
        p3_status = "NEUTRAL"
        age_just = "Year built is not stated on the queried public roll."
    score += age_pts
    pillars.append(ScorePillar(
        name="Roof Age & Substrate Vulnerability",
        weight_score=age_pts,
        status=p3_status,
        metric_value=roof_age_str,
        justification=age_just
    ))

    # Pillar 4: Insurance Claim Clock & Urgency
    time_pts = round(min(15.0, months_unrepaired * 0.5), 1)
    score += time_pts
    if 12 <= months_unrepaired <= 24:
        p4_status = "STRONG"
        urgency_just = f"Property is at month {months_unrepaired} post-storm; entering the critical deadline window for standard 24-month commercial policy proof-of-loss."
    elif months_unrepaired < 12:
        p4_status = "MODERATE"
        urgency_just = f"Recent storm impact ({months_unrepaired} months ago); prime window to file carrier claim before seasonal weather worsens."
    else:
        p4_status = "LOW"
        urgency_just = f"Event occurred {months_unrepaired} months ago; may require specialized bad-faith or delayed discovery policy endorsement."
    pillars.append(ScorePillar(
        name="Insurance Claim Staleness & Expiration Clock",
        weight_score=time_pts,
        status=p4_status,
        metric_value=f"{months_unrepaired} months unrepaired",
        justification=urgency_just
    ))

    # Pillar 5: Municipal Permit Verification (No unverified claims!)
    if permit_check_date:
        has_zero_permits = "zero" in str(permit_status).lower() or permit_status == "ZERO_PERMITS_FOUND"
        p5_status = "STRONG" if has_zero_permits else "MODERATE"
        p5_metric = f"Permit search logged {permit_check_date}: {permit_status or 'see search log'}"
        p5_just = f"Municipal permit search log date {permit_check_date}."
    else:
        p5_status = "NEUTRAL"
        p5_metric = "Permit status: not checked against city portal"
        p5_just = "Municipal building permit portal has not yet been audited for this property."

    pillars.append(ScorePillar(
        name="Municipal Permit Verification",
        weight_score=10.0 if (permit_check_date and p5_status == "STRONG") else 0.0,
        status=p5_status,
        metric_value=p5_metric,
        justification=p5_just
    ))

    final_score = exposure_score(hail_in, None, tier, roof_age, int(val_info["roof_sqft"]))

    # Classification
    if final_score >= 85:
        classification = "TIER_1_HOT_LEAD"
        badge = "🔥 Tier 1 Hot Lead"
    elif final_score >= 70:
        classification = "TIER_2_QUALIFIED"
        badge = "⚡ Tier 2 Qualified Opportunity"
    else:
        classification = "DEPRIORITIZED"
        badge = "⏸ Deprioritized / Weak"

    # Why Strong Reasons
    why_strong: List[str] = []
    if hail_in >= 1.75:
        why_strong.append(f"Severe Kinetic Impact: {hail_in}\" hail generated {physics['kinetic_energy_joules']:.1f} Joules of kinetic energy, sufficient to puncture commercial single-ply membranes.")
    if 10 <= months_unrepaired <= 24:
        why_strong.append(f"Statutory Deadline Urgency: At month {months_unrepaired}, owner is approaching the standard 24-month insurance claim statute of limitations.")
    if permit_check_date and ("zero" in str(permit_status).lower() or permit_status == "ZERO_PERMITS_FOUND"):
        why_strong.append(f"Permit search logged on {permit_check_date}: {permit_status}.")
    if sqft_source and sqft >= 50000:
        why_strong.append(f"Scale: Substantial commercial building footprint ({sqft:,} sq ft per public roll).")

    # Why Weak / Risk Factors
    why_weak: List[str] = []
    if not sqft_source or sqft == 0:
        why_weak.append("Missing Building Area: Building sq ft not available on public roll; on-site measurement required.")
    if not yr_source or not y_built:
        why_weak.append("Missing County Age: Year built missing from county roll; contractor must inspect substrate in person.")
    if not permit_check_date:
        why_weak.append("Permits Unchecked: Municipal building department records not yet pulled for this address.")
    if hail_in < 1.5:
        why_weak.append(f"Moderate Hail Size: {hail_in}\" hail may have caused cosmetic granule loss rather than catastrophic membrane puncture.")
    if not why_weak:
        why_weak.append("No material disqualifiers detected; prime commercial prospect.")

    # Sales Outreach Hooks
    hook_permit_phrase = f"City records show zero post-storm roofing permits on file as of {permit_check_date}." if permit_check_date else "Public records show no record of a completed whole-roof replacement."
    hook = (
        f"\"Hi {owner}, I'm calling regarding the property at {addr}. "
        f"SPC-listed storm reports recorded {hail_in}\" hail in this corridor during the {storm_name}. "
        f"{hook_permit_phrase} With the insurance claim window advancing, "
        f"we wanted to offer a non-invasive visual drone inspection before the policy deadline closes.\""
    )

    urgency_angle = (
        f"Property is currently at month {months_unrepaired} since the {storm_date} storm. "
        f"Commercial property insurance policies typically carry a 12-to-24 month proof-of-loss clause. "
        f"Reaching out now frames the contractor as protecting the owner's carrier settlement."
    )

    inspection_offer = (
        "Non-Invasive Aerial Infrared & Thermal Drone Moisture Scan: Pinpoints subsurface insulation water intrusion without penetrating the existing roof membrane."
    )

    rec_roof = (
        "Not named on a permit. Specify the system after the inspection."
    )

    # Markdown Document
    md = f"""# Depoii Commercial Lead Intelligence Dossier

> **Asset:** {addr}, {city}, {state} {zip_c}  
> **Deeded Owner:** {owner}  
> **Mailing address on the appraisal roll:** {owner_mail or "not on the roll"}  
> **Lead Classification:** **{badge}** (Score: **{final_score} / 99**)  
> **NRCA Estimated Replacement Range:** {val_info['formatted']} (estimate only)

---

## 1. Executive Summary & Score Justification

| Metric | Recorded Value | Evaluation / Source |
| :--- | :--- | :--- |
| **Exposure Score** | **{final_score} / 99** | {badge} |
| **Building Size** | **{p2_metric}** | {ptype} |
| **Year Built** | **{roof_age_str}** | Substrate Vulnerability: {p3_status} |
| **Associated Storm** | **{storm_name}** | Event Date: {storm_date} |
| **Hail Severity** | **{hail_in:.2f} inches** | Kinetic Energy: {physics['kinetic_energy_joules']:.1f} Joules ({matched_storm['severity_tier']}) |
| **Time Since Storm** | **{months_unrepaired} months** | Claim Expiration Status: {p4_status} |
| **Permit Status** | **{p5_metric}** | Sourced from municipal portal |

---

## 2. 5-Pillar Scorecard Breakdown

"""
    for p in pillars:
        md += f"### {p.name}\n"
        md += f"* **Metric:** {p.metric_value}\n"
        md += f"* **Score Contribution:** `+{p.weight_score} pts` | **Rating:** `{p.status}`\n"
        md += f"* **Technical Justification:** {p.justification}\n\n"

    md += "## 3. Why This Is a Strong Lead vs. Risk Factors\n\n"
    md += "### Key Positive Drivers (Why It's Strong):\n"
    for s in why_strong:
        md += f"- **[+]** {s}\n"
    md += "\n### Potential Risk Factors / Objections (Why It Could Be Challenging):\n"
    for w in why_weak:
        md += f"- **[-]** {w}\n"

    md += f"""
---

## 4. Actionable Sales Outreach Playbook

### Phone Opening Hook:
> {hook}

### Insurance Claim Urgency Talking Point:
> {urgency_angle}

### Recommended Diagnostic Offer:
> **{inspection_offer}**

### Recommended Replacement Specification:
> **{rec_roof}**

---

## 5. Data Sources & Provenance
* **Appraisal District Roll:** {val_source or 'County appraisal record'}, retrieved {prov_date or 'recent query'}
* **Building Specifications:** {sqft_source or 'not available on public roll'}
* **Year Built:** {yr_source or 'not stated on public roll'}
* **Municipal Building Permits:** {f'Audited on {permit_check_date}' if permit_check_date else 'Not yet audited against city portal'}
* **Severe Weather Records:** NOAA SPC convective archive report ({nearest_hail_loc or storm_name})

> *Notice: Sourced from public records. Depoii dossiers represent public record cross-referencing and do not constitute physical damage claims, engineering certifications, or structural warranties.*
"""

    return LeadDossier(
        parcel_id=str(pid),
        address=addr,
        city=city or "",
        state=state or "",
        zip_code=str(zip_c or ""),
        owner_name=owner,
        owner_mail=owner_mail,
        property_type=ptype,
        building_sqft=0,
        year_built=None,
        cad_total_valuation=0,
        storm_id=matched_storm["id"],
        storm_name=storm_name,
        event_date=storm_date,
        max_hail_inches=hail_in,
        max_gust_mph=gust_mph,
        kinetic_energy_joules=physics["kinetic_energy_joules"],
        terminal_velocity_mph=physics["terminal_velocity_mph"],
        damage_severity_tier=matched_storm["severity_tier"],
        estimated_replacement_low=val_info["low"],
        estimated_replacement_high=val_info["high"],
        estimated_replacement_mid=val_info["mid"],
        estimated_replacement_formatted=val_info["formatted"],
        unresolved_exposure_score=final_score,
        lead_classification=classification,
        lead_badge=badge,
        scorecard_pillars=pillars,
        why_strong_reasons=why_strong,
        why_weak_reasons=why_weak,
        cold_call_opening_hook=hook,
        insurance_urgency_angle=urgency_angle,
        recommended_inspection_offer=inspection_offer,
        recommended_roof_system=rec_roof,
        markdown_dossier=md
    )
