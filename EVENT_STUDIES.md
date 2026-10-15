# ATLAS v0.9 Event Study Foundation

This initial increment only adds a **pure calculation module and tests**, not a live event-study dashboard or a production trading strategy.

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
