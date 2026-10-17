## Workspace UI consolidation — in development
- Five destinations: Home, Discover, Research, Watchlist, Settings / Tools; all specialized research remains accessible.
- Dated saved conclusions, source-linked filing history, notes, comparison and research/Conviction shortcuts in Watchlist.
- Clearly separated fictional tools, including legacy demo notes; existing local storage retained.
- Responsive secondary navigation and keyboard-accessible mobile navigation.
- See UI_CONSOLIDATION.md for the full before/after inventory and validation limits.

# Features and roadmap

## Implemented — v0.1.0
- [x] Polished dark terminal interface with responsive navigation
- [x] Fictional sample company universe with clear data warnings
- [x] Filterable and sortable opportunity screener
- [x] Transparent heuristic scoring with score components
- [x] Company research page with sample chart and fundamentals
- [x] Editable thesis notes and watchlist with local persistence
- [x] Compound-earnings valuation and CAGR with dilution
- [x] Bear/base/bull sensitivity cards
- [x] CSV export of screener results
- [x] Automated valuation tests

## Implemented — v0.2
- [x] SEC annual financial facts with explicit source and filing dates
- [x] Real SEC company ticker lookup and proxy
- [x] YoY growth, 3-year revenue CAGR and financial margin calculations
- [x] Historical reported data charts
- [x] SEC and financial-analysis tests

## In development — v0.3
- [x] Two-company comparison using reported SEC annual financial statements
- [ ] Improved fiscal period normalization and peer comparability
- [ ] Source/date badge for every reported number
- [x] Company search for real tickers
- [ ] User-controlled assumption presets
- [ ] Import/export and backup for watchlist and notes

## Future milestones
- [ ] Authenticated accounts and cloud synchronization
- [ ] DCF and owner earnings models with capital structure adjustments
- [ ] Peer comparison, forward dilution and valuation distributions
- [ ] Historical snapshots / point-in-time backtesting
- [ ] Risk budgeting, concentration analysis, portfolio imports
- [ ] Automated earnings/transcript/document changes with source citations
- [ ] Source-verified AI research assistant

## In development — v0.4
- [x] Manual, source-aware emerging technology research journal
- [x] Distinguish hypotheses, technical evidence, commercial milestones and counterevidence
- [x] Optional public ticker and browser-local persistence
- [ ] Independently verify source content and provenance
- [ ] Research workflows for technology-to-company economic exposure

## In development — v0.5
- [x] Search public academic publication metadata via Crossref
- [x] Include DOI links and retrieval metadata; never invent results
- [ ] Validate publication relevance and technical maturity
- [ ] Link research to companies using independently supported evidence

## In development — v0.6
- [x] SEC 8-K event lookup with source links and categorized item codes
- [x] Manual price-return and relative-volume calculation
- [ ] Licensed or free actual market data and validated event-to-price alignment
- [ ] Measured multi-day continuation and exit conditions

## In development — v0.7
- [x] Free-tier IEX daily market bars (requires free Alpaca keys)
- [x] 1-day, 3-day, 5-day returns, RVOL and distance from 20-day high
- [x] Open stock chart on Yahoo Finance for independent visual review
- [ ] Automatically associate filing catalysts to market sessions
- [ ] Paper-trade historical entry/exit rules with realistic friction

## In development — v0.8
- [x] Multi-ticker daily momentum scan for up to 8 symbols
- [x] Clearly defined illustrative bullish and bearish research criteria
- [x] Per-symbol errors, source metadata and Yahoo Finance links
- [ ] Detect catalyst-to-price timing and run historical event studies
- [ ] Evaluate out-of-sample results including trading costs
