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
