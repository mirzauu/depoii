# DEPOII™ — Step-by-Step Execution Sequence (First to Last)
### Chronological Engineering Checklist for Dallas County Rollout
**Target:** 54,693 Commercial Map Parcels (Dallas County, TX)  
**Output Location:** `d:\Depoii_nextjs\Depoii_plan_implemention\EXECUTION_SEQUENCE_FIRST_TO_LAST.md`  
**Status:** Ready to Execute  

---

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CHRONOLOGICAL EXECUTION ORDER                         │
│                                                                             │
│  STAGE 1: Code Hardening & Data Hygiene   ──► Fix matcher & kill 45m circle │
│  STAGE 2: Database & Roll Ingestion       ──► Ingest 54,693 commercial roll │
│  STAGE 3: Sector 1 Pilot (Northwest Hub)  ──► Irving, Coppell, Valwood      │
│  STAGE 4: Live Permit Resolution          ──► DallasNow / Accela live sync  │
│  STAGE 5: JIT Verification & Dossiers     ──► Top 50 C-suite loss dossiers  │
│  STAGE 6: Countywide Automation Daemon    ──► Real-time 15m hail monitoring │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## STAGE 1: Code Hardening & Hygiene Fixes (DO FIRST)
*Objective: Stop corrupting lead data before touching another parcel.*

- [ ] **Step 1.1: Fix the Address Tokenizer in `batch_parcel_matcher.py`**
  - **Problem in Code:** Lines 62–65 currently strip directionals (`E SEMINARY` $\rightarrow$ `SEMINARY`).
  - **Action:** Delete directional stripping. Require `[ST_NUM] + [DIRECTIONAL: N/S/E/W] + [ST_NAME]`.
  - **Verification:** Ensure `E LOOP 820` never matches `N LOOP 820`.

- [ ] **Step 1.2: Eliminate 45-Meter Radial Permit Linking in `spatial_permit_matcher.py`**
  - **Problem in Code:** Line 19 uses `max_distance_meters=45.0` to glue permits to nearby parcels, causing false links along commercial corridors (e.g. Dallas Pkwy).
  - **Action:** Remove radial distance from permit linking. Distance is strictly reserved for **NWS hail reports $\rightarrow$ parcel centroids**.

- [ ] **Step 1.3: Quarantine Frozen Permit Feeds in `src/lib/live/dallas.ts`**
  - **Problem in Code:** Line 13 references `NewPermit_2008_2024`, which stops on **Nov 12, 2024**.
  - **Action:** Add a hard warning banner on any lead evaluated against this layer: *"Permit layer frozen as of Nov 12, 2024 — requires live DallasNow verification."*

---

## STAGE 2: Database Preparation & Ground Truth Ingestion
*Objective: Establish zero-latency local database indexed for sub-5ms lookups.*

- [ ] **Step 2.1: Ingest DCAD 2026 Certified Roll (`DCAD2026_CURRENT.ZIP`)**
  - Stream `ACCOUNT_INFO.CSV` and `COM_DETAIL.CSV` directly into SQLite (`depoii_local.db`).
  - Populate: `account_number`, `owner_name`, `owner_address`, `building_sqft`, `year_built`, `property_type`.

- [ ] **Step 2.2: Build Deterministic CAD Deep Links**
  - Synthesize direct links without scraping:  
    `record_url = "https://www.dallascad.org/AcctDetailCom.aspx?ID=" + account_number`

- [ ] **Step 2.3: Build Core B-Tree Database Indexes**
  - Run SQL migrations:
    ```sql
    CREATE INDEX IF NOT EXISTS idx_parcels_jurisdiction ON parcels(jurisdiction, property_type, building_sqft);
    CREATE INDEX IF NOT EXISTS idx_parcels_address_clean ON parcels(address, city);
    CREATE INDEX IF NOT EXISTS idx_parcels_coords ON parcels(latitude, longitude);
    ```

---

## STAGE 3: Sector 1 Pilot Launch (Northwest Logistics Corridor)
*Objective: Deploy to the highest-dollar, highest-density commercial reroof corridor.*

- [ ] **Step 3.1: Scope Sector 1 Boundaries**
  - Cities: **Irving, Coppell, Carrollton, Farmers Branch, Addison**.
  - Baseline Volume: **4,011 commercial parcels** (86.7% are $\ge 15,000\text{ sq ft}$).

