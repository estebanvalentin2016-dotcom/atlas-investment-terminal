# ATLAS — Moonshot Infrastructure Radar (planned)
Status: **Roadmap / not implemented**.
Purpose: search for publicly listed, potentially overlooked suppliers of essential technology infrastructure that may benefit from broad technology growth regardless of which AI model vendor wins. Never claim immunity to AI disruption, guaranteed 10x/100x returns, or a reliable quantitative forecast of extreme winners.

## Intended discovery universe
- Start with **$100 million–$2 billion verified market capitalizations** as a configurable research range; expand by evidence and not an arbitrary small-cap cutoff.
- Prefer current SEC disclosure, auditable annual/quarterly reporting, traceable public listing and trading venue, and current verified shares outstanding.
- Focus on bottlenecks: **power/electrical infrastructure** (transformers, switchgear, grid connectivity), **data center thermal management**, **semiconductor tools/materials**, **optical networking/photonics**, and **industrial precision manufacturing/automation**.
- Example *research seeds only*, **not recommendations or currently validated eligible stocks**:
  - Power: POWL, GEV
  - Cooling: MOD, VRT
  - Semiconductor supply chain: ACLS, ONTO, ENTG
  - Photonics/connectivity: AAOI, COHR
  - Manufacturing: FN, XMTR
- The actual market caps, valuations, float, exchange eligibility, liquidity, and sector exposure of these names must be checked at the time of a live scan, not assumed.

## Two independent evaluations, never collapsed into an unsupported single prediction
### Technological durability — evidence-backed
- Exposure to the *growth of computing infrastructure* rather than a particular model or customer.
- Switching costs, certifications, lead times, intellectual property where defensible, specialized manufacturing skills, replacement/retrofit cycles.
- Customer and supplier concentration, commoditization, architectural displacement risks, countervailing substitutes, potential AI-enabled substitution.
- Source every key claim with SEC filings, issuer materials, credible technical publications or contract evidence.
- Show **unknown** when evidence is weak rather than inventing durability scores.

### Asymmetric upside — valuation/scenario analysis
- Verified current market cap and enterprise value where available; SEC revenue growth, FCF and margins; justified market-size assumptions with evidence rather than promotional TAM.
- Compare prices to plausible future *company outcomes* under explicitly stated assumptions (low/base/high + failure).
- Keep sector-aware valuation comparisons and current expectations separate from business-quality scoring.
- Require share-count/dilution assumptions; estimate potential *per-share returns*, not only future market cap:
  - Approximate gross shareholder multiple = future equity value / current equity value × current shares / future shares, holding other factors constant.
  - Flag when future financing, leverage, restructuring, buybacks, dividends or valuation changes make that shortcut incomplete.
- 5x, 10x and 100x scenarios may be modeled as **hypotheticals**, not forecasts or returns likely to occur.

## Survival / downside gate (visible on every candidate)
- Cash, operating cash burn, FCF after capital expenditures, liquidity runway where calculable; debt maturity schedule, covenants and financing risk.
- Historical share-count changes, convertibles, warrants, issuance activity, dilution; cap table data provenance.
- Dependence on one customer, unproven commercialization, nonrecurring contract wins and cyclical overexpansion.
- If crucial risk data are missing, label **Unassessed / insufficient disclosure**, not low risk.
- Penny-stock/OTC liquidity, spreads and Robinhood eligibility verified independently; never inferred from SEC ticker presence.
- Keep speculative ideas distinct from emergency savings, required debt payments and leveraged commitments. ATLAS does not trade.

## UX and integrations
- New **Moonshot / Infrastructure** workspace view or Discovery Feed mode, visually consistent with the user's large-font, green/red directionality and glance-first research cards.
- User-defined infrastructure theme, market-cap range, balance-sheet thresholds, financial-factor weights, and saved company lists.
- Small real-source watchlist and side-by-side comparison; save narrative thesis, confidence, counterarguments and falsification triggers.
- Feed into SEC Opportunity Radar: filing catalysts, earnings evidence, precise publication provenance, market reaction and relevant breakthrough publications, without implying a causal match.
- Separate **Durability**, **Valuation asymmetry**, and **Survival risk** presentations. Show source coverage and uncertainty, not invented precision.
- Rank only genuinely eligible, data-sufficient *candidates*, call them **research priorities**, allow the user to open the raw source for every core metric.

## Implementation milestones / acceptance tests
1. Data coverage: market-cap feed or validated calculation from timestamp-compatible price/share counts; SEC cash/debt/share-count/funding metrics; check split adjustments, stale data and issuer reclassifications.
2. Build source-cited infrastructure-exposure taxonomy with manual override and verifiable evidence, not ungrounded AI keyword hits.
3. Implement transparent independent rubric cards, separate factor weights, no-score on missing critical facts, and dilution-aware scenario math.
4. Add research screens for watchlist, company comparison, evidence/counterevidence, and exportable thesis documentation.
5. Backtest/bias audits (survivorship, selection/look-ahead bias, delistings, corporate actions), limitations on extreme-outcome base rates. Calibrate claims before any recommendation wording.
6. Test with a handful of named research seeds and at least one deliberately poor-quality company, showing why it fails or remains unknown.

## Existing ATLAS work in progress (complete and validate before this new module)
- Automatic indicative **FY P/E** from a completed Alpaca IEX close and matched annual SEC diluted EPS; cannot call it TTM or forward P/E; show unavailable if earnings, dates, split integrity or price data are inadequate.
- Company-name and ticker search, actual SEC company research, persistent *real* watchlist and comparison, separate from fictional demo screens.
- Discovery Feed keyword news search plus descriptive 5-session stock/sector ETF returns against SPY; **sector momentum does not establish news-caused bullishness**.
- Catalyst Radar 3 AM EDT timestamp bug/ambiguity: surface **raw Google RSS clock** separately from verified original-publisher posting time, never invent time from a date-only record. Further original-publisher validation remains to implement.
- User-local npm build and tests have **not yet validated** these newest changes; ask for results before declaring finished.
