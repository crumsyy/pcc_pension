# Walkthrough — Discount/Promo Modal UX Overhaul (no commit/push yet)

## Changes (`app/admin/discounts/page.js` + its API route only)
- **Hierarchy**: Identity (1) / Value (2) / Rules & Eligibility (3) sections in both discount modals; Identity / Applicability / Validity in both promo modals. Labels, order, and buttons otherwise unchanged.
- **Explainer**: live "How this works" box per eligibility + plain-meaning option labels ("ID-Based — name + ID required", etc.); promo room-limit one-liner + end-date hint.
- **Toasts**: all create/update/archive/restore completions and validation/API errors now call shadcn `toast.success`/`toast.error` directly with specific titles (same system as before, clearer titles). Confirms stay as dialogs.
- **Promo validation**: client 1–100 + server shared validator (1–100, real dates, end ≥ start). No logic changes beyond validation.

## Verification (actually performed)
- `npx eslint`: 3 problems before = 3 after (pre-existing). `npm run build`: 97/97.

Say `"push"` only when you want commit + push.
