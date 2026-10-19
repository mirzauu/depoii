"""Regression tests from the 2026-10-13 audit. Do not add a control after seeing a failure."""

import ast
import os
import sqlite3
from pathlib import Path

import pytest

from app.science.dcad_parse import parse_dcad_account
from app.science.lead_quality import roof_square_feet
from app.science.lead_store import measured_roof_sqft, try_release, ensure_schema
from app.science.permit_match import addresses_match, search_summary
from app.science.spc_hail import nearest_report, parse_hail_csv
from app.science.wilson import n_for_margin, wilson_interval
from scripts.null_standin_fingerprints import null_standins

ENGINE = Path(__file__).resolve().parents[1]
PAGES = ENGINE.parents[1] / "audit" / "queries" / "live_pages"
SPC = ENGINE.parents[1] / "audit" / "queries" / "spc"
WRITERS = [
    ENGINE / "batch_dallas_enrichment.py",
    ENGINE / "batch_dallas_permit_injector.py",
    ENGINE / "batch_stage2_hail_proximity.py",
    ENGINE / "batch_score_verified_only.py",
    ENGINE / "app" / "science" / "city_verification_runner.py",
    ENGINE / "app" / "science" / "verification_engine.py",
]


def _html(name):
    return (PAGES / name).read_text(encoding="utf-8", errors="ignore")


def test_dcad_16850_is_not_the_stand_in_value():
    parsed = parse_dcad_account(_html("DCAD-PARCEL-00000799950250000.html"))
    assert parsed["year_built"] == 1979
    assert parsed["source_area"] == 11994
    assert parsed["market_value"] == 1625000
    assert parsed["source_area"] != 33083
    assert parsed["year_built"] != 1996


def test_dcad_14222_is_an_apartment_and_not_one_story():
    parsed = parse_dcad_account(_html("DCAD-PARCEL-00000662970600000.html"))
    assert parsed["stories"] == 2
    assert parsed["unit_count"] == 217
    assert "APARTMENT" in parsed["improvement_description"].upper()
    assert parsed["ineligible"]
    assert parsed["roof_sqft_used"] is None
    assert "MFR" in parsed["land_use_code"].upper()


def test_dcad_14350_apartment_and_hillcrest_church_stay_out():
    apartment = parse_dcad_account(_html("DCAD-PARCEL-00000662970550000.html"))
    church = parse_dcad_account(_html("DCAD-PARCEL-008195001604C0000.html"))
    assert apartment["ineligible"]
    assert "CHURCH" in church["improvement_description"].upper()
    assert church["ineligible"]


def test_multi_section_roof_uses_each_foundation():
    madison = parse_dcad_account(_html("DCAD-PARCEL-004643000A0010000.html"))
    preston = parse_dcad_account(_html("DCAD-PARCEL-008189000B05C0000.html"))
    golden = parse_dcad_account(_html("DCAD-PARCEL-14105100010080000.html"))
    assert madison["roof_sqft_used"] is None
    assert madison["foundations"][0] == 29362
    assert preston["roof_sqft_used"] == 12316 + 55070 + 14150
    assert golden["roof_sqft_used"] == 15717
    assert golden["stories"] == 1
    assert golden["year_built"] == 2006


def test_release_blocks_a_far_or_social_report():
    conn = sqlite3.connect(":memory:")
    ensure_schema(conn)
    base = {
        "address": "1 Main St",
        "owner_name": "Owner",
        "year_built": "1979",
        "stories": "1",
        "market_value": "1",
        "improvement_description": "OFFICE BUILDING",
        "land_use_code": "OFFICE",
        "source_area": "1000",
        "source_area_kind": "dcad_improvement_total_area",
        "roof_sqft_used": "1000",
        "spc_file": "260602_rpts_hail.csv",
        "spc_time_utc": "1200",
        "spc_lat": "32.90",
        "spc_lon": "-96.80",
        "spc_size_in": "1.00",
        "spc_comment": "spotter",
        "hail_distance_mi": "25.00",
        "permit_query": "searched Dallas on 2026-10-14: 0 matches for 1 MAIN",
        "permit_match_count": "0",
        "permit_portal": "Dallas permits",
    }
    for name, value in base.items():
        conn.execute(
            "INSERT INTO lead_evidence VALUES ('P', ?, ?, 't', '', '', '2026-10-14T00:00:00+00:00', '')",
            (name, value),
        )
    ok, reason = try_release(conn, "P")
    assert ok is False
    assert "15 miles" in reason
    conn.execute(
        "UPDATE lead_evidence SET stored_value = '1.00' WHERE field_name = 'hail_distance_mi'"
    )
    conn.execute(
        "UPDATE lead_evidence SET stored_value = 'delayed facebook' WHERE field_name = 'spc_comment'"
    )
    ok, reason = try_release(conn, "P")
    assert ok is False
    assert "delayed" in reason


def test_roof_size_rejects_land_ratio():
    assert measured_roof_sqft(2, [97139]) is None
    assert measured_roof_sqft(1, [97139, None]) is None
    assert measured_roof_sqft(1, [12000]) == 12000
    sqft, _basis = roof_square_feet(0, stories=1, footprint_sqft=246961, land_sqft=379940)
    assert sqft == 0


