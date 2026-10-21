# Depoii Pilot Inbound Reply Playbook (DFW Launch Wave 1)
> **Author:** Depoii Go-To-Market & Executive Operations  
> **Effective Date:** October 20, 2026  
> **Target Cohort:** Mike Gibson (New View Roofing) & Trevor Rodden (SR1 Roofing)

---

## 1. Playbook Philosophy

The pilot outreach sent on October 20 is not a marketing broadcast—it is a founder-to-founder technical alignment. The value of this dispatch is the conversation, not the open rate. Every response, objection, or question is direct calibration data for our verification engine and Gate 5 qualification standards.

---

## 2. Response Scenarios & Action Protocols

### Scenario A: Positive Reply ("YES" + Territory Stated)
> **Goal:** Complete frictionless onboarding within 24 hours, provision access, secure a 15-minute orientation, and identify the lead commercial estimator for seat #2.

* **Response SLA:** Under 2 hours during business hours; maximum 24 hours.
* **Execution Steps:**
  1. **Direct Provisioning (Invite Link):** Founder generates a one-time invite / magic link (`https://depoii.com/invite/[token]`) via Supabase / Depoii auth for the recipient's work email. Never transmit plaintext passwords over email.
  2. **Provision Estimator Seat:** Commercial roofing owners rarely pull property records daily—their lead estimators and BD managers do. Provision a second seat invite link immediately.
  3. **Expectation Grounding:** Explicitly frame the pilot inventory: *"Pilot members receive each verified batch as it is released, and shape what gets verified next. We prioritize 100% county-backed property dossiers over high-volume automated lead feeds."*
  4. **Call Booking:** Propose two concrete times for a 15-minute screen share.

#### Draft Response Template (Scenario A)
```text
Subject: Re: [Original Subject]

[Mike / Trevor],

Your workspace invite is active:
• Access link: https://depoii.com/invite/[token]
(Clicking sets your password and directly opens your reserved territory workspace—no temporary credentials in email.)

I also generated a second seat invite for your lead commercial estimator so they can pull raw county appraisal records and municipal permit histories directly. What is their name and work email?

Do you have 15 minutes tomorrow at [Time 1, e.g., 10:30 AM] or [Time 2, e.g., 2:00 PM] for a quick screen share? I'll show you how we pull the raw appraisal rolls and filter out recently reroofed buildings in [Dallas / Fort Worth] before anyone drives out.

Ali Mirza
hello@depoii.com | (Direct) [Phone]
```

---

### Scenario B: Questions or Objections (Data Queries, Entity Gaps, Pilot Terms)
> **Goal:** Founder answers personally, grounds every response in verifiable public sources, and logs the feedback verbatim into our calibration engine.

* **Response SLA:** Same business day (under 4 hours).
* **Protocol:**
  * Zero defensiveness. Validate the objection immediately.
  * Cite the exact public source (TAD roll, DCAD AcctDetail, CFW permit portal, NOAA SPC row).
  * Record objection verbatim in `d:/Depoii_nextjs/Roofx/depoii-data-engine/calibration_log.json`.

#### Example Responses:
* **If they ask about cost:**  
  *"The pilot is free while we run this initial evaluation batch and dial in the verification standard directly with DFW contractors. If you decide to keep using it after the pilot, commercial plans align with our standard Executive tier ($1,199/mo) for your exclusive territory. If the verified parcel data doesn't deliver clear pipeline value for your estimators, there is zero commitment to continue."*
* **If they ask about exclusivity:**  
  *"Every lead assigned to you is locked in our project registry. No competitor receives that building while it is in your queue, and we maintain a mandatory 7-day cooldown after expiration before any re-evaluation."*

---

### Scenario C: Silence at 72 Hours (Oct 23–24, 2026)
> **Goal:** One single, high-signal, non-salesy bump referencing the specific asset. No generic "checking in."

* **Timing:** Send between 8:30 AM – 10:00 AM CDT on Friday, October 23, 2026.
* **Rule:** **Exactly ONE bump.** If no reply, do not send a second bump. The lead moves to `CONTACTED_NO_REPLY` at exclusivity expiration (Oct 27), and we proceed with Track B.

#### Bump Draft: Mike Gibson (New View Roofing)
```text
Subject: Re: 1133 S Madison: Owner resolution + corrected DCAD footprint (Pack B)

Mike,

Checking in quickly—did your commercial estimators have a chance to look at the On-Target vs. Treco contact map for Madison Ave? 

If you want to test the Dallas workspace this month, reply YES and I’ll send over your direct invite link. If the timing isn’t right, no problem at all.

Ali
```

#### Bump Draft: Trevor Rodden (SR1 Roofing)
```text
Subject: Re: 3001 Meacham: Verification correction note

Trevor,

Wanted to make sure you saw the corrected Haltom City hail figures (1.00″ at 1.06 mi) and updated parcel records for Meacham Blvd. 

If you want to review the live Fort Worth parcel file with your estimators, reply YES and I'll generate a direct invite link. If the timing isn’t right, no problem at all.

Ali
```

---

## 3. Governance & Transition Rules

1. **Exclusivity Expiration (October 27, 2026 at 23:59 CDT):**
   * If no reply is received by October 27, status shifts to `EXPIRED_COOLDOWN_ACTIVE`.
   * Cooldown period runs through November 3, 2026. Neither 3001 Meacham nor 1133 S Madison may be pitched to another contractor during cooldown.
2. **Post-Cooldown Transition (November 4, 2026):**
   * If unaccepted, registry marks status as `EXPIRED_COOL` / `CONTACTED_NO_REPLY`.
