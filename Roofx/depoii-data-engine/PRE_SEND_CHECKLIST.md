# Depoii Pre-Send Verification & Exclusivity Protocol
> **Document Purpose:** Mandatory operational checklist executed prior to pitching, assigning, or generating an outreach evidence pack for any commercial roofing lead in DFW.
> **Enforcement:** Default-deny. If any gate fails, the property is withheld from outbound dispatch.

---

## 1. Registry Integrity & Exclusivity Gate (Step 1)

Before compiling or proposing any commercial property to a contractor:

1. **Query Master Registry:** Check `lead_assignment_registry.json` by:
   - Primary Key: `parcel_id` (e.g., `TAD-PARCEL-07532598`, `DCAD-PARCEL-004643000A0010000`).
   - Secondary Key: Normalized situs address (e.g., `3001 Meacham Blvd`).
2. **Evaluate Assignment Status:**
   - **`ACTIVE_EXCLUSIVE`**: **STRICTLY BLOCKED.** Lead is under active exclusivity pledge with another roofer. Do not pitch.
   - **`EXPIRES_TODAY_COOLDOWN_ACTIVE` / `EXPIRED_COOLDOWN_ACTIVE`**: **STRICTLY BLOCKED.** Exclusivity expiration marks the *beginning of a 7-day cooldown period*, not a green light for recycling. Reassigning a recently expired lead creates the perception of double-selling to contractors who network.
   - **`NO_EXCLUSIVITY_PLEDGED` / `EXPIRED_COOL`**: Permitted for consideration only if no collision exists with the recipient's primary competitors in the same submarket.
   - **`UNMAPPED_PARCEL` / Unassigned**: Permitted for verification pipeline.
3. **Log Assignment Upon Dispatch:**
   - Immediately append or update the assignment entry with:
     * `assignment_id`: Sequential ID (`ASN-XXX`)
     * `parcel_id`: Verified county parcel number
     * `normalized_address`: Exact situs street address
     * `recipient_company` & `recipient_email`: Target contractor and executive
     * `date_sent_iso`: Dispatch timestamp (ISO 8601)
     * `exclusivity_days_pledged`: Typically 7 calendar days
     * `exclusivity_expiry_date`: Dispatch date + pledged hold
     * `cooldown_end_date`: Expiry date + 7 days
     * `assignment_status`: `ACTIVE_EXCLUSIVE`
     * `dossier_version`: Specific pack version delivered

---

## 2. Public Record Fact-Verification Gate (Step 2)

No property data may be transmitted from cached scrapers, heuristics, or AI assumptions. Every field must trace to a live county record inspected in the current cycle:

1. **Structural Improvement Area vs. Land Polygon:**
   - **Banned Practice:** Never estimate roof footprint using `land_sqft * 0.65` or parcel boundary polygons.
   - **Mandatory Standard:** Cite exact structural improvement area (e.g., TAD `LIVING_ARE` or DCAD commercial section sum). Explicitly state the breakdown between ground-floor warehouse footprint and total multi-story/mezzanine improvement area.
2. **Owner of Record & Entity Mapping:**
   - Extract legal deed owner name directly from current tax roll (e.g. `OWNER_NAME`, `OWNER_ADDR`).
   - If deed owner is an entity (LP, LLC, Trust), conduct two-lane research:
     * **Owner/Deed Lane:** Texas SOS / Comptroller filing details: General Partner, Managing Member, Registered Agent, and formal legal mailing address.
     * **Occupant/Facility Lane:** Operating tenant at the facility, plant manager, or commercial logistics tenant.
     * **Honesty Guardrail:** Clearly differentiate owner from tenant. Never conflate an on-site tenant executive with the deed property owner.
3. **Municipal Permit Portal History:**
   - Query municipal open data permit portal (City of Fort Worth Development Permits or City of Dallas Permits).
   - Search by numerical street number and street name.
   - Report exact count of historical permits on file.
   - Check specifically for reroof, tear-off, TPO, EPDM, or metal roof permits.
   - **Standard Wording:** State: `"No reroof found in [City] portal history as of [Month YYYY] ([N] historical permits on file, 0 reroofs)"`. Never claim `"zero reroofs ever"` (portals have defined historical start dates).
   - If a reroof permit is found: Record permit number, date, and scope. Reset roof age calculation to permit year (`ROOF_AGE_RESET_YYYY`).
4. **NOAA Storm Prediction Center (SPC) Verification:**
   - Extract exact storm event: Convective date, UTC timestamp, spotter location, and reported hail diameter.
   - Calculate Haversine distance from building coordinates to exact SPC spotter point.
   - **Threshold Rules:**
     * **Tier 1 Storm Qualified Lead:** Hail diameter ≥1.50″ within 3.0 miles.
     * **Tier 2 Storm-Adjacent / Capital Candidate:** Hail diameter <1.50″ (e.g., 1.00″) OR distance >3.0 miles. Must be explicitly labeled as an **Aging / Capital Reroof Candidate**, NOT pitched as a storm lead.

---

## 3. Pre-Send Quality Sign-Off Checklist

Before hitting send on any roofer email or dossier:

- [ ] Parcel verified in `lead_assignment_registry.json` as unassigned or fully cooled.
- [ ] Structural footprint reflects county appraisal improvement records (not land polygon or land × 0.65).
- [ ] Owner entity and contact lanes are separated and labeled honestly.
- [ ] Municipal permit portal searched and cited with exact permit count and portal date.
- [ ] NOAA SPC storm metrics verified with exact report distance, time, and diameter.
- [ ] Lead classification accurately reflects thresholds (Storm Lead vs. Aging/Capital Candidate).
- [ ] Exclusivity pledge date, expiry date, and cooldown period recorded in project registry.
