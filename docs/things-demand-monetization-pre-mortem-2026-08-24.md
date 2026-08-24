# Things App demand and monetization pre-mortem

Date: 2026-08-24  
Owner: Worker 4  
Scope: read-only commercial assessment of the actual repository/product. No PR change, merge, hosted-security duplication, outreach, account, payment, or publication.

## Executive decision

**Verdict: REPOSITION_NARROWLY_AND_HOLD_BUILD.**

The technical hypothesis is differentiated, but the current evidence proves infrastructure rather than demand. The narrowest commercially testable product is not a general consumer marketplace. It is a **local, buyer-funded sourcing network for independent smartphone refurbishers and repair shops**, supplied by households that want to keep unused phones private until a credible matching offer exists.

Continue no engineering or growth spend until a concierge alpha proves both sides of the market and price acceptance. The current mobile screen supports authentication and private inventory entry; the repository describes buyer intents, matching, fresh condition checks, reservation and bilateral trade confirmation, but the end-to-end buyer experience is not yet demand-validated.

## Actual product hypothesis

### Supply-side user

A German household with one or more unused iPhones/Samsung devices that is unwilling to:

- create a public listing;
- handle many messages or bargaining;
- ship before trusting the counterparty;
- accept an instant-buyback price without knowing whether a local buyer values the device more.

### Paying-side user

One independent smartphone refurbisher, used-device dealer, or repair shop within a single local radius that repeatedly needs specific models and conditions but cannot efficiently discover devices still sitting in private drawers.

### Job to be done

> When I need a specific used smartphone, show me privately registered local devices matching my model/condition demand and let the owner opt in to a fresh check and local handover, so I can source inventory before it appears on public marketplaces.

This is a B2B supply-acquisition job. Owners must remain free; charging the supply side would directly reduce the scarce inventory needed for liquidity.

## Current evidence

### Category demand exists

- Bitkom reported on 15 April 2026 that German households still hold about **167 million unused phones**, and **86%** of people keep at least one unused device.
- Bitkom's March 2025 representative survey found **30%** had bought a used smartphone from a private source and **18%** had bought a professionally refurbished smartphone.
- These facts prove latent supply and an established second-hand category. They do **not** prove that owners will pre-register devices, activate on an anonymous intent, or accept a local offer through this product.
- No alpha users, buyer intents, matches, verified trades, willingness-to-pay, acquisition cost, revenue, cost, or net profit are currently evidenced.

Sources:

- Bitkom unused phones, 2026-04-15: https://www.bitkom.org/Presse/Presseinformation/Deutsche-horten-167-Millionen-Alt-Handys
- Bitkom second-hand smartphone demand, 2025-03-17: https://www.bitkom.org/Presse/Presseinformation/Refurbished-gebraucht-Smartphones-nicht-immer-Neuware

## Current alternatives

| Alternative | User value today | Strength versus Things | Gap Things could exploit |
|---|---|---|---|
| rebuy instant purchase | Immediate model/condition quote, free shipping and rapid payout | Mature trust, simple transaction, nationwide liquidity | Seller accepts a fixed intermediary price and must initiate a sale |
| Back Market trade-in | Offer in under two minutes, free shipping and payout stated within six business days | Brand, device checking, buyer network, logistics | Transaction begins with an owner already willing to sell |
| Kleinanzeigen | Huge general audience, public listing, local cash handover or protected payment | Existing liquidity and messaging/trust tooling | Public listing, negotiation/message workload and exposure are required |

Official/current alternative evidence:

- rebuy sales flow: https://www.rebuy.de/verkaufen/handy/samsung/galaxy-s21-serie
- Back Market app and trade-in flow: https://www.backmarket.de/de-de/e/mobile-app
- Kleinanzeigen safe local/payment flow: https://hilfe.kleinanzeigen.de/hc/de/articles/17143872772252-Wie-handle-ich-sicher

The product cannot win on generic resale convenience today. Its only defensible wedge is **private-before-listed inventory activated by explicit local demand**.

## Monetization boundary

### Free

- owner account and private inventory;
- condition snapshot;
- offer permission/decline;
- consumer-side participation during alpha;
- all privacy and deletion controls.

### Potentially paid after validation

Charge the professional buyer for incremental supply access, never the household merely holding inventory.

Candidate price tests:

| Model | Price sensitivity | Required proof |
|---|---:|---|
| Verified-match fee | EUR 5 per mutually accepted match | At least one completed bilateral price-confirmed trade; fraud/dispute rate manageable |
| Starter subscription | EUR 29/month per professional buyer | At least one incremental profitable acquisition per month worth more than EUR 29 |
| Local Pro | EUR 79/month | Repeated demand and enough qualified inventory for roughly 2–4 profitable acquisitions monthly |
| High-volume/API | EUR 149+/month | Multiple locations, recurring volume, response-time value and explicit integration demand |

These are test prices, not validated market prices.

Sensitivity:

