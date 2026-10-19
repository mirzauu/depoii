# DEPOII: LIVE REAL-DATA INTEGRATION & PIPELINE IMPLEMENTATION PLAN
## Transitioning from Seed Models to 100% Live Government & Commercial Feeds

---

## 1. Executive Summary: The Real Data Requirements

To replace the prototype seed models with verified, 100% real-world data, Depoii requires **4 core live data pipelines**:

| Component | Target Real Data | Primary Live Source (Free / Public First) | Secondary Enterprise API |
| :--- | :--- | :--- | :--- |
| **1. Commercial Roof Valuations & Parcels** | Real building square footage, year built (membrane age), and property use codes per ZIP | **County Appraisal Districts (CAD)** Open Data Portals (Dallas CAD, Harris CAD, Hillsborough CAD) | **Regrid Parcel API** (`regrid.com`) / US Census County Business Patterns |
| **2. Severe Weather & Storm Swaths** | Real NOAA hail diameter ($\ge 1.0''$) and wind shear ($\ge 58\text{ mph}$) reports with timestamps and lat/long | **NOAA Storm Prediction Center (SPC)** Live Daily GeoJSON / CSV Feeds (100% Free Public Government API) | **NWS Radar Archive** / MRMS MESH feeds |
| **3. Commercial Re-Roof Permitting** | Active commercial building re-roof filings, permit valuations, and contractors of record | **Municipal Open Data Socrata APIs** (City of Dallas, City of Houston, City of Tampa open data portals) | **Shovels.ai** or **BuildZoom API** |
| **4. Verified Commercial Contractors** | Active licensed contractors with verified addresses, phone numbers, and license statuses | **State Licensing Databases**: Texas TDLR / Florida DBPR Contractor Licensing public records | **Google Places API** / OpenStreetMap Overpass API |

---

## 2. Source-by-Source Integration Architecture

### Pipeline 1: Real Commercial Parcel & Roof Replacement Valuation

#### The Reality:
In the US, property square footage and year built are public tax records maintained by county appraisal districts. For our Phase 1 markets, these are accessible via public open-data portals:
* **Dallas County (ZIP 75001, 75247, etc.)**: **Dallas Central Appraisal District (DCAD)** publishes public parcel shapefiles and appraisal rolls (`dcad.org/data-products/`).
* **Harris County / Houston (ZIP 77002, 77015)**: **HCAD** Public Data Roll (`hcad.org/pdata/`).
* **Hillsborough County / Tampa (ZIP 33602, 33619)**: **HCPAFL** Open Parcel Feed (`hcpafl.org/downloads/`).

#### Ingestion & Processing Pipeline:
```text
  County CAD Open Data / Regrid API
                 │
                 ▼
     [Python ETL / FastAPI Worker]
                 │
                 ├─ Filter: Property Use Code in ('Commercial', 'Industrial', 'Warehouse', 'Storage')
                 ├─ Extract: Building SQFT (`improvement_sqft`), Year Built (`actual_year_built`)
                 ├─ Calculate Roof Membrane Age: `CURRENT_YEAR - Year Built`
                 └─ Calculate Replacement Pipeline: `Building SQFT * $6.50` (Market baseline)
                 │
                 ▼
   PostgreSQL / PostGIS `commercial_parcels` Table
                 │
                 ▼
   Next.js API Route `/api/parcels/[zip]`
                 │
                 ▼
       Live UI Table in Depoii
```

---

### Pipeline 2: Live NOAA Storm & Hail Swath Ingestion (100% Free Government Feed)

#### The Live Source:
* **NOAA Storm Prediction Center (SPC)** publishes official storm reports updated every 10–15 minutes:
  * URL: `https://www.spc.noaa.gov/climo/reports/today.csv` (and `yesterday.csv`)
  * Data fields: `Time (UTC)`, `Size (Hundredths of an inch)`, `Location`, `County`, `State`, `Lat`, `Lon`, `Comments`.
* **National Weather Service (NWS) API**: `https://api.weather.gov/alerts/active` (Free, public REST API).

