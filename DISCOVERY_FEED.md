# ATLAS v0.5 Discovery Feed (draft)

The **Discovery Feed** page searches Crossref's public publication metadata API through the existing local Vite Node middleware. Enter a technology keyword or phrase and click Find publications. Results include the title, publication date where supplied, venue, document type and DOI link. Crossref may return unrelated or incomplete records. This is **not a breakthrough detector**, relevance model, fact-checker, stock screener, patent system, or evidence of company commercial traction.

Network access is required; outages and invalid responses are shown as errors. Nothing synthetic is substituted. No API keys are stored in the frontend. Search is on demand only, not recurring monitoring. Results are not saved or linked to the manual journal yet.

Before merging, run `npm.cmd run build`, `npm.cmd run test`, and `npm.cmd run dev`; then use Discovery Feed to search `photonic computing` and inspect a DOI link. Verify errors do not display sample data. Keep the PR in draft until tested.
