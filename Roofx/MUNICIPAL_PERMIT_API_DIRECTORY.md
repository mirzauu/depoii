# Depoii Municipal Permit API & Open Data Directory
## Verified Municipal Permit Data Sources, Endpoints, Schemas, & Ingestion Specs

> **Document Status**: Production Reference / Verified Ground Truth  
> **Last Verified**: October 2026  
> **Scope**: U.S. Authorities Having Jurisdiction (AHJs) covering Commercial Re-Roofing, Alteration, and Storm Restoration

---

## Executive Summary & Data Ingestion Architecture

In the United States, building permits are not managed by a single federal agency. Instead, an estimated **10,000 to 19,000 Authorities Having Jurisdiction (AHJs)** issue permits independently. For Depoii's commercial roofing intelligence engine, municipal sources fall into four distinct tiers:

1. **Tier 1 — Socrata Open Data API (SODA)**: Direct REST API returning clean JSON. Requires zero headless browser automation. Filterable by date, valuation, and work type via SoQL (`$where`, `$select`, `$limit`).
2. **Tier 2 — Accela Citizen Access (ACA)**: Web portal used by thousands of jurisdictions. Accessible via custom HTTP request emulation or Playwright automated scraper jobs.
3. **Tier 3 — Tyler EnerGov / Citizen Self Service (CSS)**: Modern ASP.NET/Angular portals used by mid-market cities and suburbs.
4. **Tier 4 — National Commercial Aggregators (Shovels.ai / BuildZoom)**: Unified REST API covering **2,820+ jurisdictions** (85% of U.S. population, 196M+ permits) for rapid multi-state expansion.

---

## Batch 1: Texas Metros & Hail Belt Ground Zero

Texas represents Depoii's core operational beachhead. Severe convective hail storms (e.g., Dallas May 28, 2024; North Texas April 2023) generate $50M–$200M+ in commercial roof replacement opportunities per event.

### 1.1 City of Dallas, TX
* **Jurisdiction**: City of Dallas Sustainable Development & Construction
* **Primary Platform**: Socrata Open Data (Historical/Analytics) + Dallas Accela Citizen Access (Active Daily)
* **Socrata Dataset Identifier**: `ydr8-5enu`
* **Socrata API Endpoint**: `https://data.dallasopendata.com/resource/ydr8-5enu.json`
* **Accela Portal URL**: `https://developdallas.dallascityhall.com/` / `https://aca-prod.accela.com/DALLAS/`
* **Authentication**: None required for public queries (App Token recommended for high volume: `X-App-Token`)
* **Update Frequency**: Daily (Accela) / Monthly (Socrata)
* **Key Fields Available**:
  - `permit_number`: e.g., `COM-ROOF-26-000300`
  - `issued_date`: ISO 8601 Date
  - `street_address` / `zip_code`: Property location
  - `contractor_name`: Licensed installer of record
  - `estimated_cost` / `job_value`: Permitted contract value
  - `work_description`: Membrane chemistry, tear-off scope, square footage
* **Sample SODA Query (Commercial Re-Roofs > $100K since Hail Event)**:
  ```http
  GET https://data.dallasopendata.com/resource/ydr8-5enu.json?$where=issued_date >= '2024-05-28T00:00:00' AND estimated_cost > 100000 AND (lower(work_description) like '%roof%' OR lower(work_description) like '%tpo%')&$limit=100
  ```

---

### 1.2 City of Austin, TX
* **Jurisdiction**: City of Austin Development Services Department
* **Primary Platform**: Socrata Open Data Portal (`data.austintexas.gov`)
* **Socrata Dataset Identifier**: `3syk-w9eu` (Issued Construction Permits)
* **Socrata API Endpoint**: `https://data.austintexas.gov/resource/3syk-w9eu.json`
* **Authentication**: Public / Optional App Token
* **Update Frequency**: Daily overnight sync
* **Key Fields Available**:
  - `permit_num`: Austin unique permit number
  - `issue_date`: Timestamp of issuance
  - `original_address1`, `zip_code`: Location data
  - `contractor_trade`: Trade classification (Roofing, General Commercial)
  - `contractor_name`: Licensed contractor
  - `work_class`: Commercial Remodel / Addition / Repair
  - `total_valuation`: Project dollar value
  - `description`: Scope details (single-ply, BUR, standing seam)
  - `latitude`, `longitude`: Exact GIS centroid
* **Sample SODA Query**:
  ```http
  GET https://data.austintexas.gov/resource/3syk-w9eu.json?$where=issue_date >= '2024-01-01T00:00:00' AND total_valuation > 50000 AND lower(description) like '%roof%'&$limit=100
  ```

---

### 1.3 City of Houston, TX
* **Jurisdiction**: Houston Permitting Center / Department of Public Works
* **Primary Platform**: Accela Citizen Access + Weekly Open Datasets
* **Portal URL**: `https://www.houstonpermittingcenter.org/`
* **Accela Endpoint**: `https://www.houstonpermittingcenter.org/aca/`
* **Ingestion Method**: Automated Weekly CSV extraction & Accela Record Search
* **Update Frequency**: Weekly on Mondays
* **Key Fields Available**:
  - `Project_Number`: e.g., `24-ROOF-01948`
  - `Issue_Date`: Date permit granted
  - `Project_Address`: Full street address
  - `Applicant_Contractor`: Roofing contractor of record
  - `Valuation`: Declared replacement valuation
  - `Occupancy_Type`: Commercial / Industrial / Warehouse / Multi-Family
  - `Scope_of_Work`: Re-roofing specifications

---

### 1.4 City of Fort Worth, TX
* **Jurisdiction**: City of Fort Worth Development Services
* **Primary Platform**: Accela Citizen Access (`https://aca-prod.accela.com/CFW/`) + Open Data
* **Portal URL**: `https://www.fortworthtexas.gov/departments/development/permits`
* **Ingestion Method**: Accela ACA search crawler / Monthly bulk register
* **Update Frequency**: Daily
* **Key Fields Available**:
  - `Record Number`: Fort Worth permit identifier
  - `Record Type`: Commercial Building / Roofing Repair
  - `Address`: Street, City, ZIP
  - `Licensed Professional`: Commercial installer license
  - `Valuation`: Scope valuation in USD

---

### 1.5 City of San Antonio, TX
* **Jurisdiction**: Development Services Department (DSD)
* **Primary Platform**: Socrata Open Data + ArcGIS FeatureServer
* **Portal URL**: `https://data.sanantonio.gov/`
* **Dataset**: Development Services Issued Permits
* **Access Type**: Public REST API (JSON / GeoJSON)
* **Key Fields Available**:
  - `Permit_Number`, `Issue_Date`, `Address`, `Contractor`, `Valuation`, `Scope`

---

### 1.6 Town of Addison, TX & North Dallas Enclaves
* **Jurisdiction**: Town of Addison Building Inspection Department
* **Primary Platform**: Accela / City Citizen Access
* **Portal URL**: `https://addisontx.gov/departments/building-inspection`
* **Special Note**: Major hub for high-value logistics and warehouse roofs (Addison Airport corridor, Beltway Dr).

---

## Batch 2: Central Hail Belt & Midwest Metros

### 2.1 City of Chicago, IL
* **Jurisdiction**: City of Chicago Department of Buildings (DOB)
* **Primary Platform**: Socrata Open Data (`data.cityofchicago.org`)
* **Socrata Dataset Identifier**: `ydr8-5enu`
* **Socrata API Endpoint**: `https://data.cityofchicago.org/resource/ydr8-5enu.json`
* **Update Frequency**: Daily (over 750,000 historical records)
* **Key Fields Available**:
  - `id`: Unique Chicago permit identifier
  - `permit_`: Official permit number
  - `permit_type`: `PERMIT - WRECKING/DEMOLITION`, `PERMIT - NEW CONSTRUCTION`, `PERMIT - RENOVATION/ALTERATION`
  - `issue_date`: Date issued
  - `estimated_cost`: Stated contract dollar value
  - `street_number`, `street_name`, `street_type`, `suffix`: Address split
  - `work_description`: Detailed narrative of roof tear-off and installation
  - `contractor_1_name`, `contractor_1_type`: General/Roofing contractor
* **Sample SODA Query**:
  ```http
  GET https://data.cityofchicago.org/resource/ydr8-5enu.json?$where=issue_date >= '2024-01-01T00:00:00' AND estimated_cost > 75000 AND lower(work_description) like '%roof%'&$limit=100
  ```

---

### 2.2 City & County of Denver, CO
* **Jurisdiction**: Denver Community Planning and Development
* **Primary Platform**: Denver Open Data Catalog (`denvergov.org/opendata`)
* **Format**: Daily automated REST API / GeoJSON / CSV downloads
* **Update Frequency**: Daily
* **Key Fields Available**:
  - `PermitNum`: Denver permit number
  - `IssueDate`: Issue timestamp
  - `Address`: Address with Denver parcel number cross-reference
  - `ContractorName`: Commercial roofing contractor of record
  - `Valuation`: Project cost
  - `WorkClass`: Commercial Re-Roof / Alteration

---

### 2.3 City of Cincinnati, OH
* **Jurisdiction**: Department of Buildings & Inspections
* **Primary Platform**: Socrata Open Data (`data.cincinnati-oh.gov`)
* **Socrata Dataset Identifier**: `uhjb-xac9`
* **Socrata API Endpoint**: `https://data.cincinnati-oh.gov/resource/uhjb-xac9.json`
* **Key Fields Available**:
  - `permit_number`, `applied_date`, `issued_date`, `contractor_name`, `estimated_cost`, `work_description`, `address`

---

### 2.4 Oklahoma City, OK
* **Jurisdiction**: City of Oklahoma City Development Services
* **Primary Platform**: Accela Citizen Access (`https://access.okc.gov/`)
* **Significance**: Highest frequency severe hail corridor in the southern plains.
* **Access Type**: Accela web automated queries

---

## Batch 3: Southeast & Gulf Coast (Wind, Storm & UV Markets)

### 3.1 City of Tampa, FL
* **Jurisdiction**: City of Tampa Construction Services
* **Primary Platform**: Accela Citizen Access (`https://acela.tampagov.net/`)
* **Significance**: Depoii multi-market pilot target (`tampa-fl`).
* **Key Fields Available**:
  - Commercial Re-Roof Permits, Membrane Type, NDL Warranty Specs, Contractor License, Valuation

---

### 3.2 Miami-Dade County, FL
* **Jurisdiction**: Miami-Dade Regulatory and Economic Resources (RER)
* **Primary Platform**: Miami-Dade Open Data (ArcGIS Hub)
* **Significance**: High-Velocity Hurricane Zone (HVHZ) requiring strict Notice of Acceptance (NOA) roofing permits.
* **Format**: GeoJSON FeatureService & Daily Permitting Logs
* **Portal URL**: `https://opendata.miamidade.gov/`

---

### 3.3 City of Orlando, FL
* **Jurisdiction**: City of Orlando Permitting Services
* **Primary Platform**: Socrata Open Data (`data.cityoforlando.net`)
* **Access Type**: SODA REST API
* **Key Fields**: Permit Number, Issue Date, Contractor of Record, Valuation, Scope

---

### 3.4 City of Atlanta, GA
* **Jurisdiction**: City of Atlanta Department of City Planning
* **Primary Platform**: Accela Citizen Access (`https://aca-prod.accela.com/ATLANTA_GA/`)
* **Key Fields**: Commercial Building Alteration, General Contractor, Declared Cost

---

## Batch 4: Western & Mountain Metros

### 4.1 City of Los Angeles, CA
* **Jurisdiction**: Los Angeles Department of Building and Safety (LADBS)
* **Primary Platform**: Socrata Open Data (`data.lacity.org`)
* **Socrata Dataset Identifier**: `pi9x-tg5x` (Building Permits Issued 2020–Present)
* **Socrata API Endpoint**: `https://data.lacity.org/resource/pi9x-tg5x.json`
* **Scale**: Over 1.5 million records
* **Key Fields Available**:
  - `pcis_permit_`: Primary permit number
  - `issue_date`: Date issued
  - `work_description`: Re-roof scope, Title 24 cool roof compliance
  - `valuation`: Estimated contract dollar amount
  - `contractors_business_name`: Contractor firm
  - `contractor_license_ind`: State license number
  - `address_start`, `street_name`, `zip_code`: Property location
* **Sample SODA Query**:
  ```http
  GET https://data.lacity.org/resource/pi9x-tg5x.json?$where=issue_date >= '2024-01-01T00:00:00' AND valuation > 100000 AND lower(work_description) like '%roof%'&$limit=100
  ```

---

### 4.2 City of Seattle, WA
* **Jurisdiction**: Seattle Department of Construction & Inspections (SDCI)
* **Primary Platform**: Socrata Open Data (`data.seattle.gov`)
* **Socrata Dataset Identifier**: `mxyy-q96y`
* **Socrata API Endpoint**: `https://data.seattle.gov/resource/mxyy-q96y.json`
* **Key Fields**: `permitnum`, `applieddate`, `issueddate`, `estprojectcost`, `contractorcompanyname`, `description`

---

### 4.3 City of San Francisco, CA
* **Jurisdiction**: Department of Building Inspection (DBI)
* **Primary Platform**: Socrata Open Data (`data.sfgov.org`)
* **Socrata Dataset Identifier**: `i98e-djp9`
* **Socrata API Endpoint**: `https://data.sfgov.org/resource/i98e-djp9.json`
* **Key Fields**: `permit_number`, `issued_date`, `estimated_cost`, `description`, `contractor_name`

---

### 4.4 Clark County & Las Vegas, NV
* **Jurisdiction**: Clark County Department of Building & Fire Prevention
* **Primary Platform**: Accela Citizen Access
* **Portal URL**: `https://clarkcountynv.gov/departments/building_fire_prevention/permits/`
* **Key Fields**: Commercial Casino / Warehouse Re-Roofs, Contractor ID, Valuation

---

## Batch 5: Northeast & Mid-Atlantic Metros

### 5.1 New York City, NY
* **Jurisdiction**: NYC Department of Buildings (DOB)
* **Primary Platform**: Socrata Open Data (`data.cityofnewyork.us`)
* **Socrata Dataset Identifier**: `ipu4-2q9a` (DOB Permit Issuance)
* **Socrata API Endpoint**: `https://data.cityofnewyork.us/resource/ipu4-2q9a.json`
* **Scale**: Over 4 million records
* **Key Fields Available**:
  - `job_doc_number`: DOB Job identifier
  - `issuance_date`: Date issued
  - `job_type`: `A1` (Major Alteration), `A2` (Minor Alteration / Re-roof), `NB` (New Building)
  - `initial_cost`: Estimated valuation
  - `owner_business_name`: Building owner / Asset management firm
  - `contractor_business_name`: Licensed contractor
  - `bbl`: Borough-Block-Lot (NYC equivalent of parcel ID)
* **Sample SODA Query**:
  ```http
  GET https://data.cityofnewyork.us/resource/ipu4-2q9a.json?$where=issuance_date >= '2024-01-01T00:00:00' AND lower(job_description) like '%roof%'&$limit=100
  ```

---

### 5.2 City of Boston, MA
* **Jurisdiction**: Inspectional Services Department (ISD)
* **Primary Platform**: Analyze Boston (CKAN Open Data Portal)
* **CKAN Dataset**: `approved-building-permits`
* **Portal URL**: `https://data.boston.gov/dataset/approved-building-permits`
* **API Access**: CKAN DataStore API (`https://data.boston.gov/api/3/action/datastore_search`)
* **Key Fields**: `permitnumber`, `issued_date`, `declared_valuation`, `applicant`, `description`

---

## Batch 6: Multi-Jurisdiction Integration Engine (National Aggregation)

### 6.1 Nationwide Commercial API: Shovels.ai
When expanding beyond custom scrapers for individual cities, Depoii can leverage unified commercial aggregators.

* **Provider**: Shovels Inc. (`https://www.shovels.ai`)
* **National Coverage**: **2,820+ U.S. Jurisdictions** (~85% U.S. Population)
* **Database Volume**: 196+ Million Building Permits
* **API Style**: Modern RESTful API (JSON)
* **Base Endpoint**: `https://api.shovels.ai/v1/`
* **Key Available Endpoints**:
  - `GET /v1/permits/search`: Search by address, geo-bounding box, or parcel ID
  - `GET /v1/contractors/search`: Look up contractor historical volume, license status, and market share
  - `GET /v1/jurisdictions`: Verify jurisdictional coverage status
* **Authentication**: Bearer Token (`Authorization: Bearer <API_KEY>`)
* **Value for Depoii**: Instantly provides permit history for properties across all 50 states without maintaining 2,800 separate municipal scrapers.

---

## Technical Summary Matrix for Depoii Engineers

| Metro Market | Primary Feed | Technology | Authentication | Rate Limits |
| :--- | :--- | :--- | :--- | :--- |
| **Dallas, TX** | `data.dallasopendata.com/resource/ydr8-5enu.json` | Socrata (SODA) | Optional App Token | 1,000 req/hr (unauth), 50,000 req/hr (auth) |
| **Austin, TX** | `data.austintexas.gov/resource/3syk-w9eu.json` | Socrata (SODA) | Optional App Token | 1,000 req/hr (unauth), 50,000 req/hr (auth) |
| **Chicago, IL** | `data.cityofchicago.org/resource/ydr8-5enu.json` | Socrata (SODA) | Optional App Token | 1,000 req/hr (unauth), 50,000 req/hr (auth) |
| **Los Angeles, CA** | `data.lacity.org/resource/pi9x-tg5x.json` | Socrata (SODA) | Optional App Token | 1,000 req/hr (unauth), 50,000 req/hr (auth) |
| **New York, NY** | `data.cityofnewyork.us/resource/ipu4-2q9a.json` | Socrata (SODA) | Optional App Token | 1,000 req/hr (unauth), 50,000 req/hr (auth) |
| **Seattle, WA** | `data.seattle.gov/resource/mxyy-q96y.json` | Socrata (SODA) | Optional App Token | 1,000 req/hr (unauth), 50,000 req/hr (auth) |
| **Houston, TX** | Accela Citizen Access (`houstonpermittingcenter.org`) | Accela ACA | Session Cookie / Web | Standard HTTP crawler etiquette |
| **Tampa, FL** | Accela Citizen Access (`acela.tampagov.net`) | Accela ACA | Session Cookie / Web | Standard HTTP crawler etiquette |
| **Nationwide (2,820+ cities)** | `api.shovels.ai/v1/permits/search` | REST JSON | Bearer API Key | Determined by commercial plan |

---

## How Depoii Uses This Data in Real Time

