"""Mock city parcels are not loaded.

Phase A deleted generated parcels. This script refuses to insert them again.
"""


def seed_data():
    raise SystemExit("seed_other_cities is disabled: it inserted generated parcels.")


if __name__ == "__main__":
    seed_data()
