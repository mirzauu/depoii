"""DFW pilot lead export is disabled.

It treated year built as roof age and building area as roof area, then wrote
replacement dollars and a dossier JSON. Those outputs stay off until a release
field has provenance.
"""


def run_dfw_pilot_generation():
    raise SystemExit(
        "DFW pilot lead generation is disabled. It wrote stand-in roof age, area, and dollars."
    )


if __name__ == "__main__":
    run_dfw_pilot_generation()
