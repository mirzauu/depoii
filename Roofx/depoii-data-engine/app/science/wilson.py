"""Wilson score interval for a measured recall or field-accuracy rate."""

from __future__ import annotations

import math
from typing import Tuple


def wilson_interval(successes: int, n: int, z: float = 1.959963984540054) -> Tuple[float, float]:
    if n <= 0:
        raise ValueError("n must be positive")
    p = successes / n
    denom = 1 + z * z / n
    center = (p + z * z / (2 * n)) / denom
    margin = z * math.sqrt((p * (1 - p) + z * z / (4 * n)) / n) / denom
    return max(0.0, center - margin), min(1.0, center + margin)


def n_for_margin(margin: float = 0.03, p: float = 0.5, z: float = 1.959963984540054) -> int:
    return math.ceil((z * z * p * (1 - p)) / (margin * margin))
