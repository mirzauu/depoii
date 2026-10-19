import httpx
import csv
import io

for code in ['260425', '260428']:
    url = f"https://www.spc.noaa.gov/climo/reports/{code}_rpts_hail.csv"
    r = httpx.get(url, headers={'User-Agent': 'Mozilla/5.0'})
    reader = csv.reader(io.StringIO(r.text))
    next(reader)
    print("=" * 80)
    print(f"ALL TARRANT & DFW HAIL REPORTS IN {code} ({url}):")
    print("=" * 80)
    for row in reader:
        if len(row) >= 8 and row[4].strip() == 'TX' and row[3].strip().upper() in ['TARRANT', 'PARKER', 'DALLAS']:
            size_val = float(row[1]) / 100.0 if row[1].isdigit() else row[1]
            print(f"Time: {row[0]} UTC | Size: {size_val}\" | Loc: {row[2]}, {row[3]} Co. | Lat/Lon: ({row[5]}, {row[6]}) | Comment: {row[7]}")
