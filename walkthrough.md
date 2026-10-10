# Walkthrough — Discounts/Promos Label Cleanup (no commit/push yet)

## Changes (`app/admin/discounts/page.js` only, 3 strings)
- Tabs: "Active Discounts" → "Discounts", "Active Promos" → "Promos" (tab ids and logic untouched; Archived tab untouched).
- Headings: "🏷 Discounts" → "Discounts", "🔥 Promotions" → "Promotions" (archived 📦 variants kept per your choice).

## Verification (actually performed)
- `npx eslint`: 3 problems before = 3 after (pre-existing). `npm run build`: 97/97.

Say `"push"` only when you want commit + push.
