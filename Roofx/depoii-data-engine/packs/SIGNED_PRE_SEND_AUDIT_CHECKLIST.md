# Signed Pre-Send Quality Audit & Verification Checklist (v2.1)
> **Standard:** Executed under `PRE_SEND_CHECKLIST.md` (Default-Deny Protocol v2.4)  
> **Audit Execution Date:** October 20, 2026  
> **Audit Decision:** **Pack A: HOLD** | **Pack B: CONDITIONAL (Sendable as Resolution Note)**  
> **Scope:** Pack A (Trevor Rodden, SR1 Roofing) & Pack B (Mike Gibson, New View Roofing)

---

## 1. Registry Integrity & Exclusivity Gate (Step 1)

| Check Item | Pack A: 3001 Meacham | Pack A: 7151 Jack Newell | Pack B: 1133 S Madison | Gate Status |
| :--- | :---: | :---: | :---: | :---: |
| **Registry ID Present** | `ASN-001` | `ASN-049` | `ASN-002` | **PASS** |
| **Parcel ID Match** | `TAD-PARCEL-07532598` | `TAD-PARCEL-41009673` | `DCAD-PARCEL-004643000A0010000` | **PASS** |
| **Normalized Situs Address** | 3001 Meacham Blvd | 7151 Jack Newell Blvd S | 1133 S Madison Ave | **PASS** |
| **Recipient Email Verified** | `trevor@sr1roofing.com` | `trevor@sr1roofing.com` | `mike@newviewroofing.com` | **PASS** |
| **Collision Check** | No competing contractor assigned | No competing contractor assigned | No competing contractor assigned | **PASS** |
| **Registry Lifecycle Status** | `RESERVED_PENDING_DISPATCH` | `RESERVED_PENDING_DISPATCH` | `RESERVED_PENDING_DISPATCH` | **PASS** |
| **History Preserved** | Initial outreach Oct 14 logged | New inventory proposed | Initial outreach Oct 14 logged | **PASS** |

---

## 2. Public Record Fact-Verification Gate (Step 2)

### A. Structural Footprint vs. Land Area
* [x] **No Heuristic Estimates:** Land × 0.65 formula completely banned; zero instances present.
* [x] **3001 Meacham Blvd:** Structural improvement area: **115,188 sq ft** (TAD `LIVING_ARE`) vs. 325,742 sq ft land. Story count explicitly noted as **unverified** on TAD feed.
* [x] **7151 Jack Newell Blvd S:** Structural improvement area: **526,195 sq ft** (TAD `LIVING_ARE`) vs. 1,778,990 sq ft land. Story count explicitly noted as **unverified** on TAD feed.
* [x] **1133 S Madison Ave:** Ground foundation footprint: **96,636 sq ft** vs. gross improvement area: **101,140 sq ft** (includes 4,504 sq ft 2nd-floor office mezzanine across 6 DCAD sections) vs. 214,433 sq ft land.

### B. Ownership Entities & Contact Lanes
* [x] **3001 Meacham Blvd:** Deed owner: **Mercantile Partners, L.P.** (2650 Meacham Blvd, Fort Worth, TX 76137). Named executive principals: **Andrew Ward** (VP) and **Brian Randolph** (Project Director), cited with URLs and access dates. Facilities path marked **`CONTACT_PATH_PARTIAL`** (direct plant/maintenance lead unverified).
* [x] **7151 Jack Newell Blvd S (Owner vs. Operator Separated):**
  * **Deed Owner:** **Allied Electronics, Inc.** (TAD Account `41009673`).
  * **Operating Company / Tenant:** **RS Americas, Inc.** (TAD Rendition Account `10967702`).
  * **Corporate Executive:** **Doug Moody** (President, RS Americas), cited with URLs and access dates.
  * **Facilities Path:** Marked **`CONTACT_PATH_PARTIAL`** (on-site Director of Facilities unverified without internal directory access).
* [x] **1133 S Madison Ave (Two-Lane Resolution):**
  * **Lane A (Deed / Property Owner):** **Treco Investments, Ltd.** (1133 S Madison Ave, Dallas, TX 75208). Named principals: **Albert C. Black, Jr.** (Founder & Executive Chairman) and **Albert C. ("Tré") Black III** (President, TreCo Investments), cited with URLs and access dates.
  * **Lane B (Tenant / Facility Occupant):** **On-Target Supplies & Logistics, Ltd. (OTSL)**. Named executive: **Tré Black** (President & CEO, OTSL), cited with URLs and access dates.