- [ ] **Step 3.2: Filter Target Asset Thresholds**
  - Select parcels with:
    - `building_sqft >= 25,000`
    - `year_built >= 1920`
    - Flat / low-slope commercial roof construction (warehouses, office parks, corporate HQs).

- [ ] **Step 3.3: Spatial Hail Swath Intersection**
  - Intersect Sector 1 parcels with historical severe hail polygons (e.g. 2.0" hail tracks).
  - Calculate kinetic impact energy (Joules) and distance to nearest NWS spotter report.
  - Expected yield: **~350–500 storm-exposed commercial targets**.

---

## STAGE 4: Live Permit Resolution Pipeline
*Objective: Identify the genuine "Unresolved Gap" with zero post-storm permits.*

- [ ] **Step 4.1: Query City of Dallas Live API (DallasNow / Accela)**
  - Ingest reroof permits filed from storm date to current day.
  - Extract: Permit Number, Contractor Name, Valuation, Scope Description.

- [ ] **Step 4.2: Run Strict 4-Token Address Matching**
  - Match candidate storm parcels against live reroof permits.
  - **Lead Qualification Filter:**
    $$\text{Qualified Lead} = (\text{Hail} \ge 1.5'') \cap (\text{Area} \ge 25\text{k}) \cap (\text{Verified Reroof Permits Post-Storm} = 0)$$

- [ ] **Step 4.3: Isolate Unresolved Roster**
  - Filter out resolved roofs (where a competitor already pulled a permit).
  - Retain only **unresolved commercial losses**.

---

## STAGE 5: Just-In-Time (JIT) Verification & Dossier Generation
*Objective: Deliver audit-grade C-suite loss dossiers to contractor sales leadership.*

- [ ] **Step 5.1: Shortlist Top 50 Highest-Scoring Leads**
  - Rank by: Replacement contract value ($\$1\text{M}–\$10\text{M}+$) $\times$ Hail Exposure Score ($90–100$).

- [ ] **Step 5.2: Run Live DCAD Detail Fetcher (`live_dcad_detail_fetcher.py`) on Shortlist**
  - Hit `dallascad.org/AcctDetailCom.aspx?ID={account}` for the 50 assets only.
  - Extract:
    - Exact foundation square footage (true roof footprint).
    - Story count (differentiating flat warehouse from multi-story tower).
    - Improvement section breakdown (e.g., Office vs Warehouse).

- [ ] **Step 5.3: High-Resolution Aerial Capture**
  - Capture 0.15m/px true-ortho aerial imagery of the roof envelope.

- [ ] **Step 5.4: Generate Executive Loss Dossiers**
  - Compile HTML/PDF Dossier (matching the standard of `Town_and_Country_Roofing_Commercial_Dossier.html`).
  - Include: Storm date, radar reflectivity, estimated replacement valuation, and Texas statutory TDI 24-month notice countdown.

---

## STAGE 6: Full County Scaling & Autonomous Daemon (DO LAST)
*Objective: Scale from Sector 1 to countywide 24/7 autonomous monitoring.*

- [ ] **Step 6.1: Ingest Remaining Sectors**
  - **Sector 2:** Dallas Central Core & Stemmons (39,103 commercial parcels).
  - **Sector 3:** South Logistics Hub — Grand Prairie, Lancaster, Hutchins (4,923 commercial parcels).
  - **Sector 4:** East Corridor — Garland, Mesquite, Richardson (5,758 commercial parcels).
  - Full County Total: **54,693 commercial parcels**.

- [ ] **Step 6.2: Activate `daily_storm_daemon.py`**
  - Connect to automated NOAA NEXRAD Level III radar feeds.
  - When hail $\ge 1.5''$ strikes any coordinate in Dallas County, the daemon automatically:
    1. Intersects parcels within 15 minutes.
    2. Runs permit hygiene checks.
    3. Notifies sales leadership with instant inspection routes.

- [ ] **Step 6.3: Deploy Competitor Market-Share Radar**
  - Track competitor permit filings across all 33 municipalities in real time to show market share shifts.

---

*Authored by Depoii Systems Architecture & Lead Data Engineering Team.*  
*File Saved: `d:\Depoii_nextjs\Depoii_plan_implemention\EXECUTION_SEQUENCE_FIRST_TO_LAST.md`*
