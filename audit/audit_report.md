# Depoii dataset audit

Audit copy: `audit/depoii_local_audit_copy.db` (copied from `Roofx/depoii-data-engine/depoii_local.db`, 391,999,488 bytes, file timestamp 2026-10-14 01:57 local). The original database and application code were not modified. Queries were run read-only (`mode=ro`). Live pages were retrieved on 2026-10-13 UTC.

Population at `queries/00_schema_inventory.txt` (run 2026-10-13T20:42:20Z): 16,657 parcels, 11,270 scored leads, 93,508 permits, 692 storm swaths.

## Executive summary

The ranked-leads query returns 5,782 buildings with exposure score at least 60, and 3,887 of those are outside Texas, almost all still tagged `unverified_seed`. Dollar values, years, roof size, and hail distance on leads that do reach a customer path disagree with the county roll or with the NOAA SPC hail file. No scored lead currently meets the release gate. Do not send any lead to a contractor.

## Findings

### F01 — CRITICAL — Ranked leads include New York, Seattle, and unverified rows

Area B, H. The customer endpoint `GET /intelligence/leads/ranked` selects from `scored_parcel_leads` where `exposure_score >= 60` and `is_mock = 0`. It does not require `outbound_ready`, a Texas city, or a live provenance (`Roofx/depoii-data-engine/app/api/v1/intelligence.py` lines 246–265).

Query in `queries/03_customer_surface_and_eligibility.py`, run 2026-10-13T20:46:46Z, re-run in `queries/08_self_check.py` at 2026-10-13T20:57:27Z with the same counts:

| Result | Count | Share of the 5,782 |
|---|---:|---:|
| exposure_score >= 60 | 5,782 | 100% |
| state other than TX | 3,887 | 67.2% |
| data_provenance = unverified_seed | 5,780 | 99.97% |
| verification_status = PERMIT_DETECTED | 3,908 | 67.6% |
| outbound_ready = 1 inside this set | 2 | 0.03% |

New York City accounts for 3,080 + 429 of those rows and Seattle for 378 (`queries/02_geo_storms_permits.txt`). The response columns include address, owner, square feet, year, valuation, storm name, hail size, and score. They omit permit status, so a row already marked `PERMIT_DETECTED` is still returned as a lead.

Customer impact: a contractor can be shown a New York walk-up or a Seattle parcel as a DFW hail lead. Root cause is the missing predicate in `intelligence.py:246`. Regression test: the ranked query must return 0 rows with `state <> 'TX'` or `data_provenance = 'unverified_seed'`.

### F02 — CRITICAL — Lead value equals square feet times $165, and 1996 is not the roll year

Area A, G. On the parcel table, zero rows have `total_valuation = building_sqft * 165`. On scored leads, 1,095 rows do (1,095 / 11,270 = 9.7%). All 1,095 disagree with the parcel’s own `total_valuation` (`queries/03`, run 2026-10-13T20:46:46Z; identical 1,095 and 0 on the 2026-10-13T20:57:27Z re-run). The 1,095 sit in Dallas County cities (Addison 258, Carrollton 198, Dallas 173, and eight smaller cities).

The current tree no longer contains an assignment of `* 165`. The detector that names the fingerprint is `outbound_qa_check.py` line 20. The values remain on `scored_parcel_leads.cad_total_valuation`.

Two golden-set rows, opened on the live DCAD account page at 2026-10-13T20:52Z and reparsed in `queries/07_reparse_and_links.txt`:

| Account | Stored | Live DCAD page |
|---|---|---|
| 00000799950250000, 16850 Dallas Pkwy | 33,083 sq ft, year 1996, value $5,458,695 | Office, 11,994 sq ft, year 1979, market value $1,625,000. Screenshot `screenshots/dcad_16850_year_area.png` |
| 00000662970550000, 14350 Dallas Pkwy | 243,288 sq ft, year 1996, value $40,142,520 | Apartment, 232 units, 192,991 sq ft, year 1978, market value $26,340,050, 2 stories |

33,083 × 165 = 5,458,695 and 243,288 × 165 = 40,142,520.

