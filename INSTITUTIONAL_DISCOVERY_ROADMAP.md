# ATLAS — Institutional Discovery / VC-Backed Public Companies
Status: **Planned / not yet implemented**. Build after current automatic P/E, live company search/watchlist, keyword Discovery Feed, and timestamp-provenance changes pass local validation.

## Research goal
**Follow proven institutional capital; assess remaining public-market upside independently.** Locate companies backed by major venture capital and deep-tech funds that subsequently became publicly traded, identify any genuinely current publicly reportable positions, and investigate whether public investors still have credible 3x–5x or higher *hypothetical* upside over a five-year horizon. Avoid “VC invested” as a buy signal. The user is willing to forgo bottom timing and early private-round returns in exchange for more evidence of commercial execution and meaningful upside.

## Three distinct records — never merge
1. **Historical venture backing** — Official venture firm portfolio entries, issuer IPO prospectuses (S-1/F-1), disclosed pre-IPO shareholders, financing releases, or other source-cited records. Label investor, portfolio company, investment type, approximate disclosed date, and citation. Being listed on a firm's portfolio page does not establish a *current* holding or entry price.
2. **Current disclosed public-market holdings** — Relevant filings such as 13F-HR, 13F-NT (notice rather than a complete holdings report; follow linked managers), Schedule 13D / 13G and amendments, proxy statements, and current 10-K/10-Q disclosures where applicable. Store filing date, as-of date, manager/entity, shares/security type, accession/source URL, amendments, known holding status, and coverage limits. 13F does not disclose private stakes and often reports with substantial lag; 13D/13G have thresholds and exemptions. No filing means *unknown*, not proof of zero shares.
3. **Public-market remaining upside** — Current verified market cap, earnings/FCF/operating metrics, sector-relevant valuation, balance-sheet survival, dilution, commercialization/retention, competitive durability, and realistic independently justified future scenarios. The VC's early entry return is *not* the public shareholder return.

## Start with researched investors, not a fictitious complete institutional universe
Research seeds: Sequoia Capital, Andreessen Horowitz, Founders Fund, Khosla Ventures, and Lux Capital. Not endorsements or assumptions of live positions.
- Discover publicly disclosed holdings and normalize manager/entity relationships, including Form 13F notice-reporting and associated funds.
- Cross-reference issuer SEC CIK, ticker, share class, corporate actions, IPO date, and current ticker status. Require evidence before linking similar names.
- Identify consensus among independently established investors only when ownership records and dates are compatible; never count multiple affiliated funds as wholly independent endorsements.
- Track exits and reductions conservatively: stale 13F, manager notices, transfers between fund entities, confidential treatments, and ownership percentages can make records incomplete.

## Candidate workflow
**Who backed it?** → **Has the business proven meaningful commercial traction?** → **What is the public-market entry valuation?** → **How much dilution/financing/exit-overhang risk remains?** → **What specifically supports a five-year 3x–5x scenario?**

Scores are separate, with source links:
- Institutional backing confidence and recency (not a quality guarantee)
- Commercial validation (revenue, gross profit/FCF, paying customers, runway, regulatory/technical milestones)
- Valuation headroom / remaining upside (financial scenarios, sector peers, shares outstanding)
- Capital structure / downside (burn, debt, dilution, pending unlocks, fund ownership concentration and potential selling)

Never claim a historical VC gain based purely on private round company valuation; valuation history, dilution, ownership and exit timing often differ. Model a public investor's own cost basis and future diluted per-share value. Illustrate 3x, 5x, 10x and remote 100x outcomes as scenarios, not forecasts.

## Integration with current ATLAS
- New **Institutional Discovery** page / filter in the existing Discovery Feed or separate sidebar tab when production-ready.
- Search investors and tickers, show **Historical VC-backed** vs **Latest disclosed position** as different fields with dates and sources.
- One-click **Research in Company Research**, **Save to real Watchlist**, **Compare SEC financials**, and **Open Moonshot Infrastructure analysis**.
- Filter by infrastructure exposure and technological durability, issuer age/public-listing history, market capitalization, verified cash runway, and current reportable equity ownership.
- Visual hierarchy: readable metrics, green/red *factual directional changes*, collapse detailed filings. Display **Unknown** whenever ownership, source, or return scenario inputs are not validated.

## Technical implementation milestones
1. SEC reporting-manager identifier and 13F pipeline: extract 13F-HR infotable XML, map CUSIP to a verified listed issuer/ticker (nontrivial), and follow 13F-NT related managers. Record original date and reporting period; flag delayed data.
2. Beneficial ownership/IPO disclosures: parse Schedule 13D/13G, amendments, S-1 selling-stockholder ownership tables and issuer corporate actions conservatively.
3. Portfolio-source indexing: only authoritative VC pages and auditable sources; match with issuer tickers and public listing dates, with clear confidence grading.
4. Combine with the existing SEC company fundamentals, price, cash-flow, diluted EPS, watchlist and Moonshot Infrastructure roadmap.
5. Add attribution and recency audits; simulate user-cost-basis return scenarios under future share issuance.
6. Validate on well-sourced positive and deliberately misleading examples: name ambiguity, fund affiliate duplicate, historical exited holding, stale 13F and manager-notice-only position.

## Investment research safety
No automatic trading. 13F is usually a delayed snapshot of reportable securities, not “everything a publicly traded firm owns.” VC firm public/private status is not sufficient to infer mandatory comprehensive disclosures. Newly public VC-backed stocks may have extreme concentration, lockup, thin liquidity, overhang or continued funding needs; the firm's success does not necessarily become a public investor's gain.
