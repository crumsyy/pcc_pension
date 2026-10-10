# Walkthrough — Archived Side-by-Side, Emoji-Free (no commit/push yet)

## Changes (`app/admin/discounts/page.js` only)
- Headings: "📦 Archived Discounts" → "Archived Discounts", "📦 Archived Promos" → "Archived Promos".
- Archived tab: both sections wrapped in a fixed-height `row` (`max(480px, calc(100dvh - 340px))`), each in `col-12 col-lg-6` (stacked below `lg`); cards `h-100 d-flex flex-column`; table areas `flex: 1` with internal scroll; each pagination pinned via `mt-auto`. Active Discounts/Promos tabs keep the exact previous full-width layout (conditionals only alter classes in archived mode).
- Untouched: columns, data, pagination logic, filters, restore/edit actions, theme.

## Verification (actually performed)
- `npx eslint`: 3 problems, same pre-existing set (line-180 effect rule). `npm run build`: 97/97 (proves JSX balances).
- Staging visual check needed (half-width fit of the 7-col promos table varies by screen).

Say `"push"` only when you want commit + push.