Separately, 315 Dallas parcels have `year_built = 1996` and `year_built_source = 'missing'` (315 / 16,657 = 1.9%). The writer that fills a missing year with 1996 is `batch_dallas_enrichment.py` lines 228–237. The two accounts above are in that set; the other 313 were not opened.

Customer impact: the ranked response includes `cad_total_valuation` and `year_built`. A contractor is told a building is from 1996 and worth about three times the roll. Regression test: `ABS(cad_total_valuation - building_sqft * 165) < 1` must be 0, and `year_built = 1996 AND year_built_source = 'missing'` must be 0.

### F03 — CRITICAL — An outbound-ready lead is a 217-unit apartment priced from land × 0.65

Area A, F, G. Six rows have `outbound_ready = 1` (`queries/02`, run 2026-10-13T20:43:26Z). One of them is `DCAD-PARCEL-00000662970600000`, 14222 Dallas Pkwy.

Live DCAD page retrieved 2026-10-13T20:52:36Z and screenshotted 2026-10-13T20:59Z (`screenshots/dcad_14222_apartment.png`):

- Description: APARTMENT (BRICK EXTERIOR), land state code MFR - APARTMENTS
- 217 units, 2 stories
- Total area 193,589 sq ft, net lease area 193,556 sq ft
- Foundation 97,139 sq ft
- Year built 1978, market value $25,868,580
- Land area on the page: 355,418 sq ft
- Owner: WESTDALE NOEL LP

The database row stores stories = 1, land_sqft = 379,940, footprint_sqft = 246,961, and estimated_replacement_mid = $2,321,434. 379,940 × 0.65 = 246,961 exactly, and 246,961 × 9.40 = 2,321,433, which rounds to the stored replacement mid. The $9.40 rate is the midpoint of the NRCA $7.50 and $12.50 rates times the 0.94 Texas factor in `app/science/lead_quality.py` lines 11–13 and 189–201. The price uses a footprint larger than the building and about 2.5 times the foundation. `property_type` is blank, so the apartment filters in `intelligence.py` lines 64–76 and `city_verification_runner.py` do not see the word apartment.

The same land × 0.65 footprint prices two other outbound rows (`queries/07`, run 2026-10-13T20:55:41Z):

- 14856 Preston Rd: live foundation 12,316 sq ft and three commercial sections totaling 81,536 sq ft; stored footprint 200,875 = round(309,039 × 0.65); replacement mid $1,888,225.
- 1133 S Madison Ave: live foundation on the first section 29,362 sq ft and total improvement area 101,140; stored footprint 139,381 = round(214,433 × 0.65); replacement mid $1,310,182.

Across the database, 136 parcels have `footprint_sqft = round(land_sqft * 0.65)` (136 / 16,657 = 0.8% of all parcels; 136 of the roughly 1,041 parcels that have a footprint). 78 scored leads still have a replacement mid equal to that footprint times 9.4.

Customer impact: the only rows marked ready to send include an apartment and dollar amounts built from land area. Regression test: reject any lead whose improvement description or land state code contains apartment, and reject any footprint equal to `round(land_sqft * 0.65)`.

### F04 — CRITICAL — Quoted hail distance is not the distance to the nearest SPC report

Area C, D. `nearest_hail_distance_mi = 1.5` on 2,333 of 11,270 scored leads (20.7%). For the June 6, 2026 New York rows, 1,965 of them are exactly 1.5 (`queries/03`).

