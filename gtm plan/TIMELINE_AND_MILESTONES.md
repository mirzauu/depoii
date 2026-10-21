# Depoii GTM: Date-by-Date Operational Timeline & Milestones
> **Scope:** Parallel Outreach Architecture (Waves 1 & 2) & Pilot Partner Monitoring (Trevor & Mike)  
> **Active Period:** October 20, 2026 – November 3, 2026  
> **Source Directory:** `d:\Depoii_nextjs\gtm plan`  

---

## 📅 Timeline at a Glance

| Date | Phase | Primary Action | Registry & Lead Status | Outbound Status |
| :--- | :--- | :--- | :--- | :--- |
| **Mon, Oct 20** | **Dispatch Day (Done)** | Delivered Pack A to Trevor & Pack B to Mike | `ASN-001` & `ASN-002`: `ACTIVE_EXCLUSIVE` | 100% Frozen (Zero other cold sends) |
| **Tue, Oct 21 – Mon, Oct 27** | **Active Listening & Wave Prep** | Monitor inbox 2x daily; build Account Cards & verify properties for Waves 1 & 2 | Trevor/Mike hold active through Oct 27 | 100% Frozen |
| **Mon, Oct 27** | **Exclusivity Expiration** | Send single check-in note at 11:00 AM if silent | Holds expire at 23:59:59 | 100% Frozen |
| **Tue, Oct 28** | **Wave 1 Dispatch (Net-New)** | Dispatch Wave 1 to 4 net-new specialists (MRB, Frontier, Sta-Dry, ClimAply) | Trevor/Mike properties enter `COOLING_OFF`; Wave 1 leads `ACTIVE_EXCLUSIVE` | **Wave 1 Sends Only** (Hand-verified packs only) |
| **Thu, Oct 30** | **Wave 2 Dispatch (Reactivation)** | Dispatch Wave 2 to 5 reactivations (Castro, TRM, Supreme, Joe Hall, Zenith) | Oct 12/13 cooldown expired; Wave 2 leads `ACTIVE_EXCLUSIVE` | **Wave 2 Sends Only** (Reactivation angle with corrections) |
| **Mon, Nov 3** | **Trevor & Mike Cooldown Closes** | 7-day parcel cooldown cleanly concludes at 23:59:59 | If unengaged: `ASN-001`, `ASN-002` marked `RELEASED_UNASSIGNED` | Cooldown concludes |

---

## 🔍 Detailed Date-by-Date Breakdown

### Phase 1: Active Listening Window & Pre-Send Pack Verification (Oct 20 – Oct 27)

#### Monday, October 20, 2026 (Completed)
- ✅ Pack A (3001 Meacham Blvd) dispatched to Trevor Rodden (`trevor@sr1roofing.com`).
- ✅ Pack B (1133 S Madison Ave) dispatched to Mike Gibson (`mike@newviewroofing.com`).
- ✅ Registry updated: `ASN-001` and `ASN-002` set to `ACTIVE_EXCLUSIVE` (expiration Oct 27, cooldown Nov 3).
- ✅ Track B Screener v2.3 frozen; Curated Watchlist (13 accounts) and Discovery Queue (73 accounts) locked.

#### Tuesday, October 21 – Sunday, October 26, 2026 (In Progress)
- **Daily In-Flight Monitoring:**
  - 9:00 AM CDT: Inbox scan for Trevor / Mike replies.
  - 4:00 PM CDT: Inbox scan for Trevor / Mike replies.
- **Strict Outbound Silence:** No outreach to any roofer until scheduled wave send dates.
- **Internal Preparation (Zero Outreach):**
  - Compile Account Cards for all 9 accounts (Wave 1 + Wave 2) in `Roofx/depoii-data-engine/account_cards/`.
  - Re-verify 5 properties for Wave 2 (source replacement property for Supreme Roofing).
  - Verify 4 virgin territory-matched properties for Wave 1.
  - Log all 9 new property reservations in `lead_assignment_registry.json` as `RESERVED_PENDING_DISPATCH`.

#### Monday, October 27, 2026 (Exclusivity Expiration Day)
- **11:00 AM CDT:** If no response from Trevor or Mike:
  - Send the polite, low-pressure Day 7 check-in note (drafts in `DESIGN_PARTNER_PILOT_PLAN.md`).
- **11:59 PM CDT:** Trevor and Mike's 7-day exclusive holds formally expire.

---

### Phase 2: Parallel Wave Dispatches & Cooldown Governance (Oct 28 – Nov 3)

#### Tuesday, October 28, 2026 (Wave 1 Dispatch — Net-New Discovery)
- **Trevor & Mike Lead Transition:**
  - `ASN-001` (3001 Meacham) and `ASN-002` (1133 S Madison) transition to `COOLING_OFF` in registry.
  - Parcels remain strictly protected; zero reassignment during cooldown.
- **Wave 1 Dispatch (4 Accounts):**
  - **MRB Contractors LLC** (Michael R. Brown | Joel East Rd reroof program anchor)
  - **Frontier Roofing Systems LLC** (Ronald Gaston | Fort Worth commercial reroof anchor)
  - **Stay Dry Roofing LLC** (Larry Brown | South Dallas / Duncanville anchor)
  - **ClimAply Commercial Roofing LLC** (Marc VanDusen | Irving / Mid-Cities anchor)
  - *Throttle Rule: Only send packs that have 100% passed `PRE_SEND_CHECKLIST.md`.*

#### Thursday, October 30, 2026 (Wave 2 Dispatch — Reactivation / Correction)
- **October 12/13 Cooldown Expired:** 17 days of clean space since initial blasts.
- **Wave 2 Dispatch (5 Accounts):**
  - **Supreme Roofing** (Tim Rainey | Correction play: 4001 Mark IV reroofed 2022; pitched replacement property)
  - **Castro Roofing** (Rudy Castro | 6400 Plaza Pkwy re-verified Pack B standard)
  - **Texas Roof Management Inc.** (Catherine Awtrey | 401 NE 38th St re-verified)
  - **Joe Hall Roofing** (Tina Hall / Brett Hall | 6000 E Berry St re-verified)
  - **Zenith Roofing Services** (Steve Zbeida / Michael Davis | 3600 McCart Ave re-verified; phone-first if email unverified)

#### Monday, November 3, 2026 (Trevor & Mike Cooldown Concludes)
- 11:59 PM CDT: 7-day cooldown on 3001 Meacham and 1133 S Madison cleanly concludes.
- If no engagement has occurred, both properties return to unassigned inventory.

---

## ⚡ Reaction Matrix (If Anyone Replies)

The moment any contractor replies `YES`:
1. **SLA < 2 Hours:** Respond acknowledging their specific response.
2. **Issue Pilot Charter:** Send the one-page Pilot Charter (30 days free, deliverables, weekly feedback call, post-pilot terms) *before* workspace onboarding.
3. **Issue Portal Access:** Send secure one-time magic invite link (no plaintext credentials).
4. **Schedule Onboarding Call:** 15-minute calibration on building classes, roof types, and geographic radius.
