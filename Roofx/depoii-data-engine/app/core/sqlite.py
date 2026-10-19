"""Shared SQLite access for depoii_local.db.

The engine serves many readers while verify/brief also write. SQLite needs an
explicit busy timeout and WAL, or a concurrent write returns "database is locked".
"""

from __future__ import annotations

import os
import sqlite3
import time
from typing import Callable, Optional, TypeVar

DB_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "depoii_local.db")
)

T = TypeVar("T")


def connect(timeout: float = 30.0, readonly: bool = False) -> sqlite3.Connection:
    if readonly:
        conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True, timeout=timeout)
    else:
        conn = sqlite3.connect(DB_PATH, timeout=timeout)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=30000")
        conn.execute("PRAGMA synchronous=NORMAL")
    return conn


def write_with_retry(fn: Callable[[sqlite3.Connection], T], attempts: int = 8) -> T:
    last: Optional[BaseException] = None
    for i in range(attempts):
        conn = connect()
        try:
            result = fn(conn)
            conn.commit()
            return result
        except sqlite3.OperationalError as exc:
            last = exc
            if "locked" not in str(exc).lower():
                raise
            time.sleep(0.05 * (2 ** i))
        finally:
            conn.close()
    assert last is not None
    raise last
