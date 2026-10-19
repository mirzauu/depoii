"""Release check requires evidence rows. A live source tag is not enough."""

import unittest
from provenance_guard import verify_outbound_ready


def _complete_evidence():
    return {
        "address": "100 Example Rd",
        "owner_name": "Example Owner LLC",
        "year_built": "1982",
        "stories": "1",
        "market_value": "1000000",
        "improvement_description": "OFFICE BUILDING",
        "land_use_code": "COMMERCIAL",
        "source_area": "20000",
        "source_area_kind": "foundation_sum",
        "roof_sqft_used": "20000",
        "spc_file": "260425_rpts_hail.csv",
        "spc_time_utc": "0539",
        "spc_lat": "32.84",
        "spc_lon": "-97.32",
        "spc_size_in": "1.00",
        "spc_comment": "2 NW Haltom City",
        "hail_distance_mi": "1.06",
        "permit_query": "searched Fort Worth permits on 2026-10-14: 0 matches for 100 Example",
        "permit_match_count": "0",
        "permit_portal": "https://example.test/permits",
    }


class TestProvenanceGuard(unittest.TestCase):
    def test_blocks_unverified_seed(self):
        ready, reason = verify_outbound_ready({"data_provenance": "unverified_seed", "state": "TX"})
        self.assertFalse(ready)
        self.assertIn("evidence", reason.lower())

    def test_blocks_live_tag_without_evidence(self):
        ready, reason = verify_outbound_ready({
            "data_provenance": "live_tad_api",
            "state": "TX",
            "building_sqft": 115188,
            "building_sqft_source": "TAD LIVING_ARE",
            "year_built": 1998,
            "year_built_source": "TAD YEAR_BUILT",
            "total_valuation": 12062715,
            "valuation_source": "TAD TOTAL_VALU",
            "owner_name": "Mercantile Partners",
        })
        self.assertFalse(ready)
        self.assertIn("evidence", reason.lower())

    def test_blocks_apartment_evidence(self):
        evidence = _complete_evidence()
        evidence["improvement_description"] = "APARTMENT (BRICK EXTERIOR)"
        evidence["land_use_code"] = "MFR - APARTMENTS"
        evidence["stories"] = "2"
        ready, reason = verify_outbound_ready({"state": "TX", "evidence": evidence})
        self.assertFalse(ready)
        self.assertTrue("apartment" in reason.lower() or "stories" in reason.lower() or "commercial" in reason.lower())

    def test_blocks_verified_wording(self):
        ready, reason = verify_outbound_ready({
            "state": "TX",
            "evidence": _complete_evidence(),
            "why_strong_summary": "100% verified and no roofing permit found",
        })
        self.assertFalse(ready)

    def test_passes_complete_evidence(self):
        ready, reason = verify_outbound_ready({"state": "TX", "evidence": _complete_evidence()})
        self.assertTrue(ready)
        self.assertNotIn("100%", reason)
        self.assertNotIn("verified", reason.lower())


if __name__ == "__main__":
    unittest.main()
