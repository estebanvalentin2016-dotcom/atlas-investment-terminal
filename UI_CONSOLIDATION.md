# Workspace consolidation inventory

Base: integration/latest-research-to-main, 8c10b95 (identical source to v0.12).
Audit completed before UI implementation. Preserve every module; reorganize its entry point.

## Before → after feature-preservation checklist

| Existing page/workflow | Destination after consolidation | Preserve |
| --- | --- | --- |
| Research Home / MonthlyPicksDashboard | Home | Decision briefs, source audits, rotating issuer batches, monthly/90-day ledger, optional price context |
| AutonomousDiscovery | Discover → Autonomous Discovery | SEC universe enumeration, batch cursor, financial passes, historical price assessments, research/conviction links |
| OpportunityRadar | Discover → Opportunity Radar | Broad filing queue, search, date filters, pagination, selected source review, ranking, acceptance and price context |
| CatalystRadar / EventReaction / EventComparison | Discover → Catalyst Radar | 8-K lookup, manual worksheet, SPY comparisons, excursions, continuation, intraday checkpoints, publication timing, BOATS probe |
| InstitutionalDiscovery / HistoricalCase / FundCSVImport | Discover → Institutional Discovery | 13F sources, manager changes, historical cases, CSV import |
| InstitutionalConsensus | Discover → Institutional Consensus | Holdings overlap, manager independence caveats, company investigation |
| BreakthroughResearch | Discover → Breakthrough Radar | Manual evidence journal, source validation, browser persistence |
| DiscoveryIntelligence / PublicationDiscovery | Discover → Discovery Feed (publications expandable) | Keyword RSS, sector/stock momentum, Crossref publications |
| RealWorkspace research | Research → Company Research | SEC search, financial metrics, notes, saved companies, Conviction handoff |
| InvestmentRankings + legacy screener | Research → Financial Screener; Settings / Tools → Demo Screener | Real financial ranking, weights, FY valuation, filters, fictional screener and CSV export |
| RealResearch / CompanyComparison | Research → SEC Research | Annual facts, trends, derived ratios, two-company comparison |
| ConvictionLab and evidence panels | Research → Conviction Lab | Bank guards, survival, financing, capitalization, scenarios, historical prices, editable dated theses |
| RealWorkspace watchlist | Watchlist | Existing real company entries, notes, comparison, removal; add saved conclusion/development context |
| MarketData / MomentumScanner | Settings / Tools → Daily Momentum / Momentum Scanner | Existing Alpaca adapters and research calculations |
| Overview / Valuation Lab | Settings / Tools → clearly marked Demo Sandbox | Fictional companies, dilution-aware financial model, scenarios, demo watchlist and assumptions |
| Research stages / research standard | Settings / Tools → Methodology | Existing process and uncertainty guidance, concise provider/configuration instructions |

All server adapters remain unchanged: SEC facts/search/universe, catalyst submissions, SEC-wide indexes, filing review, raw acceptance, Alpaca daily/event/valuation-close/long-history, intraday, overnight BOATS, Crossref, Google RSS ticker/topic news, institutional holdings and cases. No new backend or runtime dependencies.

## Overlap and design decisions

The old sidebar exposed 17 destinations across four groups. The shell repeated ATLAS branding, a page introduction and a long blanket disclaimer before module introductions. Research Home duplicated the journey/methodology already explained elsewhere. Replace this with five primary destinations, task-specific secondary navigation, a short research-quality notice, and optional methodology. Keep source-specific warnings beside the figures they qualify; never hide incomplete evidence behind a generic positive conclusion.

Watchlist currently shows names and notes but no dated conclusions. Reuse existing saved thesis versions and the saved SEC filing ledger, and record a compact dated snapshot when Conviction research succeeds. Display snapshots as historical research, never monitoring, live updates or verified investment recommendations. SEC ledger entries are filing developments, not verified positive catalysts. Unsafe/malformed/future source records must not become developments.

## Data preservation contract

