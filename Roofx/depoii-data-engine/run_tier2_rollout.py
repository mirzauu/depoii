import asyncio
import time
from app.science.city_verification_runner import CityVerificationRunner

TIER_2_CITIES = [
    "Addison",
    "Carrollton",
    "Farmers Branch",
    "Coppell",
    "Rowlett",
    "Irving",
    "Grand Prairie"
]

async def main():
    print("=" * 80)
    print("STARTING TIER 2 DFW INDUSTRIAL CORRIDOR PRODUCTION ROLLOUT")
    print("=" * 80)
    total_start = time.time()
    results = []

    for city in TIER_2_CITIES:
        print(f"\n>>> AUDITING & VERIFYING: {city}, TX <<<")
        start_t = time.time()
        res = await CityVerificationRunner.run_pipeline(city, "TX", max_aerials=10)
        res["duration"] = round(time.time() - start_t, 2)
        results.append(res)
        print(f"[{city}] -> Verified Leads: {res.get('total_verified')}, Pipeline: ${res.get('pipeline_value_usd', 0):,.0f}, Aerials: {res.get('aerials_cached')} ({res['duration']}s)")

    print("\n" + "=" * 80)
    print("TIER 2 ROLLOUT COMPLETE — SUMMARY REPORT")
    print("=" * 80)
    print(f"{'City':<18} | {'Verified Leads':<15} | {'Pipeline Value':<20} | {'Aerials Cached':<15}")
    print("-" * 80)
    total_v = 0
    total_pipe = 0
    total_aer = 0
    for r in results:
        v = r.get("total_verified", 0)
        p = r.get("pipeline_value_usd", 0)
        a = r.get("aerials_cached", 0)
        total_v += v
        total_pipe += p
        total_aer += a
        print(f"{r['city']:<18} | {v:<15} | ${p:<19,.0f} | {a:<15}")

    print("-" * 80)
    print(f"{'TOTAL TIER 2':<18} | {total_v:<15} | ${total_pipe:<19,.0f} | {total_aer:<15}")
    print(f"Total Rollout Execution Time: {time.time() - total_start:.2f} seconds")

if __name__ == "__main__":
    asyncio.run(main())
