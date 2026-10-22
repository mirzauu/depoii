# Depoii GTM Plan: Design Partner Pilot Roadmap & Protocol
> [!CAUTION]
> **SUPERSEDED / HISTORICAL REFERENCE — Source of truth resides strictly in [`Roofx/depoii-data-engine/`](file:///d:/Depoii_nextjs/Roofx/depoii-data-engine/) ([`lead_assignment_registry.json`](file:///d:/Depoii_nextjs/Roofx/depoii-data-engine/lead_assignment_registry.json) and [`packs/`](file:///d:/Depoii_nextjs/Roofx/depoii-data-engine/packs/)).**  
> All property specs below have been reconciled to the verified Pack A and Pack B dossiers.

> **Target Accounts:** Trevor Rodden (SR1 Roofing, LLC) & Mike Gibson (New View Roofing / Mob Home Solutions, Inc.)  
> **Engagement Lane:** `ACTIVE_DESIGN_PARTNERS`  
> **Lifecycle Status:** `ACTIVE_EXCLUSIVE` (7-Day Exclusivity in Effect)  
> **Effective Dates:** October 20, 2026 – November 3, 2026 (Parallel Waves launch Oct 28 & Oct 30)  
> **Author:** Depoii Commercial GTM Team  

---

## 1. Executive Summary & Objective

On **Monday, October 20, 2026**, Depoii dispatched pilot lead resolution packs to our two engaged design partners:
1. **Trevor Rodden** (`trevor@sr1roofing.com`), Managing Partner of **SR1 Roofing, LLC** — Lead `ASN-001` (3001 Meacham Blvd, Fort Worth).
2. **Mike Gibson** (`mike@newviewroofing.com`), President of **New View Roofing** — Lead `ASN-002` (1133 S Madison Ave, Dallas).

Both parcels are held under **100% active exclusivity** through **October 27, 2026**.

**Core Objective:** While awaiting their replies, maintain strict operational silence (zero outbound to other roofers), prepare the next wave of vetted commercial specialists in the background, and execute pre-scripted response workflows the moment Trevor or Mike replies.

---

## 2. Partner Dossier & Assigned Assets

| Attribute | Partner A: Trevor Rodden (SR1 Roofing) | Partner B: Mike Gibson (New View Roofing) |
| :--- | :--- | :--- |
| **Contact** | Trevor Rodden (`trevor@sr1roofing.com`) | Mike Gibson (`mike@newviewroofing.com`) |
| **Company** | SR1 Roofing, LLC (Fort Worth, TX) | Mob Home Solutions, Inc. dba New View Roofing (Dallas, TX) |
| **ICP Status** | `ENGAGED PARTNER` (Watchlist pending 3rd staff verification) | `ENGAGED PARTNER` (Watchlist pending 3rd staff verification) |
| **Assigned Lead ID** | `ASN-001` (`TAD-PARCEL-07532598`) | `ASN-002` (`DCAD-PARCEL-004643000A0010000`) |
| **Property Name & Address** | Mercantile Center Bldg 30, **3001 Meacham Blvd**, Fort Worth, TX **76102** | **1133 S Madison Ave**, Dallas, TX **75208** |
| **Property Specs** | **115,188 sq ft** structural improvement area, built 1998 (Situs ZIP 76102, Owner mailing 76137) | **96,636 sq ft** foundation footprint (**101,140 sq ft** gross improvement across 6 sections), built 1980 |
| **Owner of Record** | Mercantile Partners, L.P. (Fort Worth, TX) | Treco Investments, Ltd. (Dallas, TX) |
| **Pack Version Dispatched** | Pilot Pack v2.1 (Two-Lane Contact Path: Owner Principal vs Tenant) | Correction & Resolution Pack v2.1 (Two-Lane Path + UNVERIFIED Permit Gate) |
| **Exclusivity Window** | **Oct 20, 2026 – Oct 27, 2026 (23:59:59)** | **Oct 20, 2026 – Oct 27, 2026 (23:59:59)** |
| **Cooldown Period** | **Oct 28, 2026 – Nov 3, 2026** (Parcels protected) | **Oct 28, 2026 – Nov 3, 2026** (Parcels protected) |
| **Held in Reserve** | Lead 2 (`ASN-049`, 7151 Jack Newell Blvd S: **526,195 sq ft** industrial distribution complex, built 2006, Tier 2 storm-adjacent) | Lead 2 withheld pending Dallas permit data unmasking |

---

## 3. Date-by-Date Operational Schedule

```
[OCT 20]  DISPATCH DAY (Done)
          - Pack A (Meacham) & Pack B (Madison) delivered.
          - Registry updated to ACTIVE_EXCLUSIVE.
          - Screener v2.3 frozen. All Track B outbound frozen.
             │
[OCT 21-26] PASSIVE LISTENING & BACKGROUND WORK (Days 1–6)
          - Zero outbound to any contractor.
          - Monitor inbox 2x daily (9:00 AM & 4:00 PM).
          - Research Gate 2/3 direct-to-owner evidence for next wave:
            Frontier Roofing Systems, MRB Contractors, Stay Dry Roofing.
             │
[OCT 27]  EXCLUSIVITY EXPIRATION (Day 7)
          - If no reply received: Send single, low-friction Day 7 check-in note.
          - Exclusivity window closes at 23:59:59.
             │
[OCT 28]  WAVE 1 DISPATCH (Net-New Discovery — 4 Accounts)
          - MRB Contractors, Frontier Roofing, Sta-Dry Roofing, ClimAply.
          - Trevor & Mike properties enter 7-day cooldown (parcels protected in registry).
             │
[OCT 30]  WAVE 2 DISPATCH (Reactivation — 5 Accounts)
          - Castro, TRM, Supreme (with replacement property), Joe Hall, Zenith.
          - October 12/13 cooldown has cleanly expired.
             │
[NOV 3]   TREVOR & MIKE PARCEL COOLDOWN ENDS (Day 14)
          - 7-day parcel cooldown cleanly concludes.
          - If unengaged, ASN-001 and ASN-002 released back to unassigned inventory.
```

---

## 4. Response Protocols & Branching Playbook

### Scenario 1: Trevor or Mike Replies Positively ("Looks interesting", "Send me the portal", "How do we get started?")

**Execution SLA: Under 2 Hours**

1. **Acknowledge & Welcome:**
   - Thank them for testing Depoii.
   - Reiterate that they have 100% exclusivity on their assigned property.
2. **Issue Portal Access (Secure Onboarding):**
   - **Security Mandate:** Never email temporary passwords in plaintext.
   - Send a personalized **One-Time Magic Invite Link** generated by the Supabase/Next.js auth system.
   - Deliver the One-Page Pilot Charter before seat activation.
3. **Unlock Queued Lead (for Trevor):**
   - Unlock Lead 2 (`ASN-049`, 7151 Jack Newell Blvd S, **526,195 sq ft** industrial distribution facility, built 2006, Tier 2 storm-adjacent).
   - Flip `ASN-049` in `lead_assignment_registry.json` from `RESERVED_PENDING_DISPATCH` to `ACTIVE_EXCLUSIVE`.
4. **Offer a 15-Minute Calibration Call:**
   - Focus: *"We want to tune the data engine to your exact workflow."*
   - Three specific diagnostic questions to ask:
     1. *Building Profile:* What minimum sq ft or building class does your commercial team pursue (e.g. >50k sq ft industrial, multi-tenant flex, retail)?
     2. *Roof Systems:* Which low-slope systems do you prioritize (TPO, PVC, EPDM, Built-Up, Modified Bitumen, Metal)?
     3. *Territory:* Which specific DFW corridors or counties do your estimators cover daily?
5. **Gate 4 Contracting Resolution (Internal Only):**
   - For Trevor (SR1): Verify official operating legal entity via SR1's Carlisle SynTec applicator certificate or standard W-9 during agreement setup. (Do not raise as a trust issue).

---

### Scenario 2: Partner Questions or Disputes Data ("Owner doesn't match", "We don't do this roof type", "Permit seems wrong")

**Execution SLA: Under 4 Hours**

1. **Acknowledge and Validate with Sourced Evidence:**
   - Respond with humility and absolute transparency.
   - For Mike on Madison Ave: Reiterate the two-lane contact architecture (Owner Principal: Treco Investments Ltd vs Tenant/Facility Executive: Tré Black at On-Target Supplies). Show the exact DCAD section breakdown.
   - For Trevor on Meacham Blvd: Reiterate that 3001 Meacham shares ownership with 4770 Mercantile (Mercantile Partners LP), but 3001 Meacham is exclusively assigned to SR1.
2. **Immediate Replacement Policy:**
   - If a partner notes that a property does not match their commercial division's target profile, offer an immediate replacement parcel tailored to their specific parameters within 24 hours.

---

### Scenario 3: Complete Silence through October 27 (Day 7)

**Execution SLA: October 27, 2026 at 11:00 AM CDT**

If neither Trevor nor Mike has replied by Day 7, send a single, non-pushy, high-respect follow-up email.

#### Draft for Trevor Rodden (SR1 Roofing):
> **Subject:** Re: 3001 Meacham Blvd (Mercantile Center Bldg 30) — 7-day hold ending today
>
> Trevor,
>
> Quick check-in before the 7-day exclusive hold on **3001 Meacham Blvd** expires tonight.
>
> If your commercial team had a chance to glance at the two-lane contact breakdown and the Tarrant County appraisal sections, I’d love to know if this matches how you evaluate reroof opportunities.
>
> If you're slammed or this isn't a fit right now, no problem at all — I'll release the property hold tonight so another roofer can look at it, and I won't clutter your inbox.
>
> Thanks for your time,  
> Alimirsa

#### Draft for Mike Gibson (New View Roofing):
> **Subject:** Re: 2601 Madison Ave (Owner vs. Tenant contact path) — hold expiring today
>
> Mike,
>
> Reaching out before the 7-day hold on **2601 Madison Ave** closes tonight.
>
> The owner-resolution note (separating Treco Investments Ltd from On-Target Supplies) was built specifically to address the roadblock you ran into reaching the building owner. 
>
> If this was helpful for your estimators, I can share two additional Dallas industrial parcels. If not, I'll release the Madison Ave hold tonight and leave you to your week.
>
> Best,  
> Alimirsa

---

## 5. Transition to Next Target Wave (November 4, 2026)

If both design partners remain unengaged after the 7-day exclusivity (Oct 20–27) plus the 7-day cooldown (Oct 28–Nov 3), the company seamlessly moves to the next vetted tier on **Wednesday, November 4, 2026**.

### Top 3 Target Candidates for Wave 2:

1. **Frontier Roofing Systems LLC**
   - **Location:** Fort Worth, TX | Phone: (817) 713-6687
   - **Principal:** Ronald Joseph Gaston (Owner/Operator)
   - **Qualification:** 2 in-window commercial reroofs ($376K). Dedicated commercial roofer.
   - **Target Property:** Vetted Fort Worth commercial reroof parcel.
2. **MRB Contractors LLC**
   - **Location:** Irving, TX | Phone: (972) 827-8599
   - **Principal:** Michael R. Brown (Managing Member)
   - **Qualification:** RCAT Commercial License #03-0215. 2 in-window Fort Worth reroofs ($2.62M city valuation).
   - **Target Property:** Dedicated Dallas/Tarrant warehouse package.
3. **Stay Dry Roofing LLC**
   - **Location:** Duncanville / DFW, TX | Phone: (972) 572-7663
   - **Principal:** Larry Brown (Owner & RCAT Qualifier)
   - **Qualification:** RCAT licensed roofer. 1 in-window commercial reroof ($623K).
   - **Target Property:** South Dallas / I-20 commercial corridor parcel.

---

## 6. Rules of Engagement & Guardrails

1. **Zero Cold Outbound:** No outreach to any contractor on the Discovery Queue or Curated Watchlist until the Trevor/Mike listening window concludes.
2. **Zero Plaintext Credentials:** All pilot portal access must use one-time magic invite links.
3. **Zero Renegotiated Thresholds:** Screener v2.3 remains frozen. Shortlist stays 9 qualified + 13 watchlist.
4. **Registry as Sole Source of Truth:** Any status change for `ASN-001`, `ASN-002`, or `ASN-049` must be written to `lead_assignment_registry.json` with an append-only event ID.
