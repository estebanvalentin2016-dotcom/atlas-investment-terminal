# ATLAS v0.6 Catalyst Radar (draft)

**What it does:** A user-initiated lookup of SEC 8-K and amended 8-K filing metadata for a selected US ticker. Labels come from SEC item numbers (such as 2.02 results of operations), not independent reading of the filing or bullish/bearish sentiment analysis. Click through to the original filing and inspect context.

**Manual momentum worksheet:** Input earlier/later closes, a completed session's volume, and comparable average session volume; ATLAS computes return and RVOL. Values are entirely user supplied. No delayed or live market data feed is connected, and the worksheet does not associate a filing automatically with price dates. Results are not trading signals.

**Limitations:** On-demand polling only; not instant alerts, not all corporate news, and no streaming trade data. Filing dates are not precise publication timestamps. SEC submission `filings.recent` is a limited portion of a company's submission history, and 8-K item classifications don't establish significance, direction, or surprise. Free data may be delayed, incomplete or inaccessible. Shorting introduces significant risks including unlimited potential losses.

**Development dependency:** v0.6 is branched off the **unmerged v0.5** feature. Merge v0.5 to `main` before merging this PR. Then test `npm.cmd run build`, `npm.cmd run test` (29 expected), `npm.cmd run dev`, and check Catalyst Radar for a known public company ticker. Verify filing links and the manual momentum calculations. Do not merge until reviewed.
