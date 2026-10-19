"""
Scoring from a hardcoded hail list is disabled.

Attach a convective-day SPC CSV through app.science.spc_hail and release a
parcel only through app.science.lead_store.try_release.
"""


def score_verified_parcels():
    raise SystemExit(
        "Refusing to score. There is no hardcoded hail list. "
        "Use app.science.spc_hail and app.science.lead_store.try_release."
    )


if __name__ == "__main__":
    score_verified_parcels()
