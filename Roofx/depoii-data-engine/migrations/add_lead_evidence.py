"""Create empty lead_evidence and released_leads tables. Does not delete parcels."""

from __future__ import annotations

import os
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.science.lead_store import ensure_schema


def apply(db_path: str) -> None:
    conn = sqlite3.connect(db_path)
    try:
        ensure_schema(conn)
        conn.commit()
        evidence = conn.execute("SELECT COUNT(*) FROM lead_evidence").fetchone()[0]
        released = conn.execute("SELECT COUNT(*) FROM released_leads").fetchone()[0]
    finally:
        conn.close()
    print(f"lead_evidence rows {evidence}")
    print(f"released_leads rows {released}")


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "depoii_local.db",
    )
    apply(target)
