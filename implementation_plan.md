# Implementation Plan — Discounts/Promos Label Cleanup

## 1. Sites (all in `app/admin/discounts/page.js`)
1. Line 542-543: `<Tab id="active_discounts">Active Discounts</Tab>` → `Discounts`; `<Tab id="active_promos">Active Promos</Tab>` → `Promos` (ids unchanged, so tab logic untouched; Archived tab untouched).
2. Line 585: `'🏷 Discounts'` → `'Discounts'` (archived variant `'📦 Archived Discounts'` left as-is — not requested).
3. Line 639: `'🔥 Promotions'` → `'Promotions'` (archived `'📦 Archived Promos'` left as-is).

## 2. Verify
- `npx eslint` (stash-compared) + `npm run build`; visual staging check.
- Commit/push only on `"push"`.

## 3. Questions
1. Also strip 📦 from the two archived headings for consistency, or leave them?
2. Proceed?
