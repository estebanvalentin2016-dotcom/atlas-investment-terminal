# ATLAS Cross-Institutional Consensus Intelligence

Status: **Stage 1 implemented** for SEC Form 13F manager snapshots and a dedicated consensus dashboard. **Fund-provider adapters, verified active mandates/manager affiliations, pricing, 13D/13G and historical performance validation are NOT implemented yet.** This is a non-destructive extension to [Institutional Discovery](INSTITUTIONAL_DISCOVERY_ROADMAP.md), [Moonshot Infrastructure Radar](MOONSHOT_INFRASTRUCTURE_ROADMAP.md) and the existing [ATLAS Conviction Plan](ATLAS_RESTRUCTURE_PLAN.md).

## Objective
Discover companies where multiple *independent, documented active* managers may be establishing or increasing meaningful public-market positions. Use this as one research lead alongside business durability, FCF, current valuation, liquidity and financing risk—not as an automatic investment recommendation.

## Implemented first stage
- `server/institutional-api.mjs`: on-demand, exact SEC CIK, quarterly company submissions and filing-directory inspection, bounded XML 13F information tables, two consecutive 13F-HR periods, the original SEC source URL for both, issuer/CUSIP/share class/share count/reported dollar value, filing and as-of dates, and explicit failures rather than empty fabricated portfolios.
- Amendment and 13F-NT notices are **not** treated as comparable full holdings reports. Nonordinary share types (options/PRN) are excluded; tables over the byte cap cannot be fully compared. Increases/decreases are *quarter-to-quarter changes in reported positions*, not dated transaction confirmations. Share splits/renamings and affiliated managers are unresolved and flagged.
- `src/InstitutionalDiscovery.tsx`: Investor → Companies and Company → Investors among manager reports the user explicitly loaded; 13F issuer-name matching to tickers is tentative until an authoritative CUSIP crosswalk exists.
- `src/institutional-consensus.ts`: point-in-time grouping by **exact reporting period + security CUSIP/share class**. Separately counts all reporting managers, provisional new/increased positions, unique verified active manager families, verified passive families and unknown mandate/affiliation relationships. Two independent, documented active families with new/increasing shares are required for a verified active-convergence signal.
- By default, SEC 13F manager records are **unknown strategy / unknown affiliated family**; even two apparent owners yield **unverified co-reporting**, not "smart-money consensus." This prevents false independence and reflexive active-manager endorsements.
- `src/InstitutionalConsensus.tsx`: separate ATLAS sidebar research dashboard, on-demand loading of 2–6 manager CIKs, security-level coverage, source links, provisional co-reporting patterns and transparency about unknown active consensus. Does not automatically connect a ticker or change Conviction Lab ratings.
- Unit and UI tests for source completeness, manager grouping, date alignment, affiliate de-duplication, passive exclusion and nonprediction behavior.

## Fund-level integration contracts and future adapters
Every authoritative disclosure will need:
- **Provider / fund**: SEC/official fund identifier, manager CIK and registered fund/family identifiers; classify share classes/funds/affiliations with independently sourceable identity records.
- **Disclosure cadence**: store a `frequency` among daily, monthly or quarterly for THAT fund and snapshot; distinguish portfolio **as-of date**, **publisher posting date**, later correction time and retrieved time. Never assume all funds publish daily.
- **Security**: the exact CUSIP/ISIN and share class, shares, source-reported market value and portfolio weight, units/currency, corporate actions and any missing rows. Map to public tickers only with verified dated crosswalk.
- **Mandate**: `verified_active`, `verified_passive`, or `unknown` with investment mandate and family relationship sources. Index-tracking flows, ETF share creation/redemption and passive rebalancing are NOT active stock-selection evidence.
- **Full source provenance**: direct issuer/fund official CSV/JSON/PDF reference, legally accessible terms, snapshot checksum, source availability status and partial-coverage errors. Parsing must be provider-specific and testable; do not fabricate a comprehensive provider-wide view.
- Initial desired provider adapters: **Vanguard**, **BlackRock/iShares**, and **State Street/SPDR**. As of this stage, all three remain `source adapter pending`: no fund-level holdings have been claimed.

## Historical validation (not yet implemented)
Build point-in-time panels keyed by actual publication date, avoid looking ahead or retroactively backdating holdings to quarter end; control for size, beta, sector, quality, momentum, liquidity and passive/index effects. Evaluate next 1/3/5-year returns and turnover *after the public disclosure time*, including delisted and failed firms, publication/filing lags, trading costs and data survivorship. Compare active-manager consensus against baseline factors using train/test time splits, not optimized results on the same sample. No claim of predictive accuracy until these checks pass.

