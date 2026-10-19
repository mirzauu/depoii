import httpx
import csv
import io

codes = ['260425', '260426', '260428']
dfw_counties = ['TARRANT', 'DALLAS', 'PARKER', 'DENTON', 'JOHNSON', 'WISE', 'HOOD']

for code in codes:
    url = f"https://www.spc.noaa.gov/climo/reports/{code}_rpts_hail.csv"
    print("=" * 80)
    print(f"NOAA SPC HAIL FILE: {code} -> {url}")
    print("=" * 80)
    resp = httpx.get(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii/1.0'})
    reader = csv.reader(io.StringIO(resp.text))
    header = None
    matches = []
    for row in reader:
        if not row:
            continue
        if header is None:
            header = row
            print("Columns:", header)
            continue
        if len(row) >= 7:
            # Time,Size,Location,County,State,Lat,Lon,Comments
            time_utc, size_hail, loc, county, st, lat, lon = row[0], row[1], row[2], row[3], row[4], row[5], row[6]
            comments = row[7] if len(row) > 7 else ""
            if st.upper() == 'TX' and county.upper() in dfw_counties:
                matches.append((time_utc, size_hail, loc, county, st, lat, lon, comments))
    print(f"Total matching DFW reports in {code}: {len(matches)}")
    for m in matches:
        print(f"  Time: {m[0]} UTC | Size: {m[1]} ({float(m[1])/100.0 if m[1].isdigit() else m[1]}\") | Loc: {m[2]}, {m[3]} Co. | Lat/Lon: {m[5]},{m[6]} | Comm: {m[7][:50]}")
