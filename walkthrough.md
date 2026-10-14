# Walkthrough — Guest Home reskin (pilot)

## Changes (presentational only, no logic/API)
- `globals.css`: shape/elevation/status-tint tokens; hero glow + Fraunces headline; eyebrow, metric-tile, quick-action-tile, room-card, price-pill classes with dark-mode pairs.
- `GuestDashboardClient.js` (Home only + one shared Details button): icon-led metric tiles (balance red/green by state), eyebrow section headers, icon quick-action tiles (My Bookings/Details no longer render red from the global secondary rule), price pills, 16px room cards.

## Verification
- `npm run build` → success.
- Manual: light + dark, 375px + desktop; all Home actions identical behavior.
