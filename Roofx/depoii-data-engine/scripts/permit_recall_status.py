"""Record why roof-permit recall is not a rate yet.

The Dallas FY2023-24 activity filter for ROOF returned no features, so that
word is not the city's vocabulary. Fort Worth's permit service timed out in
the audit. This script does not invent a recall number.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SAMPLE = os.path.join(ROOT, "audit", "queries", "live_pages", "dallas_roof_30.json")
OUT = os.path.join(ROOT, "audit", "permit_recall_status.txt")


def main() -> None:
    features = []
    if os.path.exists(SAMPLE):
        payload = json.load(open(SAMPLE, encoding="utf-8"))
        features = payload.get("features") or []
    activities = sorted({
        str((f.get("attributes") or {}).get("ACTIVITY") or "")
        for f in features
        if (f.get("attributes") or {}).get("ACTIVITY")
    })
    lines = [
        f"RUN_UTC {datetime.now(timezone.utc).isoformat()}",
        f"dallas_sample_features {len(features)}",
        f"distinct_ACTIVITY {len(activities)}",
        "recall UNKNOWN",
        "reason Dallas ACTIVITY LIKE '%ROOF%' returned 0 features in audit/queries/09_dallas_permit_recall.txt, and the saved sample has no features to list a vocabulary.",
        "customer_text searched {portal} on {date}: {n} matches",
        "forbidden ZERO_PERMITS_FOUND",
        "forbidden no roofing permit found",
    ]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