def test_spc_empty_day_and_meacham_madison_distances():
    empty = parse_hail_csv((SPC / "260317_rpts_hail.csv").read_text(encoding="utf-8"))
    assert nearest_report(40.7, -74.0, empty, state="TX") is None
    rows = parse_hail_csv((SPC / "260425_rpts_hail.csv").read_text(encoding="utf-8"))
    # Saved query: queries/08 centroid for 1133 S Madison Ave, file 260425_rpts_hail.csv.
    # A PDF that quotes 3.73 miles used a different centroid. This test quotes 3.78 only.
    madison_centroid = (32.73385401620511, -96.82712790244761)
    meacham = nearest_report(32.82495, -97.30341, rows, state="TX")
    madison = nearest_report(madison_centroid[0], madison_centroid[1], rows, state="TX")
    assert meacham is not None and madison is not None
    assert abs(meacham["distance_mi"] - 3.63) > 0.25
    assert abs(madison["distance_mi"] - 7.33) > 0.25
    assert madison["distance_mi"] == 3.78
    assert meacham["distance_mi"] < 2
    assert "Haltom" in (meacham["location"] + meacham["comment"])


def test_street_number_alone_is_not_a_match():
    assert not addresses_match("488 Foster Rd", "488 Fountain Ave")
    assert not addresses_match("205 North Henry", "205 Henry")
    assert not addresses_match("E LOOP 820", "N LOOP 820")
    assert addresses_match("150 TURTLE CREEK BLVD Ste:106", "150 TURTLE CREEK BLVD")
    summary = search_summary("Dallas permits", "488 Foster", 0, when="2026-10-14")
    assert summary.startswith("searched ")
    assert "ZERO_PERMITS_FOUND" not in summary
    assert "no roofing permit found" not in summary.lower()


def test_fingerprint_null_on_a_copy():
    conn = sqlite3.connect(":memory:")
    conn.executescript(
        """
        CREATE TABLE parcels (id TEXT, land_sqft REAL, footprint_sqft INT, year_built INT, year_built_source TEXT);
        CREATE TABLE scored_parcel_leads (
            parcel_id TEXT, building_sqft INT, cad_total_valuation REAL, footprint_sqft INT,
            estimated_replacement_mid REAL, estimated_replacement_low REAL,
            estimated_replacement_high REAL, estimated_replacement_formatted TEXT,
            nearest_hail_distance_mi REAL, event_date TEXT, storm_name TEXT, max_hail_inches REAL
        );
        CREATE TABLE normalized_permits (source_system TEXT, valuation REAL, issue_date TEXT, date_quality TEXT);
        INSERT INTO parcels VALUES ('a', 1000, 650, 1996, 'missing');
        INSERT INTO scored_parcel_leads VALUES ('a', 100, 16500, 650, 6110, 1, 1, '$', 1.5, '2026-03-17', 'empty', 1);
        INSERT INTO normalized_permits VALUES ('DALLAS_ARCGIS_FY24', 20000, '2026-10-06', 'substituted');
        """
    )
    null_standins(conn)
    assert conn.execute("SELECT cad_total_valuation FROM scored_parcel_leads").fetchone()[0] is None
    assert conn.execute("SELECT year_built FROM parcels").fetchone()[0] is None
    assert conn.execute("SELECT footprint_sqft FROM parcels").fetchone()[0] is None
    assert conn.execute("SELECT nearest_hail_distance_mi FROM scored_parcel_leads").fetchone()[0] is None
    assert conn.execute("SELECT event_date FROM scored_parcel_leads").fetchone()[0] is None
    assert conn.execute("SELECT valuation FROM normalized_permits").fetchone()[0] is None
    assert conn.execute("SELECT issue_date FROM normalized_permits").fetchone()[0] is None


def test_writers_do_not_contain_stand_in_constants():
    for path in WRITERS:
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Name):
                assert "APRIL_26" not in node.id
                assert node.id != "HAIL_GROUND_REPORTS"
            if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
                assert node.value not in {1996, 0.65, 165, 20000, 75000, 25000}


def test_release_stays_empty_without_hail_and_permit():
    conn = sqlite3.connect(":memory:")
    ensure_schema(conn)
    from app.science.lead_store import upsert_evidence
    upsert_evidence(conn, "DCAD-PARCEL-00000662970600000", "improvement_description", "APARTMENT", "dcad", retrieved_at="2026-10-14")
    ok, _reason = try_release(conn, "DCAD-PARCEL-00000662970600000", state="TX")
    assert ok is False
    assert conn.execute("SELECT COUNT(*) FROM released_leads").fetchone()[0] == 0


def test_customer_copy_has_no_verified_record_or_100_percent():
    src = ENGINE.parents[1] / "src"
    banned = []
    for path in src.rglob("*"):
        if path.suffix not in {".ts", ".tsx"}:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        if "verified-record" in text:
            banned.append(str(path))
    assert banned == []
    guard = (ENGINE / "provenance_guard.py").read_text(encoding="utf-8")
    dossier = (ENGINE / "generate_markdown_dossier.py").read_text(encoding="utf-8")
    assert "100% verified" not in guard
    assert "100% of apartments" not in dossier


def test_wilson_sample_size_for_three_points():
    assert n_for_margin(0.03, 0.5) == 1068
    low, high = wilson_interval(14, 60)
    assert low < 0.24 < high


def test_ranked_sql_does_not_read_scored_table():
    text = (ENGINE / "app" / "api" / "v1" / "intelligence.py").read_text(encoding="utf-8")
    ranked = text.split("async def get_ranked_scored_leads")[1].split("@router.get")[0]
    assert "released_leads" in ranked or "list_released" in ranked
    assert "FROM scored_parcel_leads" not in ranked
    assert "May 28, 2024 Dallas Severe Hail Core" not in text