## Integration gate
ATLAS can surface an institutionally interesting **research lead**. It cannot upgrade to Strong Speculative Buy or a conviction rating based only on a 13F cluster, an apparently increasing passive ETF position, or unknown manager motives. A dated, independently cited business/valuation/financing scenario remains necessary.

## Known blockers
- SEC 403/timeouts or index/document size limit.
- Manager amendments, 13F-NT notices, shared reporting accounts, confidential holdings, private assets, positions outside 13F.
- Split-sensitive changes and incomplete issuer CUSIP/ticker mapping.
- Unverified investor reasoning and investment mandate independence.
- Provider-specific fund holdings URLs/data formats, publication metadata and licensing.
- No market-cap/FCF/valuation or risk-gating integration yet for institutional consensus output.

## Stage 1.5 — reproducible historical case and initial fund CSV import

**Real historical reporting evidence independently checked against SEC complete-submission text:**
- Reporting manager **ValueAct Holdings, L.P.**, CIK **1418814**. SEC 13F-HR periods **2026-03-31** and **2026-06-30**, publicly filed **2026-05-15** and **2026-08-14**. Original complete submissions: [previous](https://www.sec.gov/Archives/edgar/data/1418814/000141881426000002/0001418814-26-000002.txt) and [latest](https://www.sec.gov/Archives/edgar/data/1418814/000141881426000003/0001418814-26-000003.txt).
- Exact CUSIP/class values from source table XML: Rocket Companies Class A (CUSIP 77311W101) **28,214,724 → 41,668,774** (+13,454,050 shares); BlackRock common (09290D101) **546,100 → 581,700** (+35,600); MongoDB Class A (60937P106) **1,037,800 → 165,700** (−872,100); Roblox Class A (771049103) **5,848,621 → 3,147,421** (−2,701,200). These are changes in **reported positions**, not confirmed purchases/sales at specified times.
- The Q2 13F cover explicitly identifies the report as a **13F COMBINATION REPORT** and includes **ValueAct Capital Management, L.P., CIK 1351069**. Treat these as **related reporting entities**, not independent endorsements. The true total manager portfolio extends beyond this one information table.
- `/api/institutions/historical-case` fetches both SEC directories and complete original information-table XML files plus the latest primary cover. It **checks** each expected source value, quarter dates and included manager relationship. A mismatch, unavailable SEC document, or missing affiliate metadata prevents a verified result. It is refreshable; tests include a tampered holding.
- `InstitutionalHistoricalCase` renders an on-demand verified audit inside Consensus, reported-share changes, position-value and share-of-comparable-information-table changes, filing/publication dates and original links. A separate on-demand `RKT` research action uses the existing SEC company facts, indicative FY P/E and Conviction Lab evidence gates. It is **not a new buy rating**.
- **Important financial interpretation:** Rocket's changed reported share count is interesting but does NOT establish ValueAct's investment thesis, actual trade dates, independent active-manager convergence, price-sensitive mispricing, or remaining 3x–5x upside. These must be established separately.

**Fund-level adapter groundwork, not automated live feeds:**
- `src/fund-csv-adapters.ts` and `FundCSVImport.tsx` accept a locally selected, user-downloaded **provider-style CSV** from Vanguard, BlackRock/iShares or State Street/SPDR. They parse source-reported ticker, issuer, exact CUSIP (or U.S. ISIN mapping), shares, fund weight and market value when provided, and a holdings as-of date if present.
- Enforce a limited size and an **official provider HTTPS URL**; do not fetch arbitrary user URLs or treat entered URLs as authenticated provenance. Original **publication date remains unknown** unless verifiably available. Input is **user-supplied/unverified** and **does not contribute to active institutional consensus**.
- Official **automatic** fund-level downloads, robust provider-specific current endpoints, disclosure-frequency timestamps, manager/fund-family verification and point-in-time backtesting remain pending. An uploaded holdings CSV is not equivalent to a tested daily/monthly issuer adapter.

**Validation before release:** run local `npm.cmd run build`, `npm.cmd run test`, and `npm.cmd run dev`. On the Institutional Consensus page click **Verify two real SEC reporting periods**, confirm the live source match or note SEC availability errors, then **Check RKT fundamentals and conviction readiness**. No real-source results may be claimed verified solely because an offline synthetic test passes.