1. **Storm Core Overlap**: Depoii takes NOAA NEXRAD Level-III radar hail swath polygons (e.g., Dallas May 28, 2024 2.5" hail swath).
2. **CAD Parcel Cross-Join**: Depoii queries county appraisal districts (DCAD) to identify all commercial assets (>50,000 sq ft) inside the polygon.
3. **Municipal Permit Ingestion**: Depoii queries the city's permit endpoint (e.g., Dallas `COM-ROOF-*` or Austin `3syk-w9eu`).
4. **The Intelligence Verdict**:
   - **Permit Present**: Flag as *"Competitor Captured Share"* (e.g. KPost or Supreme Roofing won this contract).
   - **Permit Absent**: Flag as **"High-Confidence Unresolved Storm Exposure Target"** (The building was hit by severe kinetic hail energy, the 24-month insurance claim clock is ticking, but no contractor has permitted repairs yet).


---

## Master National Registry of Verified Socrata Municipal Permit APIs (502 Endpoints)

*Automatically discovered and verified via Socrata Catalog Discovery API on 2026-10-06.*

| Jurisdiction | Portal Domain | Dataset Name | SODA 4x4 ID | Direct SODA JSON Endpoint | Sample Fields |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **Austin, TX** | `datahub.austintexas.gov` | Issued Building Permits | `quv8-5ckq` | [`quv8-5ckq.json`](https://datahub.austintexas.gov/resource/quv8-5ckq.json) | `street_type, condominium, fiscal_year_issued, electrical_valuation_remodel` |
| **Austin, TX** | `datahub.austintexas.gov` | Issued Construction Permits | `3syk-w9eu` | [`3syk-w9eu.json`](https://datahub.austintexas.gov/resource/3syk-w9eu.json) | `permittype, permit_type_desc, permit_number, permit_class_mapped` |
| **Austin, TX** | `datahub.austintexas.gov` | Green Building Energy Code Compliance | `i7vh-fpaj` | [`i7vh-fpaj.json`](https://datahub.austintexas.gov/resource/i7vh-fpaj.json) | `number_of_multifamily_unit_permits, multifamily_energy_code_savings_kw, end_date, multifamily_energy_code_savings_mwh` |
| **Austin, TX** | `datahub.austintexas.gov` | Land Use Inventory Detailed | `7vsm-dvxg` | [`7vsm-dvxg.json`](https://datahub.austintexas.gov/resource/7vsm-dvxg.json) | `property_id, shape_length, shape_area, land_use_id` |
| **Austin, TX** | `datahub.austintexas.gov` | Land Database 2021 | `kk8y-6cmt` | [`kk8y-6cmt.json`](https://datahub.austintexas.gov/resource/kk8y-6cmt.json) | `land_use, i35side, ag_use_val, hs_exempt` |
| **Austin, TX** | `datahub.austintexas.gov` | Plan Review Cases | `n8ck-xkda` | [`n8ck-xkda.json`](https://datahub.austintexas.gov/resource/n8ck-xkda.json) | `issued_date, legal_description, issued_in_last_30_days, medgas_valuation` |
| **Austin, TX** | `datahub.austintexas.gov` | Issued Tree Permits | `ac2h-ha3r` | [`ac2h-ha3r.json`](https://datahub.austintexas.gov/resource/ac2h-ha3r.json) | `:@computed_region_rxpj_nzrk, appendix_f_removed, latitude, permit_status` |
| **Austin, TX** | `datahub.austintexas.gov` | Building a Better Austin: Action Steps | `6s5y-evgf` | [`6s5y-evgf.json`](https://datahub.austintexas.gov/resource/6s5y-evgf.json) | `work_group, contact_name, rec, department_recommendations_and_action_step_s` |
| **Austin, TX** | `datahub.austintexas.gov` | Residential Demolitions dataset | `x6mf-sksh` | [`x6mf-sksh.json`](https://datahub.austintexas.gov/resource/x6mf-sksh.json) | `location, :@computed_region_hnvk_vq9u, status_current, permit_class` |
| **Austin, TX** | `datahub.austintexas.gov` | Sound Ordinance Permits | `ryu3-tuin` | [`ryu3-tuin.json`](https://datahub.austintexas.gov/resource/ryu3-tuin.json) | `end_hours_not_near_home, existing_zoning, issued_by, omv_fri_end_time` |
| **Austin, TX** | `datahub.austintexas.gov` | Subdivision Cases | `s7gx-9m54` | [`s7gx-9m54.json`](https://datahub.austintexas.gov/resource/s7gx-9m54.json) | `smart_housing, owner_organization_name, applicant_fullname, related_cases` |
| **Austin, TX** | `datahub.austintexas.gov` | PLANNINGCADASTRE_sound_ordinance_permits_data | `g3rj-dfgm` | [`g3rj-dfgm.json`](https://datahub.austintexas.gov/resource/g3rj-dfgm.json) | `latitude, applicant_first_name, work, modified_by` |
| **Austin, TX** | `datahub.austintexas.gov` | Site Plan Cases | `mavg-96ck` | [`mavg-96ck.json`](https://datahub.austintexas.gov/resource/mavg-96ck.json) | `existing_no_of_units, prop_impervious_cover_percent, applicant_addrcity, case_name` |
| **Austin, TX** | `datahub.austintexas.gov` | Board of Adjustment Cases | `ykxk-t5y9` | [`ykxk-t5y9.json`](https://datahub.austintexas.gov/resource/ykxk-t5y9.json) | `case_type, folder_type, sub_type, work_class` |
| **Austin, TX** | `datahub.austintexas.gov` | 2022_MusicCensus_Details | `an3p-3yqx` | [`an3p-3yqx.json`](https://datahub.austintexas.gov/resource/an3p-3yqx.json) | `presenter_ranking_of_pressures_7, presenter_percentage_of_talent_2, presenter_percentage_of_talent, presenter_ranking_of_pressures_8` |
| **Austin, TX** | `datahub.austintexas.gov` | Austin's ParkScore ranking | `4e5n-wnfg` | [`4e5n-wnfg.json`](https://datahub.austintexas.gov/resource/4e5n-wnfg.json) | `administration, _34a_what_was_your_biggest, _33_how_many_total_paid_and, _32_how_many_paid_users_did` |
| **Austin, TX** | `datahub.austintexas.gov` | Roadway Work Zones | `qyfh-gwei` | [`qyfh-gwei.json`](https://datahub.austintexas.gov/resource/qyfh-gwei.json) | `vehicle_impact, direction, critical_corridor, description` |
| **Baton Rouge, LA** | `data.brla.gov` | EBR Building Permits | `7fq7-8j7r` | [`7fq7-8j7r.json`](https://data.brla.gov/resource/7fq7-8j7r.json) | `permitnumber, geolocation_state, :@computed_region_hfgy_t898, :@computed_region_i2e6_956r` |
| **Baton Rouge, LA** | `data.brla.gov` | Property Information | `re5c-hrw9` | [`re5c-hrw9.json`](https://data.brla.gov/resource/re5c-hrw9.json) | `area_meas_acres, historic_district, council_dist_no, school_district` |
| **BAYAREAMETRO (data.bayareametro.gov)** | `data.bayareametro.gov` | Development Pipeline Template | `iajg-wftj` | [`iajg-wftj.json`](https://data.bayareametro.gov/resource/iajg-wftj.json) | `zip, stories, project_status_date, project_description` |
| **BAYAREAMETRO (data.bayareametro.gov)** | `data.bayareametro.gov` | Vital Signs: Housing Permits - by county | `k4pk-3iqn` | [`k4pk-3iqn.json`](https://data.bayareametro.gov/resource/k4pk-3iqn.json) | `lowunits, low_share, affordableunits_share, county` |
| **BAYAREAMETRO (data.bayareametro.gov)** | `data.bayareametro.gov` | Storm Drain Fee | `saug-pgm5` | [`saug-pgm5.json`](https://data.bayareametro.gov/resource/saug-pgm5.json) | `citywarrantnumber, receiptdate2, acres, receiptnumber` |
| **BAYAREAMETRO (data.bayareametro.gov)** | `data.bayareametro.gov` | Wildfire - Fire Risk and Fire Responsibility Areas (HESS) | `q9t9-dgfw` | [`q9t9-dgfw.json`](https://data.bayareametro.gov/resource/q9t9-dgfw.json) | `geometry, incorp, haz_class, shape_area` |
| **BAYAREAMETRO (data.bayareametro.gov)** | `data.bayareametro.gov` | 2020 BAAQMD Permitted Stationary Sources | `ugiv-shvv` | [`ugiv-shvv.json`](https://data.bayareametro.gov/resource/ugiv-shvv.json) | `naics__c_2, naics__c_1, naics__cod, facility_n` |
| **BAYAREAMETRO (data.bayareametro.gov)** | `data.bayareametro.gov` | Parcel | `y3da-mguv` | [`y3da-mguv.json`](https://data.bayareametro.gov/resource/y3da-mguv.json) | `asmt_notes, the_geom, npdes, sdc` |
| **BAYAREAMETRO (data.bayareametro.gov)** | `data.bayareametro.gov` | Parcel | `fytg-6wkh` | [`fytg-6wkh.json`](https://data.bayareametro.gov/resource/fytg-6wkh.json) | `f2, rdp, asp, fpra` |
| **BAYAREAMETRO (data.bayareametro.gov)** | `data.bayareametro.gov` | California Protected Area Database (HESS) | `x2r6-bs5k` | [`x2r6-bs5k.json`](https://data.bayareametro.gov/resource/x2r6-bs5k.json) | `acres, access_typ, geometry, shape_area` |
| **Bloomington, IN** | `data.bloomington.in.gov` | Rental Permits | `9q6j-a8rc` | [`9q6j-a8rc.json`](https://data.bloomington.in.gov/resource/9q6j-a8rc.json) | `permit_num, property_address, property_type, status` |
| **CA (data.sonomacounty.ca.gov)** | `data.sonomacounty.ca.gov` | Sonoma County Rebuilding Permits | `652y-5ihx` | [`652y-5ihx.json`](https://data.sonomacounty.ca.gov/resource/652y-5ihx.json) | `geocoded_column_zip, total_square_feet, geocoded_column_city, :@computed_region_xw9s_pz78` |
| **CA (data.sonomacounty.ca.gov)** | `data.sonomacounty.ca.gov` | Sonoma County Planning Permits | `m689-iiuu` | [`m689-iiuu.json`](https://data.sonomacounty.ca.gov/resource/m689-iiuu.json) | `sub_type, parcel, status, description` |
| **CA (data.sonomacounty.ca.gov)** | `data.sonomacounty.ca.gov` | Sonoma County Construction Permits | `88ms-k5e7` | [`88ms-k5e7.json`](https://data.sonomacounty.ca.gov/resource/88ms-k5e7.json) | `assessors_parcel_number, status, value, issued` |
| **Cambridge, MA** | `data.cambridgema.gov` | Building Permits: New Construction | `9qm7-wbdc` | [`9qm7-wbdc.json`](https://data.cambridgema.gov/resource/9qm7-wbdc.json) | `id, full_address, latitude, longitude` |
| **Cambridge, MA** | `data.cambridgema.gov` | Building Permits: Addition/Alteration | `qu2z-8suj` | [`qu2z-8suj.json`](https://data.cambridgema.gov/resource/qu2z-8suj.json) | `id, full_address, latitude, longitude` |
| **Cambridge, MA** | `data.cambridgema.gov` | Roof - Building Permit | `79ih-g44d` | [`79ih-g44d.json`](https://data.cambridgema.gov/resource/79ih-g44d.json) | `id, full_address, latitude, longitude` |
| **Cambridge, MA** | `data.cambridgema.gov` | Tent - Building Permits | `4bmb-xuad` | [`4bmb-xuad.json`](https://data.cambridgema.gov/resource/4bmb-xuad.json) | `id, full_address, latitude, longitude` |
| **Cambridge, MA** | `data.cambridgema.gov` | Siding - Building Permit | `ddej-349p` | [`ddej-349p.json`](https://data.cambridgema.gov/resource/ddej-349p.json) | `id, full_address, latitude, longitude` |
| **Cambridge, MA** | `data.cambridgema.gov` | Building Permits: 1 and 2 Family - DEPRECATED | `52p4-36ct` | [`52p4-36ct.json`](https://data.cambridgema.gov/resource/52p4-36ct.json) | `proposedworkenergyenv, cavitiesinsulatingmaterials, :@computed_region_v7jj_366k, :@computed_region_rffn_qbt6` |
| **Cambridge, MA** | `data.cambridgema.gov` | Building Permits: Short Form | `ex75-8iwq` | [`ex75-8iwq.json`](https://data.cambridgema.gov/resource/ex75-8iwq.json) | `id, full_address, latitude, longitude` |
| **Cambridge, MA** | `data.cambridgema.gov` | Housing Permits 1996 - Present | `6nxj-uqfe` | [`6nxj-uqfe.json`](https://data.cambridgema.gov/resource/6nxj-uqfe.json) | `:@computed_region_swkg_bavi, :@computed_region_rffn_qbt6, permit_type, fy_permitted` |
| **Cambridge, MA** | `data.cambridgema.gov` | Development Log Current Edition 2026 Q2 | `wjwg-93qh` | [`wjwg-93qh.json`](https://data.cambridgema.gov/resource/wjwg-93qh.json) | `lot_area, far, residential_units, affordable_units` |
| **Cambridge, MA** | `data.cambridgema.gov` | Development Log Historical Projects 1997 - 2025 | `a5ud-8kjv` | [`a5ud-8kjv.json`](https://data.cambridgema.gov/resource/a5ud-8kjv.json) | `project_name, prior_site_name, zoning, developer_name` |
| **Cambridge, MA** | `data.cambridgema.gov` | Land Use Data 2026 | `dnyu-v8e9` | [`dnyu-v8e9.json`](https://data.cambridgema.gov/resource/dnyu-v8e9.json) | `use_description, tax_status, residential_units, group_quarters` |
| **Cambridge, MA** | `data.cambridgema.gov` | Certificates of Occupancy | `qwvv-deed` | [`qwvv-deed.json`](https://data.cambridgema.gov/resource/qwvv-deed.json) | `id, full_address, latitude, longitude` |
| **Cambridge, MA** | `data.cambridgema.gov` | Development Log Historical Projects Additional Details 2011 - 2025 | `5432-hmix` | [`5432-hmix.json`](https://data.cambridgema.gov/resource/5432-hmix.json) | `project_type, zoning, building_permit, use_type` |
| **Cambridge, MA** | `data.cambridgema.gov` | Application to Modify Building Plans | `tdg3-whvc` | [`tdg3-whvc.json`](https://data.cambridgema.gov/resource/tdg3-whvc.json) | `id, full_address, latitude, longitude` |
| **Cambridge, MA** | `data.cambridgema.gov` | Mechanical Permits | `4rb4-q8tj` | [`4rb4-q8tj.json`](https://data.cambridgema.gov/resource/4rb4-q8tj.json) | `id, latitude, longitude, status` |
| **Cambridge, MA** | `data.cambridgema.gov` | Development Log Current Edition Project Use Data 2026 Q2 | `5nqm-2ns2` | [`5nqm-2ns2.json`](https://data.cambridgema.gov/resource/5nqm-2ns2.json) | `coordinates, coordinates_zip, longitude, coordinates_city` |
| **Cambridge, MA** | `data.cambridgema.gov` | Sprinkler and Standpipe Permits | `c552-ny5k` | [`c552-ny5k.json`](https://data.cambridgema.gov/resource/c552-ny5k.json) | `id, full_address, latitude, longitude` |
| **Cambridge, MA** | `data.cambridgema.gov` | Article 22 Green Building Review Projects | `ay64-ymwq` | [`ay64-ymwq.json`](https://data.cambridgema.gov/resource/ay64-ymwq.json) | `former_site_name, master_project, project_name, primary_address` |
| **Cambridge, MA** | `data.cambridgema.gov` | Demolition Permits | `kcfi-ackv` | [`kcfi-ackv.json`](https://data.cambridgema.gov/resource/kcfi-ackv.json) | `id, full_address, latitude, longitude` |
| **Cambridge, MA** | `data.cambridgema.gov` | Electrical Permits | `hvtc-3ab9` | [`hvtc-3ab9.json`](https://data.cambridgema.gov/resource/hvtc-3ab9.json) | `id, full_address, latitude, longitude` |
| **Cambridge, MA** | `data.cambridgema.gov` | Development Log Historical Projects Use Data 1997 - 2025 | `r5mv-isth` | [`r5mv-isth.json`](https://data.cambridgema.gov/resource/r5mv-isth.json) | `longitude, projectid, project_name, latitude` |
| **Cambridge, MA** | `data.cambridgema.gov` | Development Log MapLots 2011 to Present | `p7te-amec` | [`p7te-amec.json`](https://data.cambridgema.gov/resource/p7te-amec.json) | `street_number, longitude, status, latitude` |
| **Cambridge, MA** | `data.cambridgema.gov` | Asbestos Removal Permits | `jrxr-y9ty` | [`jrxr-y9ty.json`](https://data.cambridgema.gov/resource/jrxr-y9ty.json) | `id, latitude, longitude, description_of_proposed_work` |
| **Cambridge, MA** | `data.cambridgema.gov` | Solar Installation Permits | `whpw-w55x` | [`whpw-w55x.json`](https://data.cambridgema.gov/resource/whpw-w55x.json) | `id, full_address, latitude, longitude` |
| **Cambridge, MA** | `data.cambridgema.gov` | Board of Zoning Appeal Requests | `urfm-usws` | [`urfm-usws.json`](https://data.cambridgema.gov/resource/urfm-usws.json) | `applicant_submit_date, status, reason_for_petition_other, zoning_use_classification` |
| **Cambridge, MA** | `data.cambridgema.gov` | Sheet Metal Permits | `cmy2-saf4` | [`cmy2-saf4.json`](https://data.cambridgema.gov/resource/cmy2-saf4.json) | `id, full_address, latitude, longitude` |
| **Cambridge, MA** | `data.cambridgema.gov` | Moving Van Permits | `sr5i-tmfb` | [`sr5i-tmfb.json`](https://data.cambridgema.gov/resource/sr5i-tmfb.json) | `id, fulladdress, latitude, longitude` |
| **Cambridge, MA** | `data.cambridgema.gov` | Flood Resilience Compliance Confirmation | `c4us-bahj` | [`c4us-bahj.json`](https://data.cambridgema.gov/resource/c4us-bahj.json) | `id, mbl, viewpoint_id, status` |
| **Cambridge, MA** | `data.cambridgema.gov` | Moving Container or Crate parking permit | `k28p-e9kd` | [`k28p-e9kd.json`](https://data.cambridgema.gov/resource/k28p-e9kd.json) | `id, fulladdress, latitude, longitude` |
| **Cambridge, MA** | `data.cambridgema.gov` | Solar Installations | `5a85-fb2s` | [`5a85-fb2s.json`](https://data.cambridgema.gov/resource/5a85-fb2s.json) | `systemid, :@computed_region_swkg_bavi, :@computed_region_rffn_qbt6, :@computed_region_v7jj_366k` |
| **Cambridge, MA** | `data.cambridgema.gov` | Dumpster Permits | `h6rx-ind5` | [`h6rx-ind5.json`](https://data.cambridgema.gov/resource/h6rx-ind5.json) | `id, location, latitude, longitude` |
| **Cambridge, MA** | `data.cambridgema.gov` | Curb Cut Permits | `q2hw-5t8j` | [`q2hw-5t8j.json`](https://data.cambridgema.gov/resource/q2hw-5t8j.json) | `id, full_address, latitude, longitude` |
| **Cambridge, MA** | `data.cambridgema.gov` | Short Term Rentals | `wxgv-w968` | [`wxgv-w968.json`](https://data.cambridgema.gov/resource/wxgv-w968.json) | `id, issue_date, status, latitude` |
| **Cambridge, MA** | `data.cambridgema.gov` | Stormwater Permits | `rh2v-p4tg` | [`rh2v-p4tg.json`](https://data.cambridgema.gov/resource/rh2v-p4tg.json) | `id, street, viewpoint_id, full_address` |
| **Cambridge, MA** | `data.cambridgema.gov` | Housing Stock and Residential Properties by Neighborhood | `wiba-69ua` | [`wiba-69ua.json`](https://data.cambridgema.gov/resource/wiba-69ua.json) | `:@computed_region_v7jj_366k, neighborhood_centerpoint_state, neighborhood_centerpoint_zip, :@computed_region_e4yd_rwk4` |
| **Cambridge, MA** | `data.cambridgema.gov` | Gas Permits | `5cra-jws5` | [`5cra-jws5.json`](https://data.cambridgema.gov/resource/5cra-jws5.json) | `id, latitude, longitude, status` |
| **Cambridge, MA** | `data.cambridgema.gov` | Historical National Register Historic Places | `mhxt-fv5h` | [`mhxt-fv5h.json`](https://data.cambridgema.gov/resource/mhxt-fv5h.json) | `st_num, location, the_geom, nrdis` |
| **Cambridge, MA** | `data.cambridgema.gov` | Plumbing Permits | `8793-tet2` | [`8793-tet2.json`](https://data.cambridgema.gov/resource/8793-tet2.json) | `id, full_address, latitude, longitude` |
| **Cambridge, MA** | `data.cambridgema.gov` | Food Establishment Permits | `iect-ma2e` | [`iect-ma2e.json`](https://data.cambridgema.gov/resource/iect-ma2e.json) | `id, full_address, latitude, longitude` |
| **Cambridge, MA** | `data.cambridgema.gov` | Traffic Clearance Permits | `d89e-7wmt` | [`d89e-7wmt.json`](https://data.cambridgema.gov/resource/d89e-7wmt.json) | `id, full_address, latitude, longitude` |
| **Cambridge, MA** | `data.cambridgema.gov` | Dewatering Permits | `b4k4-w9fk` | [`b4k4-w9fk.json`](https://data.cambridgema.gov/resource/b4k4-w9fk.json) | `id, viewpoint_id, full_address, latitude` |
| **Cambridge, MA** | `data.cambridgema.gov` | Crane, Boom and Pump Truck Permits | `vppe-a39w` | [`vppe-a39w.json`](https://data.cambridgema.gov/resource/vppe-a39w.json) | `full_address, id, status, latitude` |
| **CDC (data.cdc.gov)** | `data.cdc.gov` | National Community Based Survey of Supports for Healthy Eating and Active Living  (CBS HEAL) | `8hus-y5nc` | [`8hus-y5nc.json`](https://data.cdc.gov/resource/8hus-y5nc.json) | `femmat, storeopen_a, publoc_c, zonepol` |
| **Chicago, IL** | `data.cityofchicago.org` | Building Permits | `ydr8-5enu` | [`ydr8-5enu.json`](https://data.cityofchicago.org/resource/ydr8-5enu.json) | `contact_14_city, contact_2_type, zoning_fee_subtotal, subtotal_unpaid` |
| **Chicago, IL** | `data.cityofchicago.org` | Performance Metrics - Housing & Economic Development - Zoning Permit Scheduling And Review | `icic-3jsa` | [`icic-3jsa.json`](https://data.cityofchicago.org/resource/icic-3jsa.json) | `year, corrections_denials, average_number_of_plan_reviews_to_approval, month` |
| **Chicago, IL** | `data.cityofchicago.org` | Performance Metrics - Buildings - Time to Issue Standard Plan Review Program Permits | `4ygs-9x34` | [`4ygs-9x34.json`](https://data.cityofchicago.org/resource/4ygs-9x34.json) | `week_text, week, average_days_to_permit, target` |
| **Chicago, IL** | `data.cityofchicago.org` | Performance Metrics - Business Affairs & Consumer Protection - Business Licenses | `emvs-38e6` | [`emvs-38e6.json`](https://data.cityofchicago.org/resource/emvs-38e6.json) | `year, median_days_to_issue_license, license_description, licence_code` |
| **Chicago, IL** | `data.cityofchicago.org` | Building Violations | `22u3-xenr` | [`22u3-xenr.json`](https://data.cityofchicago.org/resource/22u3-xenr.json) | `latitude, inspection_waived, location, :@computed_region_vrxf_vc4k` |
| **Chicago, IL** | `data.cityofchicago.org` | Performance Metrics - Buildings - Time to Issue Easy Permits | `7ray-xvet` | [`7ray-xvet.json`](https://data.cityofchicago.org/resource/7ray-xvet.json) | `week, week_text, target, average_days_to_permit` |
| **Chicago, IL** | `data.cityofchicago.org` | Additional Dwelling Unit Preapproval Applications - Historical | `xbwc-ntpx` | [`xbwc-ntpx.json`](https://data.cityofchicago.org/resource/xbwc-ntpx.json) | `owner_occ, :@computed_region_rpca_8um6, existing_bldg, aff_adus` |
| **Chicago, IL** | `data.cityofchicago.org` | Performance Metrics - Buildings - Time to Issue Developer Services Permits | `ijdy-a94t` | [`ijdy-a94t.json`](https://data.cityofchicago.org/resource/ijdy-a94t.json) | `week, target, week_text, average_days_to_permit` |
| **Chicago, IL** | `data.cityofchicago.org` | Public Building Commission - Event Permits | `knv6-r5ad` | [`knv6-r5ad.json`](https://data.cityofchicago.org/resource/knv6-r5ad.json) | `event_date, permit_status, approved_or_denied, date_received` |
| **Chicago, IL** | `data.cityofchicago.org` | Performance Metrics - Buildings - Time To Issue Green Permits | `z2qz-687z` | [`z2qz-687z.json`](https://data.cityofchicago.org/resource/z2qz-687z.json) | `target, week_text, average_days_to_permit, week` |
| **Chicago, IL** | `data.cityofchicago.org` | DOE Environmental Permits | `ir7v-8mc8` | [`ir7v-8mc8.json`](https://data.cityofchicago.org/resource/ir7v-8mc8.json) | `status, application_subtype, application_type, applicant` |
| **Chicago, IL** | `data.cityofchicago.org` | Micro-Market Recovery Program - Permits | `4dpw-9rts` | [`4dpw-9rts.json`](https://data.cityofchicago.org/resource/4dpw-9rts.json) | `permit_number, post_direction, permit_status, central_business_district` |
| **Chicago, IL** | `data.cityofchicago.org` | Micro-Market Recovery Program - Violations and Inspections | `ujwc-724r` | [`ujwc-724r.json`](https://data.cityofchicago.org/resource/ujwc-724r.json) | `zip_code, violation_status, y_coord, address_key` |
| **Chicago, IL** | `data.cityofchicago.org` | Additional Dwelling Unit Areas | `ttjb-ayff` | [`ttjb-ayff.json`](https://data.cityofchicago.org/resource/ttjb-ayff.json) | `shape_leng, objectid, the_geom, area` |
| **Chicago, IL** | `data.cityofchicago.org` | Additional Dwelling Unit Preapproval Applications | `j4h8-ug9m` | [`j4h8-ug9m.json`](https://data.cityofchicago.org/resource/j4h8-ug9m.json) | `affidavit_yn, zoning, submitter_role, fee_affordable_units_required` |
| **Chicago, IL** | `data.cityofchicago.org` | DOE Environmental Storage Tanks | `ug5u-hxnx` | [`ug5u-hxnx.json`](https://data.cityofchicago.org/resource/ug5u-hxnx.json) | `data_source, street_number, street_type, last_used_date` |
| **Chicago, IL** | `data.cityofchicago.org` | Micro-Market Recovery Program - Addresses | `cf2f-mmzv` | [`cf2f-mmzv.json`](https://data.cityofchicago.org/resource/cf2f-mmzv.json) | `:@computed_region_awaf_s7ux, suffix, :@computed_region_6mkv_f3dw, post_direction` |
| **Chicago, IL** | `data.cityofchicago.org` | Micro-Market Recovery Program - Cases | `gm9b-bwv5` | [`gm9b-bwv5.json`](https://data.cityofchicago.org/resource/gm9b-bwv5.json) | `disposition_description, add_date_time, location, modified_date_time` |
| **Chicago, IL** | `data.cityofchicago.org` | DOE Environmental Inspections | `i9rk-duva` | [`i9rk-duva.json`](https://data.cityofchicago.org/resource/i9rk-duva.json) | `data_source, street_type, street_name, street_number_to` |
| **Chicago, IL** | `data.cityofchicago.org` | Roadway Construction Moratoriums | `ndbz-vy4e` | [`ndbz-vy4e.json`](https://data.cityofchicago.org/resource/ndbz-vy4e.json) | `street_name_suffix, moratorium_type, start_date, expiration_date` |
| **Chicago, IL** | `data.cityofchicago.org` | Public Right-of-Way Use Permits - Historical | `hwmb-iu8j` | [`hwmb-iu8j.json`](https://data.cityofchicago.org/resource/hwmb-iu8j.json) | `expiration_date, permit_number, id, location` |
| **Chicago, IL** | `data.cityofchicago.org` | DOE Environmental Hold on City-Issued Permits and LUST NFR | `6gqn-e2ij` | [`6gqn-e2ij.json`](https://data.cityofchicago.org/resource/6gqn-e2ij.json) | `:@computed_region_awaf_s7ux, location, :@computed_region_rpca_8um6, latitude` |
| **Cincinnati, OH** | `data.cincinnati-oh.gov` | Cincinnati Building Permits | `uhjb-xac9` | [`uhjb-xac9.json`](https://data.cincinnati-oh.gov/resource/uhjb-xac9.json) | `units, community_council_neighborhood, originalstate, link` |
| **Cincinnati, OH** | `data.cincinnati-oh.gov` | Cincinnati Building Permits Contacts | `vmk6-gy84` | [`vmk6-gy84.json`](https://data.cincinnati-oh.gov/resource/vmk6-gy84.json) | `applied_date, number_key, zip, address_2` |
| **Cincinnati, OH** | `data.cincinnati-oh.gov` | Cincinnati Building Permits Timeline | `94uh-66xv` | [`94uh-66xv.json`](https://data.cincinnati-oh.gov/resource/94uh-66xv.json) | `work_type, data_status, issued_year, applied_year` |
| **Cincinnati, OH** | `data.cincinnati-oh.gov` | Cincinnati Building Permits (Combo) w/ Plan Review Comments | `thvx-5mem` | [`thvx-5mem.json`](https://data.cincinnati-oh.gov/resource/thvx-5mem.json) | `sub_type_desc, dwelling_units, sub_type, entry_by` |
| **Cincinnati, OH** | `data.cincinnati-oh.gov` | Licenses (and Use Permits) | `ehdi-ajku` | [`ehdi-ajku.json`](https://data.cincinnati-oh.gov/resource/ehdi-ajku.json) | `display_agency, neighborhood, latitude, work_type` |
| **Cincinnati, OH** | `data.cincinnati-oh.gov` | Small Cell Permits: Right of Way | `st7e-6uwd` | [`st7e-6uwd.json`](https://data.cincinnati-oh.gov/resource/st7e-6uwd.json) | `app_submittal_date, community_council_neighborhood, neighborhood, owner` |
| **Cincinnati, OH** | `data.cincinnati-oh.gov` | Community Perceptions Survey 2021 | `pkyn-d5t4` | [`pkyn-d5t4.json`](https://data.cincinnati-oh.gov/resource/pkyn-d5t4.json) | `how_well_your_city_is_managing, city_s_efforts_to_attract, city_s_use_of_economic, access_to_job_training` |
| **Cincinnati, OH** | `data.cincinnati-oh.gov` | City of Cincinnati- Residential Tax Abatements | `6ck4-ukva` | [`6ck4-ukva.json`](https://data.cincinnati-oh.gov/resource/6ck4-ukva.json) | `community_council_neighborhood, application_date, cra_id, leed_class` |
| **CITYOFCAMAS (performance.cityofcamas.us)** | `performance.cityofcamas.us` | CD-Residential Building Permit Totals | `bpag-h9vx` | [`bpag-h9vx.json`](https://performance.cityofcamas.us/resource/bpag-h9vx.json) | `permitsissued, permitissuedt` |
| **CITYOFCAMAS (performance.cityofcamas.us)** | `performance.cityofcamas.us` | CD-Residential Housing Sizes | `tnfa-i8da` | [`tnfa-i8da.json`](https://performance.cityofcamas.us/resource/tnfa-i8da.json) | `pctoftotalnew, newpermits, count, year` |
| **CITYOFCAMAS (performance.cityofcamas.us)** | `performance.cityofcamas.us` | CD-Residential Construction | `t4q7-r3d4` | [`t4q7-r3d4.json`](https://performance.cityofcamas.us/resource/t4q7-r3d4.json) | `year, permittype, location_1_zip, location_1_city` |
| **CITYOFDAVENPORTIOWA (performance.cityofdavenportiowa.com)** | `performance.cityofdavenportiowa.com` | Number of Construction Permits | `9cns-rzvq` | [`9cns-rzvq.json`](https://performance.cityofdavenportiowa.com/resource/9cns-rzvq.json) | `construction_permits, date` |
| **CITYOFDAVENPORTIOWA (performance.cityofdavenportiowa.com)** | `performance.cityofdavenportiowa.com` | Public Works Performance Measures | `dhxq-u2iy` | [`dhxq-u2iy.json`](https://performance.cityofdavenportiowa.com/resource/dhxq-u2iy.json) | `rental_inspections, substandard_letters_issued, recycling_in_tons, miles_street_swept` |
| **COOKCOUNTYIL (datacatalog.cookcountyil.gov)** | `datacatalog.cookcountyil.gov` | Environmental Control - Asbestos Removal Permits - 2010 | `b4e6-7ck8` | [`b4e6-7ck8.json`](https://datacatalog.cookcountyil.gov/resource/b4e6-7ck8.json) | `building_zip_zip, permit_fee, building_zip_address, building_address_address` |
| **COOKCOUNTYIL (datacatalog.cookcountyil.gov)** | `datacatalog.cookcountyil.gov` | Environmental Control - Asbestos Removal Permits - 2010 | `6biq-7ju6` | [`6biq-7ju6.json`](https://datacatalog.cookcountyil.gov/resource/6biq-7ju6.json) | `building_address_state, building_address_address, filing_fees, inspection_fees` |
| **COOKCOUNTYIL (datacatalog.cookcountyil.gov)** | `datacatalog.cookcountyil.gov` | Building and Zoning - Building, Plumbing, And Electrical Permits Applied For - Fiscal Year 2005 through part of Fiscal Year 2011 | `6myv-3m4t` | [`6myv-3m4t.json`](https://datacatalog.cookcountyil.gov/resource/6myv-3m4t.json) | `totals, plumbing, electrical, fiscal_year` |
| **COOKCOUNTYIL (datacatalog.cookcountyil.gov)** | `datacatalog.cookcountyil.gov` | Asbestos & Demolition Permits | `gpmj-6p9q` | [`gpmj-6p9q.json`](https://datacatalog.cookcountyil.gov/resource/gpmj-6p9q.json) | `permit_number, project_type, project_end_date, building_floors` |
| **COOKCOUNTYIL (datacatalog.cookcountyil.gov)** | `datacatalog.cookcountyil.gov` | Environmental Control - Asbestos Demolition Permits - 2012 Q3 | `qkzq-fgkt` | [`qkzq-fgkt.json`](https://datacatalog.cookcountyil.gov/resource/qkzq-fgkt.json) | `location_1_city, demolition_permit_number, location_1_zip, location_1_address` |
| **COOKCOUNTYIL (datacatalog.cookcountyil.gov)** | `datacatalog.cookcountyil.gov` | Open Data - BZ - FY2005 - Building, Plumbing, And Electrical Permits Applied For-- Locator | `iiq4-y58u` | [`iiq4-y58u.json`](https://datacatalog.cookcountyil.gov/resource/iiq4-y58u.json) | `location_1_state, location_1, fiscal_year, township_name` |
| **COOKCOUNTYIL (datacatalog.cookcountyil.gov)** | `datacatalog.cookcountyil.gov` | Solid Waste Permits | `9ui4-wwkp` | [`9ui4-wwkp.json`](https://datacatalog.cookcountyil.gov/resource/9ui4-wwkp.json) | `city, zip_code, permit_number, permit_approval_date` |
| **COOKCOUNTYIL (datacatalog.cookcountyil.gov)** | `datacatalog.cookcountyil.gov` | Assessor - Commercial Valuation Data | `csik-bsws` | [`csik-bsws.json`](https://datacatalog.cookcountyil.gov/resource/csik-bsws.json) | `exp, yearbuilt, vacancy, townregion` |
| **COOKCOUNTYIL (datacatalog.cookcountyil.gov)** | `datacatalog.cookcountyil.gov` | Temporary Rock Crusher Permits | `2nu5-mzu4` | [`2nu5-mzu4.json`](https://datacatalog.cookcountyil.gov/resource/2nu5-mzu4.json) | `anticipated_end_date, facility_type, facility_name, address` |
| **Corona, CA** | `corstat.coronaca.gov` | CorStat - Building Permits | `2agx-camz` | [`2agx-camz.json`](https://corstat.coronaca.gov/resource/2agx-camz.json) | `expired, :@computed_region_jzf3_x6hp, site_streetid, finaled_count` |
| **Corona, CA** | `corstat.coronaca.gov` | CorStat - Residential Building Permits | `d2td-q3px` | [`d2td-q3px.json`](https://corstat.coronaca.gov/resource/d2td-q3px.json) | `type, applied, issued, finaled` |
| **Corona, CA** | `corstat.coronaca.gov` | CorStat - Commercial Building Permits | `bzvz-cu4n` | [`bzvz-cu4n.json`](https://corstat.coronaca.gov/resource/bzvz-cu4n.json) | `approved, applied, finaled, type` |
| **Corona, CA** | `corstat.coronaca.gov` | Building - Customer Service Surveys | `cn5w-sm8e` | [`cn5w-sm8e.json`](https://corstat.coronaca.gov/resource/cn5w-sm8e.json) | `overall_experience, public_works_plan_check, building_fire_plan_check, ease_of_contact` |
| **Corona, CA** | `corstat.coronaca.gov` | CorStat - Building Inspections (Daily) | `fa7r-xnfs` | [`fa7r-xnfs.json`](https://corstat.coronaca.gov/resource/fa7r-xnfs.json) | `scheduled_date, daily_inspections` |
| **Corona, CA** | `corstat.coronaca.gov` | CorStat - Building Submittal Times | `wyg7-eqee` | [`wyg7-eqee.json`](https://corstat.coronaca.gov/resource/wyg7-eqee.json) | `organization, _1st_submittal_days, resubmittal_days` |
| **Corona, CA** | `corstat.coronaca.gov` | CorStat - CAP Tracking by Permit/Project | `ac64-jjxt` | [`ac64-jjxt.json`](https://corstat.coronaca.gov/resource/ac64-jjxt.json) | `measurement, applied, permitsubtype, permit_no` |
| **Corona, CA** | `corstat.coronaca.gov` | CorStat - County Assessor's Office Permit Data | `faij-4cug` | [`faij-4cug.json`](https://corstat.coronaca.gov/resource/faij-4cug.json) | `const_type, relationship, title, text_001` |
| **CT (data.ct.gov)** | `data.ct.gov` | Monthly Building Permits Issued by Units in Structure | `5vjm-esav` | [`5vjm-esav.json`](https://data.ct.gov/resource/5vjm-esav.json) | `_2_units, date, _1_unit, _5_units` |
| **CT (data.ct.gov)** | `data.ct.gov` | 2025 Connecticut Parcel and CAMA Data | `rny9-6ak2` | [`rny9-6ak2.json`](https://data.ct.gov/resource/rny9-6ak2.json) | `base_floor_use_1st_floor, building_photo, sketch, cama_site_link` |
| **CT (data.ct.gov)** | `data.ct.gov` | 2024 Connecticut Parcel and CAMA Data | `pqrn-qghw` | [`pqrn-qghw.json`](https://data.ct.gov/resource/pqrn-qghw.json) | `gis_tag, appraised_total, pre_yr_assessed_land, assessed_extra_feature` |
| **CT (data.ct.gov)** | `data.ct.gov` | Connecticut CAMA Data 2023 | `ezgm-i4uu` | [`ezgm-i4uu.json`](https://data.ct.gov/resource/ezgm-i4uu.json) | `preyrassessedbuilding, outbuildingcount, extrafeaturescount, permitcount` |
| **CT (data.ct.gov)** | `data.ct.gov` | 2026 Connecticut Parcel and CAMA Data | `ibe8-9i3q` | [`ibe8-9i3q.json`](https://data.ct.gov/resource/ibe8-9i3q.json) | `grade_desc, grade, style_desc, state_use_description` |
| **CT (data.ct.gov)** | `data.ct.gov` | Connecticut CAMA Data 2022 | `i7xw-titi` | [`i7xw-titi.json`](https://data.ct.gov/resource/i7xw-titi.json) | `property_city, land_use_note, sketch, number_of_units` |
| **CT (data.ct.gov)** | `data.ct.gov` | Energy Storage Solutions (ESS) Enrollment | `uy2c-bbdw` | [`uy2c-bbdw.json`](https://data.ct.gov/resource/uy2c-bbdw.json) | `transfer_from_connected_solutions, combined_bess_models, cost_kwh, kwh_kw` |
| **CT (data.ct.gov)** | `data.ct.gov` | DECD Housing Permit Survey Suppmental Questions | `aqvk-nwva` | [`aqvk-nwva.json`](https://data.ct.gov/resource/aqvk-nwva.json) | `of_units_denied, of_permit_apps_denied, county, of_units_proposed` |
| **CUNY (bronx.lehman.cuny.edu)** | `bronx.lehman.cuny.edu` | Bronx Building Permits | `eeyd-a5c6` | [`eeyd-a5c6.json`](https://bronx.lehman.cuny.edu/resource/eeyd-a5c6.json) | `job_location_city, superintendent_first_last_name, site_safety_mgr_business_name, job_start_date` |
| **Dallas, TX** | `www.dallasopendata.com` | Building Permits | `e7gq-4sah` | [`e7gq-4sah.json`](https://www.dallasopendata.com/resource/e7gq-4sah.json) | `permit_type, issued_date, value, work_description` |
| **Dallas, TX** | `www.dallasopendata.com` | Building Permits for Fiscal Year 2011 - 2012 | `azf5-sdcr` | [`azf5-sdcr.json`](https://www.dallasopendata.com/resource/azf5-sdcr.json) | `work_description, land_use, permit_number, zip_code` |
| **Dallas, TX** | `www.dallasopendata.com` | Building Permits for Fiscal Year 2017 - 2018 | `w2uy-zn9f` | [`w2uy-zn9f.json`](https://www.dallasopendata.com/resource/w2uy-zn9f.json) | `area, issued_date, work_description, value` |
| **Dallas, TX** | `www.dallasopendata.com` | Building Permits for Fiscal Year 2013 - 2014 | `fs84-rv8z` | [`fs84-rv8z.json`](https://www.dallasopendata.com/resource/fs84-rv8z.json) | `permit_number, permit_type, mapsco, zip_code` |
| **Dallas, TX** | `www.dallasopendata.com` | Building Permits for Fiscal Year 2015 - 2016 | `rzm4-tcqx` | [`rzm4-tcqx.json`](https://www.dallasopendata.com/resource/rzm4-tcqx.json) | `work_description, area, street_address, zip_code` |
| **Dallas, TX** | `www.dallasopendata.com` | Building Inspection Certificates Of Occupancy | `9qet-qt9e` | [`9qet-qt9e.json`](https://www.dallasopendata.com/resource/9qet-qt9e.json) | `address, business_name, co, geolocation_zip` |
| **Dallas, TX** | `www.dallasopendata.com` | Building Inspection Certifcates Of Occupancy Fiscal Year 2016 - 2017 | `e2aq-6nz6` | [`e2aq-6nz6.json`](https://www.dallasopendata.com/resource/e2aq-6nz6.json) | `geolocation, geolocation_address, sq_ft, date_approved` |
| **Dallas, TX** | `www.dallasopendata.com` | Building Inspection Certifcates Of Occupancy Fiscal Year 2015 - 2016 | `dryn-sntn` | [`dryn-sntn.json`](https://www.dallasopendata.com/resource/dryn-sntn.json) | `code_district, sq_ft, geolocation, type_of_co` |
| **Dallas, TX** | `www.dallasopendata.com` | Permit Points | `6ik7-4gqj` | [`6ik7-4gqj.json`](https://www.dallasopendata.com/resource/6ik7-4gqj.json) | `id_1, xcoord, lu, jobvalue` |
| **Dallas, TX** | `www.dallasopendata.com` | ROW Permits - Points | `bw6g-a3ur` | [`bw6g-a3ur.json`](https://www.dallasopendata.com/resource/bw6g-a3ur.json) | `inspection_districts, council_districts, caseid, allcontractorsname` |
| **Dallas, TX** | `www.dallasopendata.com` | ROW Permits - Lines | `xd3q-ipis` | [`xd3q-ipis.json`](https://www.dallasopendata.com/resource/xd3q-ipis.json) | `shape_stlength, caseid, locationnames, applicantnamestored` |
| **Dallas, TX** | `www.dallasopendata.com` | ROW Restrictions | `8hyu-vkvq` | [`8hyu-vkvq.json`](https://www.dallasopendata.com/resource/8hyu-vkvq.json) | `shape_stlength, shape_starea, restrictdesc, lastupdate` |
| **DELAWARE (data.delaware.gov)** | `data.delaware.gov` | Permitted Septic Systems | `mv7j-tx3u` | [`mv7j-tx3u.json`](https://data.delaware.gov/resource/mv7j-tx3u.json) | `septicpropusecode, withdrawndate, designerlicensenumber, geocoded_location` |
| **DELAWARE (data.delaware.gov)** | `data.delaware.gov` | Storm Water Notices of Intent | `3s4n-3up9` | [`3s4n-3up9.json`](https://data.delaware.gov/resource/3s4n-3up9.json) | `projectname, longitude, project_location, geocoded_location` |
| **DELAWARE (data.delaware.gov)** | `data.delaware.gov` | Well Permits | `2655-qn8j` | [`2655-qn8j.json`](https://data.delaware.gov/resource/2655-qn8j.json) | `estconstructdate, pumpingwaterlevel, waterleveldate, wellcomments` |
| **DUMFRIESVA (data.dumfriesva.gov)** | `data.dumfriesva.gov` | Town Permit Processing Time | `76tz-5d55` | [`76tz-5d55.json`](https://data.dumfriesva.gov/resource/76tz-5d55.json) | `issued_date, month, permit_number, permit_type` |
| **EVERETTWA (data.everettwa.gov)** | `data.everettwa.gov` | Permit First Review By Tier | `c6k3-mamn` | [`c6k3-mamn.json`](https://data.everettwa.gov/resource/c6k3-mamn.json) | `tier, permittype, noofdays` |
| **FCGOV (opendata.fcgov.com)** | `opendata.fcgov.com` | Current Building Permits | `fvgz-viez` | [`fvgz-viez.json`](https://opendata.fcgov.com/resource/fvgz-viez.json) | `ymax, subaddunit, web, distance` |
| **FCGOV (opendata.fcgov.com)** | `opendata.fcgov.com` | new_const2016_WGS84 | `y6wr-rcc6` | [`y6wr-rcc6.json`](https://opendata.fcgov.com/resource/y6wr-rcc6.json) | `date_issued, def_type, the_geom, num_of_units` |
| **Framingham, MA** | `data.framinghamma.gov` | Building Permits | `2vzw-yean` | [`2vzw-yean.json`](https://data.framinghamma.gov/resource/2vzw-yean.json) | `fee, estimated_job_cost, location_1_zip, applied` |
| **Framingham, MA** | `data.framinghamma.gov` | Building Inspections | `ipef-acke` | [`ipef-acke.json`](https://data.framinghamma.gov/resource/ipef-acke.json) | `street_number, inspected, insp_type, type` |
| **Framingham, MA** | `data.framinghamma.gov` | Code Enforcement Cases | `tjcb-7gwr` | [`tjcb-7gwr.json`](https://data.framinghamma.gov/resource/tjcb-7gwr.json) | `status, type, opened, case` |
| **FRANKLINTN (performance.franklintn.gov)** | `performance.franklintn.gov` | Historic General Fund Financial Data | `tgyb-gmn2` | [`tgyb-gmn2.json`](https://performance.franklintn.gov/resource/tgyb-gmn2.json) | `franchise_fees, in_lieu_of_tax, personnel, total_expenses` |
| **FRANKLINTN (performance.franklintn.gov)** | `performance.franklintn.gov` | FY 2019 GF Budget File | `nfcr-gcpk` | [`nfcr-gcpk.json`](https://performance.franklintn.gov/resource/nfcr-gcpk.json) | `total_revenues, governance_management, building_permits_licenses, fiscal_year` |
| **FRANKLINTN (performance.franklintn.gov)** | `performance.franklintn.gov` | BNS Stats | `5uvn-iiub` | [`5uvn-iiub.json`](https://performance.franklintn.gov/resource/5uvn-iiub.json) | `tn_build_insp_avg, tn_const_plan_avg, tn_co_avg, building_inspections_performed` |
| **FULTONCOUNTYGA (performance.fultoncountyga.gov)** | `performance.fultoncountyga.gov` | Building Permits By Zip Code | `p3f6-ug7s` | [`p3f6-ug7s.json`](https://performance.fultoncountyga.gov/resource/p3f6-ug7s.json) | `zipcode, count, totalvalue, latitude` |
| **FULTONCOUNTYGA (sharefulton.fultoncountyga.gov)** | `sharefulton.fultoncountyga.gov` | Monthly Building Permit Counts | `tg8q-cswr` | [`tg8q-cswr.json`](https://sharefulton.fultoncountyga.gov/resource/tg8q-cswr.json) | `yearmonth, threefourunits_units, fiveplusunits_bldgs, fiveplusunitsrep_bldgs` |
| **FULTONCOUNTYGA (sharefulton.fultoncountyga.gov)** | `sharefulton.fultoncountyga.gov` | Monthly Building Permit Counts for Fulton County | `ffx9-udkf` | [`ffx9-udkf.json`](https://sharefulton.fultoncountyga.gov/resource/ffx9-udkf.json) | `surveydate, oneunit12monthavg, countyname, multiunits_units` |
| **Gainesville, FL** | `data.cityofgainesville.org` | Building Permits | `p798-x3nx` | [`p798-x3nx.json`](https://data.cityofgainesville.org/resource/p798-x3nx.json) | `parcel, state, :@computed_region_ndi2_bfht, :@computed_region_9cfm_spy5` |
| **Gainesville, FL** | `data.cityofgainesville.org` | Landlord Permits | `x3sz-gqmp` | [`x3sz-gqmp.json`](https://data.cityofgainesville.org/resource/x3sz-gqmp.json) | `:@computed_region_u9vc_vmbc, :@computed_region_4rat_gsiv, location_zip, parcel_city` |
| **Gainesville, FL** | `data.cityofgainesville.org` | Code Complaints, Violations & Permits | `vu9p-a5f7` | [`vu9p-a5f7.json`](https://data.cityofgainesville.org/resource/vu9p-a5f7.json) | `parcel, case_type, address, number` |
| **Gainesville, FL** | `data.cityofgainesville.org` | Permit Table | `mfe4-6q3g` | [`mfe4-6q3g.json`](https://data.cityofgainesville.org/resource/mfe4-6q3g.json) | `permit_name, permit_location, online_submission, permit_description` |
| **HONOLULU (data.honolulu.gov)** | `data.honolulu.gov` | Building Permits - January 1, 2005 through June 30, 2025 | `4vab-c87q` | [`4vab-c87q.json`](https://data.honolulu.gov/resource/4vab-c87q.json) | `typesofconstructionmin, sidewalktypes, requireaffidavit, commercialresidential` |
| **HOWARDCOUNTYMD (opendata.howardcountymd.gov)** | `opendata.howardcountymd.gov` | Building, Electrical, Fire, Grading, Mechanical, Plumbing & Sign Permits | `kvz2-j5cj` | [`kvz2-j5cj.json`](https://opendata.howardcountymd.gov/resource/kvz2-j5cj.json) | `zip, file_date, type, sewer` |
| **Kansas City, MO** | `data.kcmo.org` | 2000-2009 Building Permit Listing | `cvnj-fvgf` | [`cvnj-fvgf.json`](https://data.kcmo.org/resource/cvnj-fvgf.json) | `subdivision, location_2, how_far_north, dwelling_units_gained_or_lost` |
| **Kansas City, MO** | `data.kcmo.org` | 2014 Building Permit Listing | `qt6m-65bz` | [`qt6m-65bz.json`](https://data.kcmo.org/resource/qt6m-65bz.json) | `day, location, dwelling_units_gained_or_lost, council_district` |
| **Kansas City, MO** | `data.kcmo.org` | 2020 Building Permit Listing | `cwrz-29jm` | [`cwrz-29jm.json`](https://data.kcmo.org/resource/cwrz-29jm.json) | `full_address, month, day, dwelling_units_gained_or` |
| **Kansas City, MO** | `data.kcmo.org` | 2010-2013 Building Permit Listing | `vcj3-ncb3` | [`vcj3-ncb3.json`](https://data.kcmo.org/resource/vcj3-ncb3.json) | `school_district, pin, parcel, applicant_name` |
| **Kansas City, MO** | `data.kcmo.org` | 1970-1979 Building Permit Listing | `akhc-zaz6` | [`akhc-zaz6.json`](https://data.kcmo.org/resource/akhc-zaz6.json) | `permit_value, dwelling_units_gained_or_lost, sf_mf, name` |
| **Kansas City, MO** | `data.kcmo.org` | 1980-1989 Building Permit Listing | `hqe6-tuji` | [`hqe6-tuji.json`](https://data.kcmo.org/resource/hqe6-tuji.json) | `res_non, how_far_east, how_far_north, permit_value` |
| **Kansas City, MO** | `data.kcmo.org` | 1990-1999 Building Permit Listing | `4hr8-fgbf` | [`4hr8-fgbf.json`](https://data.kcmo.org/resource/4hr8-fgbf.json) | `parcel, county, school_district, permit_value` |
| **Kansas City, MO** | `data.kcmo.org` | 2010-2016 Building Permit Listing | `yazt-9xgq` | [`yazt-9xgq.json`](https://data.kcmo.org/resource/yazt-9xgq.json) | `day, dwelling_units_gained_or_lost, how_far_east, how_far_north` |
| **Kansas City, MO** | `data.kcmo.org` | 2010 to 2019 Building Permit Listing | `jnga-5v37` | [`jnga-5v37.json`](https://data.kcmo.org/resource/jnga-5v37.json) | `day, how_far_north, how_far_east, permit_value` |
| **Kansas City, MO** | `data.kcmo.org` | 2010 to September 2019 Building Permit Listing | `i2p9-vksn` | [`i2p9-vksn.json`](https://data.kcmo.org/resource/i2p9-vksn.json) | `council_district, owner_name, legal, prefix` |
| **Kansas City, MO** | `data.kcmo.org` | CPD Permits - Status Change Dataset | `6h9j-mu65` | [`6h9j-mu65.json`](https://data.kcmo.org/resource/6h9j-mu65.json) | `statuspreviousmapped, statuspreviousdate, applieddate, issueddate` |
| **Kansas City, MO** | `data.kcmo.org` | Permits - CPD Dataset | `ntw8-aacc` | [`ntw8-aacc.json`](https://data.kcmo.org/resource/ntw8-aacc.json) | `voiddate, issueddate, housingunits, estprojectcost` |
| **Kansas City, MO** | `data.kcmo.org` | Market Value Analysis (MVA) 2020 | `qhqc-4mi2` | [`qhqc-4mi2.json`](https://data.kcmo.org/resource/qhqc-4mi2.json) | `renters, percvacind, hhperacre, percsub` |
| **Kansas City, MO** | `data.kcmo.org` | Financial Trends Monitoring System Data | `btez-inz8` | [`btez-inz8.json`](https://data.kcmo.org/resource/btez-inz8.json) | `fiscal_year_text_label, calendar_year, number_of_uniform_police, other_post_employement_benefits_opeb_as_a_percent_of_net_operating_expenditures` |
| **Los Angeles, CA** | `data.lacity.org` | Building and Safety - Building Permits Issued from 2020 to Present (N) | `pi9x-tg5x` | [`pi9x-tg5x.json`](https://data.lacity.org/resource/pi9x-tg5x.json) | `junior_adu, apc, primary_address, ct` |
| **Los Angeles, CA** | `data.lacity.org` | Building and Safety - Building Permits Issued Before 2010 (N) | `e67z-kt2n` | [`e67z-kt2n.json`](https://data.lacity.org/resource/e67z-kt2n.json) | `construction, permit_type, use_code, use_desc` |
| **Los Angeles, CA** | `data.lacity.org` | Building and Safety - Building Permits Issued Between 2010 and 2019 (N) | `dyxf-7hc4` | [`dyxf-7hc4.json`](https://data.lacity.org/resource/dyxf-7hc4.json) | `permit_type, permit_sub_type, zip_code, business_unit` |
| **Los Angeles, CA** | `data.lacity.org` | Building and Safety - Building Permits Submitted from 2020 to Present (N) | `gwh9-jnip` | [`gwh9-jnip.json`](https://data.lacity.org/resource/gwh9-jnip.json) | `business_unit, work_desc, construction, valuation` |
| **Los Angeles, CA** | `data.lacity.org` | Building and Safety - Building Permits Submitted Before 2010 (N) | `b6ii-mhed` | [`b6ii-mhed.json`](https://data.lacity.org/resource/b6ii-mhed.json) | `cpa, apc, business_unit, status_desc` |
| **Los Angeles, CA** | `data.lacity.org` | Building and Safety - Building Permits Submitted Between 2010 and 2019 (N) | `n3xg-rixm` | [`n3xg-rixm.json`](https://data.lacity.org/resource/n3xg-rixm.json) | `apc, issue_date, use_desc, ev` |
| **Los Angeles, CA** | `data.lacity.org` | Total and Affordable Housing Units | `rckt-8prm` | [`rckt-8prm.json`](https://data.lacity.org/resource/rckt-8prm.json) | `new_affordable_units_financed_by_hcidla_with_new_construction_rehab_tax_credit, affordable_units_preserved, cumulative_new_housing_units, affordable_units_produced_w_land_use_incentives` |
| **Los Angeles, CA** | `controllerdata.lacity.org` | City of Los Angeles Economic Data | `xtbr-xwes` | [`xtbr-xwes.json`](https://controllerdata.lacity.org/resource/xtbr-xwes.json) | `unit_text, quarter_start, cy_qtr, calendar_year` |
| **Los Angeles, CA** | `data.lacity.org` | Building and Safety Certificate of Occupancy | `3f9m-afei` | [`3f9m-afei.json`](https://data.lacity.org/resource/3f9m-afei.json) | `applicant_first_name, applicant_address_1, applicant_address_3, zone` |
| **Los Angeles, CA** | `data.lacity.org` | Building and Safety - Electrical Permits Issued from 2020 to Present (N) | `ysqd-apz7` | [`ysqd-apz7.json`](https://data.lacity.org/resource/ysqd-apz7.json) | `issue_date, status_date, zone, status_desc` |
| **Los Angeles, CA** | `data.lacity.org` | Building and Safety - Mechanical Permits Issued from 2020 to Present (N) | `67is-svtd` | [`67is-svtd.json`](https://data.lacity.org/resource/67is-svtd.json) | `status_date, cofo_date, use_code, zip_code` |
| **Los Angeles, CA** | `controllerdata.lacity.org` | Economy Panel LA - Data | `4ndk-mmc8` | [`4ndk-mmc8.json`](https://controllerdata.lacity.org/resource/4ndk-mmc8.json) | `gender, as_of_date, value, unit_of_measure` |
| **Los Angeles, CA** | `data.lacity.org` | Building and Safety - Electrical Permits Submitted from 2020 to Present (N) | `9k3p-zrda` | [`9k3p-zrda.json`](https://data.lacity.org/resource/9k3p-zrda.json) | `issue_date, permit_type, ct, zone` |
| **Los Angeles, CA** | `data.lacity.org` | Building and Safety - Mechanical Permits Submitted from 2020 to Present (N) | `9rag-xmmd` | [`9rag-xmmd.json`](https://data.lacity.org/resource/9rag-xmmd.json) | `status_desc, issue_date, ct, work_desc` |
| **Los Angeles, CA** | `data.lacity.org` | Building and Safety - Electrical Permits Issued Between 2010 and 2019 (N) | `yaaf-cyfa` | [`yaaf-cyfa.json`](https://data.lacity.org/resource/yaaf-cyfa.json) | `permit_sub_type, work_desc, lon, lat` |
| **Los Angeles, CA** | `data.lacity.org` | Building and Safety Inspections | `9w5z-rg2h` | [`9w5z-rg2h.json`](https://data.lacity.org/resource/9w5z-rg2h.json) | `permit, :@computed_region_kqwf_mjcx, :@computed_region_k96s_3jcv, :@computed_region_tatf_ua23` |
| **Los Angeles, CA** | `data.lacity.org` | Building and Safety - Electrical Permits Submitted Before 2010 (N) | `7ts7-nh4y` | [`7ts7-nh4y.json`](https://data.lacity.org/resource/7ts7-nh4y.json) | `status_date, lon, ev, apn` |
| **Los Angeles, CA** | `data.lacity.org` | Building and Safety - Mechanical Permits Submitted Before 2010 (N) | `vnau-u5ph` | [`vnau-u5ph.json`](https://data.lacity.org/resource/vnau-u5ph.json) | `status_desc, solar, cofo_date, use_desc` |
| **Los Angeles, CA** | `data.lacity.org` | Building and Safety - Mechanical Permits Issued Before 2010 (N) | `mcip-sa6g` | [`mcip-sa6g.json`](https://data.lacity.org/resource/mcip-sa6g.json) | `permit_type, use_code, issue_date, lat` |
| **Los Angeles, CA** | `data.lacity.org` | Building and Safety - Mechanical Permits Submitted Between 2010 and 2019 (N) | `bjvp-eqku` | [`bjvp-eqku.json`](https://data.lacity.org/resource/bjvp-eqku.json) | `use_code, submitted_date, cpa, zip_code` |
| **Los Angeles, CA** | `data.lacity.org` | Building and Safety - Electrical Permits Issued Before 2010 (N) | `h8me-eag6` | [`h8me-eag6.json`](https://data.lacity.org/resource/h8me-eag6.json) | `solar, primary_address, pin_nbr, apn` |
| **Los Angeles, CA** | `data.lacity.org` | Building and Safety - Electrical Permits Submitted Between 2010 and 2019 (N) | `9i2c-csvn` | [`9i2c-csvn.json`](https://data.lacity.org/resource/9i2c-csvn.json) | `status_date, submitted_date, hl, work_desc` |
| **Los Angeles, CA** | `data.lacity.org` | Building and Safety - Mechanical Permits Issued Between 2010 and 2019 (N) | `5m3t-xjex` | [`5m3t-xjex.json`](https://data.lacity.org/resource/5m3t-xjex.json) | `permit_group, pin_nbr, primary_address, geolocation` |
| **Los Angeles, CA** | `data.lacity.org` | Building and Safety Temporary Special Event (TSE) Permits | `8spw-3fhx` | [`8spw-3fhx.json`](https://data.lacity.org/resource/8spw-3fhx.json) | `address_start, zip_code, addr_suff, event_end_date` |
| **Los Angeles, CA** | `controllerdata.lacity.org` | CAFR City Activities 2018 (Full) | `yvi8-2wdp` | [`yvi8-2wdp.json`](https://controllerdata.lacity.org/resource/yvi8-2wdp.json) | `congregate_meals_served, cruise_passengers, led_streetlights_percentage_, water_main_breaks` |
| **Los Angeles, CA** | `controllerdata.lacity.org` | CAFR City Activities FY19 | `rwzb-etf8` | [`rwzb-etf8.json`](https://controllerdata.lacity.org/resource/rwzb-etf8.json) | `total_crimes_reported, cultural_programming, camper_attendance_days, team_sports_participants` |
| **Los Angeles, CA** | `data.lacity.org` | Los Angeles BusinessSource Centers "Micro: PreStartups" Performance Units | `ptdy-3ivc` | [`ptdy-3ivc.json`](https://data.lacity.org/resource/ptdy-3ivc.json) | `number_of_referrals_to_wsc, loan_amount_funded, loan_amount_packaged, loan_amount_approved` |
| **Los Angeles, CA** | `data.lacity.org` | Los Angeles BusinessSource Centers "Operating Businesses (>5 Employees)" Performance Units for 01/01/17 through 12/31/17 | `tp35-mfg9` | [`tp35-mfg9.json`](https://data.lacity.org/resource/tp35-mfg9.json) | `loan_amount_funded, loan_amount_approved, number_of_referrals_to_wsc, number_of_pte_jobs_retained` |
| **Los Angeles, CA** | `data.lacity.org` | Los Angeles BusinessSource Centers "Micro: Startups (<5 Employees)" Performance Units for 01/01/17 through 12/31/17 | `jg4k-s4ud` | [`jg4k-s4ud.json`](https://data.lacity.org/resource/jg4k-s4ud.json) | `number_of_loans_approved, number_of_loans_funded, loan_amount_funded, number_of_referrals_to_partner` |
| **Los Angeles, CA** | `data.lacity.org` | Bureau of Engineering Permit Information | `j7mw-thyc` | [`j7mw-thyc.json`](https://data.lacity.org/resource/j7mw-thyc.json) | `permitissuedate, permitno, permittype, permiturl` |
| **Marin County, CA** | `data.marincounty.gov` | Building Permit | `mkbn-caye` | [`mkbn-caye.json`](https://data.marincounty.gov/resource/mkbn-caye.json) | `type_permit, location_state, location_address, location_zip` |
| **Marin County, CA** | `data.marincounty.gov` | Building Permit Inspection | `yfwm-p533` | [`yfwm-p533.json`](https://data.marincounty.gov/resource/yfwm-p533.json) | `inspector, inspection_date, inspection_result, inspection_description` |
| **Marin County, CA** | `data.marincounty.gov` | Code Enforcement | `ti2m-gwng` | [`ti2m-gwng.json`](https://data.marincounty.gov/resource/ti2m-gwng.json) | `divisionemail, parcel, streetnumber, streetsuffix` |
| **MARYLAND (opendata.maryland.gov)** | `opendata.maryland.gov` | City of Frederick Issued Permits | `xrz3-9xhj` | [`xrz3-9xhj.json`](https://opendata.maryland.gov/resource/xrz3-9xhj.json) | `location_1_zip, parcel, location_1_address, location_1_state` |
| **MARYLAND (opendata.maryland.gov)** | `opendata.maryland.gov` | Maryland Total New Housing Units Authorized For Construction: 2010-2025 | `c7z9-v9mr` | [`c7z9-v9mr.json`](https://opendata.maryland.gov/resource/c7z9-v9mr.json) | `harford_county, garrett_county, frederick_county, dorchester_county` |
| **MARYLAND (opendata.maryland.gov)** | `opendata.maryland.gov` | Parcel Points | `x8a5-h2sy` | [`x8a5-h2sy.json`](https://opendata.maryland.gov/resource/x8a5-h2sy.json) | `bg2020, geogcode, ooi, resityp` |
| **MARYLAND (opendata.maryland.gov)** | `opendata.maryland.gov` | Maryland Department of the Environment - LMA Resource Management Program, Animal Feeding Operations Division(AFO) -  Permits | `s4e3-7tuu` | [`s4e3-7tuu.json`](https://opendata.maryland.gov/resource/s4e3-7tuu.json) | `permit_class, document, permit_status, organic` |
| **MARYLAND (opendata.maryland.gov)** | `opendata.maryland.gov` | Maryland Real Property Assessments_Hidden Property Owner Names | `ed4q-f8tm` | [`ed4q-f8tm.json`](https://opendata.maryland.gov/resource/ed4q-f8tm.json) | `special_dates_and_data_non_perc_area_unit_mdp_field_nprcluom_sdat_field_220, special_dates_and_data_ag_tax_liab_due_date_yyyy_mm_dd_sdat_field_221, special_dates_and_data_letter_of_intent_date_yyyy_mm_dd_sdat_field_222, special_dates_and_data_zoning_change_date_yyyy_mm_dd_mdp_field_znchgdat_sdat_field_224` |
| **MARYLAND (opendata.maryland.gov)** | `opendata.maryland.gov` | MTA Transit Oriented Development (TOD) Data | `cqt2-ypem` | [`cqt2-ypem.json`](https://opendata.maryland.gov/resource/cqt2-ypem.json) | `jurisdiction, tod_place_type, local_zoning_descriptions, number_of_bicycle_lockers_occupied` |
| **Mesa, AZ** | `citydata.mesaaz.gov` | Building Permits (RETIRED) | `2gkz-7z4f` | [`2gkz-7z4f.json`](https://citydata.mesaaz.gov/resource/2gkz-7z4f.json) | `street_type, :@computed_region_fcpr_wj2n, use, residential_permit` |
| **Mesa, AZ** | `citydata.mesaaz.gov` | Building Permits | `dzpk-hxfb` | [`dzpk-hxfb.json`](https://citydata.mesaaz.gov/resource/dzpk-hxfb.json) | `contractor_license, closed_date, cofo_year, contractor_phone` |
| **Mesa, AZ** | `citydata.mesaaz.gov` | DSD - Applications Logged out in a day | `9xn7-c9ju` | [`9xn7-c9ju.json`](https://citydata.mesaaz.gov/resource/9xn7-c9ju.json) | `street_address, record_type, record_status_date, date_assigned` |
| **Mesa, AZ** | `citydata.mesaaz.gov` | DSD - Document Retrieval Applications | `knta-3f2w` | [`knta-3f2w.json`](https://citydata.mesaaz.gov/resource/knta-3f2w.json) | `tat_under_10_days, location, record_count, street_number` |
| **MIAMIGOV (data.miamigov.com)** | `data.miamigov.com` | Building Permits Issued By City Of Miami From 2014 To Present | `7ey5-m434` | [`7ey5-m434.json`](https://data.miamigov.com/resource/7ey5-m434.json) | `workitems, isprivateprovider, certificatecode, buildingpermitstatusdesc` |
| **MIAMIGOV (data.miamigov.com)** | `data.miamigov.com` | Building Tree Permits from 2014 to Present | `kyut-b7du` | [`kyut-b7du.json`](https://data.miamigov.com/resource/kyut-b7du.json) | `propertyaddress, latitude, plannumber, location_1` |
| **MICHIGAN (data.michigan.gov)** | `data.michigan.gov` | Michigan Building Permits for Housing Starts | `9a5w-et7j` | [`9a5w-et7j.json`](https://data.michigan.gov/resource/9a5w-et7j.json) | `michiganbuildingpermits_12monthmovingaverage_000s, highlights, date` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Electrical Building Permits | `qxie-8qnp` | [`qxie-8qnp.json`](https://data.montgomerycountymd.gov/resource/qxie-8qnp.json) | `:@computed_region_d7bw_bq6x, :@computed_region_kbsp_ykn9, :@computed_region_tx5f_5em3, description` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Residential Permit | `m88u-pqki` | [`m88u-pqki.json`](https://data.montgomerycountymd.gov/resource/m88u-pqki.json) | `:@computed_region_vu5j_pcmz, description, finaleddate, addeddate` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Commercial Permits | `i26v-w6bd` | [`i26v-w6bd.json`](https://data.montgomerycountymd.gov/resource/i26v-w6bd.json) | `postdir, location_address, usecode, buildingarea` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Construction Activities of Commercial Permits | `7ate-xrxm` | [`7ate-xrxm.json`](https://data.montgomerycountymd.gov/resource/7ate-xrxm.json) | `applicationtype, longitude, city, issueddate` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Mechanical Permits | `ih88-a6aa` | [`ih88-a6aa.json`](https://data.montgomerycountymd.gov/resource/ih88-a6aa.json) | `applicationtype, state, postdir, addeddate` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Use and Occupancy Certificates | `2fhm-xt6p` | [`2fhm-xt6p.json`](https://data.montgomerycountymd.gov/resource/2fhm-xt6p.json) | `added_date, expired_date, post_dir, :@computed_region_6vgr_duib` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Waivers Granted for Personal Home Construction | `kgch-m3dw` | [`kgch-m3dw.json`](https://data.montgomerycountymd.gov/resource/kgch-m3dw.json) | `location, street_name, waiver_decision_date, waiver_date_received` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | DPS - Fire Code Compliance Permit | `a7xm-vjfv` | [`a7xm-vjfv.json`](https://data.montgomerycountymd.gov/resource/a7xm-vjfv.json) | `issue_date, business_name, zip_code, comments` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | DPS - Antenna/Wireless Permits | `djk9-h36c` | [`djk9-h36c.json`](https://data.montgomerycountymd.gov/resource/djk9-h36c.json) | `location, permit_status, attachment_type, tfcg_number` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Commercial Fast Track Permits | `drdm-p89i` | [`drdm-p89i.json`](https://data.montgomerycountymd.gov/resource/drdm-p89i.json) | `finaleddate, declaredvaluation, worktype, permitno` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Public Right Of Way Permits | `2b9e-mbxk` | [`2b9e-mbxk.json`](https://data.montgomerycountymd.gov/resource/2b9e-mbxk.json) | `description, location_zip, wssc, pepco` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Fence Permits | `9quz-avmj` | [`9quz-avmj.json`](https://data.montgomerycountymd.gov/resource/9quz-avmj.json) | `building_area, post_direction, :@computed_region_kbsp_ykn9, :@computed_region_tx5f_5em3` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Residential Impact Tax for Rockville | `3q4c-igb4` | [`3q4c-igb4.json`](https://data.montgomerycountymd.gov/resource/3q4c-igb4.json) | `suffix, applicationtype, predir, zip` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Commercial Impact Tax for Gaithersburg | `uwvj-gxqd` | [`uwvj-gxqd.json`](https://data.montgomerycountymd.gov/resource/uwvj-gxqd.json) | `permitno, tax_amount, status, city` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Residential Impact Tax for Gaithersburg | `qfzq-8jxi` | [`qfzq-8jxi.json`](https://data.montgomerycountymd.gov/resource/qfzq-8jxi.json) | `hige_rise, no_of_units, permitno, predir` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Commercial Impact Tax for Rockville | `r5vz-knwn` | [`r5vz-knwn.json`](https://data.montgomerycountymd.gov/resource/r5vz-knwn.json) | `tax_description, processeddate, tax_amount, description` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | County Well Permits | `vddw-tec2` | [`vddw-tec2.json`](https://data.montgomerycountymd.gov/resource/vddw-tec2.json) | `zip, :@computed_region_vu5j_pcmz, building_area, application_type` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Construction Activities of open (Issued, not final) Public Right-of-Way Permits | `ktqv-9vft` | [`ktqv-9vft.json`](https://data.montgomerycountymd.gov/resource/ktqv-9vft.json) | `stname, :@computed_region_rbt8_3x7n, :@computed_region_6vgr_duib, state` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Electrical Business Licenses | `ydri-y5u9` | [`ydri-y5u9.json`](https://data.montgomerycountymd.gov/resource/ydri-y5u9.json) | `insuranceexpire, address1, expiredate, licensetype` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Fire Alarm Permits | `6m7h-b5eg` | [`6m7h-b5eg.json`](https://data.montgomerycountymd.gov/resource/6m7h-b5eg.json) | `status, pre_dir, post_dir, state` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Sign Permits | `piic-h4rw` | [`piic-h4rw.json`](https://data.montgomerycountymd.gov/resource/piic-h4rw.json) | `:@computed_region_kbsp_ykn9, :@computed_region_d7bw_bq6x, :@computed_region_rbt8_3x7n, pre_dir` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Fire Protection Systems Permits | `87fk-79fk` | [`87fk-79fk.json`](https://data.montgomerycountymd.gov/resource/87fk-79fk.json) | `:@computed_region_kbsp_ykn9, :@computed_region_tx5f_5em3, :@computed_region_vu5j_pcmz, :@computed_region_d7bw_bq6x` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Sewage Disposal Permits | `jf73-mva3` | [`jf73-mva3.json`](https://data.montgomerycountymd.gov/resource/jf73-mva3.json) | `usecode, worktype, stname, geolocation` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Construction Activities of open (Issued, not final) Commercial Demolition Permits | `ha72-8evs` | [`ha72-8evs.json`](https://data.montgomerycountymd.gov/resource/ha72-8evs.json) | `stname, state, worktype, postdir` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Retaining Wall Permits | `gzxt-dxxx` | [`gzxt-dxxx.json`](https://data.montgomerycountymd.gov/resource/gzxt-dxxx.json) | `building_area, longitude, pre_direction, street_suffix` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Historic Area Work Permits | `bhqn-3agh` | [`bhqn-3agh.json`](https://data.montgomerycountymd.gov/resource/bhqn-3agh.json) | `:@computed_region_vu5j_pcmz, geolocation, zip_code, street_name` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | DPS Non-Conforming Use Certificates | `7bgv-mbmu` | [`7bgv-mbmu.json`](https://data.montgomerycountymd.gov/resource/7bgv-mbmu.json) | `added_date, permit_number, city, post_direction` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Limited Master Electrician License | `f637-ajic` | [`f637-ajic.json`](https://data.montgomerycountymd.gov/resource/f637-ajic.json) | `licensedate, applicant, geolocation_zip, jurisdictional_reciprocal` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Limited Electrical Business License | `rmjr-4zb9` | [`rmjr-4zb9.json`](https://data.montgomerycountymd.gov/resource/rmjr-4zb9.json) | `licensedate, geolocation_city, geolocation_address, zip` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Development Standard Variance | `ba7y-a7iy` | [`ba7y-a7iy.json`](https://data.montgomerycountymd.gov/resource/ba7y-a7iy.json) | `garage_carport, state, location1, other` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Transmission Facilities Application Status & Location | `fedv-djbq` | [`fedv-djbq.json`](https://data.montgomerycountymd.gov/resource/fedv-djbq.json) | `city, applicationid, receiveddate, ctcstatus` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Water Quality Protection Charges | `97f6-dhn4` | [`97f6-dhn4.json`](https://data.montgomerycountymd.gov/resource/97f6-dhn4.json) | `location1_address, recreationimpervious, parkingimpervious, buildingimpervious` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | DEP - Levy Year 2024 Solid Waste Charges | `c6x6-qf7b` | [`c6x6-qf7b.json`](https://data.montgomerycountymd.gov/resource/c6x6-qf7b.json) | `sub_category, base_charge, year, leaf_vacuuming_charge` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Food Inspection | `5pue-gfbe` | [`5pue-gfbe.json`](https://data.montgomerycountymd.gov/resource/5pue-gfbe.json) | `location_city, address2, city, zip` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | DEP - FY24 Solid Waste Charges | `tz2f-qusr` | [`tz2f-qusr.json`](https://data.montgomerycountymd.gov/resource/tz2f-qusr.json) | `billing_rate, category, leaf_vacuuming_charge, incremental_systems_benefit` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | DEP - Levy Year 2025 Solid Waste Charges | `rasx-x3ry` | [`rasx-x3ry.json`](https://data.montgomerycountymd.gov/resource/rasx-x3ry.json) | `base_charge_ton, total_bill, incremental_systems_benefit, base_systems_benefit_charge` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | HHS - Food Inspection Data from July 2024 and onward | `dkrp-gr48` | [`dkrp-gr48.json`](https://data.montgomerycountymd.gov/resource/dkrp-gr48.json) | `cooking_time_and_temperature, nosmoking_sign_posted, hot_and_cold_running_water_provided, state` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Sediment Control Permits | `bdky-n9r2` | [`bdky-n9r2.json`](https://data.montgomerycountymd.gov/resource/bdky-n9r2.json) | `project_name, longitude, permit_number, street_suffix` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Food and Pool Plan Review | `2zj7-irhh` | [`2zj7-irhh.json`](https://data.montgomerycountymd.gov/resource/2zj7-irhh.json) | `geolocation_state, date_application_received, sanitarian, geolocation` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | DPS - Floodplain Status Request | `3fq7-5mdv` | [`3fq7-5mdv.json`](https://data.montgomerycountymd.gov/resource/3fq7-5mdv.json) | `pre_direction, latitude, permit_number, state` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | DPS - Sign Variance Permit | `bgjj-gnmw` | [`bgjj-gnmw.json`](https://data.montgomerycountymd.gov/resource/bgjj-gnmw.json) | `street_name, city, description_of_work, street_number` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | Floodplain District Permit | `sgci-afes` | [`sgci-afes.json`](https://data.montgomerycountymd.gov/resource/sgci-afes.json) | `location1_city, city, watershed, application_no` |
| **Montgomery County, MD** | `data.montgomerycountymd.gov` | DPS - Special Exception Permit | `dgbr-vt3c` | [`dgbr-vt3c.json`](https://data.montgomerycountymd.gov/resource/dgbr-vt3c.json) | `post_direction, one_year_periodic, state, application_type` |
| **New York City, NY** | `data.cityofnewyork.us` | DOB Permit Issuance | `ipu4-2q9a` | [`ipu4-2q9a.json`](https://data.cityofnewyork.us/resource/ipu4-2q9a.json) | `permittee_s_last_name, owner_s_zip_code, work_type, owner_s_business_name` |
| **New York City, NY** | `data.cityofnewyork.us` | DOB NOW: Build – Approved Permits | `rbx6-tga4` | [`rbx6-tga4.json`](https://data.cityofnewyork.us/resource/rbx6-tga4.json) | `applicant_middle_name, sequence_number, applicant_first_name, permittee_s_license_type` |
| **New York City, NY** | `data.cityofnewyork.us` | Property Data (Buildings Information System) - Now Retired | `e98g-f8hy` | [`e98g-f8hy.json`](https://data.cityofnewyork.us/resource/e98g-f8hy.json) | `permit_type, permit_issuance_date, permit_bin, permit_application_job_number` |
| **New York City, NY** | `data.cityofnewyork.us` | Bureau of Fire Prevention - Inspections (Historical) | `ssq6-fkht` | [`ssq6-fkht.json`](https://data.cityofnewyork.us/resource/ssq6-fkht.json) | `last_insp_stat, acct_num, census_tract, alpha` |
| **New York City, NY** | `data.cityofnewyork.us` | Primary Land Use Tax Lot Output (PLUTO) | `64uk-42ks` | [`64uk-42ks.json`](https://data.cityofnewyork.us/resource/64uk-42ks.json) | `assessland, unitstotal, yearbuilt, lotdepth` |
| **New York City, NY** | `data.cityofnewyork.us` | DOB Job Application Filings | `ic3t-wcy2` | [`ic3t-wcy2.json`](https://data.cityofnewyork.us/resource/ic3t-wcy2.json) | `bbl, owner_s_last_name, zoning_dist3, standpipe` |
| **New York City, NY** | `data.cityofnewyork.us` | DOB NOW: Electrical Permit Applications | `dm9a-ab7w` | [`dm9a-ab7w.json`](https://data.cityofnewyork.us/resource/dm9a-ab7w.json) | `lighting_work, general_wiring, filing_fee, nogood_check_fee` |
| **New York City, NY** | `data.cityofnewyork.us` | DOB NOW: Build – Limited Alteration Applications | `xxbr-ypig` | [`xxbr-ypig.json`](https://data.cityofnewyork.us/resource/xxbr-ypig.json) | `laasign_off_date, location_borough_name, latitude, location_house_no` |
| **New York City, NY** | `data.cityofnewyork.us` | Historical DOB Permit Issuance | `bty7-2jhb` | [`bty7-2jhb.json`](https://data.cityofnewyork.us/resource/bty7-2jhb.json) | `block, expiration_date, job, community_board` |
| **New York City, NY** | `data.cityofnewyork.us` | DOHMH Childcare Center Inspections (Historical) | `dsg6-ifza` | [`dsg6-ifza.json`](https://data.cityofnewyork.us/resource/dsg6-ifza.json) | `violationstatus, permitnumber, violationratepercent, building` |
| **New York City, NY** | `data.cityofnewyork.us` | Water and Sewer Permits (Historic) | `4k4u-823g` | [`4k4u-823g.json`](https://data.cityofnewyork.us/resource/4k4u-823g.json) | `block, borough, serv_order_type, permit_description` |
| **New York City, NY** | `data.cityofnewyork.us` | DOB NOW: Build Elevator Permit Applications | `kfp4-dz4h` | [`kfp4-dz4h.json`](https://data.cityofnewyork.us/resource/kfp4-dz4h.json) | `total_construction_floor, filing_fee, filingstatus_or_filingincludes, lot` |
| **New York City, NY** | `data.cityofnewyork.us` | DOB NOW: Certificate of Occupancy | `pkdm-hqz6` | [`pkdm-hqz6.json`](https://data.cityofnewyork.us/resource/pkdm-hqz6.json) | `borough, job_filing_name, application_number, c_of_o_filing_type` |
| **New York City, NY** | `data.cityofnewyork.us` | DOB After Hour Variance Permits | `g76y-dcqj` | [`g76y-dcqj.json`](https://data.cityofnewyork.us/resource/g76y-dcqj.json) | `workpermitnumber, cbno, ahv_permit_number, ahvpermitstatus` |
| **New York City, NY** | `data.cityofnewyork.us` | DOB NOW: Build – Job Application Filings | `w9ak-ipjd` | [`w9ak-ipjd.json`](https://data.cityofnewyork.us/resource/w9ak-ipjd.json) | `proposed_dwelling_units, standpipe, applicants_middle_initial, sign` |
| **New York City, NY** | `data.cityofnewyork.us` | Clean Air Tracking System (CATS) Permits | `f4rp-2kvy` | [`f4rp-2kvy.json`](https://data.cityofnewyork.us/resource/f4rp-2kvy.json) | `secondaryfuel, requestid, premisename, street` |
| **New York City, NY** | `data.cityofnewyork.us` | DOB Certificate Of Occupancy | `bs8b-p36w` | [`bs8b-p36w.json`](https://data.cityofnewyork.us/resource/bs8b-p36w.json) | `bin, job_type, council_district, location_city` |
| **New York City, NY** | `data.cityofnewyork.us` | Adding Chemicals to Water Supply Permits | `v8i9-yfpr` | [`v8i9-yfpr.json`](https://data.cityofnewyork.us/resource/v8i9-yfpr.json) | `nta_code, expiration_date, permit_number, zipcode` |
| **New York City, NY** | `data.cityofnewyork.us` | DOB NOW: Build Elevator Device Details | `juyv-2jek` | [`juyv-2jek.json`](https://data.cityofnewyork.us/resource/juyv-2jek.json) | `device_confirming_with_seismic, machine_counterweight_ropes, device_type, fire_rated_construction_type` |
| **New York City, NY** | `data.cityofnewyork.us` | DOB Cellular Antenna Filings | `iz2q-9x8d` | [`iz2q-9x8d.json`](https://data.cityofnewyork.us/resource/iz2q-9x8d.json) | `zoning_distr_2, non_profit, owner_s_last_name, job__` |
| **New York City, NY** | `data.cityofnewyork.us` | Housing Database by Community District | `dbdt-5s7j` | [`dbdt-5s7j.json`](https://data.cityofnewyork.us/resource/dbdt-5s7j.json) | `comp2015, inactive, withdrawn, cenunits20` |
| **New York City, NY** | `data.cityofnewyork.us` | Permitted Nonpotable Wells | `gnyq-kf2y` | [`gnyq-kf2y.json`](https://data.cityofnewyork.us/resource/gnyq-kf2y.json) | `city_council_district, expiration_date, address_st, bo` |
| **New York City, NY** | `data.cityofnewyork.us` | Housing Database by 2020 NTA | `kyz5-72x5` | [`kyz5-72x5.json`](https://data.cityofnewyork.us/resource/kyz5-72x5.json) | `the_geom, approved, comp2016, comp2021` |
| **New York City, NY** | `data.cityofnewyork.us` | Housing Database by 2020 Census Block | `8zyi-kxay` | [`8zyi-kxay.json`](https://data.cityofnewyork.us/resource/8zyi-kxay.json) | `comp2012, comp2021, cenunits20, comp2024` |
| **New York City, NY** | `data.cityofnewyork.us` | Bureau of Fire Prevention - Active Violation Orders (Historical) | `bi53-yph3` | [`bi53-yph3.json`](https://data.cityofnewyork.us/resource/bi53-yph3.json) | `vio_id, census_tract, street, number` |
| **New York City, NY** | `data.cityofnewyork.us` | Housing Database by 2024 City Council | `szq8-b4uy` | [`szq8-b4uy.json`](https://data.cityofnewyork.us/resource/szq8-b4uy.json) | `comp2018, shape_area, comp2015, comp2012` |
| **New York City, NY** | `data.cityofnewyork.us` | Active NYC Health Code Regulated Child Care Programs | `gy3q-4tzp` | [`gy3q-4tzp.json`](https://data.cityofnewyork.us/resource/gy3q-4tzp.json) | `program_name, program_type, borough, census_tract` |
| **New York City, NY** | `data.cityofnewyork.us` | LPC Permit Application Information | `dpm2-m9mq` | [`dpm2-m9mq.json`](https://data.cityofnewyork.us/resource/dpm2-m9mq.json) | `owner_address1, applicant_name, owner_co, applicant_co` |
| **New York City, NY** | `data.cityofnewyork.us` | 421-a(16) Affordable New York Housing Program Completion Extension - Letters of Intent | `pq4c-wbq4` | [`pq4c-wbq4.json`](https://data.cityofnewyork.us/resource/pq4c-wbq4.json) | `reported_dob_bin_number, presumed_borough, reported_property_addresses, ct2020` |
| **New York City, NY** | `data.cityofnewyork.us` | DOB Sign Application Filings | `nyis-y4yr` | [`nyis-y4yr.json`](https://data.cityofnewyork.us/resource/nyis-y4yr.json) | `sign_illumination, plan_assigned_date, lot, block` |
| **New York City, NY** | `data.cityofnewyork.us` | Privately Owned Public Spaces (POPS) | `rvih-nhyn` | [`rvih-nhyn.json`](https://data.cityofnewyork.us/resource/rvih-nhyn.json) | `tax_block, building_address_with_zip, street_name, zip_code` |
| **New York City, NY** | `data.cityofnewyork.us` | DOB NOW: Electrical Permit Details | `xmmq-y7za` | [`xmmq-y7za.json`](https://data.cityofnewyork.us/resource/xmmq-y7za.json) | `unique_id, floor_name, to_floor, floor_hpkw` |
| **New York City, NY** | `data.cityofnewyork.us` | Housing Database by 2020 CDTA | `48dt-mn3z` | [`48dt-mn3z.json`](https://data.cityofnewyork.us/resource/48dt-mn3z.json) | `comp2018, comp2025, the_geom, comp2021` |
| **New York City, NY** | `data.cityofnewyork.us` | Housing Database by 2020 Census Tract | `nahe-je7c` | [`nahe-je7c.json`](https://data.cityofnewyork.us/resource/nahe-je7c.json) | `comp2016, bct2010, filed, comp2024` |
| **New York City, NY** | `data.cityofnewyork.us` | Housing Database Project Level Files | `br6q-ssj3` | [`br6q-ssj3.json`](https://data.cityofnewyork.us/resource/br6q-ssj3.json) | `zoningdst1, :@computed_region_sbqj_enih, firecmpany, councildst` |
| **New York City, NY** | `data.cityofnewyork.us` | NYC Pool Inspections | `3kfa-rvez` | [`3kfa-rvez.json`](https://data.cityofnewyork.us/resource/3kfa-rvez.json) | `nta_code, docket, bbl, of_critical_violations` |
| **New York City, NY** | `data.cityofnewyork.us` | DOHMH School Cafeteria Inspections (2020-Present) | `5ery-qagt` | [`5ery-qagt.json`](https://data.cityofnewyork.us/resource/5ery-qagt.json) | `entityid, schoolname, number, street` |
| **New York City, NY** | `data.cityofnewyork.us` | 485-x Affordable Neighborhoods for New Yorkers: Registrations of Prospective Applicants for Tax Benefits | `rrtd-iyd7` | [`rrtd-iyd7.json`](https://data.cityofnewyork.us/resource/rrtd-iyd7.json) | `presumed_duplicate, reported_property_borough, reported_dob_permit_sequence, nta2020` |
| **New York City, NY** | `data.cityofnewyork.us` | Self-Reported Drinking Water Tank Inspection Results | `gjm4-k24g` | [`gjm4-k24g.json`](https://data.cityofnewyork.us/resource/gjm4-k24g.json) | `si_result_sediment, si_result_biological_growth, council_district, gi_result_overflow_pipes` |
| **New York City, NY** | `data.cityofnewyork.us` | DOHMH New York City Restaurant Inspection Results | `43nn-pn8j` | [`43nn-pn8j.json`](https://data.cityofnewyork.us/resource/43nn-pn8j.json) | `cuisine_description, camis, violation_code, inspection_type` |
| **New York City, NY** | `data.cityofnewyork.us` | NYC Building Energy and Water Data Disclosure for Local Law 84 2023 to Present (Data for Calendar Year 2022-Present) | `5zyy-y8am` | [`5zyy-y8am.json`](https://data.cityofnewyork.us/resource/5zyy-y8am.json) | `electricity_use_generated, property_id, property_name, parent_property_id` |
| **New York City, NY** | `data.cityofnewyork.us` | DOHMH School Cafeteria Inspections (Historical) | `9hxz-c2kj` | [`9hxz-c2kj.json`](https://data.cityofnewyork.us/resource/9hxz-c2kj.json) | `entityid, level, inspectiondate, latitude` |
| **New York City, NY** | `data.cityofnewyork.us` | NYC Drinking Water Tank Inspections and Audits Compliance Results | `rytv-g5ui` | [`rytv-g5ui.json`](https://data.cityofnewyork.us/resource/rytv-g5ui.json) | `census_tract, bbl, activity_type, violation_code` |
| **New York City, NY** | `data.cityofnewyork.us` | Open Restaurant Applications (Historical) | `pitm-atqc` | [`pitm-atqc.json`](https://data.cityofnewyork.us/resource/pitm-atqc.json) | `time_of_submission, approved_for_roadway_seating, community_board, healthcompliance_terms` |
| **New York City, NY** | `data.cityofnewyork.us` | HISTORICAL Sidewalk Café Licenses and Applications | `qcdj-rwhu` | [`qcdj-rwhu.json`](https://data.cityofnewyork.us/resource/qcdj-rwhu.json) | `swc_type, dpqa, intake, community_district` |
| **New York City, NY** | `data.cityofnewyork.us` | Radiation Producing Equipment | `i595-2byq` | [`i595-2byq.json`](https://data.cityofnewyork.us/resource/i595-2byq.json) | `bbl, bin, address, name` |
| **New York City, NY** | `data.cityofnewyork.us` | LinkNYC Kiosk Locations | `s4kf-3yrf` | [`s4kf-3yrf.json`](https://data.cityofnewyork.us/resource/s4kf-3yrf.json) | `:@computed_region_f5dn_yrer, postcode, borough_block_lot_bbl, boro` |
| **New York City, NY** | `data.cityofnewyork.us` | LinkNYC New Site Permit Applications | `xp25-gxux` | [`xp25-gxux.json`](https://data.cityofnewyork.us/resource/xp25-gxux.json) | `:@computed_region_92fq_4b7q, ppt_id, planned_kiosk_type, historic_district_name` |
| **New York City, NY** | `data.cityofnewyork.us` | Open Streets Locations | `uiay-nctu` | [`uiay-nctu.json`](https://data.cityofnewyork.us/resource/uiay-nctu.json) | `apprtostre, apprmonclo, orgname, apprstartd` |
| **New York City, NY** | `data.cityofnewyork.us` | Dining Out NYC Locations | `fpeh-f7ci` | [`fpeh-f7ci.json`](https://data.cityofnewyork.us/resource/fpeh-f7ci.json) | `business_legal_name, postcode, license_type, license_status` |
| **New York City, NY** | `data.cityofnewyork.us` | Local Law 8 of 2020 – Complaints of Illegal Parking of Vehicles Operated on Behalf of the City | `cwy2-px8b` | [`cwy2-px8b.json`](https://data.cityofnewyork.us/resource/cwy2-px8b.json) | `bbl, city, latitude, cross_street_1` |
| **New York City, NY** | `data.cityofnewyork.us` | LinkNYC Kiosk Status (Historical) | `quxm-hmyr` | [`quxm-hmyr.json`](https://data.cityofnewyork.us/resource/quxm-hmyr.json) | `:@computed_region_yeji_bk3q, nta, active_date, site_id` |
| **New York City, NY** | `data.cityofnewyork.us` | LinkNYC Kiosk Status | `n6c5-95xh` | [`n6c5-95xh.json`](https://data.cityofnewyork.us/resource/n6c5-95xh.json) | `wifi_status, cross_street_1, :@computed_region_sbqj_enih, cross_street_2` |
| **New York City, NY** | `data.cityofnewyork.us` | Forestry Work Orders | `bdjm-n7q4` | [`bdjm-n7q4.json`](https://data.cityofnewyork.us/resource/bdjm-n7q4.json) | `woequipment, zipcode, wowireconflict, createddate` |
| **New York City, NY** | `data.cityofnewyork.us` | Street Construction Permits (2022 - Present) | `tqtj-sjs8` | [`tqtj-sjs8.json`](https://data.cityofnewyork.us/resource/tqtj-sjs8.json) | `sidewalkshortdesc, locationgeometry, modifiedon, permitlinearfeet` |
| **New York City, NY** | `data.cityofnewyork.us` | Street Construction Permits - Fee | `9fnm-j6if` | [`9fnm-j6if.json`](https://data.cityofnewyork.us/resource/9fnm-j6if.json) | `permitnumber, feetype, permitfeeamountcharged, createdon` |
| **New York City, NY** | `data.cityofnewyork.us` | Street Construction Permits - Cranes | `hcv3-zacv` | [`hcv3-zacv.json`](https://data.cityofnewyork.us/resource/hcv3-zacv.json) | `modifiedon, craneserialnumber, cranetypeshortdesc, permitnumber` |
| **New York City, NY** | `data.cityofnewyork.us` | Street Construction Permits (2013-2021) | `c9sj-fmsg` | [`c9sj-fmsg.json`](https://data.cityofnewyork.us/resource/c9sj-fmsg.json) | `permitestimatednumberofcuts, permitissuedate, issuedworkenddate, createdon` |
| **New York City, NY** | `data.cityofnewyork.us` | Street Construction Permits - Related Agency | `cj3v-xdpd` | [`cj3v-xdpd.json`](https://data.cityofnewyork.us/resource/cj3v-xdpd.json) | `permitnumber, permitrelatedagencydesc, relatedpermitnumber, createdon` |
| **New York City, NY** | `data.cityofnewyork.us` | Street Construction Permits - Stipulations (2020 - Present) | `gsgx-6efw` | [`gsgx-6efw.json`](https://data.cityofnewyork.us/resource/gsgx-6efw.json) | `permitnumber, stipulationid, stipulationfulltext, createdon` |
| **New York City, NY** | `data.cityofnewyork.us` | Street Construction Permits - Stipulations (Historical) | `pbk5-6r7z` | [`pbk5-6r7z.json`](https://data.cityofnewyork.us/resource/pbk5-6r7z.json) | `createdon, stipulationfulltext, stipulationid, permitnumber` |
| **New York City, NY** | `data.cityofnewyork.us` | Interagency Coordination and Construction Permits Data (MOSYS) | `wye7-nyek` | [`wye7-nyek.json`](https://data.cityofnewyork.us/resource/wye7-nyek.json) | `primary_scope_of_work, sponsoring_agency_entity, address_intersection, multisite_project` |
| **New York City, NY** | `data.cityofnewyork.us` | Holiday Construction Embargo - Block | `4te8-9n3p` | [`4te8-9n3p.json`](https://data.cityofnewyork.us/resource/4te8-9n3p.json) | `the_geom, tostreetna, fromstreet, oftcode` |
| **New York City, NY** | `data.cityofnewyork.us` | Street Closures due to Construction Activities by Block | `i6b5-j7bu` | [`i6b5-j7bu.json`](https://data.cityofnewyork.us/resource/i6b5-j7bu.json) | `fromstreetname, borough_code, work_start_date, uniqueid` |
| **New York City, NY** | `data.cityofnewyork.us` | Street Closures due to Construction Activities by Block and Intersection | `ezy6-djsf` | [`ezy6-djsf.json`](https://data.cityofnewyork.us/resource/ezy6-djsf.json) | `tostreetname, onstreetname, wkt, purpose` |
| **New York City, NY** | `data.cityofnewyork.us` | Holiday Construction Embargo- Intersection | `jr6f-nsuv` | [`jr6f-nsuv.json`](https://data.cityofnewyork.us/resource/jr6f-nsuv.json) | `:@computed_region_f5dn_yrer, :@computed_region_efsh_h5xi, :@computed_region_92fq_4b7q, the_geom` |
| **New York City, NY** | `data.cityofnewyork.us` | Street Closures due to Construction Activities by Intersection | `478a-yykk` | [`478a-yykk.json`](https://data.cityofnewyork.us/resource/478a-yykk.json) | `:@computed_region_f5dn_yrer, :@computed_region_92fq_4b7q, fromstreetname, uniqueid` |
| **New York City, NY** | `data.cityofnewyork.us` | Street Construction Inspections and Corrective Action Requests | `ydkf-mpxb` | [`ydkf-mpxb.json`](https://data.cityofnewyork.us/resource/ydkf-mpxb.json) | `crossstreetname, feetfromcurb, defectivecuts, laneofcut` |
| **New York City, NY** | `data.cityofnewyork.us` | Protected Streets Intersection (Dataset) | `bryy-vqd9` | [`bryy-vqd9.json`](https://data.cityofnewyork.us/resource/bryy-vqd9.json) | `the_geom, oftcode, geoborough, dateprot_1` |
| **New York City, NY** | `data.cityofnewyork.us` | Protected Streets Block (Dataset) | `wyih-3nzf` | [`wyih-3nzf.json`](https://data.cityofnewyork.us/resource/wyih-3nzf.json) | `dateprot_1, geoborough, dateprotec, shape_stle` |
| **New York City, NY** | `data.cityofnewyork.us` | Parks Closure Status Due to COVID-19: Athletic Facilities | `g3xg-qtbc` | [`g3xg-qtbc.json`](https://data.cityofnewyork.us/resource/g3xg-qtbc.json) | `system, subpropertyname, status, red_sign_installed` |
| **NJ (data.nj.gov)** | `data.nj.gov` | NJ Construction Permit Data | `w9se-dmra` | [`w9se-dmra.json`](https://data.nj.gov/resource/w9se-dmra.json) | `manufactured, censusnumber, usegroup, rentgained` |
| **NOLA (data.nola.gov)** | `data.nola.gov` | Building Permits (2018-present) | `nbcf-m6c2` | [`nbcf-m6c2.json`](https://data.nola.gov/resource/nbcf-m6c2.json) | `globalid, the_geom, proposedusecategory, topcat` |
| **NOLA (data.nola.gov)** | `data.nola.gov` | Permits | `rcm3-fn58` | [`rcm3-fn58.json`](https://data.nola.gov/resource/rcm3-fn58.json) | `pin, contractors, currentstatus, heattype` |
| **NOLA (data.nola.gov)** | `data.nola.gov` | Historical Permit Data | `f7tt-z5vu` | [`f7tt-z5vu.json`](https://data.nola.gov/resource/f7tt-z5vu.json) | `description, permitnumber, applicantname, streetdir` |
| **NOLA (data.nola.gov)** | `data.nola.gov` | Permits - BLDS | `72f9-bi28` | [`72f9-bi28.json`](https://data.nola.gov/resource/72f9-bi28.json) | `:@computed_region_evki_aju8, originaladdress1, statuscurrent, issuedate` |
| **NOLA (data.nola.gov)** | `data.nola.gov` | Permit Application Data for the Office of Business and External Services | `aib5-en5t` | [`aib5-en5t.json`](https://data.nola.gov/resource/aib5-en5t.json) | `application_submitted, date_of_first_inspection, address, reason` |
| **NOLA (data.nola.gov)** | `data.nola.gov` | Historical Inspection Requests | `grqp-bvwk` | [`grqp-bvwk.json`](https://data.nola.gov/resource/grqp-bvwk.json) | `violatorname, updateopid, x, createdatetime` |
| **NOLA (data.nola.gov)** | `data.nola.gov` | Non-Commercial Short-Term Rental Licenses | `2ei9-wqw2` | [`2ei9-wqw2.json`](https://data.nola.gov/resource/2ei9-wqw2.json) | `:@computed_region_u4yh_3wk9, owner_permit_documents, operator_permit_documents, :@computed_region_ewbu_t8bu` |
| **NOLA (data.nola.gov)** | `data.nola.gov` | Grass Cutting (Lot Abatement/Chapter 66) | `xhih-vxs6` | [`xhih-vxs6.json`](https://data.nola.gov/resource/xhih-vxs6.json) | `longitude, latestmaintenancecut, casefiled, initialcutassignment` |
| **NORFOLK (data.norfolk.gov)** | `data.norfolk.gov` | Permits and Inspections | `bnrb-u445` | [`bnrb-u445.json`](https://data.norfolk.gov/resource/bnrb-u445.json) | `ftpuser, permit_address, permit_application_date, permit_issue_date` |
| **NORFOLK (data.norfolk.gov)** | `data.norfolk.gov` | Permits | `fahm-yuh4` | [`fahm-yuh4.json`](https://data.norfolk.gov/resource/fahm-yuh4.json) | `permit_number, parent_permit_number, address, gpin` |
| **NORFOLK (data.norfolk.gov)** | `data.norfolk.gov` | Inspections | `ihzr-5x5n` | [`ihzr-5x5n.json`](https://data.norfolk.gov/resource/ihzr-5x5n.json) | `inspection_number, address, gpin, tax_account` |
| **NORFOLK (data.norfolk.gov)** | `data.norfolk.gov` | Complaints | `m9m3-wk2s` | [`m9m3-wk2s.json`](https://data.norfolk.gov/resource/m9m3-wk2s.json) | `complaint_id, gpin, tax_account, address` |
| **NORFOLK (data.norfolk.gov)** | `data.norfolk.gov` | Plan Reviews | `dhk3-hr4y` | [`dhk3-hr4y.json`](https://data.norfolk.gov/resource/dhk3-hr4y.json) | `review_number, permit_or_land_use_application, address, gpin` |
| **NY (data.ny.gov)** | `data.ny.gov` | City of Albany Building Permits Issued:  2009-2013 | `kb9s-4gzd` | [`kb9s-4gzd.json`](https://data.ny.gov/resource/kb9s-4gzd.json) | `location_state, description_of_work, fee, estimated_cost` |
| **NY (data.ny.gov)** | `data.ny.gov` | Local Government Code Officials: Beginning 2007 | `xky4-9pj6` | [`xky4-9pj6.json`](https://data.ny.gov/resource/xky4-9pj6.json) | `is_contractor, middle_name, municipality_type, first_name` |
| **NY (data.ny.gov)** | `data.ny.gov` | Uniform Code Annual Report Submissions: Beginning 2007 | `kpkx-452i` | [`kpkx-452i.json`](https://data.ny.gov/resource/kpkx-452i.json) | `period_start_eff, personnelcount, personnelhoursperweek, complaints_fire_received` |
| **NY (data.ny.gov)** | `data.ny.gov` | Energy Code Annual Report Submissions: Beginning 2007 | `vfqs-vuqv` | [`vfqs-vuqv.json`](https://data.ny.gov/resource/vfqs-vuqv.json) | `e_sup_lte3_blower_door_report, complaints_energy_received, e_sup_compliance_methods, e_sup_existing_residential_1` |
| **NY (data.ny.gov)** | `data.ny.gov` | City of Albany Vacant Building Inventory: 2013 | `nv2j-hmda` | [`nv2j-hmda.json`](https://data.ny.gov/resource/nv2j-hmda.json) | `fire_detection_system_y_n, age_of_building, most_recent_inspector, most_recent_maintenance_notice_of_violation_date` |
| **NY (data.ny.gov)** | `data.ny.gov` | SPDES Multi-Sector General Permit (MSGP) Facilities | `7hs3-2njf` | [`7hs3-2njf.json`](https://data.ny.gov/resource/7hs3-2njf.json) | `primary_permit_sic_code, npdes_id, dec_region, :@computed_region_wbg7_3whc` |
| **NY (data.ny.gov)** | `data.ny.gov` | State Highway Work Permits Issued:  Beginning 2010 | `698j-9a6e` | [`698j-9a6e.json`](https://data.ny.gov/resource/698j-9a6e.json) | `permit_number, location_end_reference_number, location_beginning_reference_number, route` |
| **NY (data.ny.gov)** | `data.ny.gov` | Large-scale Renewable Projects Reported by NYSERDA: Beginning 2004 | `dprp-55ye` | [`dprp-55ye.json`](https://data.ny.gov/resource/dprp-55ye.json) | `new_renewable_capacity_mw, year_of_delivery_start_date, year_of_commercial_operation, redc` |
| **NY (data.ny.gov)** | `data.ny.gov` | Vehicle, Snowmobile, and Boat Registrations | `w4pv-hbkt` | [`w4pv-hbkt.json`](https://data.ny.gov/resource/w4pv-hbkt.json) | `suspension_indicator, reg_valid_date, county, zip` |
| **NY (data.ny.gov)** | `data.ny.gov` | Orphaned Wells | `vgue-bamz` | [`vgue-bamz.json`](https://data.ny.gov/resource/vgue-bamz.json) | `company_name, county, town, api_well_number` |
| **NY (data.ny.gov)** | `data.ny.gov` | NYSDOT Highway Record Plans: Beginning 1900 | `6j6c-aqy9` | [`6j6c-aqy9.json`](https://data.ny.gov/resource/6j6c-aqy9.json) | `cont_no, route, numbersheets, loc_municipality` |
| **NY (data.ny.gov)** | `data.ny.gov` | Title V Emissions Inventory: Beginning 2010 | `4ry5-tfin` | [`4ry5-tfin.json`](https://data.ny.gov/resource/4ry5-tfin.json) | `pm10, location, facility_name, year` |
| **NY (data.ny.gov)** | `data.ny.gov` | Current Descriptive Data of Municipal Wastewater Treatment Plants | `g5a2-qa6a` | [`g5a2-qa6a.json`](https://data.ny.gov/resource/g5a2-qa6a.json) | `plant_class, sludge_digestion, sludge_conditioning, sludge_drying_beds` |
| **NY (health.data.ny.gov)** | `health.data.ny.gov` | Temporary Residences: Last Inspection | `jcb4-hcyb` | [`jcb4-hcyb.json`](https://health.data.ny.gov/resource/jcb4-hcyb.json) | `permitted_corp_name, permitted_owner_operator_name, food_service_establishment_s, state` |
| **OAKLANDCA (data.oaklandca.gov)** | `data.oaklandca.gov` | Soft Story Buildings | `q5mn-iahk` | [`q5mn-iahk.json`](https://data.oaklandca.gov/resource/q5mn-iahk.json) | `soft_story_parcels, race_ethnicity, soft_story_area, percent_of_area_that_is` |
| **OAKLANDCA (data.oaklandca.gov)** | `data.oaklandca.gov` | Vehicular Food Vending | `uprn-fh39` | [`uprn-fh39.json`](https://data.oaklandca.gov/resource/uprn-fh39.json) | `descriptio, the_geom, name` |
| **ORCITIES (data.orcities.org)** | `data.orcities.org` | Franchise Fee (ROW) Survey Data 2019 | `8rt5-pp77` | [`8rt5-pp77.json`](https://data.orcities.org/resource/8rt5-pp77.json) | `company_4_privilege_tax, company_4_per_foot_fee_rate_2, company_5_per_foot_fee_rate_2, company_1_row_usage_fee_3` |
| **ORCITIES (data.orcities.org)** | `data.orcities.org` | State Of The Cities 2017 | `n9hh-kmv5` | [`n9hh-kmv5.json`](https://data.orcities.org/resource/n9hh-kmv5.json) | `q15_1_city_hall, q14_over_the_last_several_years_cities_have_taken_a_wide_range_of_budget_balanc, q5_4_actual_infrastructure_spending, q13_do_you_expect_future_city_service_demand_to` |
| **ORCITIES (data.orcities.org)** | `data.orcities.org` | 2023 Water Rates Survey Data | `6m6g-823g` | [`6m6g-823g.json`](https://data.orcities.org/resource/6m6g-823g.json) | `please_list_the_amount_of_3, what_is_the_service_population_5, does_your_city_charge_for_2, what_method_is_used_to` |
| **ORCITIES (data.orcities.org)** | `data.orcities.org` | Water Rates Data 2021 | `ym9k-v6dn` | [`ym9k-v6dn.json`](https://data.orcities.org/resource/ym9k-v6dn.json) | `please_provide_the_following_18, please_provide_the_following_20, please_provide_the_following_21, in_what_year_will_the` |
| **ORCITIES (data.orcities.org)** | `data.orcities.org` | Water Rates Survey Data 2019 | `q75m-xxc4` | [`q75m-xxc4.json`](https://data.orcities.org/resource/q75m-xxc4.json) | `do_you_provide_paperless, thank_you_for_participating, do_you_have_any_additional_2, what_is_the_average_equivalent` |
| **OREGON (data.oregon.gov)** | `data.oregon.gov` | Current and Proposed Long-term Rural Enterprise Zone Facilities | `re77-krua` | [`re77-krua.json`](https://data.oregon.gov/resource/re77-krua.json) | `cetified_business_firm, facility_or, local_certification_date, investment_required_by_year_operations_begin` |
| **Oxnard, CA** | `data.oxnard.org` | Building Permits | `vmzx-48vx` | [`vmzx-48vx.json`](https://data.oxnard.org/resource/vmzx-48vx.json) | `permitdescription, apptype, appnum, fulladdress` |
| **PA (data.pa.gov)** | `data.pa.gov` | Radon Test Results September 1986 - Current Annual County Environmental Protection | `vkjb-sx3k` | [`vkjb-sx3k.json`](https://data.pa.gov/resource/vkjb-sx3k.json) | `mitigation_system_indicator, building_type_code, building_purpose_code, radon_data_source_name` |
| **PA (data.pa.gov)** | `data.pa.gov` | Child Care Providers including Early Learning Programs Listing Current Monthly Facility County Human Services | `ajn5-kaxt` | [`ajn5-kaxt.json`](https://data.pa.gov/resource/ajn5-kaxt.json) | `geocoded_column, mpi_location_id, provider_type, facility_address` |
| **PA (data.pa.gov)** | `data.pa.gov` | Uninsured Population Census Data CY 2009-2014 Human Services | `s782-mpqp` | [`s782-mpqp.json`](https://data.pa.gov/resource/s782-mpqp.json) | `population_18_to_64_years, location_1_address, county_code_number, population_18_to_64_years_moe` |
| **PA (data.pa.gov)** | `data.pa.gov` | Air Quality Continuous Emission Monitoring System (CEMS) 1986 -Current Quarterly Environmental Protection | `5s9f-3bq4` | [`5s9f-3bq4.json`](https://data.pa.gov/resource/5s9f-3bq4.json) | `pollutant, source_name, county_name, latitude_seconds` |
| **PA (data.pa.gov)** | `data.pa.gov` | Waste Management, Resource Conservation and Recovery Act (RCRAInfo) | `8aqs-mzku` | [`8aqs-mzku.json`](https://data.pa.gov/resource/8aqs-mzku.json) | `county_code, universal_waste_owner, land_based_unit_ind_text, land_based_unit_ind` |
| **Parker, CO** | `parkeronline.data.socrata.com` | Parker Building Permits | `f6vi-7y2m` | [`f6vi-7y2m.json`](https://parkeronline.data.socrata.com/resource/f6vi-7y2m.json) | `location, legal_description, subdivision_name, job_valuation` |
| **PIERCECOUNTYWA (internal.open.piercecountywa.gov)** | `internal.open.piercecountywa.gov` | Average Days to Approve Commercial Permits with Annual Average | `4ze4-rs86` | [`4ze4-rs86.json`](https://internal.open.piercecountywa.gov/resource/4ze4-rs86.json) | `valuation, permit_value_category, permit_type, permit_id` |
| **PIERCECOUNTYWA (internal.open.piercecountywa.gov)** | `internal.open.piercecountywa.gov` | Average Wait Time in Development Center | `tpf3-85ju` | [`tpf3-85ju.json`](https://internal.open.piercecountywa.gov/resource/tpf3-85ju.json) | `date, wait_time, month, number_of_customers` |
| **PIERCECOUNTYWA (internal.open.piercecountywa.gov)** | `internal.open.piercecountywa.gov` | Average Fee Costs by Type | `qthc-4e6d` | [`qthc-4e6d.json`](https://internal.open.piercecountywa.gov/resource/qthc-4e6d.json) | `jurisdiction, average_amount_money, year, fee_type` |
| **PIERCECOUNTYWA (internal.open.piercecountywa.gov)** | `internal.open.piercecountywa.gov` | Average Days to Approve Residential Permits with Annual Aggregate | `cxz2-6pst` | [`cxz2-6pst.json`](https://internal.open.piercecountywa.gov/resource/cxz2-6pst.json) | `number_of_days, valuation, permit_type_flag, permit_type` |
| **PIERCECOUNTYWA (internal.open.piercecountywa.gov)** | `internal.open.piercecountywa.gov` | Permits - Pierce County | `nhnt-v7ka` | [`nhnt-v7ka.json`](https://internal.open.piercecountywa.gov/resource/nhnt-v7ka.json) | `projectname, projectvalue, projectid, approvaldate` |
| **PIERCECOUNTYWA (internal.open.piercecountywa.gov)** | `internal.open.piercecountywa.gov` | Historical Pierce County Fees by Type | `cbjs-fy9x` | [`cbjs-fy9x.json`](https://internal.open.piercecountywa.gov/resource/cbjs-fy9x.json) | `fee_type, average_amount_money, jurisdiction, percent_change` |
| **PIERCECOUNTYWA (internal.open.piercecountywa.gov)** | `internal.open.piercecountywa.gov` | Days to Approve SFR-COM-MED-AVG | `r54f-2iqe` | [`r54f-2iqe.json`](https://internal.open.piercecountywa.gov/resource/r54f-2iqe.json) | `sfr_average, com_median, date, com_valuation` |
| **PIERCECOUNTYWA (internal.open.piercecountywa.gov)** | `internal.open.piercecountywa.gov` | DEM Fire Prevention Bureau Residential Application Reviews | `v4rn-zxma` | [`v4rn-zxma.json`](https://internal.open.piercecountywa.gov/resource/v4rn-zxma.json) | `percentage_of_permits_reviewed, month, number_of_permit_applications, date` |
| **PIERCECOUNTYWA (internal.open.piercecountywa.gov)** | `internal.open.piercecountywa.gov` | Number of New Housing Starts | `tnmq-dd3f` | [`tnmq-dd3f.json`](https://internal.open.piercecountywa.gov/resource/tnmq-dd3f.json) | `new_home_starts_single_family, multi_family_home_starts, month, year` |
| **PIERCECOUNTYWA (internal.open.piercecountywa.gov)** | `internal.open.piercecountywa.gov` | DEM Fire Prevention Bureau Commercial Application Review | `qrep-c92t` | [`qrep-c92t.json`](https://internal.open.piercecountywa.gov/resource/qrep-c92t.json) | `number_of_permits_with_review, year, date, number_of_permits_with_review_1` |
| **PIERCECOUNTYWA (internal.open.piercecountywa.gov)** | `internal.open.piercecountywa.gov` | PPW Permit Activity by Month | `esuz-yhgd` | [`esuz-yhgd.json`](https://internal.open.piercecountywa.gov/resource/esuz-yhgd.json) | `number_of_permits, permit_category, month, date` |
| **PIERCECOUNTYWA (internal.open.piercecountywa.gov)** | `internal.open.piercecountywa.gov` | Commercial Permit_Valuations&Mapping | `6cud-qad2` | [`6cud-qad2.json`](https://internal.open.piercecountywa.gov/resource/6cud-qad2.json) | `work_type, x_coord, y_coord, geocoded_column` |
| **PIERCECOUNTYWA (internal.open.piercecountywa.gov)** | `internal.open.piercecountywa.gov` | Address Points | `ewun-9uc6` | [`ewun-9uc6.json`](https://internal.open.piercecountywa.gov/resource/ewun-9uc6.json) | `prefixdirectional, city, addressid, address` |
| **PIERCECOUNTYWA (internal.open.piercecountywa.gov)** | `internal.open.piercecountywa.gov` | DEM Residential Building Applications | `rvrf-86ma` | [`rvrf-86ma.json`](https://internal.open.piercecountywa.gov/resource/rvrf-86ma.json) | `appl_status_desc, proj_appl_issued_dt, proj_appl_exp_dt, proj_appl_desc` |
| **PIERCECOUNTYWA (internal.open.piercecountywa.gov)** | `internal.open.piercecountywa.gov` | Development Engineering - Other Land Use | `ff72-775q` | [`ff72-775q.json`](https://internal.open.piercecountywa.gov/resource/ff72-775q.json) | `pcde_cd, objectid, file_loc_desc, proj_status_cd` |
| **PIERCECOUNTYWA (internal.open.piercecountywa.gov)** | `internal.open.piercecountywa.gov` | Development Engineering - Large Lots | `qdcv-6g9t` | [`qdcv-6g9t.json`](https://internal.open.piercecountywa.gov/resource/qdcv-6g9t.json) | `last_nm, first_nm, file_loc_desc, auditor_id` |
| **PIERCECOUNTYWA (internal.open.piercecountywa.gov)** | `internal.open.piercecountywa.gov` | Development Engineering - Formal Plats | `n7r6-45rd` | [`n7r6-45rd.json`](https://internal.open.piercecountywa.gov/resource/n7r6-45rd.json) | `proj_type_nm, proj_sys_id, last_nm, first_nm` |
| **PIERCECOUNTYWA (internal.open.piercecountywa.gov)** | `internal.open.piercecountywa.gov` | Development Engineering - Commercial | `d8gt-bwgs` | [`d8gt-bwgs.json`](https://internal.open.piercecountywa.gov/resource/d8gt-bwgs.json) | `last_nm, file_loc_cd, proj_status_nm, proj_type_nm` |
| **PIERCECOUNTYWA (internal.open.piercecountywa.gov)** | `internal.open.piercecountywa.gov` | Development Engineering - Short Plats | `ck7n-82ff` | [`ck7n-82ff.json`](https://internal.open.piercecountywa.gov/resource/ck7n-82ff.json) | `pcde_map, proj_type_cd, lots_subm, fg_ref_id` |
| **PIERCECOUNTYWA (internal.open.piercecountywa.gov)** | `internal.open.piercecountywa.gov` | Development Engineering - Mobile Homes | `tc5s-t29k` | [`tc5s-t29k.json`](https://internal.open.piercecountywa.gov/resource/tc5s-t29k.json) | `lots_subm, pcde_map, proj_status_nm, objectid` |
| **PLANO (dashboard.plano.gov)** | `dashboard.plano.gov` | Building Inspection Performance Measures | `ac95-z5wm` | [`ac95-z5wm.json`](https://dashboard.plano.gov/resource/ac95-z5wm.json) | `permits_issued, inspections_made_within_24_hours, _month, commercial_plan_review` |
| **PRINCEGEORGESCOUNTYMD (data.princegeorgescountymd.gov)** | `data.princegeorgescountymd.gov` | Residential and Commercial Permits (July 2013 to Present) | `weik-ttee` | [`weik-ttee.json`](https://data.princegeorgescountymd.gov/resource/weik-ttee.json) | `location, case_name, permit_category, city` |
| **PRINCEGEORGESCOUNTYMD (data.princegeorgescountymd.gov)** | `data.princegeorgescountymd.gov` | Residential and Commercial Permits (Jan 2012 through June 2013) | `dqvr-xqvv` | [`dqvr-xqvv.json`](https://data.princegeorgescountymd.gov/resource/dqvr-xqvv.json) | `location_address, location_city, permit_case_id, city` |
| **PRINCEGEORGESCOUNTYMD (data.princegeorgescountymd.gov)** | `data.princegeorgescountymd.gov` | Residential, Commercial and Site Road Permits (May 2023 to Present) | `245r-4wz8` | [`245r-4wz8.json`](https://data.princegeorgescountymd.gov/resource/245r-4wz8.json) | `permit_issued_date, city, approved_construction_cost, unit` |
| **PRINCEGEORGESCOUNTYMD (performance.princegeorgescountymd.gov)** | `performance.princegeorgescountymd.gov` | 168 1.2 | `bnii-pyjh` | [`bnii-pyjh.json`](https://performance.princegeorgescountymd.gov/resource/bnii-pyjh.json) | `average_number_of_cycles_for_building_plan_review, percent_of_site_road_plan_review_division_staff_that_received_training, average_number_of_building_plan_reviews_completed_per_building_plan_review_staff, number_of_building_plan_permits_issued` |
| **PRINCEGEORGESCOUNTYMD (performance.princegeorgescountymd.gov)** | `performance.princegeorgescountymd.gov` | 168- FY 2019 Proposed, Performance Metrics, Obj 1.1 | `fkyx-iifc` | [`fkyx-iifc.json`](https://performance.princegeorgescountymd.gov/resource/fkyx-iifc.json) | `number_of_building_plan_reviewers, fy_text, number_of_site_road_plan_reviewers, number_of_outside_individuals_certified_for_peer_review_program_building` |
| **PRINCEGEORGESCOUNTYMD (performance.princegeorgescountymd.gov)** | `performance.princegeorgescountymd.gov` | 168 1.1 | `93p7-q7nr` | [`93p7-q7nr.json`](https://performance.princegeorgescountymd.gov/resource/93p7-q7nr.json) | `number_of_outside_individuals_certified_for_peer_review_program_site_road, average_number_of_building_plan_reviews_completed_per_building_plan_review_staff, number_of_site_road_plan_applications_submitted, number_of_outside_individuals_certified_for_third_party_plan_review_site_road` |
| **PRINCEGEORGESCOUNTYMD (performance.princegeorgescountymd.gov)** | `performance.princegeorgescountymd.gov` | 168- FY 2019 Proposed, Performance Metrics, Obj 1.2 | `qnpr-4rhz` | [`qnpr-4rhz.json`](https://performance.princegeorgescountymd.gov/resource/qnpr-4rhz.json) | `number_of_building_plan_applications_submitted, average_time_days_for_dpie_to_review_permit_applications_for_new_building_projects_and_site_road_development_projects, reported_value_of_building_construction_for_approved_plans_in_millions, percent_of_site_road_plans_screened_new_submissions` |
| **Providence, RI** | `data.providenceri.gov` | Department of Inspections and Standards Permits 2009-2018 | `ufmm-rbej` | [`ufmm-rbej.json`](https://data.providenceri.gov/resource/ufmm-rbej.json) | `geocoded_column_zip, geocoded_column_city, :@computed_region_asue_2ipu, :@computed_region_cjq3_kq3a` |
| **RAMSEYCOUNTYMN (data.ramseycountymn.gov)** | `data.ramseycountymn.gov` | Affordable Housing Production, Ramsey County | `na8e-j6xs` | [`na8e-j6xs.json`](https://data.ramseycountymn.gov/resource/na8e-j6xs.json) | `co_code, ctu_code, quantity, coctu_id` |
| **Roseville, CA** | `data.roseville.ca.us` | Building Permits Issued | `buxi-gsvq` | [`buxi-gsvq.json`](https://data.roseville.ca.us/resource/buxi-gsvq.json) | `sq_footage, job_value, dwell_sf, record_group` |
| **San Diego County, CA** | `internal-sandiegocounty.data.socrata.com` | Building Permits | `dyzh-7eat` | [`dyzh-7eat.json`](https://internal-sandiegocounty.data.socrata.com/resource/dyzh-7eat.json) | `record_id, primary_scope_code, use, street_address` |
| **San Diego County, CA** | `internal-sandiegocounty.data.socrata.com` | Building Permits - Contractors | `76h4-nnmj` | [`76h4-nnmj.json`](https://internal-sandiegocounty.data.socrata.com/resource/76h4-nnmj.json) | `contractortradem, contractoraddress2, contractorlicnum, contractorzip` |
| **San Diego County, CA** | `internal-sandiegocounty.data.socrata.com` | Building Permits 2017 | `aft7-dudp` | [`aft7-dudp.json`](https://internal-sandiegocounty.data.socrata.com/resource/aft7-dudp.json) | `originalzip, contractoraddress2, contractorlicnum, permittype` |
| **San Diego County, CA** | `internal-sandiegocounty.data.socrata.com` | Building Permits 2012 | `gs2m-invt` | [`gs2m-invt.json`](https://internal-sandiegocounty.data.socrata.com/resource/gs2m-invt.json) | `originaladdress1, issueddate, applieddate, contractoremail` |
| **San Diego County, CA** | `internal-sandiegocounty.data.socrata.com` | Building Permits 2010 | `drv2-yz75` | [`drv2-yz75.json`](https://internal-sandiegocounty.data.socrata.com/resource/drv2-yz75.json) | `contractorzip, contractortradem, fee, permitnum` |
| **San Diego County, CA** | `internal-sandiegocounty.data.socrata.com` | Building Permits 2015 | `gd8d-jveh` | [`gd8d-jveh.json`](https://internal-sandiegocounty.data.socrata.com/resource/gd8d-jveh.json) | `publisher, contractorzip, contractorlicnum, originalzip` |
| **San Diego County, CA** | `internal-sandiegocounty.data.socrata.com` | Building Permits - Status History | `vdf3-79qr` | [`vdf3-79qr.json`](https://internal-sandiegocounty.data.socrata.com/resource/vdf3-79qr.json) | `statusprevious, id, statusid, statuspreviousdate` |
| **San Diego County, CA** | `internal-sandiegocounty.data.socrata.com` | Building Permits 2016 | `x4nm-bcxc` | [`x4nm-bcxc.json`](https://internal-sandiegocounty.data.socrata.com/resource/x4nm-bcxc.json) | `coissueddate, permitclass, proposedused, permittype` |
| **San Diego County, CA** | `internal-sandiegocounty.data.socrata.com` | Building Permits 2013 | `gj2w-b96x` | [`gj2w-b96x.json`](https://internal-sandiegocounty.data.socrata.com/resource/gj2w-b96x.json) | `expiresdate, permittype, addedsqft, permittypemapped` |
| **San Diego County, CA** | `internal-sandiegocounty.data.socrata.com` | Contractor Trades - Building Permits | `eqjy-uqyj` | [`eqjy-uqyj.json`](https://internal-sandiegocounty.data.socrata.com/resource/eqjy-uqyj.json) | `id, contractortrade, contractorlicnum, contractorcompan` |
| **San Diego County, CA** | `internal-sandiegocounty.data.socrata.com` | Building Permits 2014 | `k69i-wvqz` | [`k69i-wvqz.json`](https://internal-sandiegocounty.data.socrata.com/resource/k69i-wvqz.json) | `statuscurrentmapped, workclass, permittypemapped, housingunits` |
| **San Diego County, CA** | `internal-sandiegocounty.data.socrata.com` | Building Permits 2011 | `rsbt-2w3h` | [`rsbt-2w3h.json`](https://internal-sandiegocounty.data.socrata.com/resource/rsbt-2w3h.json) | `originalcity, contractoraddress2, workclass, id` |
| **San Diego County, CA** | `internal-sandiegocounty.data.socrata.com` | Planning & Development Services - Performance | `uxjn-aerv` | [`uxjn-aerv.json`](https://internal-sandiegocounty.data.socrata.com/resource/uxjn-aerv.json) | `quarter, frequency, fiscal_year, kw_commercial` |
| **San Diego County, CA** | `internal-sandiegocounty.data.socrata.com` | Building Inspections | `fan4-6gvy` | [`fan4-6gvy.json`](https://internal-sandiegocounty.data.socrata.com/resource/fan4-6gvy.json) | `inspector, :@computed_region_ka36_wfdn, id, geocoded_column_state` |
| **San Diego County, CA** | `internal-sandiegocounty.data.socrata.com` | Discretionary Planning Applications | `afgf-rb36` | [`afgf-rb36.json`](https://internal-sandiegocounty.data.socrata.com/resource/afgf-rb36.json) | `record_id, project_name, planning_area, last_updated` |
| **San Diego County, CA** | `internal-sandiegocounty.data.socrata.com` | Construction Permits | `euk3-bj2v` | [`euk3-bj2v.json`](https://internal-sandiegocounty.data.socrata.com/resource/euk3-bj2v.json) | `state, geocoded_column_state, :@computed_region_ka36_wfdn, :@computed_region_3j2u_hbuy` |
| **Seattle, WA** | `cos-data.seattle.gov` | Building Permits | `76t5-zqzr` | [`76t5-zqzr.json`](https://cos-data.seattle.gov/resource/76t5-zqzr.json) | `standardplan, link, location1_address, location1_zip` |
| **Seattle, WA** | `cos-data.seattle.gov` | Plan Comments | `e285-aq8h` | [`e285-aq8h.json`](https://cos-data.seattle.gov/resource/e285-aq8h.json) | `documentdate, url, comment, documenttitle` |
| **Seattle, WA** | `cos-data.seattle.gov` | Permit Fees | `k8z7-3feg` | [`k8z7-3feg.json`](https://cos-data.seattle.gov/resource/k8z7-3feg.json) | `feedescription, feeamountpaid, link, permitnum` |
| **Seattle, WA** | `cos-data.seattle.gov` | Plan Review | `tqk8-y2z5` | [`tqk8-y2z5.json`](https://cos-data.seattle.gov/resource/tqk8-y2z5.json) | `reviewpriority, housingunitsremoved, permittypedesc, permitclass` |
| **Seattle, WA** | `cos-data.seattle.gov` | Building Certificates of Occupancy | `axkr-2p68` | [`axkr-2p68.json`](https://cos-data.seattle.gov/resource/axkr-2p68.json) | `occupancy_type_s, certificate_of_occupancy_date, temporary_certificate_of_occupancy_expiration_date, permit_number` |
| **Seattle, WA** | `cos-data.seattle.gov` | Land Use Permits | `ht3q-kdvx` | [`ht3q-kdvx.json`](https://cos-data.seattle.gov/resource/ht3q-kdvx.json) | `originalstate, contractorcompanyname, originaladdress1, expiresdate` |
| **Seattle, WA** | `performance.seattle.gov` | Construction Permit Wait Times | `4wuf-ppb4` | [`4wuf-ppb4.json`](https://performance.seattle.gov/resource/4wuf-ppb4.json) | `month, avg_monthly_construction_permit_wait_time_minutes` |
| **Seattle, WA** | `performance.seattle.gov` | Construction Permits Wait Timedata2014-12 | `2e23-qekg` | [`2e23-qekg.json`](https://performance.seattle.gov/resource/2e23-qekg.json) | `avg_monthly_construction_permit_wait_time_minutes, month` |
| **Seattle, WA** | `performance.seattle.gov` | Construction Permits Wait Timedata2015-12 | `r8wi-dx5v` | [`r8wi-dx5v.json`](https://performance.seattle.gov/resource/r8wi-dx5v.json) | `avg_monthly_construction_permit_wait_time_minutes, month` |
| **Seattle, WA** | `performance.seattle.gov` | Construction Permits Wait Timedata2016-03 | `7inr-ryj6` | [`7inr-ryj6.json`](https://performance.seattle.gov/resource/7inr-ryj6.json) | `avg_monthly_construction_permit_wait_time_minutes, month` |
| **Seattle, WA** | `performance.seattle.gov` | Construction Permits Wait Timedata2015-11 | `dxmi-ng2q` | [`dxmi-ng2q.json`](https://performance.seattle.gov/resource/dxmi-ng2q.json) | `month, avg_monthly_construction_permit_wait_time_minutes` |
| **Seattle, WA** | `performance.seattle.gov` | Construction Permits Wait Timedata2015-08 | `numb-5jfy` | [`numb-5jfy.json`](https://performance.seattle.gov/resource/numb-5jfy.json) | `avg_monthly_construction_permit_wait_time_minutes, month` |
| **Seattle, WA** | `performance.seattle.gov` | Construction Permits Wait Times 2016 May | `4z97-7mig` | [`4z97-7mig.json`](https://performance.seattle.gov/resource/4z97-7mig.json) | `avg_monthly_construction_permit_wait_time_minutes, month` |
| **Seattle, WA** | `performance.seattle.gov` | Construction Permits Wait Times 2016 09 | `mw82-vxyk` | [`mw82-vxyk.json`](https://performance.seattle.gov/resource/mw82-vxyk.json) | `avg_monthly_construction_permit_wait_time_minutes, month` |
| **Seattle, WA** | `performance.seattle.gov` | Construction Permits Wait Times 2016 06 | `38de-pjnk` | [`38de-pjnk.json`](https://performance.seattle.gov/resource/38de-pjnk.json) | `avg_monthly_construction_permit_wait_time_minutes, month` |
| **Seattle, WA** | `performance.seattle.gov` | Construction IP Reviews | `k4cz-j2ng` | [`k4cz-j2ng.json`](https://performance.seattle.gov/resource/k4cz-j2ng.json) | `complex_construction_permits_ip_9_weeks, date, weighted_average_of_3_types, medium_construction_permits_ip_3_weeks` |
| **Seattle, WA** | `performance.seattle.gov` | Construction IP Volume | `dpyg-98kc` | [`dpyg-98kc.json`](https://performance.seattle.gov/resource/dpyg-98kc.json) | `medium_construction_permits, date, complex_construction_permits, total_volume` |
| **Seattle, WA** | `performance.seattle.gov` | Construction Use Permitsdata2014-12 | `2gag-ptfq` | [`2gag-ptfq.json`](https://performance.seattle.gov/resource/2gag-ptfq.json) | `month, monthly_number_of_construction_permit_use_applications` |
| **Seattle, WA** | `cos-data.seattle.gov` | Street Closures | `ium9-iqtc` | [`ium9-iqtc.json`](https://cos-data.seattle.gov/resource/ium9-iqtc.json) | `project_description, start_date, sunday, tuesday` |
| **Seattle, WA** | `cos-data.seattle.gov` | Electrical Permits | `c4tj-daue` | [`c4tj-daue.json`](https://cos-data.seattle.gov/resource/c4tj-daue.json) | `statuscurrent, longitude, latitude, issueddate` |
| **Seattle, WA** | `cos-data.seattle.gov` | Trade Permits | `c87v-5hwh` | [`c87v-5hwh.json`](https://cos-data.seattle.gov/resource/c87v-5hwh.json) | `originalstate, expiresdate, applieddate, completeddate` |
| **Seattle, WA** | `cos-data.seattle.gov` | Rental Property Registration | `j2xh-c7vt` | [`j2xh-c7vt.json`](https://cos-data.seattle.gov/resource/j2xh-c7vt.json) | `statuscurrent, location1_address, expiresdate, rentalhousingunits` |
| **Seattle, WA** | `cos-data.seattle.gov` | Annual Parking Study Data | `7jzm-ucez` | [`7jzm-ucez.json`](https://cos-data.seattle.gov/resource/7jzm-ucez.json) | `study_area, rpz_blocks, subarea_label, idling` |
| **SMCGOV (datahub.smcgov.org)** | `datahub.smcgov.org` | Percentage of Online Permits Issued By Year | `gzyb-dkea` | [`gzyb-dkea.json`](https://datahub.smcgov.org/resource/gzyb-dkea.json) | `percentage_of_online_permits, fiscal_year` |
| **SMCGOV (datahub.smcgov.org)** | `datahub.smcgov.org` | Countywide Waste by Destination 1995 - 2013 | `5zdb-fcbs` | [`5zdb-fcbs.json`](https://datahub.smcgov.org/resource/5zdb-fcbs.json) | `destination_facility, disposal_ton, report_quarter, total_adc` |
| **SMCGOV (datahub.smcgov.org)** | `datahub.smcgov.org` | Countywide Waste by Origin 1995 - 2013 | `rjea-7x8a` | [`rjea-7x8a.json`](https://datahub.smcgov.org/resource/rjea-7x8a.json) | `transformation_ton, disposal_ton, report_quarter, origin_jurisdiction` |
| **SMCGOV (performance.smcgov.org)** | `performance.smcgov.org` | Number of Building Permits Issued for New Accessory Dwelling Units (ADUs)* | `qbqx-b55w` | [`qbqx-b55w.json`](https://performance.smcgov.org/resource/qbqx-b55w.json) | `dept_name, benchmark_met, measure_type, date` |
| **SMCGOV (performance.smcgov.org)** | `performance.smcgov.org` | Total housing units permitted by calendar year as a percentage of the County’s current RHNA target | `aduu-rzrp` | [`aduu-rzrp.json`](https://performance.smcgov.org/resource/aduu-rzrp.json) | `reporting_frequency, year, id, benchmark_met` |
| **SMCGOV (performance.smcgov.org)** | `performance.smcgov.org` | RHNA Income Level - Units and Permits Assigned | `43d4-6m6k` | [`43d4-6m6k.json`](https://performance.smcgov.org/resource/43d4-6m6k.json) | `budget_book, date, _2023_2031_rhna_units_assigned, id` |
| **SMCGOV (performance.smcgov.org)** | `performance.smcgov.org` | RHNA Income Level Units Assigned and Permits Issued | `b53h-ychg` | [`b53h-ychg.json`](https://performance.smcgov.org/resource/b53h-ychg.json) | `on_track, _2023_2031_rhna_units_assigned, measure_name, dept_name` |
| **SOCRATA (austin-metro.demo.socrata.com)** | `austin-metro.demo.socrata.com` | Building Permits BLDS Standard_2 | `qufe-kwqh` | [`qufe-kwqh.json`](https://austin-metro.demo.socrata.com/resource/qufe-kwqh.json) | `location_city, fee, total_unfinished_square_feet, project_name` |
| **SOCRATA (austin-metro.demo.socrata.com)** | `austin-metro.demo.socrata.com` | Issued Construction Permits - 2017 | `5m9h-spty` | [`5m9h-spty.json`](https://austin-metro.demo.socrata.com/resource/5m9h-spty.json) | `plumbingvaluationremodel, contractoraddress1, contractorcity, contractorzip` |
| **SOCRATA (celebratingcities.data.socrata.com)** | `celebratingcities.data.socrata.com` | Housing Permits | `ydrm-52a5` | [`ydrm-52a5.json`](https://celebratingcities.data.socrata.com/resource/ydrm-52a5.json) | `permitdescription, cost_est, dateexpire, existing_use` |
| **SOCRATA (celebratingcities.data.socrata.com)** | `celebratingcities.data.socrata.com` | Construction Permits Via DDOT TOPs | `kxsj-ds6t` | [`kxsj-ds6t.json`](https://celebratingcities.data.socrata.com/resource/kxsj-ds6t.json) | `edz, location_1_zip, location_1, onsegy` |
| **SOCRATA (coa-internal.demo.socrata.com)** | `coa-internal.demo.socrata.com` | Issued Construction Permits | `iax2-uguz` | [`iax2-uguz.json`](https://coa-internal.demo.socrata.com/resource/iax2-uguz.json) | `issueddate, fiscalyearissued, tcad_id, applicantaddress1` |
| **SOCRATA (gainesville-govstat.demo.socrata.com)** | `gainesville-govstat.demo.socrata.com` | Building_Inspection_Metrics | `udwx-ddq8` | [`udwx-ddq8.json`](https://gainesville-govstat.demo.socrata.com/resource/udwx-ddq8.json) | `bemp_inspections_completed, fiscal_year_fiscal_quarter, personnel_and_operating_expenditures_for_bemp_inspections, average_cost_per_plan_review` |
| **SOCRATA (gnb.socrata.com)** | `gnb.socrata.com` | Building permits, by type of structure and type of work, NB / Permis de bâtir, par type de structure et type de travaux, NB | `hdpt-etmk` | [`hdpt-etmk.json`](https://gnb.socrata.com/resource/hdpt-etmk.json) | `total_residential_and_non, total_institutional_and, total_commercial_value_of, total_industrial_number_of` |
| **SOCRATA (illinois-edp.data.socrata.com)** | `illinois-edp.data.socrata.com` | City of Rockford Building Permits | `3k8p-pkx8` | [`3k8p-pkx8.json`](https://illinois-edp.data.socrata.com/resource/3k8p-pkx8.json) | `month, valuation, propertyaddress, dateissued1` |
| **SOCRATA (illinois-edp.data.socrata.com)** | `illinois-edp.data.socrata.com` | City of Urbana: Community Development Permits Issued | `dvw9-7wyx` | [`dvw9-7wyx.json`](https://illinois-edp.data.socrata.com/resource/dvw9-7wyx.json) | `estimated_cost, georeference, permit_address_mapped, permit_status` |
| **SOCRATA (janesville.data.socrata.com)** | `janesville.data.socrata.com` | Commercial Building Permits | `qskr-bfe6` | [`qskr-bfe6.json`](https://janesville.data.socrata.com/resource/qskr-bfe6.json) | `year, new_commercial_permits, commercial_addition_remodel_permits` |
| **SOCRATA (mesa-az.demo.socrata.com)** | `mesa-az.demo.socrata.com` | Mesa Permits | `a48t-r2ep` | [`a48t-r2ep.json`](https://mesa-az.demo.socrata.com/resource/a48t-r2ep.json) | `parcel_apn, number_of_dwellings, number_of_dwelling_units, issued_date` |
| **SOCRATA (miami.demo.socrata.com)** | `miami.demo.socrata.com` | Construction Applicants | `h2dy-b575` | [`h2dy-b575.json`](https://miami.demo.socrata.com/resource/h2dy-b575.json) | `id, location_1_state, last_name, location_1_city` |
| **SOCRATA (usc.data.socrata.com)** | `usc.data.socrata.com` | Building Permits (LA) | `sg98-pu67` | [`sg98-pu67.json`](https://usc.data.socrata.com/resource/sg98-pu67.json) | `date, :@computed_region_ggb7_6x8f, tract, tract_number` |
| **Somerville, MA** | `data.somervillema.gov` | Applications for Permits and Licenses | `nneb-s3f7` | [`nneb-s3f7.json`](https://data.somervillema.gov/resource/nneb-s3f7.json) | `active_in_2014, issue_date, application_ward, business_days_to_issue` |
| **Somerville, MA** | `data.somervillema.gov` | Somerville Happiness Survey Responses | `wmeh-zuz2` | [`wmeh-zuz2.json`](https://data.somervillema.gov/resource/wmeh-zuz2.json) | `household_size, youth_workforce_readiness_satisfaction_num, restaurants_shops_businesses_satisfaction_num, survey_method` |
| **State of Colorado / Regional** | `data.colorado.gov` | Building Permit Counts in Colorado | `v4as-sthd` | [`v4as-sthd.json`](https://data.colorado.gov/resource/v4as-sthd.json) | `countyfips, placefips, area, year` |
| **State of Colorado / Regional** | `data.colorado.gov` | Boulder County Building Footprints | `emiz-7jkv` | [`emiz-7jkv.json`](https://data.colorado.gov/resource/emiz-7jkv.json) | `the_geom, structurei, source, structuret` |
| **State of Colorado / Regional** | `data.colorado.gov` | Restaurant Inspections in Tri-County Colorado 2018 | `cx7q-izrb` | [`cx7q-izrb.json`](https://data.colorado.gov/resource/cx7q-izrb.json) | `facilityid, recordid, serialnumber, servicedesc` |
| **State of Colorado / Regional** | `data.colorado.gov` | DWR Well Application Permit | `wumm-7awb` | [`wumm-7awb.json`](https://data.colorado.gov/resource/wumm-7awb.json) | `more_information, :@computed_region_nku6_53ud, coordsns_dir, location_city` |
| **State of Colorado / Regional** | `data.colorado.gov` | State Highway On-System Curb Ramps in Colorado | `sb9m-ecvv` | [`sb9m-ecvv.json`](https://data.colorado.gov/resource/sb9m-ecvv.json) | `location, gis_x, gis_y, region` |
| **State of Texas / Statewide** | `data.texas.gov` | Collin CAD Building Permits | `82ee-gbj5` | [`82ee-gbj5.json`](https://data.texas.gov/resource/82ee-gbj5.json) | `situsstreetprefix, proprescom, datadate, permitsubtypedescr` |
| **State of Texas / Statewide** | `data.texas.gov` | Key Economic Indicators | `karz-jr5v` | [`karz-jr5v.json`](https://data.texas.gov/resource/karz-jr5v.json) | `motor_fuel_taxed_diesel, year, motor_fuel_taxed_gasoline, gross_value_natural_gas_production` |
| **State of Texas / Statewide** | `data.fortworthtexas.gov` | Development Permits | `quz7-xnsy` | [`quz7-xnsy.json`](https://data.fortworthtexas.gov/resource/quz7-xnsy.json) | `b1_legal_desc, location_1_state, permit_category, location_1_city` |
| **State of Texas / Statewide** | `data.texas.gov` | Texas Commission on Environmental Quality - NOR Units | `9dej-ik5u` | [`9dej-ik5u.json`](https://data.texas.gov/resource/9dej-ik5u.json) | `wmu_cap_units_cd, haz_wst_flag, sys_typ_cd1, wmu_pmt_num_txt` |
| **TRANSPARENTRICHMOND (transparentrichmond.org)** | `www.transparentrichmond.org` | Electric Vehicle Charging Station Permits | `girg-s4vb` | [`girg-s4vb.json`](https://www.transparentrichmond.org/resource/girg-s4vb.json) | `parent_permit_no, geocoded_column, description_of_work, jurisdiction` |
| **TRANSPARENTRICHMOND (transparentrichmond.org)** | `www.transparentrichmond.org` | Energize Richmond Program Data | `jqpe-5nie` | [`jqpe-5nie.json`](https://www.transparentrichmond.org/resource/jqpe-5nie.json) | `annual_ghg_reduction_metric, annual_energy_bill_savings, richmond_rebate_requested, proposal_id` |
| **TRANSPORTATION (datahub.transportation.gov)** | `datahub.transportation.gov` | TDEI Sidewalk Dataset Hurrah City Edges | `y637-h6d9` | [`y637-h6d9.json`](https://datahub.transportation.gov/resource/y637-h6d9.json) | `features_properties_surface, features_properties_length, features_properties_crossing_markings, features_properties__u_id` |
| **TRANSPORTATION (datahub.transportation.gov)** | `datahub.transportation.gov` | Maricopa County Regional Work Zone Data Exchange (WZDx) v1.1 Feed Sample | `wd94-wugt` | [`wd94-wugt.json`](https://datahub.transportation.gov/resource/wd94-wugt.json) | `startdatetime_est, openlanes, identifier, enddatetime_est` |
| **URBANAILLINOIS (data.urbanaillinois.us)** | `data.urbanaillinois.us` | Community Development Permits Issued | `9rzq-mqbh` | [`9rzq-mqbh.json`](https://data.urbanaillinois.us/resource/9rzq-mqbh.json) | `improvement_type, building_type, estimated_cost, fee_amount` |
| **WA (data.wa.gov)** | `data.wa.gov` | City of Asotin Building Permits | `ez9k-2c5k` | [`ez9k-2c5k.json`](https://data.wa.gov/resource/ez9k-2c5k.json) | `feetotal, dateissued, valuation, address` |
| **WA (data.wa.gov)** | `data.wa.gov` | Asotin County (WA) Building Permits | `fdfj-3az2` | [`fdfj-3az2.json`](https://data.wa.gov/resource/fdfj-3az2.json) | `year, number_of_permits, cost_of_permit, state_building_fee_tax` |
| **WA (data.wa.gov)** | `data.wa.gov` | City of Clarkston Building Permits | `uxv9-c2g9` | [`uxv9-c2g9.json`](https://data.wa.gov/resource/uxv9-c2g9.json) | `permit_date, site_address, owner_name, permit_number` |
| **WA (data.wa.gov)** | `data.wa.gov` | City of Colfax: Building Permits February 2016 | `sefr-g784` | [`sefr-g784.json`](https://data.wa.gov/resource/sefr-g784.json) | `project_cost, issue_date, permit_no, owner` |
| **WA (data.wa.gov)** | `data.wa.gov` | City of Colfax: Building Permits January 2016 | `iqrw-294q` | [`iqrw-294q.json`](https://data.wa.gov/resource/iqrw-294q.json) | `work_description, type, permit_no, owner` |
| **WEHO (data.weho.org)** | `data.weho.org` | Active/Upcoming Extended Hours Construction Permits | `d96h-4b7t` | [`d96h-4b7t.json`](https://data.weho.org/resource/d96h-4b7t.json) | `address, conditions, scope_of_work, address_address` |
| **WI (performance.ci.janesville.wi.us)** | `performance.ci.janesville.wi.us` | Residential Building Permits | `3fcg-j7bi` | [`3fcg-j7bi.json`](https://performance.ci.janesville.wi.us/resource/3fcg-j7bi.json) | `year, new_residential_permits, residential_addition_remodel` |
| **WI (performance.ci.janesville.wi.us)** | `performance.ci.janesville.wi.us` | Commercial Building Permits | `7w9f-3n5s` | [`7w9f-3n5s.json`](https://performance.ci.janesville.wi.us/resource/7w9f-3n5s.json) | `commercial_addition_remodel, year, new_commercial_permits` |
| **WI (performance.ci.janesville.wi.us)** | `performance.ci.janesville.wi.us` | commercial building permit graph | `jgtv-969s` | [`jgtv-969s.json`](https://performance.ci.janesville.wi.us/resource/jgtv-969s.json) | `new_commercial_permits, commercial_addition_remodel, year` |
| **Williamson County, TX** | `data.wcad.org` | Building Permits | `fqhf-gyjx` | [`fqhf-gyjx.json`](https://data.wcad.org/resource/fqhf-gyjx.json) | `agencystatuscode, permitdesc, timestampchange, useridchange` |
