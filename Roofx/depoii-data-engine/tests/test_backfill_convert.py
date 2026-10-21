import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backfill_supabase import convert  # noqa: E402


def test_bool():
    assert convert(1, "boolean", "is_pure_reroof") is True
    assert convert(0, "boolean", "x") is False
    assert convert("1", "text", "is_hail_storm_window") is True


def test_date():
    assert convert("2024-01-02", "date", "issue_date") == "2024-01-02"
    assert convert("garbage", "date", "issue_date") is None


def test_jsonb():
    assert convert('{"a": 1}', "jsonb", "properties") == '{"a": 1}'
    assert convert("plain", "jsonb", "x") == '"plain"'


def test_numbers():
    assert convert("3.5", "double precision", "valuation") == 3.5
    assert convert("", "bigint", "x") is None
    assert convert(None, "bigint", "x") is None
