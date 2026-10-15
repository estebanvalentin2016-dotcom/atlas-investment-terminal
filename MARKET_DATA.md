# ATLAS v0.7 Daily Momentum (draft)

This feature uses the **free Alpaca Basic IEX market data feed**, not Yahoo Finance scraping. It retrieves recent daily price/volume bars and provides a direct **Yahoo Finance** chart link for cross-checking. The free IEX feed is a **single-exchange subset**, not consolidated US exchange prices and volume. Recent/current-session values may be incomplete or delayed.

## Setup (Windows)

1. Create a free Alpaca account if eligible and obtain market-data API key credentials. Check the provider's current free-plan limits and terms.
2. In your existing local `.env` file (never commit it), add:
   ```text
   ALPACA_API_KEY_ID="your-key"
   ALPACA_API_SECRET_KEY="your-secret"
   ```
3. Restart `npm.cmd run dev`. Open **Daily Momentum** and enter a US ticker.

The app reports 1/3/5-session price returns, whole-session relative volume compared to the preceding 20 bars, and percentage below the 20-session high. Figures depend on available raw/unadjusted IEX bars and may differ from consolidated Yahoo Finance data. Corporate actions and partial days can distort measurements. This version does not join market sessions to SEC events, detect repeatable profitable trading rules, stream data, or execute trades. An error is shown if credentials or data are unavailable; there is no fictional fallback.

## Tests and release

Run `npm.cmd run build` and `npm.cmd run test`; 34 tests are expected. Test a real ticker in the browser, confirm source and dates, and open the Yahoo chart link. **Do not merge before verification.** v0.7 builds on v0.6; merge v0.6 first before changing this PR's base to `main`.