- 5 buyers at EUR 29/month = EUR 145 MRR.
- 20 buyers at EUR 29/month = EUR 580 MRR.
- 100 buyers at EUR 29/month = EUR 2,900 MRR.
- At EUR 5 per verified match, 100 monthly matches yield only EUR 500 before hosting, support, disputes, tax and payment fees.

The business only becomes attractive if local density and repeat buyer usage are high. A broad consumer launch would add acquisition and trust cost before proving that loop.

## Acquisition hypothesis

### Paying buyers

Start with a single city/region and no paid ads:

- five independent repair/refurbishment shops;
- one clearly stated model/condition demand per shop;
- direct founder-led recruitment only for the bounded alpha;
- no chain stores, national rollout, scraped contacts, or bulk outreach.

### Device owners

Recruit only within the same local network:

- existing personal/community network;
- one employer, club, university, or neighborhood reuse campaign if permission exists;
- referral from accepted participants;
- no paid traffic before a first match.

This is deliberately manual. Marketplace automation before local liquidity would automate an empty market.

## Trust, liquidity and operational pre-mortem

1. **Two-sided cold start:** buyers leave without inventory; owners see no offers and never complete condition data.
2. **Adverse selection:** only damaged, locked, stolen, or uneconomic devices may activate.
3. **Pricing conflict:** anonymous buyer targets can anchor sellers below expectations; rejected offers destroy repeat usage.
4. **Condition drift:** a stale private snapshot is not enough; the repository correctly requires a fresh match-bound check.
5. **Identity and title risk:** IMEI/activation-lock/ownership checks and stolen-device handling need an operational policy before scale.
6. **Local density:** local handover reduces shipping risk but makes liquidity highly geographic.
7. **Disputes and safety:** no integrated payment/shipping means fewer regulated payment operations, but handover safety, no-shows and bilateral price disputes remain.
8. **Professional-buyer trust:** owners may view dealers as lowballing intermediaries unless expected price, privacy and decline rights are explicit.
9. **Regulatory/operations:** a commercial marketplace or lead service needs operator, privacy, tax, consumer/trader-role and platform-law review before public monetization.
10. **Support economics:** manual verification or dispute handling can erase EUR 5 match fees.

## Smallest reversible alpha-demand test

No new buyer UI or payment is required for the first test.

### Setup

- One local radius.
- Five independent professional buyers.
- Twenty-five invited device owners.
- Maximum 30 days.
- Owners use the existing private-inventory flow only after the hosted security gate is green.
- Buyer demands, candidate matches and price acceptance are handled manually by the alpha operator.
- Present two non-binding future prices to buyers: EUR 29/month or EUR 5 per mutually accepted match.
- Take no payment and promise no production feature.

### Funnel evidence

Record:

- professional buyers acknowledging recurring sourcing pain;
- buyers providing a specific model/storage/condition/maximum-buy-price intent;
- owners who start and finish private device entry;
- eligible devices after condition/lock checks;
- candidate matches;
- owner activations;
- bilateral price confirmations;
- completed local handovers;
- buyer price preference/acceptance;
- support minutes and exceptions per match.

### Decision thresholds

**GO to one paid pilot only if all are true:**

- at least 3 of 5 buyers submit a real, specific demand;
- at least 10 of 25 owners register an eligible device;
- at least 3 candidate matches occur;
- at least 1 local handover is bilaterally price-confirmed;
- at least 2 buyers accept either EUR 29/month or EUR 5/verified-match as a credible future price;
- manual operations remain under 30 minutes per candidate match, excluding the physical handover.

**HOLD / reposition if:**

- buyers report recurring pain and accept price, but inventory density produces fewer than 3 matches;
- owners register devices but buyers will not state real maximum prices;
- a different category or radius is requested consistently, with no safety incident.

**KILL if any is true:**

- fewer than 2 of 5 buyers report recurring sourcing pain;
- fewer than 5 of 25 owners complete device entry;
- zero candidate match in 30 days;
- zero buyer accepts either price indication;
- ownership/lock/fraud or handover risk cannot be handled safely;
- expected recurring revenue cannot cover measured support at a 3× gross-contribution buffer.

## Build boundary after the test

Do not add payment, shipping, public browsing, national rollout, price algorithms, dealer dashboard, API, or automated outreach before GO.

If GO:

1. Complete the hosted non-privileged security gate.
2. Run one paid, manually invoiced professional-buyer pilot only after operator/legal/tax approval.
3. Instrument demand-to-match-to-trade conversion.
4. Automate the single highest-cost manual step only after three completed paid buyer cycles.

If HOLD/KILL, archive the alpha without further product engineering.

## Expected economic contribution

This pre-mortem separates a large but generic “unused phones” market from the unproven behavior the app actually requires. It narrows the revenue thesis to one payer, one geography, two price points and a 30-day test. It prevents funding a broad two-sided marketplace before proving local liquidity and willingness to pay. Revenue and net profit remain **UNKNOWN**.
