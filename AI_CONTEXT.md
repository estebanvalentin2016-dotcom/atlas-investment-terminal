# Context for the next AI development session

The owner wants to build a Bloomberg-inspired investment research terminal designed to identify and evaluate high-upside publicly traded companies. The owner is not highly technical. Speak plainly, give exact commands and practical deliverables. The product should prioritize financial research quality over decorative data.

Current app is ATLAS v0.1, a Vite/React/TypeScript SPA with no backend. The eight example companies, every price and every financial metric are **fictional**. Do not describe any output as real or live. Read README, ARCHITECTURE, FEATURES, CHANGELOG, and current code before changing it.

Do not overwrite or break functioning screens. Preserve the investment model's correct treatment of share dilution, distinguish market cap from share price, and maintain tests. Do not disclose third-party API secrets in browser code. Build/test whenever dependencies/environment allow, and note precisely what was or was not tested. Record meaningful changes in CHANGELOG and FEATURES. Use Git to checkpoint work.

Suggested next task: introduce a secure API backend for licensed live company financial statements and historical pricing, with visible source/time metadata, a robust unavailable-data state, and test coverage. Real-data API integration should be configured only once the owner chooses a provider.
