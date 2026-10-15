# ATLAS v0.9 Event Study Foundation

This increment adds a **pure calculation module, tests, and SEC acceptance timestamp display**, not a live event-study dashboard or a production trading strategy.

- SEC 8-K results now carry `acceptedAt` when the submissions feed supplies an explicit timezone-aware timestamp; otherwise they explicitly carry `null`. The Catalyst Radar screen displays this field with clear provenance.
- `easternClock`: Converts SEC acceptance timestamps with an explicit timezone into America/New_York local date and time, accounting for daylight saving time.
- `alignEvent`: Associates an accepted event with a subsequent available daily market bar using a 4 p.m. ET cutoff. A filing at/after 4 p.m. uses the next available daily session. This is a **simplifying convention**; it does not establish actual public dissemination time or an executable price.
- `eventStudy`: Calculates descriptive price changes for the first, third and fifth event-window daily closes compared with the preceding available close, when all relevant sessions exist.

### Important limitations
- SEC accepted timestamps are **not necessarily when market participants learned the information**. Filing publication can lag acceptance, and an event may have been announced elsewhere first.
- A filing before 4 p.m. can be published during an active session; the prior session close is a research baseline, **not an executable pre-announcement price**. Same-day pricing may include pre-announcement moves.
- Inputs must be **completed**, chronological, properly adjusted daily bars on actual trading dates. The current market API returns raw IEX bars and may include partial sessions; **do not pass it directly to this module for real performance conclusions**.
- This module does not forecast returns, analyze causality or provide trade signals.
- Next increment: enrich SEC results with acceptance timestamps, confirm completed-session and adjustment policy, then integrate the engine into a UI with provenance and explicit data-quality flags.

Run `npm.cmd run build` and `npm.cmd run test` on Windows before merging.

### First on-demand integration
- Catalyst Radar now offers **Analyze price reaction** on filings with SEC acceptance timestamps. The event window uses the **Eastern acceptance date**, not the often-different filing date.
- The new `/api/market/event` endpoint requests a bounded event-centered window from free Alpaca **IEX**, with `adjustment=split`, and excludes the current Eastern trading date entirely. It intentionally rejects event dates older than 180 calendar days and will label older 8-Ks unavailable.
- 1/3/5-session results measure the close of each eligible session relative to the pre-event reference close. These are **not investable entry-to-exit returns**, and do not establish the event's causal effect. An intraday filing may have already been reflected in that reference.
- The endpoint does not paginate. A provider continuation token prevents the browser from presenting incomplete results.
- The project still needs provider data checks, real-market spot checks and more comprehensive event-window test cases before treating results as quantitatively reliable.


### Intraday high/low excursion ranges (research-only)
The event study now also displays the highest `high` and lowest `low` recorded over each fully observed 1-, 3-, and 5-session window, as percentages of the pre-event reference **close**. Missing or invalid OHLC bars and incomplete horizons produce N/A rather than invented results.

These values describe the price range following a filing; they are **not** a backtested trading strategy's maximum favorable/adverse excursion (MFE/MAE). Actual MFE/MAE require an explicitly defined tradable entry time/price, side (long or short), position and exit rules. The ordering of the high and low inside a daily bar is also unknown. Do not assume either extreme was achievable or that an SEC filing caused it.

### Post-initial-reaction continuation
The UI separates two questions: (1) **cumulative reaction** from the pre-event close to session 1/3/5 closes; and (2) **continuation** from the first eligible session's close to the session 3 and 5 closes. Continuation uses `laterClose / firstSessionClose - 1`, not subtraction or addition of percentages. This distinction helps identify whether a large initial gap was sustained; it does **not** establish a realistically executable entry, after-hours access, trading friction or causality. A complete horizon is required, otherwise N/A.
