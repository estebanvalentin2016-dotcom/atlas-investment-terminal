# ATLAS CRITICAL REQUIREMENT — Autonomous Investment Discovery

**Priority: P0 — main product acceptance criterion, above sidebar polish and additional standalone analytical dashboards.**

## Product definition of done

From a fresh application session the user must be able to click **Discover Opportunities**, enter **zero tickers**, and receive a point-in-time audited, source-backed shortlist from the **actual supported investment universe**. A successful complete run will:

1. Enumerate the supported, genuinely exchange-listed/publicly tradable universe without a predefined favorite ticker shortlist.
2. Record universe count, verified exchange/sector eligibility, scan coverage, run timestamp, failures, data freshness and each filtering stage.
3. Filter cross-sector businesses based on acceleration/growth, profitability and cash generation, liquidity, survival/runway, competitive durability, financing/dilution, and current dated market valuation.
4. Check institutional 13F/fund-level snapshots with their public availability dates and actual security identification, de-duplicate affiliated managers, and separate discretionary active allocation from passive flows. Historical VC backing must not be confused with current ownership.
5. Deep-research qualified candidates using the existing SEC company facts, 8-K primary documents and exhibits, attributable investor commentary where available, and original dated source documents. Missing original-first-public-news timestamps remain unknown.
6. Build **5-year bear/base/bull and remote moonshot sensitivity scenarios**, with sourced base-year earnings/FCF, cash/debt and current share count, explicit forward revenue, margin, exit valuation and equity issuance assumptions, share dilution, and per-share return/breakeven analysis.
7. Explain a falsifiable *market mispricing hypothesis* and counterevidence. A rapid growth stock is not inherently undervalued.
8. Return strongest **research candidates** and investment verdicts **only when corresponding evidence gates pass**. A Strong Speculative Buy is NOT a top-N score threshold; the model can return **no qualifying purchases**. Every claim must link to its source and as-of date, or be labeled inference/assumption.
9. Include historical point-in-time validation (public dissemination not just quarter-end dates), correct corporate actions, delistings, look-ahead and survivorship bias, factor baselines and realistic costs. Do not claim return-prediction power without validation.
10. Demonstrate an out-of-sample discovery on a company **not originally in the developer's test or demo universe**. No typed ticker or hidden preselected company list. Report every stage count and source delay.

**Investable capital example:** The user may have $1,000 to deploy. This is context for the candidate's fractional share feasibility, downside and sizing analysis, never an instruction to invest it automatically or compromise emergency/required debt payments. No auto-trading.

## Operational staged delivery (preserve all existing ATLAS functionality)

### P0.A — implemented in branch, LOCAL VALIDATION STILL PENDING
- `/api/autonomous/universe` reuses the existing official SEC company-ticker index, enumerates a stable, non-seeded issuer order, and returns pages with a bounded 24-company cursor rather than a user-supplied symbol.
- New `AutonomousDiscovery.tsx`: one **Discover Opportunities** action, no ticker field; sequential bounded real SEC companyfacts screening, stage counts, true SEC source links and explicit source failures. Initial gate: recent FY, revenue growth ≥10%, nonnegative FCF after capex and net margin ≥−10%; configurable/sector-aware factor gates are not implemented. The leading **up to eight preliminary** passes receive completed Alpaca IEX close requests and indicative SEC annual diluted-EPS P/E checks. This is **not** a whole-universe valuation.
- User can continue to the **next batch**, stored as a local SEC index cursor. Repeated bounded scans cover different issuers without resorting to developer-picked familiar companies.
- Research candidates link to real Company Research and Conviction Lab. They show **INSUFFICIENT EVIDENCE** because listing eligibility, liquidity, validated market cap, risk, relative valuations, institutional coverage, scenarios and true mispricing analysis are still absent.
- Nine tests cover enumerating unfamiliar synthetic issuers, non-overlapping full universe cursor traversal, no ticker inputs, SEC-derived screening and honest stage counts. This **does not substitute for a real full-universe end-to-end run**.

