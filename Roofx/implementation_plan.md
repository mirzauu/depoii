# DEPOII: CEO-CENTRIC IMPLEMENTATION PLAN & ARCHITECTURE
## Decision Intelligence Platform for Commercial Roofing Owners & Operators ($5M–$50M+ Revenue)

---

### Core ICP Definition (Target Audience)
* **Who it is for**: CEOs, Owners, Vice Presidents of Operations, Chief Estimators at commercial & industrial roofing enterprises.
* **Their true pains**:
  1. Material margin erosion (unanticipated 5–7% price hikes on TPO/Polyiso eating contracted margins).
  2. Slow quote follow-up cycle losing 6-figure bids to fast-moving regional competitors.
  3. Commercial leak slippage & unbilled change-orders on active job sites.
  4. Missing early storm & industrial hail swaths across high-value warehousing / logistics parks before competitors flood the market.
* **What they WILL pay $500–$2,500/mo for**: Actionable market intelligence that protects 3–5 points of gross margin and wins 2–3 additional commercial re-roof contracts a year ($150,000–$500,000 in gross revenue each).
* **What they DO NOT care about**: Reddit/Nextdoor chatter, residential door-to-door knocking tips, or raw uncurated Census tract numbers.

---

## 1. System Architecture (Tailored for Commercial Operators)

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      COMMERCIAL DATA SOURCES                           │
 ├────────────────────────────────────────────────────────────────────────┤
 │ • NOAA Severe Storm Swaths (Hail >= 1.5", Wind >= 60mph)               │
 │ • Commercial Parcels & Roof Footprints (Logistics, Industrial, Retail) │
 │ • Supplier Price & Allocation Bulletins (Carlisle, Elevate, GAF)       │
 │ • Municipal Commercial Re-roof Permit Filings                          │
 │ • Competitor Licensing & Active Market Presence                        │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ↓
 ┌────────────────────────────────────────────────────────────────────────┐
 │                     INGESTION & SPATIAL ENGINE                         │
 │                    (PostgreSQL 16 + PostGIS)                           │
 ├────────────────────────────────────────────────────────────────────────┤
 │ • Hierarchical Entities: Country → Region → State → Market → County →  │
 │   ZIP (ZCTA) → Commercial Parcel                                       │
 │ • Spatial Operations: ST_Intersects, ST_DWithin (Buffer zones)         │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ↓
 ┌────────────────────────────────────────────────────────────────────────┐
 │                   CEO SIGNAL & SCORING ENGINE                          │
 ├────────────────────────────────────────────────────────────────────────┤
 │ • Signal 1: Weather Event Damage Index (Hail severity × Parcel density)│
 │ • Signal 2: Supply Chain Volatility (Material lead-times & price alerts│
 │ • Signal 3: Permitting & Capital Activity (Commercial roof renewals)   │
 │ • Signal 4: Competitive Pressure & Lead Capture Friction               │
 │ • Output: Dynamic 0–100 Market & ZIP Opportunity Scores               │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ↓
 ┌────────────────────────────────────────────────────────────────────────┐
 │                 EXECUTIVE AI INTELLIGENCE & BRIEFINGS                  │
 ├────────────────────────────────────────────────────────────────────────┤
 │ • Formats mathematical signals into High-Conviction CEO Briefings     │
 │ • Generates actionable tactical dispatches (Estimating, Crew, Pricing) │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ↓
 ┌────────────────────────────────────────────────────────────────────────┐
 │                     EXECUTIVE NEXT.JS FRONTEND                         │
 ├────────────────────────────────────────────────────────────────────────┤
 │ • Market Cockpit: Opportunity ladder, heat levels, executive briefings │
 │ • ZIP Signal Inspector: Multi-signal breakdowns & parcel insights      │
 │ • Competitor Landscape: Local contractor directory with certs/revenue  │
 │ • Dispatch Trigger: Blueprint & Playbook export                        │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Practical Database Schema (PostgreSQL + PostGIS)

Instead of fragile generic graph tables, we use clean relational models with spatial geometry columns.

### A. Geographic Entities & Market Abstraction
```sql
-- 1. Administrative & Spatial Boundaries
CREATE TABLE geographies (
    id VARCHAR(64) PRIMARY KEY, -- e.g. 'us', 'south', 'tx', 'tx-dallas-county', 'zip-75001'
    name VARCHAR(255) NOT NULL,
    type VARCHAR(32) NOT NULL, -- 'country', 'region', 'state', 'county', 'zip'
    parent_id VARCHAR(64) REFERENCES geographies(id),
    state_code VARCHAR(2),
    geometry GEOMETRY(MultiPolygon, 4326),
    centroid GEOMETRY(Point, 4326),
    commercial_parcels_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Business Market Abstraction (The CEO's Mental Model)
CREATE TABLE markets (
    id VARCHAR(64) PRIMARY KEY, -- e.g. 'dallas-tx', 'houston-tx', 'tampa-fl'
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(64) NOT NULL,
    metro_name VARCHAR(255) NOT NULL,
    state_code VARCHAR(2) NOT NULL,
    region VARCHAR(32) NOT NULL, -- 'South', 'West', 'Midwest', 'Northeast'
    opportunity_score INT NOT NULL DEFAULT 50,
    demand_change_mom INT DEFAULT 0,
    storm_activity_index INT DEFAULT 0,
    material_risk_level VARCHAR(32) DEFAULT 'Normal', -- 'Alert', 'Watch', 'Normal'
    ai_briefing TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Market to County / ZIP Association
CREATE TABLE market_geographies (
    market_id VARCHAR(64) REFERENCES markets(id) ON DELETE CASCADE,
    geography_id VARCHAR(64) REFERENCES geographies(id) ON DELETE CASCADE,
    PRIMARY KEY (market_id, geography_id)
);
```

### B. Commercial Roofing Companies
```sql
CREATE TABLE roofing_companies (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    website VARCHAR(255),
    phone VARCHAR(32),
    address VARCHAR(255),
    city VARCHAR(128),
    state_code VARCHAR(2),
    zip_code VARCHAR(10),
    location GEOMETRY(Point, 4326),
    commercial_focus VARCHAR(32) NOT NULL, -- 'Commercial', 'Industrial', 'Hybrid'
    annual_revenue_est VARCHAR(64),       -- e.g. '$15M - $25M'
    crew_count INT DEFAULT 5,
    rating NUMERIC(2,1) DEFAULT 4.5,
    review_count INT DEFAULT 0,
    certifications TEXT[],                -- e.g. ARRAY['Carlisle Centurion', 'Elevate Master']
    active_storm_response BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_companies_location ON roofing_companies USING GIST(location);
CREATE INDEX idx_companies_zip ON roofing_companies(zip_code);
```

### C. Signals & Severe Weather Events
```sql
-- 4. Weather & Physical Impact Events
CREATE TABLE impact_events (
    id VARCHAR(64) PRIMARY KEY,
    event_type VARCHAR(32) NOT NULL, -- 'HAIL', 'HIGH_WIND', 'TORNADO', 'HURRICANE'
    title VARCHAR(255) NOT NULL,
    severity VARCHAR(32),            -- 'Severe', 'Moderate', 'Watch'
    hail_size_inches NUMERIC(3,2),
    wind_gust_mph INT,
    event_time TIMESTAMP WITH TIME ZONE NOT NULL,
    swath_polygon GEOMETRY(MultiPolygon, 4326),
    source VARCHAR(64) DEFAULT 'NOAA / NWS',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_impact_events_geom ON impact_events USING GIST(swath_polygon);

-- 5. Multi-Signal Registry per Geography
CREATE TABLE geo_signals (
    id BIGSERIAL PRIMARY KEY,
    geography_id VARCHAR(64) REFERENCES geographies(id),
    signal_type VARCHAR(64) NOT NULL, -- 'STORM_IMPACT', 'COMMERCIAL_PERMITS', 'SEARCH_SURGE', 'SUPPLIER_ALERT'
    signal_value NUMERIC(10,2) NOT NULL,
    metric_unit VARCHAR(32),
    confidence_score NUMERIC(3,2) DEFAULT 0.90,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);
CREATE INDEX idx_geo_signals_geo_type ON geo_signals(geography_id, signal_type);
```

---

## 3. The CEO Opportunity Scoring Engine

We abandon naive linear sums. The CEO scoring algorithm accounts for **urgency half-life**, **commercial building square footage**, and **contract value potential**.

```text
Opportunity Score = 
  Base Market Fundamentals (30%)
  + Event Impact Multiplier (40% with 14-day exponential decay)
  + Commercial Permitting & Capital Activity (20%)
  + Competitive Gap & Follow-Up Advantage (10%)
```

### Mathematical Model
1. **Event Surge ($S_{event}$)**:
   $$\text{Decay} = e^{-\frac{t_{\text{days}}}{7}}$$
   If severe hail ($\ge 1.75''$) intersects commercial industrial parcels:
   $$S_{event} = \min(100, \text{HailSeverity} \times \text{CommercialDensity} \times \text{Decay})$$

2. **Supply Chain Friction Risk ($R_{supply}$)**:
   When TPO or Polyiso lead times exceed 4 weeks, bids with unescalated 60-day terms trigger high profit-leak warnings.

3. **Final Composite Score ($Score_{CEO}$)**:
   Bounded between $0$ and $100$, grouped into Executive Action Tiers:
   * **90 – 100 (Alpha Priority)**: Immediate dispatch of estimating teams. Surge pricing in effect.
   * **80 – 89 (Active Growth)**: High conversion probability. Standard proposal follow-up tightening.
   * **60 – 79 (Stable Operations)**: Maintenance and fluid-applied coating focus.
   * **Below 60 (Low Signal)**: Standard preventative maintenance only.

---

## 4. Four-Phase Rollout Plan (Fast Time-to-Value)

### Phase 1: High-Conviction Core (Week 1–2) — *Ship & Validate*
* **Focus Markets**: Launch with **3 Premier Commercial Markets**:
  1. **Dallas-Fort Worth Metroplex (TX)** — High storm volatility + massive industrial warehouse footprint.
  2. **Greater Houston (TX)** — Gulf coast wind degradation + petrochemical corridor.
  3. **Tampa Bay / Central Florida (FL)** — Hurricane wind uplift code + insurance underwriting turbulence.
* **Deliverables**:
  - Pre-seeded PostGIS tables with counties, top 20 commercial ZIPs per market, and verified commercial roofing contractors.
  - Interactive drill-down UI: United States → Region → Market → County → ZIP.
  - Multi-signal cards: Hail diameter, commercial parcel volume, search demand, contractor density.
  - AI Executive Briefing for each market.

### Phase 2: Live Automated Ingestion (Week 3–4) — *Real-Time Accuracy*
* Integrate **NOAA Storm Prediction Center (SPC) GeoJSON feeds**:
  - Automated cron/background worker ingesting hail swaths $\ge 1.25''$ and wind gusts $\ge 60\text{ mph}$.
  - PostGIS `ST_Intersects` trigger: Instantly identifies affected ZIPs and commercial property clusters within 15 minutes of NOAA publishing.
* Integrate **Supplier Price Bulletins**:
  - Live TPO/polyiso price alert ticker (effective dates, allocation lead times).

### Phase 3: Commercial Parcel & Permit Intelligence (Week 5–6) — *Enterprise Moat*
* Attach commercial real estate parcel attributes to high-opportunity ZIPs:
  - Total commercial square footage under roof.
  - Estimated roof membrane age (10–20 year replacement window).
* Add municipal commercial re-roofing permit trend data for pilot counties.
* Launch PDF / One-Click Executive Briefing Export for CEO Board / Sales meetings.

### Phase 4: Personalized Contractor Radar & Alerts (Week 7+) — *High-Retention SaaS*
* CEO sets company profile:
  - Base locations & maximum service radius (e.g., 60-mile radius from DFW headquarters).
  - Specialties: Single-ply TPO, EPDM, Standing Seam Metal, Industrial Fluid Coatings.
* Depoii triggers real-time SMS / Email Executive Bulletins:
  - *"Hail swath confirmed in your primary service zone (ZIP 75024). 18 industrial facilities affected. 3 competitor proposals active."*

---

## 5. First 30 Days Deliverables & Success Metrics
| Milestone | Timeline | Deliverable | Success Criteria |
| :--- | :--- | :--- | :--- |
| **M1: Core UI & 3 Anchor Markets** | Day 7 | Interactive Market Intelligence Cockpit for DFW, Houston, and Tampa. | Functional drill-down to ZIPs with verified contractors and scoring. |
| **M2: Live NOAA Swath Ingestion** | Day 14 | PostGIS automated intersection pipeline. | NOAA hail events automatically bump ZIP opportunity scores. |
| **M3: CEO Feedback Interviews** | Day 21 | Demo with 3 commercial roofing CEOs / VPs of Ops. | Validate whether the intelligence justifies a $500–$1,000/mo subscription. |
| **M4: Exportable Action Playbooks** | Day 30 | Integrated PDF / Blueprint dispatches for sales and estimating teams. | Contracting CEOs can directly hand the report to their sales director. |
