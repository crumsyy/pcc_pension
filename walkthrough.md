# Walkthrough — Dashboard stat cards: rename + dedupe

## Changes (`ReceptionistDashboardClient.js` only)
- `ACTIVE RESERV.` → `ROOMS RESERVED` (count unchanged).
- Removed redundant `ACTIVE STAYS` card; kept `ROOMS OCCUPIED`. Removed now-unused `totalCheckIns` destructure.
- Grid `col-xl-2` → `col-xl`: 5 cards fill the row evenly (xs/md behavior unchanged).
- Server snapshot/API untouched (`totalCheckIns` still sent, ignored by client).

## Verification
- `grep`: no stat-card `Active Stays`/`Active Reserv.`/`totalCheckIns`/`col-xl-2` remain (section header “Active Reservations & Courtesy Holds” below is a different element, left as-is).
- `eslint`: clean. `npm run build`: exit 0.

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
