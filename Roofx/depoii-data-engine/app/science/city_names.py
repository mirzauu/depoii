"""Spellings that refer to the same city. The first name is the one shown in the picker."""

CITY_ALIASES: dict[tuple[str, str], tuple[str, ...]] = {
    ("NY", "NEW YORK"): ("New York", "New York City"),
}


def canonical_city_label(state: str, city: str) -> str:
    state_u = (state or "").strip().upper()
    city_u = (city or "").strip().upper()
    for (alias_state, _), names in CITY_ALIASES.items():
        if alias_state == state_u and city_u in {name.upper() for name in names}:
            return names[0]
    return (city or "").strip()


def city_spellings(state: str, city: str) -> list[str]:
    """Every filing spelling for this city, or just the given name when it has no aliases."""
    state_u = (state or "").strip().upper()
    city_u = (city or "").strip().upper()
    for (alias_state, _), names in CITY_ALIASES.items():
        if alias_state == state_u and city_u in {name.upper() for name in names}:
            return list(names)
    return [(city or "").strip()]


def jurisdiction_match(jurisdiction: str, *, city_col: str, jurisdiction_col: str, param: str = "jur") -> tuple[str, dict]:
    """SQL for a City, ST picker value. Alias cities match every known spelling."""
    raw = jurisdiction.strip()
    city_part, _, state_part = raw.partition(",")
    names = city_spellings(state_part, city_part)
    if len(names) == 1:
        return (
            f"(LOWER({jurisdiction_col}) LIKE :{param} OR LOWER({city_col}) LIKE :{param})",
            {param: f"%{raw.lower()}%"},
        )
    # Match the city column only. NYC boroughs share one jurisdiction string,
    # so a jurisdiction text match would combine Queens, Brooklyn, and the rest.
    parts = [f"LOWER({city_col}) = :{param}_{index}" for index in range(len(names))]
    params = {f"{param}_{index}": name.lower() for index, name in enumerate(names)}
    return "(" + " OR ".join(parts) + ")", params