### P0.B — required next: full effective universe and reliable scan state
- Verify live exchange listing/sector/asset type/market cap/float using a licensed reliable security master; SEC `company_tickers.json` is *not* such a master.
- Paginated incremental scan jobs with persistence, backpressure, bounded SEC rate, resume/retry, error policy, sample selection bias controls, and full-universe traversal. No arbitrary permanent 24-row cap or incomplete candidate pool presented as market-wide.
- SEC issuer lookup keyed by CIK (not only ticker), date-stamped observations and filings; efficient cached fundamentals and cross-sector accounting normalization.
- Support earnings-growth trajectory, quarterly financial acceleration, sector normalization, recently listed growth firms and negative-earnings survivors without forcing profitable-company only filters.

### P0.C — required: valuation and survival research
- Date/split-compatible prices and earnings; current issuer share count/diluted shares, market cap/EV, net debt, runway, maturity timing, historical issuance/dilution and FCF.
- Build auditable 5-year per-share scenario sensitivity models with **bear/base/bull/remote moonshot** and possible complete loss. Do not fabricate analyst consensus or current TAM.
- Ranking filters may prioritize research; investment verdicts remain gated.

### P0.D — required: institutional convergence and sourced thesis
- Extend existing 13F reader and historical case; reliable CUSIP-to-issuer mapping and active-manager family attestations, amendments, stock splits and SEC publication timing.
- Implement tested official Vanguard, iShares and SPDR **fund-level** adapters including real as-of and publication dates. Current CSV import is user-supplied/unverified; it must not be counted as independent active consensus.
- Distinguish investor-authored rationale, ATLAS inferred rationale, and unavailable rationale.
- Link 8-K catalyst timing, valuation/mispricing and competitive durability for truly eligible companies.

### P0.E — required independent validation and product acceptance test
- Full supported-universe scan with no manual ticker, dynamic issuer count, stage-pass metrics, dates, source coverage and incomplete-data warnings; include examples outside originally used test tickers.
- Verify at least two actual reporting periods for institutional activity, share counts and manager affiliates; perform independent reconciliation.
- Out-of-time historical returns conditioned on information-publication dates, sector/size/momentum controls, realistic trading costs and failed companies.
- Demonstrate candidates and perhaps **zero Strong Speculative Buys**. This is acceptable and preferable to a false conviction verdict.

## Source and honesty rules
- Zero ticker input is mandatory for discovery, but a ticker search is still appropriate for direct research.
- An SEC index issuer is not automatically a currently tradeable, eligible U.S. stock; a partial page of issuers is not a supported full-market search.
- SEC reported FCF, annual diluted EPS and historical share count are not themselves a current fair value.
- Never manufacture a five-year return projection, market cap, purchase time, fund positioning, institutional independence or investor motivation. Emit *unknown*.
- All displayed counts refer to successfully examined issuer records; failures are separately visible; do not conflate a blocked SEC 403 with zero qualifying companies.
- This is a **research-only** system. No order placement, automatic investing or confident investment call unsupported by evidence.

## Acceptance run log template
| Stage | Count | Source & as-of date | Exclusions or data gaps |
|---|---:|---|---|
| Supported public security universe | TBD | Licensed security master | Exchanges/asset classes |
| Issuers enumerated and checked | TBD | SEC index/companyfacts | Failures/timeouts |
| Growth/FCF/profit screening pass | TBD | SEC 10-K/10-Q | Stale/missing concepts |
| Exchange/market-cap/liquidity pass | TBD | Market security master | Unavailable |
| Institutional convergence verified | TBD | EDGAR 13F + fund providers | Affiliation/passive/delays |
| Dilution-aware valuation complete | TBD | SEC + dated prices | Share counts/scenarios |
| Evidence-backed buy candidates | TBD | Full source audit | Missing risks/counterevidence |
| Strong Speculative Buys | Could be zero | Conviction gates | No recommendation permitted |

**Owner acceptance test:** Click **Discover Opportunities** from a clean session. Do not type any company name or ticker. The scanned issuer pool must come from a real enumerated external security universe, not a demo/seed list; the produced candidates must have enough sourced financial, price, survival, institutional, dilution and valuation material for independently reproducible decisions. This remains the definition of done even if other dashboards appear complete.

## First real user-verified autonomous scan (October 15, 2026)

