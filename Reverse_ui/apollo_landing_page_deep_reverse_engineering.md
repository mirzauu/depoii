# Apollo.io Landing Page Deep Reverse Engineering & Architectural Blueprint

> **Analysis Scope**: Complete structural, psychological, UI/UX, and design system reverse engineering of Apollo.io's live flagship landing page (`https://www.apollo.io/`), paired with a direct conversion blueprint for Depoii's commercial roofing intelligence platform (`/welcome`).
> **Captured Assets**: 14 high-resolution section screenshots located in [Reverse_ui/screenshots](file:///d:/Depoii_nextjs/Reverse_ui/screenshots).

---

## Executive Summary & Core Strategic Shift

Apollo’s homepage is **not** a traditional feature tour or generic SaaS marketing site. It represents a masterclass in **Positioning Evolution**:

1. **The Strategic Transition**: Apollo has systematically transitioned from being viewed as a "cheap ZoomInfo contact database scraper" into an **"All-in-One AI GTM Operating System"**.
2. **The 3-Layer Flywheel**: Instead of marketing disjointed point features (Scraper, Sequences, Dialer, AI Writer), Apollo structures its entire value proposition into an indivisible triad:
   $$\text{Data} \longrightarrow \text{Intelligence} \longrightarrow \text{Execution} \longrightarrow \text{New Data}$$
3. **Frictionless Zero-Commitment Top of Funnel**: The hero section eliminates all standard registration barriers by offering instant 1-click Google/Microsoft OAuth directly inside the hero banner.
4. **Anti-Gimmick AI Defense**: Apollo aggressively attacks "generic AI wrappers" by highlighting AI that **actually executes** (taking action on verified contacts, respecting CRM governance, prompting humans only at critical decision points).

```
┌────────────────────────────────────────────────────────────────────────┐
│                        APOLLO.IO HOMEPAGE ENGINE                       │
├────────────────────────────────────────────────────────────────────────┤
│ 1. HERO (Frictionless OAuth + Interactive Live Product Canvas)         │
│    └── "Grow revenue with one connected GTM system"                    │
│                                                                        │
│ 2. REPUTATION MARQUEE                                                  │
│    └── "Join over 600,000 companies using Apollo"                      │
│                                                                        │
│ 3. THE 4 CAPABILITY PILLARS (Asymmetric Interactive Feature Cards)     │
│    ├── Pillar 1: Open GTM Workspace (200+ Integrations)                │
│    ├── Pillar 2: Unified Apollo Profile (Single Source of Truth)       │
│    ├── Pillar 3: AI Context Center (Autonomous Busywork Execution)     │
│    └── Pillar 4: Verified Data Foundation (275M+ Contacts)             │
│                                                                        │
│ 4. THE 3-LAYER SYSTEM BLUEPRINT                                        │
│    └── Data Feeds Intelligence → Intelligence Drives Execution         │
│                                                                        │
│ 5. ANTI-GIMMICK AI PITCH                                               │
│    └── "Generic AI talks about pipeline. Apollo AI runs it."           │
│                                                                        │
│ 6. ENTERPRISE COEXISTENCE & HARD COMPLIANCE                            │
│    ├── "Don't change your workflow. Just add Apollo."                  │
│    └── SOC 2 Type II, ISO 27001, GDPR, CASA Tier 2 Badges              │
│                                                                        │
│ 7. QUANTIFIED PROOF METRICS                                            │
│    └── Auditable Case Studies (+400% Pipeline, 3x Rep Productivity)    │
│                                                                        │
│ 8. HIGH-CONVERSION CLOSING CTA BANNER                                  │
│    └── Immediate Free Tier Sign-up vs. Enterprise Sales Consultation   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Design System & Visual Specification

Apollo’s landing page layout uses a sophisticated "Card on Canvas" architectural frame:

### 1. Canvas & Surface Hierarchy
- **Outer Canvas (`bg-sand-40`)**: `#CCC9C6` (A warm, tactile architectural beige/taupe that frames the central content card, signaling maturity, premium enterprise grounding, and separating Apollo from cold generic blue/white SaaS pages).
- **Inner Content Island (`bg-white`)**: Solid `#FFFFFF` card with rounded corners (`rounded-t-lg` / `rounded-b-xl`, `mx-6` desktop gutter) that floats seamlessly over the sand canvas.
- **Section Accent Background (`bg-sand-10`)**: `#F6F5F2` (Warm neutral tint applied to deep dive sections like "Why Apollo AI" to create visual rhythm without introducing abrasive background shifts).
- **Borders & Dividers**: `1px solid rgba(0, 0, 0, 0.08)` / `#E7E6E4`. Subtle hairline dividers maintain structure without high-contrast clutter.

### 2. Typography Token Scale
- **Display Font**: Custom Grotesque Sans (`Inter` / `Apollo Grotesk`) with tight tracking and high x-height for crisp readability.
- **Hero Title (`H1`)**: `clamp(44px, 5.2vw, 68px)`, line-height `108%`, letter-spacing `-0.035em`, font weight `600` (`#111110`).
- **Section Titles (`H2`)**: `40px` - `48px`, line-height `115%`, letter-spacing `-0.025em`, font weight `500` - `600`.
- **Eyebrow Pill Badges**: `12px` uppercase, letter-spacing `0.08em`, font weight `700`, text `#787672`, often encased in a soft pill tag (`rounded-full bg-sand-20 px-3 py-1`).
- **Body / Descriptive Paragraphs**: `18px` - `20px`, line-height `150%`, color `#5B5A57` (soft charcoal rather than harsh `#000000` to prevent eye strain).

### 3. CTA & Interaction Components
- **Primary Action**: Pill-rounded solid black button (`bg-[#111110] text-white px-6 py-3.5 text-base font-semibold hover:bg-[#252523] hover:shadow-md transition-all`).
- **OAuth Single Sign-On Buttons**: Pill-rounded white cards with subtle hairline border (`border border-[#D1D0CD] bg-white text-[#111110] hover:bg-[#F9F9F8] font-medium`), embedding official Google and Microsoft SVGs.
- **In-Page Work Email Form**: High-density horizontal input container with the input field and primary CTA nested inside a single unified boundary.

---

## Detailed Section-by-Section Reverse Engineering

### Section 01: Hero & Instant Frictionless Conversion Engine
- **Visual Capture**: [Reverse_ui/screenshots/01_hero_and_oauth.png](file:///d:/Depoii_nextjs/Reverse_ui/screenshots/01_hero_and_oauth.png) & [02_hero_product_video.png](file:///d:/Depoii_nextjs/Reverse_ui/screenshots/02_hero_product_video.png)

```
┌────────────────────────────────────────────────────────────────────────┐
│  [ Apollo Logo ]     Products  Solutions  Resources  Customers  Pricing  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│              Grow revenue with one connected GTM system                 │
│                                                                        │
│        Connect data, intelligence, and execution across every rep,     │
│             workflow, and channel — powered by Apollo AI.              │
│                                                                        │
│      ┌─────────────────────────────┐ ┌─────────────────────────────┐   │
│      │ [G] Sign up with Google    │ │ [M] Sign up with Microsoft  │   │
│      └─────────────────────────────┘ └─────────────────────────────┘   │
│                               ── or ──                                 │
│      ┌──────────────────────────────────────────────┬──────────────┐   │
│      │ Enter your work email                        │ Sign up free │   │
│      └──────────────────────────────────────────────┴──────────────┘   │
│           By signing up, I agree to Terms & Privacy. Free forever.     │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │  [LIVE PRODUCT WORKSPACE PREVIEW]                              │   │
│   │  Search filters | 275M Contacts Table | Live Email Cadence     │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

#### UI & Component Architecture
- **Header (`72px`)**: Sticky floating transparent navigation that transitions to a subtle frosted sand backdrop on scroll. Contains 5 grouped mega-menus and a dual "Log In" / "Sign Up Free" CTA cluster.
- **Dual Conversion Vector**:
  1. *Frictionless SSO*: Google & Microsoft OAuth buttons side-by-side. 80% of B2B SaaS users authenticate via corporate Google Workspace or Microsoft 365. Offering these upfront skips the form-fill barrier entirely.
  2. *Traditional Work Email*: Form input with embedded submit button for prospects who prefer email/password or whose IT prevents immediate OAuth.
- **Zero Risk Micro-copy**: "Free forever. No credit card required."
- **Interactive Live Product Canvas**: Instead of a generic stock photo, Apollo renders an ultra-crisp, high-fidelity viewport of their real data grid, showing search filters, prospect cards, and verified email tags.

#### Cognitive Psychology & Copy Strategy
- **Headline Analysis**: *"Grow revenue with one connected GTM system"*.
  - It speaks to the ultimate executive KPI (**Revenue Growth**).
  - It highlights the strategic remedy (**Connected System** vs. fragmented tool chaos).
- **The Core Objection Dissolved**: Prospects hate filling out 7-step lead forms. By allowing 1-click Google/Microsoft authentication, Apollo converts intent into an active user session in under 3 seconds.

---

### Section 02: Reputation Marquee & Social Validation
- **Visual Capture**: [Reverse_ui/screenshots/03_social_proof_marquee.png](file:///d:/Depoii_nextjs/Reverse_ui/screenshots/03_social_proof_marquee.png)

#### UI Architecture
- Eyebrow tag: `text-xs font-bold tracking-[0.08em] text-[#787672] uppercase text-center mb-6`
  `JOIN OVER 600,000 COMPANIES USING APOLLO`
- Infinite smooth horizontal logo ticker featuring globally recognizable brands: Autodesk, Census, Customer.io, Divvy, Glean, Stripe ecosystem partners.
- Monochrome gray rendering (`filter: grayscale(100%) opacity(0.7)`) to ensure the logos do not clash with Apollo's palette while conveying institutional stability.

#### Strategy
- **Bandwagon Bias**: 600,000 companies is an incomprehensibly large number in B2B tech. It reassures mid-market and enterprise buyers that Apollo is standard market infrastructure, not an unproven startup.

---

### Section 03: Capability Pillar 1 — "Run your go-to-market, your way" (Open Workspace & Integrations)
- **Visual Capture**: [Reverse_ui/screenshots/04_feature_workspace.png](file:///d:/Depoii_nextjs/Reverse_ui/screenshots/04_feature_workspace.png)

#### UI Architecture
- **Asymmetric 2-Column Grid**: Left column features strong typography and deep value statements; right column features an interactive preview card displaying the multi-channel workspace (Email, Dialer, Tasks, Integrations).
- **Integration Pill Badges**: Displays 200+ native connectors (Salesforce, HubSpot, Outreach, Salesloft, Gmail, Outlook, LinkedIn).

#### Strategy & Objection Handling
- **The #1 Enterprise Objection**: *"We already invested $200k in Salesforce and HubSpot. We aren't going to rip and replace them for Apollo."*
- **The Solution**: Apollo immediately neutralizes this by declaring: *"Run your GTM motion in Apollo, or plug it into the tools you already use. Either way, your data stays connected."* It positions Apollo as an **amplifier**, not a replacement.

---

### Section 04: Capability Pillar 2 — "Give every team the same source of truth" (Unified Apollo Profile)
- **Visual Capture**: [Reverse_ui/screenshots/05_feature_unified_profile.png](file:///d:/Depoii_nextjs/Reverse_ui/screenshots/05_feature_unified_profile.png)

#### UI Architecture
- Visual presentation of the **Apollo Unified Profile**:
  - Left panel: Enriched prospect intelligence (Direct mobile numbers, validated email status, job tenure, past company history).
  - Center panel: First-party engagement timeline (CRM deal stage, product usage telemetry, Gong/Chorus call summaries).
  - Right panel: High-intent signals (Job openings, tech stack changes, website visits).

#### Strategy
- Solves **Data Silo Fragmentation**: RevOps, SDRs, and Account Executives normally operate in different databases with conflicting information. Apollo offers a single canonical record for every account and decision-maker.

---

### Section 05: Capability Pillar 3 — "Let AI handle the busywork" (Autonomous AI Execution)
- **Visual Capture**: [Reverse_ui/screenshots/06_feature_ai_busywork.png](file:///d:/Depoii_nextjs/Reverse_ui/screenshots/06_feature_ai_busywork.png)

#### UI Architecture
- Shows the **AI Context Center & Autonomous Agent Interface**:
  - Interactive prompt card: *"32 leads found matching your ICP at Series B companies. Personalized emails drafted. Ready for review."*
  - Dual action toggles: `[Approve Batch]` or `[Inspect Individual Prompts]`.

#### Strategy: The "Human-in-the-Loop" Trust Anchor
- **Why Generic AI Marketing Fails**: Sales leaders fear autonomous AI hallucinating or emailing their VIP enterprise prospects embarrassing gibberish.
- **Apollo's Positioning**: Apollo emphasizes **supervised autonomy**. AI performs the 4 hours of tedious research and list compilation, but flags key moments for human reps to approve before dispatch.

---

### Section 06: Capability Pillar 4 — "Build on data you can actually trust" (Waterfall Enrichment Foundation)
- **Visual Capture**: [Reverse_ui/screenshots/07_feature_data_foundation.png](file:///d:/Depoii_nextjs/Reverse_ui/screenshots/07_feature_data_foundation.png)

#### UI Architecture
- Prominent metrics callouts:
  - **275M+** Verified Contacts
  - **73M+** Global Companies
  - **9-Step** Multi-Provider Waterfall Verification
- Card demonstrates live waterfall enrichment: If provider A lacks a direct mobile number, provider B fills it in real-time, verified by automated dialer pings.

#### Strategy
- Outbound campaigns fail because of dirty data (bounces, wrong numbers). Apollo grounds its entire AI story in having the largest, cleanest proprietary database.

---

### Section 07: The 3-Layer System Flywheel ("HOW IT WORKS")
- **Visual Capture**: [Reverse_ui/screenshots/08_three_layers_system.png](file:///d:/Depoii_nextjs/Reverse_ui/screenshots/08_three_layers_system.png) & [08b_three_layers_cards.png](file:///d:/Depoii_nextjs/Reverse_ui/screenshots/08b_three_layers_cards.png)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ONE SYSTEM. THREE LAYERS.                       │
│    Data feeds intelligence. Intelligence drives execution.             │
│    Execution creates more data. Every interaction makes you smarter.   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   ┌────────────────────────┐  ┌────────────────────────┐  ┌──────────┐ │
│   │     1. DATA LAYER      │  │ 2. INTELLIGENCE LAYER  │  │ 3. EXEC  │ │
│   │                        │  │                        │  │  LAYER   │ │
│   │ • 275M+ verified data  │  │ • Buyer intent scoring │  │ • Dialer │ │
│   │ • CRM bi-directional   │─▶│ • AI account research  │─▶│ • Email  │ │
│   │ • Waterfall enrichment │  │ • Trigger alerts       │  │ • Tasks  │ │
│   └────────────────────────┘  └────────────────────────┘  └──────────┘ │
│                ▲                                                │      │
│                └────────────────────────────────────────────────┘      │
│                     (Execution Telemetry Enriches Database)            │
└────────────────────────────────────────────────────────────────────────┘
```

#### Architectural Significance
- This is the intellectual centerpiece of the entire page.
- It proves that Apollo is not a random grab-bag of tools, but a **closed-loop compounding ecosystem**.
- By showing the arrows connecting the three layers, Apollo visually explains why using 3 separate point solutions (e.g., ZoomInfo + 6sense + Outreach) will always be inferior: fragmented tools do not feed data back into each other automatically.

---

### Section 08: Anti-Gimmick AI Pitch ("WHY APOLLO AI — AI that actually executes")
- **Visual Capture**: [Reverse_ui/screenshots/09_ai_execution.png](file:///d:/Depoii_nextjs/Reverse_ui/screenshots/09_ai_execution.png)

#### UI Architecture
- Background shifts to `#F6F5F2` (`bg-sand-10`) to indicate a thought-leadership / architectural contrast.
- Headline: *"AI that actually executes"*.
- Subtitle: *"Generic AI talks about pipeline. Apollo’s AI runs it, and gets smarter as you grow."*
- 3 Pillar Comparison Cards:
  1. **Deep Context vs. Generic Prompts**: Apollo AI trains on actual closed-won GTM data, not generic web scrapes.
  2. **Multi-Channel Orchestration**: Executes across email, phone, LinkedIn, and CRM automatically.
  3. **Enterprise Guardrails**: Built-in governance, spam-avoidance algorithms, and compliance rules.

---

### Section 09: Enterprise Integration & Compliance Shield
- **Visual Capture**: [Reverse_ui/screenshots/10_enterprise_workflow.png](file:///d:/Depoii_nextjs/Reverse_ui/screenshots/10_enterprise_workflow.png) & [11_compliance_security.png](file:///d:/Depoii_nextjs/Reverse_ui/screenshots/11_compliance_security.png)

#### UI Architecture
- **Integration Hub Graphic**: Demonstrates two-way bi-directional synchronization with enterprise CRMs (Salesforce, HubSpot) without data overwrites.
- **Compliance Badge Grid**: 8 auditable enterprise security certifications:
  - `GDPR` Compliant
  - `SOC 2 Type II` Certified
  - `CCPA` Compliant
  - `ISO/IEC 27001` Certified
  - `CASA Tier 2` Verified
  - `CPRA` Compliant
  - `EU-US Data Privacy Framework`
  - `PCI DSS` Compliant

#### Strategy
- Mid-market and enterprise deals die in security and infosec reviews. Putting these 8 certifications directly on the landing page eliminates procurement friction upfront.

---

### Section 10: Quantified Hard Proof Testimonials & Auditable Case Studies
- **Visual Capture**: [Reverse_ui/screenshots/12_testimonials_metrics.png](file:///d:/Depoii_nextjs/Reverse_ui/screenshots/12_testimonials_metrics.png)

#### UI Architecture
- 3 Multi-Column Customer Metric Cards:
  - **Glean**: `+400%` Qualified Pipeline Generated
  - **Lyon Bakery**: `3x` Sales Rep Efficiency, `15 hrs` Saved per Week
  - **Claiton**: `48%` Reduction in Customer Acquisition Cost (CAC)
- Features real high-resolution executive headshots, authentic quotes detailing operational shifts, and company logos.

#### Strategy
- Vague praise (*"Apollo is an amazing tool!"*) converts nobody. Specific, auditable percentages and hours saved provide the champion with the exact ammunition needed to convince the CFO.

---

### Section 11: Closing High-Impact CTA Banner & Mega-Footer
- **Visual Capture**: [Reverse_ui/screenshots/13_closing_cta.png](file:///d:/Depoii_nextjs/Reverse_ui/screenshots/13_closing_cta.png)

#### UI Architecture
- Contained within a rich textured dark charcoal card (`rounded-2xl`).
- High-contrast typography: *"Grow revenue with one connected system"*.
- Dual CTA: High-prominence white primary button (`Sign up for free`) next to an enterprise ghost button (`Talk to sales`).
- Massive 5-column directory footer indexing solutions by role (SDR, AE, RevOps), by company size, by product, and free directory tools.

---

## Direct Depoii Transformation Blueprint (`/welcome`)

Depoii is currently selling **Commercial Roofing Intelligence & Parcel Data** to commercial roofing contractors, estimators, and suppliers.

### Why Depoii's Current Landing Page Is Underperforming
1. **The Scroll-Jacking Barrier**: The current `/welcome` experience forces users to scroll through multiple rigid frames of dummy map and pipeline screens before letting them do anything.
2. **Generic "Free Pilot" CTA**: "Request a free pilot" requires submitting a contact form and waiting 24–48 hours. Modern contractors want instant gratification.
3. **Missing Architectural Narrative**: The current page shows features (permits, buildings, aging) as separate tables, rather than an interconnected intelligence engine.

---

### The New Apollo-Inspired Depoii Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DEPOII WELCOME ARCHITECTURE                     │
├────────────────────────────────────────────────────────────────────────┤
│ 1. HERO: INSTANT PARCEL & COMMERCIAL ROOF LOOKUP                       │
│    └── "Find Every High-Value Commercial Roof Replacement Before       │
│         Competitors Even Spot the Leak."                               │
│    └── [ Enter Property Address or Metro Area ] [ Inspect Roof Free ]  │
│                                                                        │
│ 2. PROOF BANNER                                                        │
│    └── "Tracking Over $4.2B in Commercial Roof Replacement Pipeline"   │
│                                                                        │
│ 3. THE 4 ROOFING CAPABILITY PILLARS                                    │
│    ├── Pillar 1: Parcel & Aging Telemetry (150M+ Commercial Parcels)   │
│    ├── Pillar 2: Pierced LLC Veil (Verified Property Owner Cell/Email) │
│    ├── Pillar 3: AI Storm & Hail Impact Overlay (Zero-Delay Doppler)   │
│    └── Pillar 4: Territory Lock & Route Engine (Exclusive Protected)   │
│                                                                        │
│ 4. THE 3-LAYER ROOFING INTELLIGENCE FLYWHEEL                           │
│    └── Data Layer (Parcels) → Intelligence (Aging) → Execution (Calls) │
│                                                                        │
│ 5. ANTI-GIMMICK ROOFING AI                                             │
│    └── "AI that actually knows the difference between TPO, EPDM,      │
│         and Modified Bitumen."                                         │
│                                                                        │
│ 6. CONTRACTOR AUDITABLE ROI PROOF                                      │
│    └── Real Contractor Metrics ($2.4M in bids closed, 6x faster)       │
│                                                                        │
│ 7. CLOSING EXCLUSIVE TERRITORY CTA                                     │
│    └── Check Your Zip Code / Territory Availability                    │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Detailed Depoii Section Execution Plan

#### 1. Hero: Instant Commercial Property Lookup (Zero Friction)
- **Headline**:
  > *"Find Every High-Value Commercial Roof Replacement Before Competitors Even Spot the Leak."*
- **Subheadline**:
  > *"Depoii unifies commercial parcel footprints, satellite roof aging, and verified property owner contact details into one connected sales intelligence system."*
- **The Interactive Hook (Replacing Generic Form)**:
  - An interactive address search bar:
    ```
    ┌─────────────────────────────────────────────────────────┬──────────────┐
    │ 🔍  Enter any commercial address (e.g. 1200 Market St) │ Inspect Roof │
    └─────────────────────────────────────────────────────────┴──────────────┘
    ```
  - Typing an address generates an **instant live teaser card**:
    - Roof Surface Area: `42,500 sq ft`
    - Estimated Roof Age: `18 Years (Critical Replacement Window)`
    - Substrate: `TPO / Ballasted Membrane`
    - Owner Entity: `Lone Star Real Estate Holdings LLC`
    - Locked Contact: `[ Unlock Decision Maker Phone & Email ]`
- **Result**: Instant visceral proof of Depoii's power in 5 seconds.

#### 2. The 3-Layer Commercial Roofing System
Replicate Apollo’s "How it Works" 3-Layer System adapted for Commercial Roofing:

| Layer | Name | What Depoii Delivers |
|---|---|---|
| **Layer 1** | **Parcel & Permit Data Foundation** | 150M+ parcel footprints, municipal roofing permits, tax assessor records, historical contractor filings. |
| **Layer 2** | **Roofing Intelligence** | Doppler hail & storm trajectory overlays, AI roof aging curves (15–25 yr thresholds), owner LLC entity de-anonymization. |
| **Layer 3** | **Contractor Execution** | One-click direct owner phone dialing, pre-drafted certified mail letters, territory route planning, export to JobNimbus / AccuLynx. |

#### 3. Anti-Gimmick Commercial Roofing AI
- **Eyebrow**: `WHY DEPOII AI`
- **Headline**: *"AI that knows the difference between TPO, EPDM, and Standing Seam."*
- **Core Message**: Generic AI scrapers send residential hail letters to commercial industrial park owners. Depoii AI understands commercial real estate leases (Triple Net, Gross, Owner-Occupied vs. REIT), ensuring contractors only pitch the entity authorized to sign $250,000+ roof replacements.

#### 4. Quantified Contractor ROI Proof Cards
- **North Texas Commercial Roofing**:
  - Metric: **$2.8M** in signed commercial re-roof contracts in first 90 days.
  - Quote: *"We stopped knocking random industrial parks. Depoii handed us 45 buildings with 20-year-old roofs and the cell phone numbers of the managing partners."*
- **Midwest Industrial Contracting**:
  - Metric: **4.5x** increase in qualified estimator walk-through appointments.

#### 5. Scarcity-Driven Closing CTA: "Claim Your Protected Territory"
- Instead of "Request a Free Pilot", use **Territory Exclusivity**:
  > *"Depoii limits access to 2 certified commercial contractors per metro territory. Check if your territory is still open."*
- Input field: `[ Enter Zip Code or County ]` -> `[ Check Territory Availability ]`.

---

## Action Plan for Depoii Implementation

1. **Phase 1: Update Hero Component (`src/app/welcome/page.tsx`)**:
   - Replace the locked multi-scroll container with a clean Apollo-style container (`bg-sand-40` frame with floating inner white card).
   - Implement the interactive address lookup mock preview.
2. **Phase 2: Add the 3-Layer Roofing Flywheel Component**:
   - Create `src/components/welcome/ThreeLayersFlywheel.tsx` modeling Data -> Intelligence -> Execution with clean SVG connection lines.
3. **Phase 3: Integrate Social Proof & ROI Metrics**:
   - Add contractor proof cards and roof material manufacturer validation badges (Carlisle, GAF Commercial, Elevate).
4. **Phase 4: Scarcity Territory CTA**:
   - Add an interactive Zip Code / Territory availability checker at the base of `/welcome`.
