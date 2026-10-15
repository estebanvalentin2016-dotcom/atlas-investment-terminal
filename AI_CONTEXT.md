# Context for the next AI development session

The owner wants to build a Bloomberg-inspired investment research terminal designed to identify and evaluate high-upside publicly traded companies. The owner is not highly technical. Speak plainly, give exact commands and practical deliverables. The product should prioritize financial research quality over decorative data.

Current main app is ATLAS v0.2, a Vite/React/TypeScript app with a local Node middleware SEC API. SEC Research fetches actual public SEC annual financial facts with dates and calculates growth/margins; the eight companies and all prices/metrics in the original demo screens remain **fictional**. No live stock prices. The v0.3 feature branch adds a side-by-side company comparison within SEC Research. Read README, ARCHITECTURE, FEATURES, CHANGELOG, and current code before changing it.

Do not overwrite or break functioning screens. Preserve the investment model's correct treatment of share dilution, distinguish market cap from share price, and maintain tests. Do not disclose third-party API secrets in browser code. Build/test whenever dependencies/environment allow, and note precisely what was or was not tested. Record meaningful changes in CHANGELOG and FEATURES. Use Git to checkpoint work.

Suggested next tasks: test and finalize the v0.3 two-company SEC comparison, improve SEC fiscal period correctness and comparability, then evaluate licensed historical market price feeds. Keep secrets server-side. Do not represent SEC filing data as live stock quotations.

The v0.4 branch adds a manual Breakthrough Radar research log with local browser persistence, evidence categories and source URLs. It does not independently verify claims or forecast returns; see BREAKTHROUGH_RESEARCH.md. Run build and tests before merging.

v0.5 branch adds a research Publication Discovery Feed backed by Crossref metadata (server-side Node proxy). Do not imply these are independently verified breakthroughs or that results identify investable companies. Continue with company exposure analysis only with direct evidence. Test build, parsing and UI before merge.