The user ran the **zero-ticker workflow** and shared its local UI output; these figures reflect the *app's reported local run*, not a separately audited full SEC index:
- SEC ticker index showed **10,444** entries; batch **offsets 24–47**, **24** enumerated, **22** issuer financial records fetched, **2** blocked/failed sources.
- Initial screen: **1 preliminary pass**, **7 rejected on thresholds**, **4 incomplete accounting**, **10 stale annual financials**, **1** completed-price follow-up; **0** evidence-complete investment verdicts.
- The discovered test-out-of-seed company was **RGEN (Repligen Corp)** with app-reported annual revenue growth **+16.4%**, FCF margin **+12.7%**, FY P/E **207.3×** and completed Alpaca IEX price **$178.24 (2026-10-14)**; FY filing shown as 2026-02-26.
- This confirms the code can enumerate and screen an untyped issuer without relying on manually supplied ticker seeds. **It does not confirm RGEN is a good investment, or that the 207.3× ratio is split-normalized/TTM earnings.** This is precisely why price sensitivity and valuation evidence must remain independent gates.

## Next incremental improvement (committed; local validation pending)

- The user can now choose **24 companies / one batch** or **up to 72 companies / three sequential batches** per click; completed-run cursor persists and can be explicitly restarted, and the expanded funnel counts every actually enumerated issuer. SEC queries remain limited to two concurrent company-facts requests.
- Each price-checked research candidate has a prominent indicative FY P/E valuation caution: at or above 80×, label **high valuation hurdle**, at or above 40× label **elevated earnings multiple**. These are *heuristic research warnings*, not fair-value claims or universal rejection thresholds. Unknown multiples are never declared inexpensive. High multiple cautions are shown before ordinary factor scores in research-priority ordering.
- New regression tests cover the warning, unknown valuations, sub-threshold margin, and the multi-batch control. The full SEC investable universe, cash/debt/dilution scenarios, sector standardization, independent active-manager consensus, and five-year risk-adjusted ranking **remain not implemented**.
- New `.github/workflows/atlas-validation.yml` runs **npm ci**, **npm run build**, and **npm run test** on pushed feature-branch commits and PRs. GitHub Actions enablement/actual success must be verified; a workflow file is not itself a passing build.

This is real progress toward the zero-ticker definition of done, but **not product completion**.

## October 15 — first 72-company live run: urgent revenue-semantic audit

The user ran another unseeded live scanner batch (local app report): **10,444 SEC index entries**, **72** enumerated (index offsets 0–71), **65** SEC companyfacts reports checked, **7** source failures, **5** preliminary candidates, and **5** completed IEX valuation requests. Reported candidates: WDC, SBAC, ELMD, PCOR and RGEN; **zero verified investment verdicts**.

