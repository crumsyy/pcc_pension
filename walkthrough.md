# Walkthrough — Products/Meals Image Placeholder (no commit/push yet)

## Change (`app/admin/products/page.js` only, 1 block)
- Items without an uploaded image now show an inline-SVG grey image-unavailable glyph (rounded frame + sun + mountains, unique clip-path id per row) in the same 36×36 box — replaces the 🍳/🥤 emoji for both Products and Cooked Meals tabs. Uploaded images, layout, and amenities untouched.

## Verification (actually performed)
- `npx eslint`: 5 problems before = 5 after (pre-existing). `npm run build`: 97/97.

Say `"push"` only when you want commit + push.
