import urllib.request
import urllib.parse
import json

p = {'where': "ACCOUNT = '04433254'", 'outFields': '*', 'f': 'json'}
url = 'https://mapit.tarrantcounty.com/arcgis/rest/services/Dynamic/TADParcels/MapServer/0/query?' + urllib.parse.urlencode(p)
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 Depoii/1.0'})
try:
    with urllib.request.urlopen(req, timeout=10) as r:
        data = json.loads(r.read().decode())
        print('Keys:', list(data.keys()))
        feats = data.get('features', [])
        print('Features count:', len(feats))
        if feats:
            print(feats[0]['attributes'])
        else:
            print("Response:", data)
except Exception as e:
    print('Exception:', e)
