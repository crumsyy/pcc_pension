# Implementation Plan — Amenities Placeholder Icon

## 1. Current state
`app/admin/amenities/page.js:441-447`: items without an uploaded image show a 🛎️ emoji in a 36×36 grey rounded box. No placeholder asset exists in `public/`. (Products fallbacks 🍳/🥤 untouched — not requested.)

## 2. Proposal (no exact asset file available — your Image 3 is a low-res screenshot, not an uploadable file)
- Replace the 🛎️ emoji with a built-in Bootstrap icon in the same 36×36 grey box: `bi-box-seam` (generic product/package glyph, muted grey — closest built-in match to your toiletries reference, theme-safe, no emoji, zero new binaries).
- Fallback chain stays: uploaded `item.image` → placeholder box. Same size, radius, alignment — no layout shift.
- If you upload the exact icon file later, wiring it is a one-line swap (`/assets/images/amenity-placeholder.png` with the icon as final fallback) — say so anytime.

## 3. Verify
- `npx eslint` (stash-compared) + `npm run build`; staging visual check of the amenities table.
- Commit/push only on `"push"`.

## 4. Questions
1. Built-in grey package icon now (Recommended) vs you upload the exact file first?
2. Proceed?
