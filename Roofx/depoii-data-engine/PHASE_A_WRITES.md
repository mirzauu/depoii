# Phase A write log

Run against `Roofx/depoii-data-engine/depoii_local.db` after the purge copy was swapped in at 2026-10-11T17:56:25Z. The untouched backup is `D:\Depoii_backups\depoii_local_2026-10-11T173039Z_pre_phase_a.db`. Baseline counts were saved at 2026-10-11T17:30:56Z in `D:\Depoii_backups\baseline_2026-10-11T173039Z.txt`.

Supabase DDL in `deploy_supabase_schema.py` was edited and was not executed.

## Writers

| File | Column | Real source? | Action |
| --- | --- | --- | --- |
| `harvest_dfw_parcels.py`, `harvest_dfw_bulk_parcels.py` | `building_sqft`, `year_built`, `total_valuation`, `improvement_valuation` | No. `AREA_FEET * 0.65` and a dollars-per-foot multiple. Proof row `14222 Dallas Pkwy`: land `379940`, building was `246961` (`0.65 * 379940`). | Stored values nulled. Sources set to `missing`. Land area kept and not released. Harvesters no longer write the formula. |
| `batch_parcel_injector.py` | `year_built`, `building_sqft` | No for Dallas. `APPRAISALYEAR` is not year built. `AREA_FEET` is not a building. | Both nulled on write. Tarrant `LIVING_ARE` and `YEAR_BUILT` are kept only when the layer sent them. |
| `harvest_dfw_parcels.py`, `harvest_dfw_bulk_parcels.py` | Tarrant `building_sqft`, `year_built`, valuations | `LIVING_ARE` and `YEAR_BUILT` are fetched living-area fields. Missing values had been filled with 25000/30000, year 1995, and a dollars-per-foot multiple. | Missing values stay null. Living area is not roof area and is not on the release allowlist. |
| `batch_fortworth_permit_injector.py` | `valuation` | A real job can be 145000 or 95000. The injector also used those amounts as defaults. | Rows with `source_system = 'CFW_ARCGIS_DEVELOPMENT'` and valuation exactly 145000 or 95000 were set null and `value_source = default`. Collision is accepted. New writes no longer substitute those amounts. |
| `batch_fortworth_permit_injector.py` | `latitude`, `longitude`, `parcel_id` | ZIP centroids and downtown `32.7555, -97.3308` are not the permit site. | 6729 Fort Worth rows set `geo_quality = zip_centroid`, coordinates null, `parcel_id` cleared. `zip_code` kept. |
| `app/science/normalizer.py` `clean_iso_date` | `issue_date` | Empty source date. | Returns `None`. Callers store null and `date_quality = missing`. Permit-id hashes (`SOCRATA-`, `ACA-`, `ENE-`) stay. |
| Fort Worth injector and `batch_permit_injector.py` | `issue_date` | Parse failure. | No longer writes `2026-01-01` or `2024-05-15`. |
| Date purge | `issue_date` | `1900-01-01`, and feeds whose issue dates collapse to one to three days including `2026-10-06`: Gainesville FL, Baton Rouge LA, Framingham MA, Sonoma County CA, Cincinnati OH, Seattle WA, Montgomery County MD. | `date_quality = substituted`. The date value is kept. A genuine `2026-01-01` outside that rule was not marked substituted. |
| `batch_contractor_enricher.py`, `batch_dallasnow_harvester.py`, `batch_nyc_permit_injector.py`, `batch_permit_injector.py`, `batch_fortworth_permit_injector.py`, `unmask_and_inject_contractors.py`, `enrich_contractors.py` | phone, website, headquarters, year founded, crew, leadership, certifications, M&A | Hashed phones, derived domains, and name-list principals. | Profile generators removed or the scripts refuse to run. Stored contact columns and `normalized_permits.contractor_phone` nulled. `canonical_name` kept. |
| `seed_other_cities.py`, `app/science/parcel_seed.py` | parcel rows | Invented. | Scripts no longer insert. Rows with `is_mock = 1`, `MOCK-%` ids, and the five `DCAD-PARCEL-*` seed ids were deleted, with their `scored_parcel_leads`. |
| `generate_dfw_pilot_leads.py`, `batch_stage5_top_aerials.py` | dossier JSON | Used year built as roof age and building area as roof area. | JSON export disabled. |
| `spatial_permit_matcher.py` | `parcel_id`, `square_footage` | A 45-meter match does not require a source point, and it copied parcel area onto the permit. | Links only when `geo_quality` is `source_point` or `geocoded`. Does not copy square footage. Point-in-polygon is not run: local parcels have no polygon column. |
| `app/science/lead_quality.py`, `lead_dossier_builder.py`, `brief_page.py`, `verification_engine.py` | roof age, roof area | `year_built` is not roof age. `building_sqft` and `AREA_FEET` are not roof area. `LIVING_ARE` is living area. | Roof area is released only from a fetched footprint. Dossier and brief responses withhold year, building area, and replacement dollars. |

