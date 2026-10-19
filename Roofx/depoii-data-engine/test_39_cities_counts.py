import sqlite3

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

cities = [
    "Sonoma County, CA",
    "Gainesville, FL",
    "Chicago, IL",
    "Baton Rouge, LA",
    "Ashton, MD",
    "Bethesda, MD",
    "Boyds, MD",
    "Brookeville, MD",
    "Burtonsville, MD",
    "Cabin John, MD",
    "Chevy Chase, MD",
    "Clarksburg, MD",
    "Damascus, MD",
    "Darnestown, MD",
    "Dickerson, MD",
    "Gaithersburg, MD",
    "Germantown, MD",
    "Highland, MD",
    "Kensington, MD",
    "Montgomery County, MD",
    "Montgomery Village, MD",
    "Mount Airy, MD",
    "North Bethesda, MD",
    "Olney, MD",
    "Poolesville, MD",
    "Potomac, MD",
    "Rockville, MD",
    "Sandy Spring, MD",
    "Silver Spring, MD",
    "Takoma Park, MD",
    "Wheaton, MD",
    "Cambridge, MA",
    "Framingham, MA",
    "New York City, NY",
    "Cincinnati, OH",
    "Addison, TX",
    "Austin, TX",
    "Dallas, TX",
    "Fort Worth, TX"
]

print(f"{'City Query':<25} | {'Parcels Found':<14} | {'Permits Found':<14} | Notes")
print("-" * 75)

for jur in cities:
    parts = jur.split(",")
    city = parts[0].strip()
    state = parts[1].strip()
    
    city_param = f"%{city}%"
    cur.execute("""
        SELECT count(*) FROM parcels
        WHERE state = ? AND (LOWER(city) LIKE LOWER(?) OR LOWER(jurisdiction) LIKE LOWER(?))
    """, (state, city_param, city_param))
    p_cnt = cur.fetchone()[0]
    
    cur.execute("""
        SELECT count(*) FROM normalized_permits
        WHERE state = ? AND (LOWER(city) LIKE LOWER(?) OR LOWER(jurisdiction) LIKE LOWER(?))
    """, (state, city_param, city_param))
    perm_cnt = cur.fetchone()[0]
    
    notes = []
    if p_cnt == 0:
        notes.append("NO PARCELS")
    if perm_cnt == 0:
        notes.append("NO PERMITS")
    if not notes:
        notes.append("OK")
        
    print(f"{jur:<25} | {p_cnt:<14} | {perm_cnt:<14} | {', '.join(notes)}")
