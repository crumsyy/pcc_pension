# Walkthrough — Fixed Fit-to-Screen Inventory Tables (no commit/push yet)

## Changes (`app/admin/inventory/page.js` only)
- Reverted `pcc-page-natural`: page is back in the exact-fit shell — no page scroll.
- Dashboard Recent Stock Movements: fixed scroll area `max(320px, calc(100dvh - 440px))` with sticky header; pagination pinned below inside the card.
- Movement Logs: row fixed at `max(420px, calc(100dvh - 380px))`; both tables `flex: 1` with internal scroll so both cards reach the viewport bottom; paginations pinned at card bottoms via existing `mt-auto`.
- Untouched: columns, data, page sizes, filters, theme, shell CSS.

## Verification (actually performed)
- `npx eslint`: clean, no findings. `npm run build`: Compiled successfully, 97/97.
- Staging visual check still needed (exact fit varies by screen height; floors guard short screens).

Say `"push"` only when you want commit + push.
