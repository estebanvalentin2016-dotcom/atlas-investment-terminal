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
