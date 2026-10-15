# v0.10 Opportunity Radar — first discovery increment

ATLAS opens on an automatic recent 8-K review queue. It calls the existing SEC endpoint sequentially for eight predefined liquid-company tickers (CRWD, NVDA, MSFT, AMZN, META, GOOGL, PLTR, AVGO) and shows source-linked, timezone-aware recent 2.02 earnings / 1.01 material agreement disclosures from the prior fourteen days. Earnings come first only as a **research-review priority**, never a bullishness score or profit forecast. Failed sources are surfaced, not replaced with fake data. The queue auto-populates when the screen opens and can be manually refreshed.

**Not yet included:** validated positive fundamentals, extracted guidance surprises, source-matched initial public news, current market quotes/remaining-upside estimates, overnight venue validation, multi-market expansion, background scanning, or automatic trading. The queue currently surfaces **leads**, not verified opportunities. Those are the next increments needed to satisfy the actual research objective.

This branch starts from the previously tested v0.9 branch while v0.9 remains unmerged. `npm.cmd run build` and `npm.cmd run test` must be run locally before any merge. The existing demo pages remain fictional.