Retain atlas.real.watch.v1, atlas.real.notes.v1, atlas.conviction.theses.v1, atlas.monthly.sec-ledger.v1, autonomous cursors/pass ledger, atlas.breakthrough.v1 and demo atlas.watch/atlas.notes/atlas.val. No migration, clearing, renaming or deletion of existing keys. A new optional research-summary key may store dated results. Removing a company must not remove its notes or thesis history. Failed storage writes must be visible and must not destroy unreadable existing records. Demo and real entries remain distinct.

## Verification to complete

- Five primary destinations; every prior page reachable through secondary navigation.
- Watchlist editing/removal/comparison and Research/Conviction handoffs; saved legacy notes/theses retained.
- No fabricated updates; empty/missing/source-quality states visible.
- Full regression suite and TypeScript/production build.
- Desktop/mobile browser checks, keyboard navigation, overflow and screenshots where available.
- Confirm unchanged server adapters, financial models, lockfile and safeguards.

## Delivery notes

- Five primary buttons replace 17 sidebar destinations; secondary navigation exposes every prior page. The fictional screener now lives in the Demo Sandbox rather than inside real financial screening. Legacy demo notes have an explicit entry point without moving or renaming their storage.
- The shell uses one concise page heading and quality notice. Home leads with its decision brief; the repeated mission/journey introduction moved into Methodology. Crossref publication research is expandable under Discovery Feed. Source-specific warnings remain beside the underlying analysis.
- Watchlist cards show the latest available dated Conviction summary or user-saved thesis, source-linked historical filings where available, notes, research/conviction actions, comparison and removal. The interface explicitly states that saved research is not monitoring. No financial conclusion is generated merely from watchlist membership.
- Successful Conviction research appends a compact local snapshot to atlas.research.summaries.v1. Existing financial decision models remain unchanged. Corrupt watchlist/notes/history is preserved rather than overwritten; storage failures are surfaced. Removing membership does not erase independent notes or thesis history.
- All server adapters, financial models, sector safeguards, dependency declarations and lockfile are unchanged from the integration base.
- Regression tests: 352 passed in 55 files (340 existing tests retained/adapted, 12 new tests). Changes to old UI assertions reflect moving navigation/methodology, without dropping financial or source-verification assertions.
- Complete TypeScript and Vite production builds passed on Node 24 and Node 22.23.3. The full regression suite also passed on both. GitHub-hosted CI is still a separate pending check.
- Production-browser validation: 166 checks passed at 1440, 768, 390 and 320 pixels; no horizontal overflow or runtime errors. Browser validation uses Chromium with intercepted API fixtures and seeded browser storage; screenshots show fixture companies and are not evidence of live provider responses. Desktop/mobile entry points, overflow, note persistence, comparison, membership removal, research/conviction handoffs, empty states and mobile Escape/focus behavior are exercised by scripts/ui-workspace-smoke.mjs. Live SEC/Alpaca/news provider success and human visual approval remain outstanding.

### Reproduce browser checks

No runtime dependency was added. Install optional browser tooling outside the checkout:

```sh
npm install --prefix /tmp/atlas-browser --cache /tmp/atlas-npm-cache --no-audit --no-fund playwright
npm run build
npm run preview -- --port 4173 --strictPort
# In a second shell, with system Chromium installed:
ATLAS_PLAYWRIGHT_PATH=/tmp/atlas-browser/node_modules/playwright/index.mjs ATLAS_UI_BASE=http://127.0.0.1:4173 node scripts/ui-workspace-smoke.mjs
```

Optional variables: ATLAS_CHROMIUM selects a Chromium executable; ATLAS_UI_ARTIFACTS chooses the screenshot directory. Defaults use /usr/bin/chromium and /tmp/atlas-ui-artifacts. Tests use separate browser contexts and never replace production data sources.

Screenshots are captured with fixture data at 1440 and 390 pixels; layout checks also cover 768 and 320 pixels. See docs/ui/ for review images. Existing source-access errors remain visible rather than falling back to synthetic application data.
