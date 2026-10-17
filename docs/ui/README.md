# Workspace UI review images

Captured against the production build in Chromium at 1440px (desktop) and 390px (mobile). Watchlist/company records and unavailable API responses are explicit UI fixtures, not live financial data. The app itself has no synthetic fallback. Human visual approval and successful live-provider checks remain outstanding.

- [Home, desktop](home-desktop.png)
- [Home, mobile](home-mobile.png)
- [Watchlist, desktop](watchlist-desktop.png)
- [Watchlist, mobile](watchlist-mobile.png)
- [Discover, mobile](discover-mobile.png)
- [Research, desktop](research-desktop.png)

The production browser run passed 166 checks across 1440, 768, 390 and 320px viewports with no horizontal overflow or runtime errors. See UI_CONSOLIDATION.md and scripts/ui-workspace-smoke.mjs for the inventory and reproduction instructions.