`queries/04b_spc_corrected.py` (run 2026-10-13T20:51:07Z) recomputed haversine miles from the parcel centroid to the nearest same-state point in that day’s SPC hail CSV, with Size divided by 100. SPC’s own page states the scale: “Hail Sizes in 1/100 of an Inch (175 = 1.75")” and “LAT/LON in decimal degrees to two decimals” (`screenshots/spc_260425_utc.png`, page retrieved 2026-10-13T20:52:09Z and viewed again at 2026-10-13T21:00Z).

| Comparison | Count |
|---|---:|
| Leads with a stored distance and a same-state SPC point | 4,241 |
| Difference greater than 0.25 mile | 4,220 |
| Difference greater than 1 mile | 4,165 |
| Difference greater than 5 miles | 3,833 |

June 6, 2026: 1,966 compared, 1,966 differ by more than 5 miles. The nearest New York point for those parcels is Deposit, about 110–120 miles away, while the stored distance is 1.5. June 2, 2026 does have Texas hail rows (14 in `260602_rpts_hail.csv`, including Balch Springs, Grapevine, and The Colony). Of 1,171 June 2 leads with coordinates and a stored distance, 1,128 differ from the nearest Texas SPC point by more than 1 mile.

The two outbound rows that quote a distance match a hardcoded coordinate list, not the nearest report. `queries/08_self_check.py` at 2026-10-13T20:57:27Z:

- 1133 S Madison Ave: stored 7.33 miles to 32.71, -96.95. Haversine to that point is 7.33. The nearest Texas point in the April 25 convective-day file is 3.78 miles (1.50 inch at 1 S Cockrell Hill, 0626 UTC).
- 3001 Meacham Blvd: stored 3.63 miles to 32.79, -97.35. Haversine to that point is 3.63. The nearest Texas point in the same file is 1.06 miles (1.00 inch at 2 NW Haltom City, 0539 UTC).

`batch_stage2_hail_proximity.py` lines 5–15 hardcodes nine points and calls them the April 26 archive. Seven of those coordinates match a row in `260425_rpts_hail.csv` at distance 0.00. Two do not: 32.71, -97.11 is 3.27 miles from the nearest row, and 32.77, -97.31 is 2.70 miles from the nearest row (`queries/04_spc_verification.txt`). The Benbrook point 32.71, -97.45 is stored as 2.00 inches; the SPC size is 175 hundredths, which is 1.75 inches. The 3.00 inch point at 32.71, -96.95 is the SPC row “4 WSW Cockrell Hill” with comment “Delayed report. Facebook photo…”. The code relabels it “Dallas Baptist University / SW Dallas (Tea cup size)”.

The SPC page for that file says the report day runs from 1200 UTC to 1159 UTC the next day, and “All Times UTC.” File `260425` is the convective day that starts 1200 UTC on April 25. A clock time of 0351 UTC on that file is 22:51 CDT on April 25. The product name is “April 26, 2026”.

481 leads have every SPC hail row within 15 miles tagged delayed, social media, Facebook, or mPING (`queries/04b`). The Meacham and Madison quotes are in that class of report.

Customer impact: a 1.5 mile hail claim on a New York building is about 100 miles off, and the two ready leads quote a chosen social-media or delayed report while a closer report exists. Regression test: recompute haversine to the SPC CSV and fail the build when the stored distance differs by more than 0.25 mile, and fail when the only reports inside 15 miles are delayed or social-media reports.

### F05 — CRITICAL — March 17, 2026 is assigned to 522 leads and is absent from SPC

Area C. `queries/04b` and the re-download in `queries/08` at 2026-10-13T20:57:28Z:

- `https://www.spc.noaa.gov/climo/reports/260317_rpts_hail.csv` HTTP 200, 49 bytes, header only, 0 data rows.
- `https://www.spc.noaa.gov/climo/reports/260317_rpts_wind.csv` HTTP 200, 50 bytes, header only, 0 data rows.

All 522 scored leads with `event_date = '2026-03-17'` are in New York and all 522 have exposure_score >= 60, so they are inside the ranked-leads population. The storm name on those rows is “March 17, 2026 New York City Metro Severe Derecho & Wind Swath”.

Customer impact: the ranked list names a storm date that has no hail row and no wind row in the SPC daily files. Regression test: every `event_date` on a scored lead must have at least one data row in the SPC hail or wind CSV for that convective day.

### F06 — HIGH — Storm-swath catalog does not match the SPC file for that state

Area C. `queries/04b`, 692 swaths, Size/100:

- 300 swaths have zero hail rows in the claimed state on that convective-day file (300 / 692 = 43.4%).
- 172 swaths have a stored max hail that differs from the SPC state maximum by more than 0.25 inch.
- 235 have at least one hail row in the state and none inside the metro box used in that script.

May 28, 2024 is in the swath table as “May 28, 2024 Dallas-Fort Worth Severe Hail Core” at 3.25 inches. File `240528_rpts_hail.csv` has 73 Texas rows and a Texas maximum of 5.00 inches. The two rows inside the script’s broad box are 1.00 inch at Kemp and 1.00 inch at Streetman. `app/extraction/noaa_client.py` lines 42–83 still ships a separate hardcoded polygon named “May 28, 2024 Dallas Severe Hail Core” at 2.50 inches, used as the fallback in `intelligence.py` lines 175–180 when the database query throws. June 2, 2026, contrary to the older failure note, does have Texas hail rows; the failure on that date is the distance error in F04, not a missing file.

`queries/05_point_in_polygon.py` (2026-10-13T20:51:07Z): of 9,521 leads tested against the polygon stored for their assigned date, 796 centroids are outside that polygon (8.4%). Moving the centroid 45 meters north flips containment for 16 leads. 1,326 leads have an event date with no stored polygon; that set is essentially the 1,323 June 2, 2026 leads, which are not in `storm_swaths`.

Customer impact: dossier matching walks these polygons (`lead_dossier_builder.py` lines 109–139) and can attach a storm the centroid is not inside. Regression test: for every swath, the SPC file for that state and day must contain a hail row, and the stored maximum must equal the maximum size in that file after dividing by 100.

### F07 — HIGH — Permit links are sparse, and a 60-link sample has the wrong street

Area B, E. `queries/02`, run 2026-10-13T20:43:26Z:

| Source | Linked to a parcel | Rows | Link rate |
|---|---:|---:|---:|
| DALLAS_ARCGIS_FY24 | 61 | 14,336 | 0.43% |
| DALLASNOW_ACCELA_LIVE | 0 | 3,226 | 0% |
| Fort Worth, geo_quality = zip_centroid | 0 | 6,729 | 0% |
| Fort Worth, geo_quality = source_point | 15 | 249 | 6.0% |

`apply_phase_a.py` lines 9–42 and 254–263 null coordinates that sat on a list of centroids, including (32.7555, -97.3308), and set `geo_quality = 'zip_centroid'`. The current Fort Worth rows with that flag have null coordinates, so the exact share that had been 32.7555 cannot be recounted from this database.

`queries/07` redrew the same seed-20261014 sample of 60 linked permits used in `queries/06` and compared street number and street name. The script flagged 15 of 60. Hand review of that printed list: 14 are a different street or a different number (examples: permit “488 FOSTER ROAD” linked to parcel “488 FOUNTAIN AVENUE”; “205 NORTH HENRY STREET” linked to “205 HENRY STREET”; “111 NORTH 6 STREET” linked to “111 EAST 26 STREET”). One flag is the same building with a suite token (“150 TURTLE CREEK BLVD Ste:106” versus “150 TURTLE CREEK BLVD”). Hand-reviewed false-link count: 14 / 60 = 23.3%. Wilson 95% interval: 0.144 to 0.354.

2,810 Texas parcels and 146 New York parcels have no permit row linked at all (`queries/06`).

The 30-permit recall test did not complete. The Fort Worth permit service timed out (`queries/06`, WinError 10060). A Dallas FY2023–24 query for `ACTIVITY LIKE '%ROOF%'` returned 0 features (`queries/09`), so that layer’s activity text did not match the filter. Recall is UNVERIFIED.

Customer impact: “no roofing permit found” is a search result against a join that links under 1% of Dallas permits and that links the wrong street on about a quarter of a 60-link sample. Regression test: street number and street name must match on every linked pair, and a monthly recall sample of 30 permits from the city feed must be recorded with a Wilson interval.

### F08 — HIGH — Apartments, a church, and a two-family house are in the scored set

Area F. Inside the 5,782 ranked rows, 2,094 have a New York housing class in {A1, A2, A3, A4, A5, A9, B1, B2, B3, C0, D1} (`queries/03`). Live MapPLUTO (`https://data.cityofnewyork.us/resource/64uk-42ks.json`, 2026-10-13T20:57:31Z to 20:57:39Z) for the eight New York rows in the stratified sample:

| BBL | PLUTO class | Units | Floors | Stored type | Score | Stored distance |
|---|---|---:|---:|---|---:|---|
| 1001510001, 105 Duane Street | D6 | 440 | 53 | Commercial Warehouse | 99 | null |
| 3013790055, 1491 St Johns Place | C1 | 32 | 4 | Commercial Warehouse | 99 | null |
| 5079080066, 493 Main Street | B2 | 2 | 2 | B2 | 99 | null |
| 2024560150, 1166 Grand Concourse | D1 | 77 | 6 | D1 | 24 | 1.5 |
| 3072990071, 2387 Ocean Avenue | D1 | 66 | 6 | D1 | 72 | 1.5 |
| 1007640057, 236 West 15 Street | C7 | 35 | 6 | C7 | 24 | 1.5 |

PLUTO `bldgarea` and `yearbuilt` match the stored square feet and year on all eight. The stored area is the PLUTO building area. On 105 Duane Street that is a 53-story residential building of 434,418 sq ft, scored 99 and typed “Commercial Warehouse”.

DCAD pages in the same sample: 15775 Hillcrest Rd is a CHURCH BUILDING, stored 131,263 sq ft and year 1998, live 53,662 sq ft and year 1979. 14350 Dallas Pkwy is an apartment with 232 units. The outbound 14222 Dallas Pkwy apartment is F03.

Customer impact: the ranked list and the ready flag both contain housing the product says it excludes. Regression test: drop any parcel whose PLUTO class is A, B, C, or D, or whose DCAD improvement description or land state code contains apartment, church, or MFR.

### F09 — HIGH — Customer text says verified

Area H. `src/components/proof-card.tsx` lines 67–70 label year built and the permit row `verified-record` on every card. `src/lib/live/load.ts` line 176 sets `hailProvenance: "verified-record"` while the parcel is still being loaded, including parcels that stay outside a warning polygon. `lead_dossier_builder.py` line 238 writes “verified {date}” into the permit pillar when a check date exists, and lines 269–273 append “Zero competitor roofing permits” and a kinetic-energy sentence computed from diameter (`app/extraction/noaa_client.py` lines 10–38). `generate_markdown_dossier.py` line 15 states that 100% of apartments, churches, schools, and city entities were excluded. `provenance_guard.py` line 51 describes the gate as “100% verified provenance”. The ranked endpoint’s docstring (`intelligence.py` lines 231–233) says it covers 9,600+ parcels.

`release_fields` has 25 columns and the views `release_parcels` and `release_permits` omit square feet, year, value, hail, and score. The ranked endpoint does not read those views. It reads `scored_parcel_leads` directly.

Customer impact: the word verified is attached to fields that F02, F04, and F08 show are wrong or unscoped. Regression test: the strings “verified-record”, “100%”, and “verified {date}” must not render unless the row’s provenance is on the live allowlist and the field passed the golden-set check.

### F10 — MEDIUM — Permit issue dates and job values were filled in

Area C, A. 18,164 permits have `issue_date = '2026-10-06'`. Of those, 18,087 are `date_quality = 'substituted'` and sit on the non-Texas socrata jurisdictions listed in `apply_phase_a.py` lines 44–52 (Cincinnati 5,000, Seattle 4,999, Gainesville 3,998, and four others). The release view nulls `issue_date` unless `date_quality = 'source'`. The raw column still holds 2026-10-06. A writer that assigns that literal date was not found in the current Python; the phase A script labels the jurisdictions substituted and does not itself write the date.

On `DALLAS_ARCGIS_FY24` (14,336 rows): valuation is exactly 20,000 on 8,015 rows (55.9% of that source, 8.6% of all 93,508 permits) and exactly 75,000 on 262 rows. `batch_dallas_permit_injector.py` lines 207–219 defaults a missing issue date to 2024-01-01 (0 such rows remain) and defaults a missing value to 75,000 for commercial and 20,000 otherwise. Valuation is not in `release_fields`. Any query that selects `normalized_permits.valuation` rather than `release_permits` will return the default.

Customer impact: a job value of $20,000 on thousands of Dallas permits is the fallback, not a declared permit value. Regression test: valuation in {20000, 75000} with no city-declared source flag must be null before it can be selected.

## Area I — Golden set

Seed 20261014. Allocation in `queries/06_live_golden_and_recall.py`: 8 New York, 3 Seattle, 7 Fort Worth, 6 Dallas, 6 other Texas, crossed by size tier and score band. The six `outbound_ready` rows were checked in addition. Results are in `golden_set.csv`. Aerials with a dated parcel outline were not retrieved; that column is UNKNOWN on every row.

What the live sources agreed with:

- Eight New York rows: PLUTO address, `bldgarea`, and `yearbuilt` match the stored address, square feet, and year. Class and story count do not match the way the row is typed and scored (F08).
- Nine Tarrant rows opened on the TAD feature service, including 3001 Meacham Blvd: situs, owner, `LIVING_ARE`, `YEAR_BUILT`, and `TOTAL_VALU` match. `LIVING_ARE` is the field the TAD writer copies (`live_tad_detail_fetcher.py` lines 8–9). It is not a measured roof area. Stories are not on that response.
- Five Dallas rows that already had `live_dcad_scrape`: address, summed improvement area, earliest year, and market value match the page. Stories do not match for 14222 Dallas Pkwy (stored 1, page 2). The owner line for 14755 Preston Rd is stored as “Signature Exchange Owner Llc”; the page reads “SIGNATURE EXCHANGE PROPERTY OWNER LLC”.

What the live sources contradicted, inside the stratified 30:

- Dallas rows still on `unverified_seed` disagreed with the DCAD page on area, year, and value wherever the page had an improvement section. Two of those disagreements are the $165 and 1996 cases in F02. 15775 Hillcrest is the church in F08.
- Hail distance and storm date were not confirmed for any of the 30. The SPC recompute in F04 covers the dates those rows carry.

n = 30 cannot support a 98% or 99% accuracy claim. For a proportion near 50%, the sample size for a 95% interval of ±3 percentage points is 1,068 (`ceil(1.95996² × 0.25 / 0.03²)`, computed in `queries/06`). For a proportion near 99% the same ±3 point width needs 43, and that calculation assumes the 99% rate is real. A sample of 27 address matches out of 27 comparable addresses (Tarrant, Dallas, and the eight PLUTO rows; Seattle was not opened) still has a Wilson 95% lower bound of about 0.88. Square-foot agreement is not one rate: PLUTO and TAD match the field that was copied, and the unverified Dallas rows do not match the roll.

## Self-check

Re-run from scratch in `queries/08_self_check.py` at 2026-10-13T20:57:27Z:

1. exposure_score >= 60: 5,782; non-TX 3,887; unverified_seed 5,780; PERMIT_DETECTED 3,908. Same as `queries/03`.
2. `cad_total_valuation = building_sqft * 165`: 1,095 scored leads, 0 parcels. Same as `queries/03`.
3. SPC `260317` hail file re-downloaded: HTTP 200, 0 data rows. The wind file for the same day was also fetched and also has 0 data rows.

## UNVERIFIED

- Recall of a 30-permit independent roof sample. Fort Worth’s permit service timed out. The Dallas FY2023–24 activity filter `LIKE '%ROOF%'` returned 0 features, so the vocabulary of that field was not established.
- Dated aerial imagery with a parcel outline, for every golden-set row.
- Census ZCTA for the outbound coordinates. The geocoder returned the county (Dallas County or Tarrant County) and did not return a ZCTA under the key requested (`queries/07`). Situs ZIP is not printed on the TAD attributes or on the DCAD situs line. The lead ZIP 75226 on 14222 Dallas Pkwy equals the owner mailing ZIP printed on that page (75226-1495). Whether that is the property ZIP was not established by a ZIP authority.
- Whether any `year_built` value is a deed-transfer date. The two DCAD legal descriptions that were read show deed dates of 12/5/2013 and 6/5/2018, and the improvement years on those pages are 1978 and 1979.
- Seattle golden-set rows were not opened on King County.
- A correlation coefficient of score versus an independent outcome was not computed. What was tested is which inputs the score uses (`lead_quality.py` lines 165–186): hail size, distance, tier, roof age, and roof square feet. Permit presence is not an input to that function. The ranked endpoint still returns rows whose `verification_status` is `PERMIT_DETECTED` (F01). `spatial_queries.py` lines 56–62 calls `roof_square_feet(0)`, which drops the building size for callers of that wrapper.
- Positive-control tests were not re-derived. Whether those controls were chosen after a bug was found was not tested.

## Release

No lead meets the release gate. The field-level passes above are matches to a source column on specific rows. Each of those rows fails hail distance, eligibility, or roof size. See `release_gate.md`.