DCAD and TAD field dictionaries were not used to backfill building area, year built, or deed dates in this phase.

## Release allowlist

`release_fields` joined to `field_provenance` returned zero violating rows at 2026-10-11T17:59:51Z.

Permits released: `raw_permit_number`, `source_system`, `jurisdiction`, `state`, `city`, `status`, `normalized_address`, `zip_code`, `category`, `raw_description`, `contractor_name`, `permit_scope` (computed, method `keyword rules in migrate_clean_permits.py`).

Parcels released: `address`, `city`, `state`, `zip_code`, `owner_name`, `owner_address`, `owner_city`, `owner_state`, `owner_zip`, `county`, `account_number`, `data_source`. Owner mailing lines are the appraisal-roll address. Phone and email are not on the roll and are not released.

Contractors released: `canonical_name`.

`release_permits.issue_date_source` is the issue date only when `date_quality = 'source'`. Views do not expose `phone_number`, `building_sqft`, `year_built`, `contractor_phone`, or `valuation`.

API parcel, permit, dossier, and intelligence responses withhold those same fields. Date comparisons in the roof-aging query require `date_quality = 'source'`. If that column is absent, the query returns no rows. Spatial exposure SQL requires `geo_quality IN ('source_point','geocoded')`.

The Next.js store `data/depoii.sqlite` still has `year_built`, `sqft`, `roof_age`, and `pipeline_value` because those columns are `NOT NULL`. They are not served: the account card does not state year, area, or pipeline dollars, and the engine parcel mapper returns year and area as 0. Queried 2026-10-11: 1832 parcels, year spikes include Addison 1998 (127) and Addison 1996 (112), which match the Dallas stand-in years. Score snapshots: 1070 rows, pipeline sum 9175445748.

## Re-audit

| Prior output | Status |
| --- | --- |
| Dallas size tiers and pipeline dollars from `building_sqft * rate` | Discarded. Building area on DCAD rows is null. |
| Top 50 dossier JSON and `verified_dfw_commercial_dossier.json` | Discarded. Writers no longer emit them. |
| Quoted permit-to-parcel link rates, including the 1234 figure | Rebuilt. Use the geo split below. Baseline at 2026-10-11T17:30:56Z was Dallas 159, Fort Worth 940, Addison 328. |
| Contractor phone, website, and principal lists from `canonical_contractors` | Discarded. Phones remaining: 0. `canonical_name` is the released field. |

## Controls

House-number join, run at 2026-10-11T17:59:51.525842Z. Dallas permits with a `permit_scope`. The key keeps a leading house number and drops city, state, ZIP, and suite tokens. A street with no house number is not a match (`street_only_rows` 2174).

| Result | Count |
| --- | --- |
| Dallas permit rows | 17709 |
| House-numbered keys | 12023 |
| Keys with two or more scopes | 545 |
| Keys with both `NEW_CONSTRUCTION` and `COMMERCIAL_REROOF` | 9 |
| Of those, source-dated roof permit on or after the first source-dated new-construction permit | 6 |

The nine overlap keys: `1410 W MOCKINGBIRD LN`, `2819 N HAMPTON RD`, `1455 ROUND TABLE DR`, `2507 WINNEQUAH ST`, `2503 WINNEQUAH ST`, `1107 CONVEYOR LN`, `2300 CANADA DR`, `1010 W MOCKINGBIRD LN`, `2307 QUARRY ST`. This is a string join, not a city-portal check. Do not describe a construction window from it.

Permit-to-parcel links by `geo_quality`, same timestamp:

| geo_quality | Permits | Linked |
| --- | --- | --- |
| source_point | 86303 | 16746 |
| zip_centroid | 6729 | 0 |
| missing | 476 | 136 |

Texas split: Addison `source_point` 328 linked of 328. Dallas `source_point` 61 linked of 17556, plus 98 links on `missing` coordinates (159 total, matching the baseline link count, of which only the 61 are usable for a spatial join). Fort Worth `zip_centroid` 6729 linked 0; `source_point` 15 linked of 249. Farmers Branch 1 link on `missing`.

`14222 Dallas Pkwy` after the purge: `building_sqft` null, `land_sqft` 379940, `year_built` null, valuations null, sources `missing`.
