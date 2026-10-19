import urllib.request
import os

properties = [
    ("aerial_4300_old_benbrook.png", 32.70818, -97.44681, "4300 Old Benbrook Rd"),
    ("aerial_2720_cullen.png", 32.76615, -97.35345, "2720 Cullen St"),
    ("aerial_633_mony.png", 32.7588, -97.3112, "633 Mony St")
]

# ESRI World Imagery Export URL
# Span approx 0.002 degrees (~200 meters)
delta = 0.0018

for fname, lat, lon, name in properties:
    minx = lon - delta
    maxx = lon + delta
    miny = lat - delta * 0.75
    maxy = lat + delta * 0.75
    url = f"https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox={minx},{miny},{maxx},{maxy}&bboxSR=4326&size=800,600&f=image"
    out_path = os.path.join(r"d:\projects\Roofx", fname)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 Depoii/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            with open(out_path, "wb") as f:
                f.write(res.read())
        print(f"Saved aerial for {name} -> {out_path} ({os.path.getsize(out_path)} bytes)")
    except Exception as e:
        print(f"Error fetching aerial for {name}: {e}")
