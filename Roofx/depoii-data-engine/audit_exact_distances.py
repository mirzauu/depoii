import math

# NOAA SPC April 26, 2026 ground reports (from 260425 convective archive):
# Official archive URL: https://www.spc.noaa.gov/climo/reports/260425_rpts.html
REPORTS = [
    {"time": "0535 UTC", "size": 2.75, "lat": 32.79, "lon": -97.35, "loc": "3 NNW Fort Worth, Tarrant Co.", "source": "Social media photo / NWS Spotter"},
    {"time": "0416 UTC", "size": 2.25, "lat": 32.72, "lon": -97.43, "loc": "2 SW Westover Hills, Tarrant Co.", "source": "mPING Report to NWS FWD"},
    {"time": "0415 UTC", "size": 2.00, "lat": 32.71, "lon": -97.45, "loc": "2 N Benbrook, Tarrant Co.", "source": "mPING Report to NWS FWD"},
    {"time": "0351 UTC", "size": 2.75, "lat": 32.76, "lon": -97.51, "loc": "3 W White Settlement, Tarrant Co.", "source": "Social media photo to NWS FWD"},
    {"time": "0546 UTC", "size": 1.75, "lat": 32.80, "lon": -97.36, "loc": "3 E Sansom Park, Tarrant Co.", "source": "mPING Report to NWS FWD"},
    {"time": "0530 UTC", "size": 1.75, "lat": 32.81, "lon": -97.34, "loc": "3 S Blue Mound, Tarrant Co.", "source": "Emailed photo to NWS FWD"}
]

def haversine_miles(lat1, lon1, lat2, lon2):
    R = 3958.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

leads = [
    # CGJ (West Fort Worth)
    {"recipient": "CGJ Roofing & Construction", "address": "6777 Camp Bowie Blvd", "lat": 32.720286, "lon": -97.433857, "acct": "00788821", "owner": "Hickman Investments Ltd", "sqft": 116432, "year": 1986, "class": "Commercial Office Complex (The Quorum)"},
    {"recipient": "CGJ Roofing & Construction", "address": "6353 Camp Bowie Blvd", "lat": 32.725008, "lon": -97.420798, "acct": "06350739", "owner": "Brixmor Holdings 12 Spe Llc", "sqft": 203179, "year": 1965, "class": "Commercial Retail Center (Ridglea Plaza)"},
    # Ducker (West & East Commercial)
    {"recipient": "Ducker Commercial Roofing", "address": "3209 Alta Mere Dr", "lat": 32.725872, "lon": -97.440122, "acct": "00028525", "owner": "Cross Family Trust", "sqft": 34692, "year": 1965, "class": "Commercial Wholesale/Industrial (CED - Miller Electric)"},
    {"recipient": "Ducker Commercial Roofing", "address": "2020 E 4th St", "lat": 32.760953, "lon": -97.315362, "acct": "07901224", "owner": "Fort Industrial LLC (Fort Capital)", "sqft": 63795, "year": 1984, "class": "Industrial Distribution Warehouse (Trinity Bend)"},
    # MAZE (North Fort Worth Stockyards)
    {"recipient": "MAZE Commercial Roofing", "address": "201 NE 28th St", "lat": 32.796460, "lon": -97.346486, "acct": "00973742", "owner": "Mimosa Lane LLC", "sqft": 108590, "year": 1998, "class": "Stockyards Commercial Center (Frost Bank Center)"},
    {"recipient": "MAZE Commercial Roofing", "address": "2701 Decatur Ave", "lat": 32.793576, "lon": -97.337657, "acct": "00973688", "owner": "DFW K&H Real Estate LLC", "sqft": 62916, "year": 1960, "class": "Industrial Manufacturing / Warehouse Facility"}
]

print("=" * 90)
print("PILOT 3: EXACT HAIL PROXIMITY AUDIT (ALL FROM APRIL 26, 2026 SPC ARCHIVE)")
print("=" * 90)

for lead in leads:
    best_dist = 999.0
    best_rep = None
    for rep in REPORTS:
        d = haversine_miles(lead["lat"], lead["lon"], rep["lat"], rep["lon"])
        if d < best_dist:
            best_dist = d
            best_rep = rep
    print(f"\n[{lead['recipient']}] -> {lead['address']} ({lead['sqft']:,} sq ft, built {lead['year']})")
    print(f"  • TAD Class / Property Use: {lead['class']}")
    print(f"  • TAD Parcel Account      : #{lead['acct']} | Owner: {lead['owner']}")
    print(f"  • Nearest Hail Report     : {best_rep['size']}\" hail ({best_rep['loc']})")
    print(f"  • Radial Distance         : {best_dist:.2f} miles")
    print(f"  • Event Time              : {best_rep['time']} on April 26, 2026")
    print(f"  • NOAA SPC Archive URL    : https://www.spc.noaa.gov/climo/reports/260425_rpts.html")
