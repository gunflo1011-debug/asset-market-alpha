# Things Concierge Alpha — Operational Test Kit

**Date:** 2026-08-24
**Owner:** Worker 4 handoff to CEO/operator
**Status:** READY, but participant work is blocked until the hosted non-privileged Supabase security gate is green and the CEO explicitly authorizes test start.
**Scope:** One local area, five professional buyers, 25 device owners, 30 calendar days, manual matching, no payment.

## 1. Purpose and non-negotiable boundaries

This alpha tests one narrow hypothesis: independent smartphone dealers and repair shops will submit specific local purchase needs, and private households with not-yet-listed devices can satisfy enough of them to create measurable liquidity.

This kit prepares the operation only. It does not authorize recruitment, messaging, publishing, advertising, product changes, payments, purchases, or PR merge.

Hard boundaries:

- One city or one radius of no more than 15 km.
- Exactly five buyer seats and at most 25 owner participants.
- Smartphone category only.
- Owners participate free; no fees are collected from either side.
- No platform custody, escrow, shipping, cash handling, price negotiation, warranty promise, or identity guarantee.
- No bulk outreach, scraped contacts, deceptive scarcity, or unsolicited automation.
- No participant data enters the portfolio repository.
- PR #3 remains unmerged until its hosted non-privileged authentication/RLS gate passes.

## 2. Start gate

The operator may begin participant contact only when all boxes are checked:

- [ ] Hosted test account exists and the authenticated login/RPC/catalog/owner-isolation workflow is green.
- [ ] CEO explicitly authorizes this 30-day alpha and selects the local area.
- [ ] One accountable operator is named.
- [ ] The operator has a private, access-controlled participant register separate from GitHub.
- [ ] The participant notice states purpose, data fields, retention period, withdrawal route, and that Things is only testing introductions.
- [ ] The local handover safety script and incident stop procedure are ready.

If any item is missing, status remains **HOLD**.

## 3. Participant qualification

### Professional buyer

Accept only a buyer who:

- operates a real local repair, resale, or refurbishment business;
- personally controls or influences device purchasing;
- expects to buy at least two used smartphones per month;
- can specify model, storage, condition, maximum price, and purchase window;
- accepts local inspection and bilateral settlement;
- agrees that an expressed need is not a binding purchase commitment;
- can provide a non-public business identity check to the operator.

Reject general consumers, remote-only buyers, vague “anything cheap” requests, and buyers asking for credentials, deposits, account access, or off-platform data before mutual opt-in.

### Device owner

Accept only an adult who:

- states they lawfully own the device and it is not reported lost/stolen;
- can remove activation/account locks before handover;
- can describe model, storage, condition, and functional defects;
- accepts local inspection and bilateral settlement;
- can state a price floor without operator coaching;
- understands that intake is not a sale guarantee or valuation.

Reject devices under finance/lease uncertainty, activation-locked devices, suspected counterfeits, missing model identity, or any ownership red flag.

## 4. Intake scripts

### Buyer discovery interview — 15 minutes

1. How do you source used phones today?
2. Which three sourcing failures cost the most time or margin?
3. How many devices did you actually buy in the last 30 days?
4. Which exact models/storage grades are currently wanted?
5. What defects are acceptable or unacceptable?
6. What is the maximum all-in purchase price for each request?
7. How quickly must a matching device be available?
8. What evidence is needed before an inspection?
9. Would a private, not-yet-listed local supply source be meaningfully different from current channels?
10. If the alpha produced the same match quality next month, which price is acceptable: €29/month, €5/verified candidate match, neither, or another amount?

A **real buyer intent** must contain: buyer ID, timestamp, model family, acceptable storage, condition rules, hard maximum price, radius, deadline of 14 days or less, and confirmation that the buyer could inspect and pay if the criteria are met.

### Owner intake — 10 minutes

Record only:

- anonymous owner ID;
- device manufacturer/model;
- storage;
- color;
- approximate age;
- screen/body condition;
- known functional defects;
- battery-health reading if readily available;
- activation-lock removal capability;
- network-lock status if known;
- stated lawful ownership;
- price floor;
- local area, not a full address;
- availability window;
- permission to disclose the device profile to a matched buyer.

Do not store account credentials, full government ID, payment data, device contents, or full IMEI/serial number in the shared scorecard. A buyer may inspect identifiers locally at handover.

## 5. Matching contract

A **candidate match** exists only if all conditions pass:

1. Requested model family matches.
2. Storage is acceptable.
3. Declared condition does not violate the buyer's hard exclusions.
4. Owner floor is less than or equal to buyer maximum.
5. Both are inside the selected area.
6. Buyer deadline and owner availability overlap.
7. Owner has confirmed lock removal and lawful ownership.
8. Both parties separately opt in before contact details are exchanged.

One device may be proposed to only one buyer at a time for 24 hours. If declined or expired, it may be offered to the next eligible buyer. The operator records the rejection reason without changing either side's price.

A **verified candidate match** requires a buyer response of “inspect,” “decline,” or “need one specified fact” within 24 hours. Silence is not verified demand.

A **price-confirmed handover** requires both parties to reconfirm the same price range before meeting. A **completed handover** requires bilateral confirmation afterward; the operator does not handle funds.

## 6. Handover and safety checklist

Before exchanging contact details:

