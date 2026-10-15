# ATLAS Product Restructure — Asymmetric Alpha & Investment Conviction

> **P0 PRODUCT ACCEPTANCE GATE (supersedes prior feature priorities):** See [AUTONOMOUS_DISCOVERY_REQUIREMENT.md](AUTONOMOUS_DISCOVERY_REQUIREMENT.md). The product is NOT done until a user can select **Discover Opportunities** with **zero ticker entry**, traverse a real supported listed-company universe (not handpicked seeds), and obtain source-backed financial, institutional, dilution-sensitive five-year valuations and evidence-gated investment research. A complete, reproducible, counted end-to-end run must include an issuer outside the original test universe. The current 24-issuer batch scanner is an early operational slice, NOT completion. Deprioritize cosmetic and new standalone-dashboard work until this pipeline works.
>

Status: **Phase 1 in progress.** This plan applies the user's 2026-10-15 ATLAS Development Directive. It is an incremental migration, NOT a rewrite or data deletion.

## One product objective
Find publicly traded businesses offering unusual potential *remaining* shareholder upside over ~3–7 years; investigate technological durability, growth economics, survival, capital structure and potential mispricing; produce explicit **price-sensitive, source-backed conviction verdicts** when evidence warrants them. An illustrative 100x outcome must never be mistaken for a forecast. No automatic trading.

## The five-stage user journey
1. **Discover** — Real-company universe, SEC Opportunity Radar, keyword/sector Discovery Feed; future institutionally-backed and technology infrastructure candidate discovery.
2. **Investigate** — A shared CIK/ticker identity and dated evidence layer: company SEC facts, 8-Ks and exhibits, financial statements, cash/debt/share count, quality of earnings, public-reportable institutional positions, original news-release provenance and technological durability.
3. **Value** — Date-matched prices and diluted share count, five-year revenue/margin/FCF/capex/net debt/equity-issuance model, bear/base/bull/moonshot cases, implied *per-share* outcomes. Real P/E based on correctly aligned financials is indicative FY P/E, not automatically TTM or forward.
4. **Decide** — Evidence gate; price-sensitive buy/watch/avoid/insufficient-evidence verdict; explicit counterarguments, bear losses, mispricing and falsification thesis. No arbitrary probabilities, no unsupported ratings. No guarantees.
5. **Monitor** — Real watchlist and versioned investment thesis, reported results vs original assumptions, changes in risk and return; later conditional alerts for material developments only.

## Feature disposition (keep, optimize, retire/contain)

| Existing ATLAS capability | Decision | Reason / migration |
| --- | --- | --- |
| SEC Research, 8-K source/index discovery, exhibit extraction | **KEEP + OPTIMIZE** | Verified source engine; feed Discover and Investigate; preserve SEC 403 as partial data, not empty days |
| Company-name search, SEC financial facts, two-company comparison | **KEEP + UNIFY** | Same company identity, as-of date, provenance and missing-value treatment across tabs |
| Alpaca free IEX market history, completed-session comparisons, acceptance timing | **KEEP** | Observed context; NOT verified publication timing, consolidated tape or alpha |
| Weighted FCF/growth/valuation screener | **OPTIMIZE** | A *research-priority queue* only; source-matched SEC facts and indicative FY P/E, then market cap, debt, dilution, sector comparability and backtested ranking |
| News/publication, Discovery Feed, Catalyst Radar | **CONSOLIDATE LOGIC** | News-time provenance + event relevance + sector signals; aggregation timestamps not verified issuer release times |
| Real watchlist and saved thesis text | **OPTIMIZE** | Timestamp thesis versions, falsification triggers, milestone review and monitoring |
| Current Valuation Lab | **REBUILD THE MODEL, KEEP THE UI IDEAS** | Currently calculated from fictional prices/companies, 3 scenarios and basic dilution; build a real 4-scenario per-share model before marketing outcomes as investor-ready |
| Overview & fictional Screener/Valuation sample data | **RETAIN AS SEPARATE DEMO SANDBOX** | Useful testing/education, but not investment recommendations; never silently mix with real data |
| Overlapping standalone news/momentum/experiment tabs | **MOVE UNDER SUPPORTING RESEARCH** | Keep code and access, reduce top-level navigation clutter; deprecate only with demonstrated equivalent functionality |
| Moonshot infrastructure & VC/Institutional tracking | **PLANNED, INTEGRATE INTO DISCOVER** | Provenance-rich discovery layers, not magic confidence boosts or signals |

