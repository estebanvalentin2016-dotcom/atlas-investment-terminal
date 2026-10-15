# ATLAS v0.8 Momentum Scanner (draft)

Use **Momentum Scanner** to check up to eight ticker symbols in sequence using the same optional free Alpaca IEX daily-data configuration as v0.7. The scanner displays 1/3/5-session returns, whole-session relative volume, and distance below the 20-session high. It labels potential bullish follow-through when all returns are positive, relative volume is at least 1.5×, and the closing price is within 5% of the 20-session high. Bearish follow-through requires all three returns negative and RVOL at least 1.5×. These are **untested screening heuristics**, not evidence of a profitable trading strategy or trading recommendations.

Data limitations: only IEX, not consolidated market data; raw unadjusted daily prices; latest bars could be incomplete; available history is limited. Source retrieval times and session dates are shown. No background scanning, news-to-price joining, broker orders or proprietary Yahoo Finance scraping. Requires your existing Alpaca keys in local `.env`, never in GitHub.

Before merging: build with `npm.cmd run build`, run `npm.cmd run test` (39 tests expected), launch `npm.cmd run dev`, and scan a few familiar tickers. Confirm each returned ticker has distinct values and Yahoo links work. This branch stacks on v0.7; don't merge into main until prior stacked PRs are merged or reconciled.