- [ ] Both parties opted in to the specific match.
- [ ] Expected price and inspection rights are restated.
- [ ] Meeting is at the buyer's business or another public daytime location.
- [ ] Neither party is asked for a deposit or remote payment.
- [ ] Owner is reminded to back up data and sign out, but not factory-reset until they are comfortable proceeding.
- [ ] Buyer is reminded to inspect activation lock, device identity, condition, and functions locally.
- [ ] Either party may stop without penalty.
- [ ] Any threat, coercion, credential request, suspected stolen device, or safety concern ends the match and pauses the alpha for review.

Afterward record only: met/not met, traded/not traded, final price band, primary rejection reason, operator minutes, and any safety/support incident.

## 7. Evidence ledger

Use one row per object; replace personal details with internal IDs.

### Buyer ledger

| buyer_id | qualified | business_type | monthly_units | intents_submitted | candidates_seen | inspections | completed_handovers | accepts_29_month | accepts_5_match | operator_minutes | notes_code |
|---|---:|---|---:|---:|---:|---:|---:|---|---|---:|---|
| | | | | | | | | | | | |

### Intent ledger

| intent_id | buyer_id | opened_at | model_family | storage_rule | condition_rule | max_price_eur | radius_km | expires_at | candidate_count | outcome_code |
|---|---|---|---|---|---|---:|---:|---|---:|---|
| | | | | | | | | | | |

### Device ledger

| device_id | owner_id | submitted_at | model_family | storage | condition_code | defect_code | owner_floor_eur | eligible | rejection_code | candidates | outcome_code |
|---|---|---|---|---|---|---|---:|---|---|---:|---|
| | | | | | | | | | | | |

### Match ledger

| match_id | intent_id | device_id | proposed_at | both_opted_in | buyer_response | price_confirmed | met | traded | price_band | operator_minutes | incident_code |
|---|---|---|---|---|---|---|---|---|---|---:|---|
| | | | | | | | | | | | |

Allowed outcome codes should be fixed before starting: OPEN, EXPIRED, NO_PRICE_OVERLAP, MODEL_MISMATCH, CONDITION_MISMATCH, OWNER_WITHDREW, BUYER_DECLINED, INSPECTION_FAILED, TRADED, SAFETY_STOP.

## 8. Daily and weekly operation

### Daily — maximum 30 operator minutes before real matches

1. Validate new intents and devices.
2. Run the matching contract without subjective repricing.
3. Ask each side for specific-match opt-in.
4. Record response and operator time.
5. Stop immediately on a safety or ownership red flag.

### Weekly review

Report counts, never participant names:

- qualified buyers / target 5;
- owners started / completed / eligible / target 25;
- real buyer intents / target 3;
- eligible devices / target 10;
- candidate matches / target 3;
- inspections;
- price-confirmed handovers / target 1;
- completed handovers;
- buyers accepting €29/month;
- buyers accepting €5/verified match;
- median and total operator minutes per candidate;
- incidents and top three rejection codes.

Do not change the product or pricing during the 30-day window. Any methodology change must be logged and the affected metric cohort separated.

## 9. Decision contract

### Demand GO

All must be true by day 30:

- five qualified professional buyers completed intake;
- at least three real buyer intents;
- at least ten eligible devices;
- at least three candidate matches;
- at least one price-confirmed local handover;
- at least two buyers accept either €29/month or €5/verified match;
- no unresolved safety, ownership, privacy, or security incident.

### Economic correction to the earlier pre-mortem

The earlier 30-minute threshold is an **operational ceiling**, not a profitable unit-economics threshold.

At an internal labor value of €10/hour:

- 30 minutes costs €5 and consumes the entire €5 match fee before hosting, support, tax, or disputes.
- For revenue to be at least three times direct operator labor, a €5 match requires **10 minutes or less** of operator work.
- A €29 monthly seat permits at most **58 minutes of direct monthly operator work per buyer** under the same 3× revenue-to-labor rule.

Therefore:

- **€5/match pricing GO:** median operator time per verified candidate match is at most 10 minutes.
- **€5/match HOLD:** 11–20 minutes; automation or a higher fee must be tested before charging.
- **€5/match KILL:** above 20 minutes or any recurring manual negotiation/support.
- **€29/month pricing GO:** accepted by at least two of five buyers and direct monthly operator work is at most 58 minutes per buyer.
- “Would pay” is directional evidence only; no revenue claim is made until an actual authorized paid test.

### Overall verdict

- **GO TO PAID DESIGN:** all Demand GO conditions pass and at least one pricing route passes its economic GO rule.
- **HOLD / ITERATE ONCE:** demand passes but economics misses narrowly, or one measurable funnel step blocks otherwise strong demand.
- **KILL:** fewer than three real intents, fewer than ten eligible devices, zero candidate matches by day 21, zero price-confirmed handovers by day 30, fewer than two price acceptances, any unresolved serious incident, or no pricing route can support the labor required.

No extension beyond 30 days without a new CEO decision.

## 10. End-of-test handoff template

- Area and dates:
- Participants recruited / qualified:
- Real buyer intents:
- Owners started / completed / eligible:
- Candidate matches:
- Inspections:
- Price-confirmed handovers:
- Completed handovers:
- €29/month acceptances:
- €5/match acceptances:
- Median / total operator minutes:
- Direct labor estimate:
- Incident count and resolution:
- Top rejection reasons:
- Evidence limitations:
- Verdict: GO TO PAID DESIGN / HOLD / KILL
- Next reversible action:
- User authorization required:

## 11. Current handoff

The kit is operationally ready. Do not contact participants. The next action is to obtain green hosted non-privileged auth/RLS evidence for PR #3, then request CEO authorization and a single test area. No app build, merge, payment setup, or outreach is justified before those gates.
