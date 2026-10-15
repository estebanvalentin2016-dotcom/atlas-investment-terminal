# ATLAS Investment Research Terminal

A working, browser-based investment research prototype built with React, TypeScript, and Vite.

**Current stable release: v0.2 SEC Research preview.** The original Overview, Screener, Company Research, Valuation Lab, and Watchlist screens still use entirely fictional demo companies and prices. Only SEC Research loads genuine SEC-reported annual financial facts. There are no live stock quotes. See [SEC_RESEARCH.md](SEC_RESEARCH.md). The v0.3 branch introduces two-company comparison.

## Quick start

1. Install Node.js 20.19+ or 22.12+ from https://nodejs.org/.
2. Open a terminal inside this folder.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open the local address printed in the terminal (typically http://localhost:5173).

## What works today

- **Overview:** summary metrics and ranked opportunity ideas.
- **Screener:** search, sector filter, growth/P/E/free-cash-flow-margin filters, sortable results, CSV export.
- **Company research:** sample trend, fundamentals, an editable investment thesis.
- **Valuation lab:** compound revenue, model future earnings, exit P/E, share dilution, implied share price, total return and CAGR; generated bear/base/bull scenarios.
- **Watchlist:** save/remove companies and revisit your research.
- **Local persistence:** investment notes, watchlist, and valuation assumptions use browser `localStorage`.
- **Responsive layout:** desktop and mobile screens.
- **SEC Research:** real annual financial statements and calculated financial trends with SEC source links (requires a local `.env` SEC contact identifier).
- **Automated tests:** core financial model, SEC parser, and financial insights with Vitest.

## Commands

`npm run dev` — development server

`npm run build` — type-check and production build

`npm run preview` — preview production build

`npm run test` — tests

## Financial calculation

```
future_revenue = current_revenue * (1 + annual_growth)^years
future_earnings = future_revenue * terminal_profit_margin
future_market_cap = future_earnings * exit_PE
future_share_count_ratio = (1 + annual_dilution)^years
implied_share_price = current_price * future_market_cap / current_market_cap / future_share_count_ratio
price_return = implied_share_price / current_price - 1
annualized_return = (implied_share_price / current_price)^(1 / years) - 1
```

No dividends, buybacks, changing debt/cash balances, changes to accounting standards, inflation adjustment, taxes, or interim discount rates are modeled. The user's profit margin assumption is treated as the terminal margin at the final year. For a real application, models need more rigorous accounting/valuation detail, input validation, historical data checks and regression tests.

## Safeguards and constraints

- All data is fictional and identified prominently as such.
- The opportunity score is an illustrative formula: 40% growth, 35% quality, 25% valuation. It is neither statistically validated nor a prediction of stock appreciation.
- Local browser data can disappear if you clear storage or move to another browser; this is not cloud backup.
- This prototype does **not** execute trades or give personalized investment advice.
- Do not place market-data API secrets in frontend environment variables. Use a separate backend and keep secrets server-side.

## Getting it onto GitHub

1. Create a new **private** GitHub repository, e.g. `atlas-investment-terminal`, without pre-populating it.
2. In the project folder, run:

```
git init
git add .
git commit -m "Initial ATLAS demo"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/atlas-investment-terminal.git
git push -u origin main
```

GitHub may ask you to authenticate using a credential manager, a personal access token or GitHub CLI, rather than your account password.

## Roadmap

See `FEATURES.md`, `ARCHITECTURE.md`, and `AI_CONTEXT.md`.
