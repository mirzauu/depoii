import sqlite3

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

print("="*70)
print("1. PERMIT FRESHNESS & TIMELINES IN DALLAS & FORT WORTH")
print("="*70)

for city in ["Dallas", "Fort Worth", "Addison"]:
    cur.execute("""
        SELECT 
            MIN(issue_date), MAX(issue_date), COUNT(*),
            COUNT(CASE WHEN issue_date >= '2024-01-01' THEN 1 END) as in_2024_plus,
            COUNT(CASE WHEN issue_date >= '2026-01-01' THEN 1 END) as in_2026_plus,
            COUNT(CASE WHEN issue_date >= '2026-04-26' THEN 1 END) as post_april_26_2026
        FROM normalized_permits
        WHERE jurisdiction LIKE ?
    """, (f"%{city}%",))
    r = cur.fetchone()
    print(f"{city:<12}: Total {r[2]:>6,} | Range: {r[0]} to {r[1]}")
    print(f"             2024+: {r[3]:>6,} | 2026+: {r[4]:>6,} | Post-April 26, 2026: {r[5]:>5,}")

print("\n" + "="*70)
print("2. PERMITS MONTHLY DISTRIBUTION (2026) IN DALLAS & FORT WORTH")
print("="*70)
cur.execute("""
    SELECT SUBSTR(issue_date, 1, 7) as ym, city, COUNT(*)
    FROM normalized_permits
    WHERE city IN ('Dallas', 'Fort Worth') AND issue_date >= '2026-01-01'
    GROUP BY ym, city
    ORDER BY ym DESC, city
    LIMIT 20
""")
for ym, city, cnt in cur.fetchall():
    print(f"  • {ym} | {city:<12}: {cnt:>5,} permits")

print("\n" + "="*70)
print("3. HOW WERE STORM SWATHS CREATED?")
print("="*70)
cur.execute("SELECT id, storm_name, properties FROM storm_swaths WHERE id = 'STORM-2026-06-02-DFW' OR id = 'STORM-2026-04-26-DFW'")
for r in cur.fetchall():
    print(f"ID: {r[0]}")
    print(f"Name: {r[1]}")
    print(f"Properties JSON: {r[2][:300]}...")
