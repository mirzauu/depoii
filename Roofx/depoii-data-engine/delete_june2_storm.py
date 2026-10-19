import sqlite3

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()
cur.execute("DELETE FROM storm_swaths WHERE id = 'STORM-2026-06-02-DFW'")
conn.commit()
print(f"Deleted unverified June 2 storm. Remaining swaths: {cur.execute('SELECT count(*) FROM storm_swaths').fetchone()[0]}")
conn.close()
