# ATLAS v0.2 SEC Research (preview)

A new **SEC Research** tab looks up real US company annual reports using the US Securities and Exchange Commission's public company facts endpoint. It is separate from the fictional v0.1 screener and valuation screens. It does **not** provide real-time prices, multiples, scores, or buy recommendations.

## How to run on Windows

1. In GitHub Desktop, after the feature branch is merged, choose **Repository → Pull** (or **Fetch origin**, then Pull).
2. Open PowerShell in the project's local repository folder.
3. Run `npm.cmd install`.
4. Create a file named `.env` next to `package.json` and add:
   `SEC_USER_AGENT="ATLAS Research your-real-email@example.com"`
   Replace with a real contact email. SEC asks automated clients to identify themselves. **Do not upload your .env file to GitHub.**
5. Restart the development server with `npm.cmd run dev`.
6. Open the app's **SEC Research** tab, enter a ticker like CRWD, and press **Fetch company filings**.

The Node/Vite development server calls the SEC. Your browser calls only your local `/api/sec/company` route. No API key is necessary. It caches requests for 30 minutes and only fetches data on your explicit request. The server must be running; opening the built index.html file directly will not work. Vite preview supports this endpoint too, but deploying static dist files alone will **not** supply the API.

## Limitations

- This is a **preview feature**, not yet production-reviewed. Validate locally before merging to main.
- Only SEC company tickers and annual US-GAAP standardized facts are supported. Missing tags return unavailable instead of fabricated values.
- Annual revenue, net income, operating cash flow and total assets are provided where standardized tags exist; definitions and fiscal years vary. Revenue supports several consolidated US-GAAP tags and reconciles available fiscal years without adding different tags together. It does not yet support unrecognized company-specific extensions. If CRWD revenue still reads 'unavailable', we will inspect the source tagging rather than invent a number. Company-specific XBRL tags, non-US GAAP, shares, price data, trailing twelve months and quarter comparisons are not supported yet.
- Reported historical data may include amended filings or restatements. The app displays filing dates.
- SEC endpoints may throttle or be temporarily unavailable. No mock fallbacks are shown in the real-data tab.
- The current `/api/sec/company` is a local-development proxy only. Any public production deployment requires a dedicated backend with rate limiting, caching, validation, monitoring, appropriate source attribution, and legal/licensing review.
- `SEC_USER_AGENT` stays on the server; never use `VITE_` for confidential settings.

Run `npm.cmd run build` and `npm.cmd run test` to validate on your machine.

## Automated insights

The SEC Research tab now calculates year-over-year revenue growth, three-year revenue CAGR, net income margin, and operating cash flow divided by revenue. Missing or unmatched fiscal periods display N/A. It also charts reported values by fiscal year. These are calculated analytics rather than SEC-reported ratios, and operating cash flow is not free cash flow.

## v0.3 company comparison preview

Select **SEC Research → Compare companies** and enter two tickers such as CRWD and PANW. ATLAS requests each company separately, shows financial figures side by side, and displays filing period ends and source links. Different fiscal calendars make exact numerical comparison imperfect; no estimates or synthetic data fill gaps. Test this in the v0.3 feature branch before merging. No live stock-price comparison is included.
