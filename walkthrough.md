# Walkthrough — Amenities Placeholder Icon (no commit/push yet)

## Change (`app/admin/amenities/page.js` only, 1 block)
- Items without an uploaded image now show a muted grey `bi-box-seam` package icon in the same 36×36 rounded box (was 🛎️ emoji). Uploaded images, layout, and products fallbacks untouched. If you later upload the exact icon file, it's a one-line swap.

## Verification (actually performed)
- `npx eslint`: 5 problems before = 5 after (pre-existing). `npm run build`: 97/97.

Say `"push"` only when you want commit + push.