### C. Municipal Permit History & Roof Age Wording
* [x] **Banned "Zero Reroofs Ever" Claim:** Eliminated across all dossiers. Replaced with as-of portal window and unverified age disclosure.
* [x] **3001 Meacham Blvd:** City of Fort Worth Open Data Development Permits verified through October 20, 2026. 60 historical permits checked; 0 reroofs on file. Stated as: *"Roof age unverified; if original, ~28 years (built 1998)."*
* [x] **7151 Jack Newell Blvd S:** City of Fort Worth Open Data Development Permits verified through October 20, 2026. 54 historical permits checked; 0 reroofs on file. Stated as: *"Roof age unverified; if original, ~20 years (built 2006)."*
* [x] **1133 S Madison Ave:** City of Dallas open data permit portal query unconfirmed on live feed for this parcel. Stated as: *"Municipal permit status: UNVERIFIED. Roof age unverified; if original, structural shells date to 1952 (Sections 1–5, 74 years) and 2000 (Section 6, 26 years)."* Existing roof system/membrane material marked **`UNKNOWN`**. Zero fabricated claims.

### D. NOAA Storm Prediction Center (SPC) Verification
* [x] **Correct Storm Year (2026):** Verified against `260425_rpts_hail.csv` (convective date April 25, 2026 / local date April 26, 2026).
* [x] **3001 Meacham Blvd:** 1.00″ hail at 1.06 miles (0539 UTC / 00:39 AM CDT April 26, 2026; Spotter: 2 NW Haltom City, Row 149). Classified: **Storm-Adjacent** (below ≥1.50″ threshold).
* [x] **7151 Jack Newell Blvd S:** 1.00″ hail at 1.79 miles (0546 UTC / 00:46 AM CDT April 26, 2026; Spotter: 1 W Richland Hills, Row 150). Classified: **Tier 2 Capital Reroof / Aging Candidate** (strictly not a storm lead).
* [x] **1133 S Madison Ave:** 1.50″ hail at 3.78 miles (0626 UTC / 01:26 AM CDT April 26, 2026; Spotter: 1 S Cockrell Hill, Row 165). Classified: **Tier 2 Storm-Adjacent Commercial Complex**.

---

## 3. Dallas Inventory Gate (Pack B Policy)

* [x] **Lead 2 Strictly Withheld:** No vague "Stemmons corridor" placeholder in Pack B. Explicit policy statement included explaining that Lead 2 will only ship when an unassigned, DCAD-verified commercial candidate passes the identical audit.

---

## 4. Auditor & Founder Sign-Off (Live Dispatch Record)

| Document | Target Contractor | Verification Version | Audit Gate Outcome | Formal Decision & Live Dispatch Status |
| :--- | :--- | :---: | :---: | :--- |
| [`pack_a_trevor_rodden_sr1.md`](file:///d:/Depoii_nextjs/Roofx/depoii-data-engine/packs/pack_a_trevor_rodden_sr1.md) | SR1 Roofing (Trevor Rodden) | v2.1 | **CONTACT_PATH_PARTIAL**<br>Story count unverified on TAD feed | **CORRECTION NOTE DISPATCHED (Oct 20)**<br>• Meacham (`ASN-001`): `ACTIVE_EXCLUSIVE` through Oct 27<br>• Jack Newell (`ASN-049`): Held `RESERVED_PENDING_DISPATCH` |
| [`pack_b_mike_gibson_new_view.md`](file:///d:/Depoii_nextjs/Roofx/depoii-data-engine/packs/pack_b_mike_gibson_new_view.md) | New View Roofing (Mike Gibson) | v2.1 | **PERMIT_UNVERIFIED**<br>Labeled Tier 2 Storm-Adjacent; roof system unknown | **DISPATCHED BY FOUNDER (Oct 20)**<br>• Madison (`ASN-002`): `ACTIVE_EXCLUSIVE` through Oct 27 (Cooldown through Nov 3) |
| [`lead_assignment_registry.json`](file:///d:/Depoii_nextjs/Roofx/depoii-data-engine/lead_assignment_registry.json) | Project-wide master ledger | v2.1 | `ASN-001` & `ASN-002` active; `ASN-049` reserved | **LOCKED & ACTIVE** |

**Founder Sign-Off & Execution:**  
*Ali Mirza, Founder — Depoii*  
*Dispatch Confirmed:* October 20, 2026 (Both emails sent)

