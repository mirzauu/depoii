import sqlite3

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

print("="*80)
print("TOP 10 HIGHEST VALUATION PERMITS IN DALLAS")
print("="*80)
cur.execute("""
    SELECT raw_permit_number, valuation, category, probable_roof_system, SUBSTR(raw_description, 1, 60)
    FROM normalized_permits
    WHERE jurisdiction LIKE '%Dallas%'
    ORDER BY valuation DESC
    LIMIT 10
""")
for r in cur.fetchall():
    print(f"Permit: {r[0]:<15} | Val: ${r[1]:>12,.2f} | Cat: {r[2]:<15} | Roof: {r[3]:<15} | Desc: {r[4]}")

print("\n" + "="*80)
print("VALUATION DISTRIBUTION IN DALLAS")
print("="*80)
cur.execute("""
    SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN valuation > 10000000 THEN 1 END) as over_10m,
        ROUND(SUM(CASE WHEN valuation > 10000000 THEN valuation ELSE 0 END) / 1e6, 2) as val_over_10m_millions,
        ROUND(SUM(CASE WHEN valuation <= 10000000 THEN valuation ELSE 0 END) / 1e6, 2) as val_under_10m_millions
    FROM normalized_permits
    WHERE jurisdiction LIKE '%Dallas%'
""")
d_stats = cur.fetchone()
print(f"Total permits: {d_stats[0]}")
print(f"Permits > $10M: {d_stats[1]} (Sum: ${d_stats[2]:,.2f}M)")
print(f"Total valuation of permits <= $10M: ${d_stats[3]:,.2f}M")
