import sqlite3

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

print("="*80)
print("TOP 10 HIGHEST VALUATION PERMITS IN FORT WORTH")
print("="*80)
cur.execute("""
    SELECT raw_permit_number, valuation, category, probable_roof_system, SUBSTR(raw_description, 1, 60), contractor_name
    FROM normalized_permits
    WHERE jurisdiction LIKE '%Fort Worth%'
    ORDER BY valuation DESC
    LIMIT 10
""")
for r in cur.fetchall():
    print(f"Permit: {r[0]:<15} | Val: ${r[1]:>12,.2f} | Cat: {r[2]:<12} | Roof: {r[3]:<15} | Desc: {r[4]}")

print("\n" + "="*80)
print("VALUATION DISTRIBUTION IN FORT WORTH")
print("="*80)
cur.execute("""
    SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN valuation > 10000000 THEN 1 END) as over_10m,
        COUNT(CASE WHEN valuation BETWEEN 1000000 AND 10000000 THEN 1 END) as between_1m_10m,
        COUNT(CASE WHEN valuation BETWEEN 100000 AND 1000000 THEN 1 END) as between_100k_1m,
        COUNT(CASE WHEN valuation < 100000 THEN 1 END) as under_100k,
        ROUND(SUM(CASE WHEN valuation > 10000000 THEN valuation ELSE 0 END) / 1e6, 2) as val_over_10m_millions,
        ROUND(SUM(CASE WHEN valuation <= 10000000 THEN valuation ELSE 0 END) / 1e6, 2) as val_under_10m_millions
    FROM normalized_permits
    WHERE jurisdiction LIKE '%Fort Worth%'
""")
f_stats = cur.fetchone()
print(f"Total permits: {f_stats[0]}")
print(f"Permits > $10M: {f_stats[1]} (Sum: ${f_stats[5]:,.2f}M)")
print(f"Permits $1M - $10M: {f_stats[2]}")
print(f"Permits $100K - $1M: {f_stats[3]}")
print(f"Permits < $100K: {f_stats[4]}")
print(f"Total valuation of permits <= $10M: ${f_stats[6]:,.2f}M")

print("\n" + "="*80)
print("CATEGORY BREAKDOWN IN FORT WORTH")
print("="*80)
cur.execute("""
    SELECT category, COUNT(*), ROUND(SUM(valuation)/1e6, 2)
    FROM normalized_permits
    WHERE jurisdiction LIKE '%Fort Worth%'
    GROUP BY category
    ORDER BY SUM(valuation) DESC
""")
for c, cnt, val_m in cur.fetchall():
    print(f"  • {c:<25}: {cnt:>6,} permits | ${val_m:>9,.2f}M")
