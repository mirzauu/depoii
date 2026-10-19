"""Fail when a harvester still contains a stand-in generator."""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

PATTERNS = {
    "hash": re.compile(r"\bhash\("),
    "random": re.compile(r"\brandom\b"),
    "randint": re.compile(r"\brandint\b"),
    "zip_coords": re.compile(r"FW_ZIP_COORDS"),
    "area_ratio": re.compile(r"\*\s*0\.65"),
    "value_per_foot": re.compile(r"\*\s*175"),
    "fw_default_high": re.compile(r"\b145000\b"),
    "fw_default_low": re.compile(r"\b95000\b"),
    "david_miller": re.compile(r"David Miller"),
    "area_214": re.compile(r"\(214\)"),
    "area_212": re.compile(r"\(212\)"),
    "area_817": re.compile(r"\(817\)"),
    "commercial_domain": re.compile(r"commercial\.com"),
}

ALLOW = {
    "hash": {"app/science/normalizer.py"},
    "random": {"benchmark_precision_30.py"},
}


def _sources():
    skip = {".venv", "venv", "__pycache__", "tests"}
    for path in ROOT.rglob("*.py"):
        if any(part in skip for part in path.parts):
            continue
        yield path


def test_no_generator_patterns():
    hits = []
    for path in _sources():
        rel = path.relative_to(ROOT).as_posix()
        text = path.read_text(encoding="utf-8", errors="replace")
        for name, pattern in PATTERNS.items():
            if pattern.search(text) and rel not in ALLOW.get(name, set()):
                hits.append(f"{rel}: {name}")
    assert hits == []
