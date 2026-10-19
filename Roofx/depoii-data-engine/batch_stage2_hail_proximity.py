"""Stage 2 no longer writes hail distance from a hardcoded point list."""


def run_stage2_hail_proximity():
    raise SystemExit(
        "Refusing to update hail distance. Attach an SPC CSV through app.science.spc_hail."
    )


if __name__ == "__main__":
    run_stage2_hail_proximity()
