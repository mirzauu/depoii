# Release gate

Default is FAIL. A field passes only where a live source, retrieved on 2026-10-13 UTC, matched the stored value on the rows named below. A passing field does not clear the lead. No scored lead meets this gate, and none should be sent to a contractor.

Evidence ids point at `audit_report.md`.

| Customer field | Gate | Evidence | What was shown |
|---|---|---|---|
| Address | FAIL | F01, F08 | Addresses matched DCAD, TAD, and PLUTO on the rows that were opened. The ranked endpoint also returns New York and Seattle addresses as if they were DFW leads. |
| City, state | FAIL | F01 | 3,887 of 5,782 ranked leads are outside Texas. |
| Owner name | FAIL | F02, F03 | Owner matched on the Tarrant rows and on most Dallas pages that were opened. 14755 Preston Rd stores “Signature Exchange Owner Llc”; the DCAD page reads “SIGNATURE EXCHANGE PROPERTY OWNER LLC”. |
| ZIP | FAIL | F03 | Situs ZIP is not on the TAD attributes or the DCAD situs line that were read. 14222 Dallas Pkwy stores 75226, which is the owner mailing ZIP on that page. Property ZIP was not confirmed. |
| Building square feet | FAIL | F02, F03, F08 | Matches PLUTO `bldgarea` and TAD `LIVING_ARE` on the rows checked, which are gross or living area. Fails the DCAD roll on unverified Dallas rows (16850 Dallas Pkwy: stored 33,083, page 11,994). On 105 Duane Street the matched number is a 53-story building. |
| Roof / footprint square feet | FAIL | F03 | 14222 Dallas Pkwy footprint 246,961 equals land × 0.65. Live foundation is 97,139. 14856 Preston Rd footprint 200,875 against a live foundation of 12,316. |
| Year built | FAIL | F02 | Matches TAD and PLUTO and the five live DCAD scrapes. Fails where the stored year is 1996 and the DCAD improvement year is 1978 or 1979. 315 Dallas rows still have year 1996 with source `missing`. |
| Stories | FAIL | F03, F08 | 14222 Dallas Pkwy stores 1; the page says 2. 105 Duane Street is 53 floors in PLUTO and the lead does not say so. |
| Total valuation | FAIL | F02 | 1,095 scored values equal square feet × $165. Live DCAD value for 16850 Dallas Pkwy is $1,625,000 against a stored $5,458,695. |
| Property type / eligibility | FAIL | F03, F08 | Ready lead 14222 Dallas Pkwy is an apartment. Ranked rows include New York classes A–D, a two-family house at score 99, and a church on Hillcrest. |
| Storm date | FAIL | F04, F05, F06 | 2026-03-17 is on 522 ranked leads and has zero SPC hail rows and zero SPC wind rows. Other dates exist in SPC and are attached at the wrong distance. |
| Hail size | FAIL | F04 | Hardcoded Benbrook size is 2.00 inches; the SPC row at the same coordinate is 1.75. Swath maxima differ from the SPC state maximum on 172 swaths. |
| Hail distance | FAIL | F04 | 2,333 stored distances are exactly 1.5 miles. 4,165 compared distances differ from the nearest same-state SPC point by more than 1 mile. |
| Permit status “none found” | FAIL | F07 | Dallas permit-to-parcel link rate is 0.43% on the ArcGIS feed and 0% on DallasNow. 14 of 60 linked pairs are the wrong street. Recall against a fresh 30-permit city sample is UNKNOWN. |
| Replacement cost | FAIL | F03 | Ready-lead prices equal footprint × $9.40, and three of those footprints are land × 0.65. |
| Exposure score | FAIL | F01, F08 | Score 99 is on a 2-unit house and on a 53-story apartment typed as a warehouse. 5,780 of 5,782 ranked rows are `unverified_seed`. |
| “Verified” label | FAIL | F09 | Proof card and dossier text say verified without a passing gate on the field. |
| Aerial with parcel outline | UNKNOWN | Area I | Not retrieved for any golden-set row. |
| Contractor phone | FAIL | queries/03 | 15,372 of 15,498 contractors have a null phone. No 555 pattern was found. Phones are not on the parcel release view. Do not treat the 126 non-null phones as verified; they were not called. |

## Rows that matched a source column and still fail

These matches are real and are not a release:

- TAD situs, owner, `LIVING_ARE`, `YEAR_BUILT`, and `TOTAL_VALU` for the nine Tarrant golden-set rows, including 3001 Meacham Blvd. Hail distance on Meacham is 3.63 miles to a hardcoded point; the nearest SPC report that day is 1.06 miles.
- DCAD address, improvement area, year, and market value for the five `live_dcad_scrape` rows. 14222 Dallas Pkwy fails stories, eligibility, footprint, and price.
- PLUTO address, `bldgarea`, and `yearbuilt` for eight New York sample rows. Those rows fail market, class, and hail distance.

## Decision

Zero leads are cleared. The release views omit the hazardous columns, and the ranked endpoint does not use those views.
