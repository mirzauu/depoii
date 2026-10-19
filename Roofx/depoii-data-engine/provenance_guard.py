"""Release check. A source tag is not enough. Every required evidence field must be present."""

from __future__ import annotations

from typing import Any, Dict, Tuple

from app.science.lead_store import release_block_reason


def verify_outbound_ready(lead: Dict[str, Any]) -> Tuple[bool, str]:
    """Return whether this lead may be released. Does not treat a provenance string as proof."""
    evidence = lead.get("evidence")
    if not isinstance(evidence, dict) or not evidence:
        return False, "missing lead_evidence rows"
    state = str(lead.get("state") or evidence.get("state") or "TX")
    reason = release_block_reason(evidence, state=state)
    if reason:
        return False, reason
    summary = str(lead.get("why_strong_summary") or "")
    lowered = summary.lower()
    if "100%" in summary or "verified" in lowered or "no roofing permit found" in lowered:
        return False, "customer text claims a certainty the evidence does not support"
    if "zero competitor permits" in lowered or "zero_permits_found" in lowered:
        return False, "permit line must be a search result, not a claim that none exist"
    return True, "evidence rows present for each required field"