**Critical accounting/data-quality regression discovered from this real run:**
- ATLAS initially showed **SBAC +59.9% revenue growth / +436.2% FCF margin**. The source [SBA Communications' 2025 10-K](https://www.sec.gov/Archives/edgar/data/1034054/000103405426000002/sbac-20251231x10k.htm) reports **2025 total revenue $2,815,139,000** and **2024 total revenue $2,679,634,000** (approximately **+5.06%**), while **site-development segment revenue $244,498,000** vs **$152,869,000** grew **+59.94%**. It also reports **2025 operating cash flow $1,291,328,000** and **capex $224,819,000**: indicative after-capex FCF **$1,066,509,000**, **37.88% of consolidated revenue**, not +436.2%. The incorrect margin is exactly the consequence of dividing true total-company cash flow by site-development segment sales.
- The original SEC `selectFact` preferred `RevenueFromContractWithCustomerExcludingAssessedTax` before `Revenues` and mixed concept tags across years. In this issuer that chose a **business-segment** fact as if it were consolidated revenue.
- Implemented `selectConsolidatedRevenue` to pick the **largest supported US-GAAP annual revenue concept for the latest year, keeping comparisons within the SAME tag**, and expose other materially smaller candidate tags for accounting review. This is still a heuristic: companyfacts tags and issuer total-revenue line must be independently checked for high-conviction decisions.
- New autonomous **accounting_review** gate quarantines implausibly high FCF margins (>100% of sales), net income margins (>100%), or hyper-growth (>200%) and companies with materially conflicting alternative revenue tags that otherwise pass. These are data-integrity review thresholds, **not claims those ratios are impossible or economically invalid**.
- The general fundamentals ranker also withholds score for an FCF ratio >100% until source reconciliation. Discovery shows a source-tag + cash flow + capex calculation audit for preliminary candidates and the count of accounting-review cases. New regression fixtures use the **real SBA Communications 10-K numbers**, checking that site revenue is not substituted and SBAC does **not** clear the scanner's 10% total-revenue-growth gate.
- **Important:** These changes were committed but require the user's local build/test and fresh scan verification. Other listed tickers' reported figures, including WDC and PCOR, have not been independently reconciled. A source-coded financial percentage is not automatically an audited consolidated business fact.

Next priority: learn from this failure—expand comparable-concept validation across issuers and annual/quarterly restatements, allow an issuer to fail financial data quality checks visibly, verify diluted per-share normalization and corporate events, then scale scan coverage with persistent point-in-time financial history.

## October 15 next tickerless scan and Phase 1 survival evidence

**Third reported real scan, offsets 72–143:** User's ATLAS UI showed **72 issuers enumerated**, **66 SEC company-facts responses**, **6 retrieval failures**, **2 preliminary passes**, **2 accounting-review flags**, **17 filtered out**, **15 incomplete**, **30 stale**; no verified investment recommendations. Unseeded preliminary candidates were **Mission Produce (AVO)** (+12.7% annual revenue growth, +2.7% FCF margin, indicative 22.7× FY P/E) and **Harrow (HROW)** (+36.4% growth, +15.8% FCF margin, FY P/E unknown). These are unvalidated initial SEC metrics, not source-reconciled buy cases; both need share-count, financing, dilution and valuation research. This is one more demonstration that the discovery queue is not hardcoded to earlier tickers.

**New incremental survival evidence implementation (committed; local build/test not yet verified):**
- Existing SEC company-facts response now exposes strictly separated annual **cash and cash equivalents**, **current part of long-term debt**, **noncurrent long-term debt**, **short-term borrowings** and **weighted-average diluted shares**. Each fact retains its standard SEC US-GAAP tag, fiscal period end, filing date and SEC company-facts citation; share units are correctly requested as `shares`, not USD.
- `src/survival-evidence.ts` aligns the reported financial year and debt/cash/share fields to the same fiscal-period end; **figures filed after the research as-of date cannot leak into the result**. Annual negative operating cash flow is retained, not interpreted as missing. Missing debt components remain unknown, NOT debt of zero. A simple cash/negative-FCF mechanical quotient may be shown as a **sensitivity, not a liquidity-runway forecast**.
- Historical weighted-average diluted share count and annual change are shown as a **capital-structure trend only**; this is NOT shares currently outstanding or a reliable dilution forecast. It must NOT be multiplied by today's share price and called verified market cap. 10-K fiscal share averages may differ from quarter-end diluted or basic outstanding shares; stock splits and classes require normalization.
- New `SurvivalEvidencePanel.tsx` is connected automatically to **Autonomous Discovery** candidates and **Conviction Lab**, showing cash/debt-source coverage, weighted-average diluted-share trend and optional cash-burning warning, with source details collapsed. Conviction verdict remains **INSUFFICIENT EVIDENCE** because complete debt maturity, runway, capital structure, liquidity, current market cap and five-year financing/valuation scenarios are not yet established.
- Regression tests protect missing data, mismatched fiscal periods, future-only filings, negative operating FCF, share-trend interpretation and no unsupported buy ratings.

**Next stage:** obtain validated as-of shares outstanding (including multiple classes/splits), current market capitalization, net debt/lease/convertible obligations, near-term maturities, quarter-over-quarter cash-burn data, and dilution-aware five-year per-share scenario modeling. A visually impressive annual cash balance is not proof of survival.

## Side validation case — AAOI / Conviction Lab growth versus financing risk (not a change of P0 priority)

User supplied the current local **Conviction Lab** output for **Applied Optoelectronics (AAOI)**, from ATLAS SEC companyfacts for CIK **0001158114**, FY2025 filed **2026-02-26** and IEX close **2026-10-14**. The *local display* reports:
- Revenue growth **+82.8%** (high expansion).
- Operating free cash flow after capex **−$353,576,000**; margin **−77.6%** (material capital consumption; not independently reconciled to the 10-K yet).
- P/E **not computable**, IEX close **$86.22** at 2026-10-14.
- **4/11 verification gates** backed by the available SEC/price evidence; the app correctly returns **INSUFFICIENT EVIDENCE**. This count measures availability of evidence, **not** financial quality or a 4/11 investment rating.
- The screenshot's survival gate still says "Balance-sheet and financing risk engine not yet connected." The latest branch now has an annual SEC cash/debt/dilution evidence panel. Check whether the user's local pull includes that update; it does not establish complete survival or solvency even once visible.

**Concrete questions to validate for AAOI (keep alongside main autonomous-discovery pipeline):**
1. Reconcile FY2025 **consolidated revenue, operating cash flow and capex** to AAOI's original 10-K and identify why free cash flow is so negative (growth capex, working-capital build, recurring operating losses, or unusual investing activities). Differentiate capital-intensive expansion from permanent operating impairment; do not presume the explanation.
2. Source balance-sheet cash and cash equivalents at exact period-end, subsequent quarterly changes, borrowings and commitments, maturity schedule, pledged securities, purchase obligations, convertibles and refinancing needs. Calculate funding gap scenarios (not just simplistic cash / annual FCF).
3. Verify basic and diluted shares currently outstanding at price date, issued shares, historical dilution, equity-linked securities, warrants and future fund-raise needs. A historical weighted-average diluted share count must not be treated as current outstanding shares.
4. Quantify what **$86.22 stock price** implies using dated current market cap/enterprise value, normalized margins and actual cash flow. Run five-year **bear/base/bull/moonshot per-share** scenarios with explicit capital investment, growth, dilution and terminal-multiple assumptions. No valuation conclusion without reconciled shares and liabilities.
5. Test durability of optical-connectivity demand, customer concentration, order conversion, capacity buildout and competitive threats using issuer filings and independently sourced material. High reported revenue growth does not imply a defensible moat.
6. Display **negative cash flow in red** and a visible "Growth versus funding" risk warning directly on the Conviction Lab summary even when other evidence gates are verified. Keep **INSUFFICIENT EVIDENCE** until risk/valuation gates actually pass.

AAOI is a useful **high-growth, capital-consuming stress test**, not a recommendation, and should help tune screening for investable high-upside suppliers without incorrectly rejecting *all* negative-FCF technology businesses. **P0 remains zero-ticker Autonomous Discovery**, with AAOI as a named test fixture for the broader survival/dilution work.

## Critical product gap: Conviction Lab must automatically complete the remaining seven research gates

User requested on October 15, 2026: **"Shouldn't these already be filled in?"** Yes—**when ATLAS is complete**, the app must autonomously research each eligible company from the tickerless pipeline through a defensible source-backed investment verdict. The user's manually choosing a ticker or writing thesis notes is supplemental, NOT the primary path. The currently missing boxes are **development/integration gaps**, not user homework and not necessarily negative attributes of the issuer. Preserve the option to return **INSUFFICIENT EVIDENCE** if trustworthy data cannot be found.

**Prioritized engineering order (P0; inside the existing workflow, no new cosmetic tab):**
1. **Market capitalization, float and liquidity:** reconcile current dated price with point-in-time actual issued/outstanding common shares, multiple classes, splits, share issuance, filings and exchange identity; use correct security-level liquidity. SEC `WeightedAverageNumberOfDilutedSharesOutstanding` is *not* point-in-time current shares. The current app has annual weighted-share history but does NOT have a validated market-cap engine.
2. **Survivability and dilution:** existing cash/debt/share-trend cards are partial evidence. Complete total debt and liabilities including convertibles/leases, debt maturities, covenant and liquidity constraints, working capital, quarterly cash flows, funding needs and issuance capacity. A missing `LongTermDebtCurrent`, `LongTermDebtNoncurrent` or `ShortTermBorrowings` tag is **NOT zero debt**. Evaluate capital consumption against cash reserves and future financing needs.
3. **Five-year per-share scenarios:** sourced fiscal starting point; bear, base, bull and remote moonshot revenue/margin/FCF/EV/per-share projections incorporating capital investment, debt, likely financing and future diluted shares. Display explicit assumptions, sensitivity, 100% loss downside and comparisons to the actual entry price. No arbitrary success probabilities or inflated expected returns.
4. **Mispricing hypothesis:** compare observable expectations implied by the current valuation to credible business trajectories, cite both supporting **and countervailing** evidence, and allow the model to conclude no bargain exists.
5. **Competitive and technological durability:** source physical bottlenecks, AI expansion dependencies, customers, moat, certification, switching costs, product obsolescence, demand/competitive threats and counterarguments.
6. **Institutional and VC relationship:** reuse the already built 13F and consensus pipelines **in Conviction Lab and tickerless discoveries**. Validate dated issuer-CUSIP matching, independently active manager families, filings/publication delays, fund-level passive mandates and IPO/VC historical backing; don't double-count affiliations or infer motive from ownership.
7. **Thesis versioning and monitoring:** automatic, source-attributed draft hypothesis/invalidation triggers, saved versions, filing/financial/price observations, re-evaluation after changed data and opt-in notifications; distinguish author-created notes (already work) from a fully connected monitoring engine (not built).

**AAOI stress case:** the user's real Conviction Lab displayed Applied Optoelectronics **+82.8% revenue growth** and **−$353.576M FCF after capex** (FY2025; numbers are app-reported and not yet reconciled to primary filing), cash **$6.389M**, **0/3 reported debt categories**, weighted diluted-share trend **+1.32%**, and indicative P/E missing. Strong sales growth and extreme cash consumption must trigger **visible funding-risk investigation**, even when a raw “4/11” readiness count has four checked sources. The cash figure alone and absent debt tags do not establish actual solvency or forecast runway; financing, earnings quality, financing cash flow and 10-Q updates need independent confirmation.

**UI clarification implemented as an incremental improvement (local build/test pending):**
- Every evidence gate shows **Source checked**, **Partial evidence**, **Automation pending** or **Source unavailable** (the latter means the presently required source value could not be verified, not that the issuer necessarily failed).
- The readiness numerator **4/11** is explicitly **evidence categories verified, not an investment score**.
- Growth with negative after-capex FCF gets a prominent red, reasoned **Growth with negative free cash flow** callout and a concrete research question, rather than a hidden footnote or a fabricated buy/avoid verdict.
- No gate falsely turns verified merely because a few annual observations are present. ATLAS must finish these modules to satisfy the zero-ticker product acceptance test.

**Definition of done for THIS bridge:** selecting an independently discovered company should trigger automated source collection and issuer-linked cross-system research that fills the seven evidence categories when reliably possible, accurately labels genuinely unavailable items, calculates dated per-share scenario valuations including dilution and downside, and may return zero viable investments. User must not be required to type market-cap, debt, competitor or manager data manually.

## October 15 — P0.B.1 dated market-cap and IEX liquidity evidence

**Status: first integrated research slice implemented; GitHub CI build and regression suite passed on commit 19c8929. Real credentialed local issuer/market-source validation remains outstanding. This does not complete P0.B or turn the market-cap evidence gate green.**

- The existing SEC companyfacts response now reads `dei.EntityCommonStockSharesOutstanding` in **shares**, as dated **instant** observations from 10-K/10-Q filings with validated filing dates, report end dates and SEC accessions. These are separate from annual **weighted-average diluted shares**, which remain unsuitable as a current capitalization denominator. Malformed, undated or untraceable observations are rejected.
- The completed-Alpaca-IEX valuation endpoint now includes a distinct **20 completed-session IEX-only average share volume and dollar turnover** when coverage is complete. The current day is excluded. These are *one-venue observed data*, not consolidated trading volume, bid-ask spread, tradable float or proof of liquidity.
- `src/market-cap-evidence.ts` aligns eligible filed DEI observations with a **same-ticker completed close**. It blocks future/publication-leaking facts, stale prices, share dates more than 135 days old and contradictory share counts in one filing. Where eligible, it shows a labeled **indicative equity value = historical reported DEI shares × raw IEX close**, together with each date, original SEC source, unverified split/class warning, and observed IEX coverage.
- `MarketCapEvidencePanel` appears **automatically** in both tickerless Autonomous Discovery leads and ticker-based Conviction Lab. The corresponding readiness gate can progress from **Automation pending** to **Partial evidence**, but continues to be marked **missing**; it cannot contribute to the 11 verified evidence categories or upgrade `INSUFFICIENT EVIDENCE`.
- Regression tests check no substitution of FY diluted share averages, filing-after-price exclusion, duplicate and conflicting share counts, stale timestamps, missing IEX coverage, and unchanged investment-evidence verdicts. Successful CI checks alone cannot establish that any given issuer has a reconciled tradable security or accurate market cap.

**Next for P0.B.2:** independently map all common share classes and securities, confirm dated shares outstanding and current issuer disclosures, reconcile splits/convertibles/ADS ratios/corporate actions, verify exchange listing and security identity, and add consolidated trading volume, float, spread and liquidity analysis. Only then may ATLAS consider upgrading its market-cap and liquidity evidence gate. Continue toward P0.C survival/debt and four-scenario per-share analysis.