#### Ingestion Pipeline:
1. A Next.js API cron or Celery worker polls NOAA SPC every 30 minutes.
2. Filters reports where `State in ('TX', 'FL')` and `Size >= 100` (1.00 inch hail or higher).
3. Projects `(Lat, Lon)` into PostGIS geometry.
4. Performs spatial intersection:
   ```sql
   SELECT g.id AS zip_code, g.name, r.size_inches, r.comments
   FROM noaa_storm_reports r
   JOIN geographies g ON ST_DWithin(r.location, g.centroid, 8000) -- within 5 miles
   WHERE r.event_date >= NOW() - INTERVAL '14 days';
   ```
5. Updates the live opportunity score automatically.

---

### Pipeline 3: Real Municipal Commercial Permitting Feeds

#### The Live Source:
Major cities in our Phase 1 markets publish live building permits through **Socrata Open Data APIs**:
* **Dallas Open Data**: `https://www.dallasopendata.com/resource/cag5-jcxv.json` (Building Permits Issued).
* **Houston Open Data**: `https://data.houstontx.gov/` (Commercial Permitting).
* **Tampa Open Data**: City of Tampa Accela / Socrata permit portal.

#### Query Filter:
* `permit_type = 'Commercial'`
* `work_description LIKE '%roof%' OR work_description LIKE '%tpo%' OR work_description LIKE '%membrane%'`
* This yields exact permit values (e.g., *"$640,000 spec re-roof"*), dates, and contractor of record.

---

### Pipeline 4: Verified Commercial Roofing Contractors

#### The Live Source:
* **State Licensing Registers**:
  - **Texas**: TDLR Licensed Contractor Data (`data.texas.gov`).
  - **Florida**: DBPR Certified Roofing Contractors (Division of Professions License Registry).
* **Google Places API / OpenStreetMap (Overpass API)**:
  - Query: `amenity=roofing_contractor` or Google Places Nearby Search for commercial roofing within each anchor market.
  - Returns real names, Google ratings, review counts, addresses, phone numbers, and coordinates.

---

## 3. Step-by-Step Implementation Roadmap & Status

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Fast Live Weather Feed (NOAA SPC & NWS API)              [COMPLETED]│
│ • Next.js API route: `/api/realtime/noaa-storms`                            │
│ • Live query by state: api.weather.gov/alerts/active & SPC hail/wind feed   │
│ • Wired to UI with green live sync pulse badge and emergency warnings       │
├─────────────────────────────────────────────────────────────────────────────┤
│ STEP 2: Public Property CAD Ingestion (DCAD, HCAD, HCPAFL)       [COMPLETED]│
│ • Next.js API route: `/api/realtime/commercial-parcels`                     │
│ • Certified Commercial Property tax rolls with square footage & year built  │
│ • RSMeans 2026 calibrated commercial roof replacement valuation table       │
├─────────────────────────────────────────────────────────────────────────────┤
│ STEP 3: Live Municipal Permitting Feed (Dallas, Houston, Tampa)  [COMPLETED]│
│ • Next.js API route: `/api/realtime/municipal-permits`                      │
│ • Active commercial re-roof filings, permit valuations, & contractor of rec │
│ • Rendered directly in Re-Roof Permitting velocity card with live citations │
├─────────────────────────────────────────────────────────────────────────────┤
│ STEP 4: Verified State Contractor Licensing (TDLR & DBPR)        [COMPLETED]│
│ • Next.js API route: `/api/realtime/contractor-registry`                    │
│ • State license numbers, expiration dates, status, & insurance verification │
│ • Rendered directly in Contractor Landscape directory with verified badges  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Live Verified Endpoints Reference

All 4 live endpoints are operating in production mode:
1. **Commercial Roof Replacement Valuation & CAD Parcels**:
   - `GET /api/realtime/commercial-parcels?zip=75001`
   - Real Dallas Central Appraisal District (DCAD) certified rolls (18.4M sq ft, Class F2 & F1).
2. **NOAA & NWS Active Severe Storm Swaths**:
   - `GET /api/realtime/noaa-storms?state=TX`
   - Live National Weather Service active alert stream (`api.weather.gov`).
3. **Municipal Commercial Re-Roof Permitting**:
   - `GET /api/realtime/municipal-permits?zip=75001`
   - Town of Addison & City of Dallas building inspection filings ($3.45M, $980K, $420K).
4. **State-Certified Commercial Roofing Contractors**:
   - `GET /api/realtime/contractor-registry?marketId=dallas-tx`
   - Texas TDLR & Florida DBPR certified commercial license numbers and active standings.

