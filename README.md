# Depoii — Commercial Roofing Opportunity Engine

Depoii ranks Dallas and Fort Worth commercial buildings against public records so a contractor can see where hail was reported, which large buildings sit inside the National Weather Service warning, and which of those addresses have no later roofing permit.

## What is live

| Record | Source |
| --- | --- |
| Hail reports of 1 inch and larger | NWS Fort Worth local storm reports, via the [Iowa Environmental Mesonet](https://mesonet.agron.iastate.edu/geojson/lsr.geojson) |
| Warning polygons and hail tags | NWS storm-based severe thunderstorm warnings, same archive |
| Owner, year built, building area | [Tarrant Appraisal District parcels](https://mapit.tarrantcounty.com/arcgis/rest/services/Dynamic/TADParcels/FeatureServer/0) and the Dallas Central Appraisal District commercial file |
| Roofing and new-construction permits | Depoii data engine when `DEPOII_ENGINE_URL` is set. Otherwise the [City of Fort Worth permit layer](https://mapit.fortworthtexas.gov/ags/rest/services/CIVIC/Permits/MapServer/0), the [City of Dallas permit map](https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/NewPermit_2008_2024/FeatureServer/0) through 12 Nov 2024, and ATTOM building permits for Dallas buildings |

The server refetches these about every 45 minutes. Use **Refresh** in the app to pull them again. Each successful pull is also written to a local SQLite file, `data/depoii.sqlite`. That file is the market record. Parcels and permits are updated in place. Hail reports are stored once. Warning polygons for a storm day are stored on the first pull of that day. A score snapshot is kept once per building per storm per calendar day, so a later refresh does not copy the same score again.

Inspection results are stored in that same file, not in the browser. `GET` and `POST /api/outcomes` read and write them. A later Depoii AI is not in this build. It should call `GET /api/intelligence?account=` or `GET /api/intelligence?storm=`, which returns a `card` string made only from stored facts. The card names Tarrant Appraisal District, the City of Fort Worth permit, or the NWS report. It does not invent a membrane, an email, or a phone number.

## What these feeds do not contain

Fort Worth and the City of Dallas are shown. Dallas parcels come from the Dallas Central Appraisal District commercial file, located on the DCAD map. For Dallas buildings inside the current hail swath, year built, size, roof cover, and permit history are read from ATTOM when `ATTOM_API_KEY` is set in `.env`. A Dallas building without that ATTOM read is not marked unresolved. The City of Dallas public GIS extract still supplies permits through 12 Nov 2024. Other cities are not shown. The appraisal rolls do not include membrane type, roof area, a facility director, or an email address. Depoii leaves those blank. A membrane is shown only when a permit text names one. The dollar figure on a property is appraisal building area times a $14 per square foot planning benchmark, not an appraisal and not a bid. Multi-story buildings overstate roof area.

Hail size on a property is the largest NWS report within 8 km, or the warning's hail tag when no report is that close. It is not a measurement taken on that roof. Reports marked estimated by the NWS are labeled estimated.

## Run locally

```bash
npm install
npm run dev      # http://localhost:4417
npm test
npm run lint
```

No API key is required. The basemap is CARTO/OSM. The warning polygons and report dots still draw if the tiles are blocked.

## Score

`src/lib/engine/score.ts` weights hail-report size, years since the TAD year built (or the latest re-roof permit before the storm), building area, and whether a Fort Worth roofing permit matched the street address after the storm. Buildings outside the warning polygons are capped at 25. Weights can be nudged from logged field outcomes on `/outcomes`.
