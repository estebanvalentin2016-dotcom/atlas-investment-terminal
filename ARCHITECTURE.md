# Architecture

## Stack
- React 18 + TypeScript, Vite.
- Lucide icons, native SVG for illustrative charts.
- Styling with plain responsive CSS.
- No backend or API keys in v0.1.

## Files
- `src/App.tsx`: screens, navigation, interactions, storage, CSV export.
- `src/model.ts`: fictional demo companies, scoring, valuation functions.
- `src/model.test.ts`: financial-model unit tests.
- `src/styles.css`: visual system and responsive design.

## Storage
`localStorage`: `atlas.watch`, `atlas.notes`, `atlas.val`. Browser-only, unencrypted, suitable for nonsensitive notes only. The app makes no account or server claims.

## Real-data evolution
Introduce a backend with provider-licensed market feeds, explicit data freshness timestamps, per-field source metadata, caching, provider error handling, and an authenticated datastore. Never silently replace source failures with made-up values. Add server-side API key handling, CI checks, and robust tests. Prefer regulatory filings (SEC EDGAR) as the baseline for public financial disclosures; market quotations require appropriate authorized feeds.

## Product boundary
Screening ranks *research candidates* only. It must not suggest that formulas prove undervaluation or future performance. Any future AI summaries should link to source documents, attribute every numerical value, and distinguish historical actuals from analyst estimates and model assumptions.