## Conviction statuses and evidence contract
- **STRONG SPECULATIVE BUY**: eventually requires current date-aligned price/valuation, audited or verifiable financial history, explicit market-mispricing thesis, credible dilution-aware return scenarios with downside, survival risk, independent support for technological moat and evidence of resilience to sensitivity, and reproducible source links. This must remain unavailable until the infrastructure is implemented and validated.
- **BUY CANDIDATE**: attractive evidence-supported return potential with narrower uncertainty; still requires core financial, risk and valuation evidence.
- **WATCHLIST**: credible business but price or evidence still insufficient.
- **AVOID**: evidenced negative risk/reward, serious viability issues or inferior opportunity after analysis.
- **INSUFFICIENT EVIDENCE**: default while critical inputs or validated scenarios are missing. A missing data field must *never* be scored as favorable.

**Never derive one of the first four labels solely from** news sentiment, momentum, current/future institutional ownership, an anecdotal TAM, model-generated probabilities or a high financial-screen score. Ratings must change when price/earnings/financing assumptions change. Probabilities appear only where externally calibrated; otherwise show unweighted scenarios.

## Information model (incrementally adopt; no disruptive migration)
Each assessed candidate should eventually have:
- **Identity**: SEC CIK, ticker, share class, exchange/venue, issuer name, current-listing proof
- **Market snapshot**: as-of timestamp, close, adjustment, current diluted shares, equity market cap / enterprise value, liquidity and data coverage
- **Financial observations**: period start/end, form accession, filed/as-known date, currency/unit/denominator, corrected amendments, SEC original source
- **Evidence facts**: cited disclosure excerpt, event type, original publication time status, and report/observation timestamps
- **Company risks**: debts, near-term liquidity, capex, dilution, issuer dependence, competitive threats and durable advantages
- **Scenario assumptions**: revenue path, margin path, reinvestment, capital requirements, EV-to-equity bridge, dilution, exit multiple, return sensitivity, explicit assumptions vs known facts
- **Conviction snapshot**: independently generated gate failures, eligible verdict, supporting and contradicting reasons, entry price, thesis falsification milestones and immutable version date

## Migration strategy
1. **Navigation + entry point** (current change): five-stage home; prominent real SEC research and optional Conviction Lab; group supporting research and demo sandbox without deleting pages or changing saved data.
2. **Shared candidate dossier**: source-backed company facts + completed IEX close + missing-evidence readiness; minimal ratings only. Wire existing watchlist notes into evidence snapshots; no fake “Strong Buy.”
3. **Financial risk + valuation model**: proper dated market cap, cash, debt, diluted shares, capex/runway, break-even and 4 cases with sensitivity; test look-ahead and corporate actions.
4. **Durability/mispricing and institutional proof**: dated evidence with explicit human-verifiable citations, VC historical/current split, sector tech exposure, counterclaims and scenario valuation.
5. **Monitoring/backtesting/alerts**: versioned forecasts, measured failure rates and benchmark comparison; watch only material fundamental changes.

## Release policy
- Each migration step keeps previous live routes, watchlists and source links intact.
- User-facing build/tests must pass before we call a new feature complete; a GitHub commit is not a successful build.
- No destructive localStorage migrations or deletion of existing experiments in Phase 1.
- Real and demo sources are always labeled separately. Strong colors show *observed* direction, not predictive verdicts.
- User-first UX: 16+ px descriptive text, big numbers, one-screen takeaways and collapsed technical audit.
