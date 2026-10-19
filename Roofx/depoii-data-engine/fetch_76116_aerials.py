import urllib.request
import os

candidates = [
    ("aerial_7408_camp_bowie.png", 32.72307, -97.44412, "7408 Camp Bowie West Blvd"),
    ("aerial_6777_camp_bowie.png", 32.72028, -97.43385, "6777 Camp Bowie Blvd"),
    ("aerial_3209_alta_mere.png", 32.72587, -97.44012, "3209 Alta Mere Dr"),
    ("aerial_7912_camp_bowie.png", 32.72397, -97.45206, "7912 Camp Bowie West Blvd")
]

delta = 0.0016
for fname, lat, lon, name in candidates:
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
        print(f"Saved {fname} ({os.path.getsize(out_path)} bytes)")
    except Exception as e:
        print(f"Error {name}: {e}")
