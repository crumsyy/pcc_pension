# Implementation Plan — Suspend Emoji Off, Amenities SVG Placeholder

## 1. Changes (2 small, independent)
1. **`app/admin/users/UsersClient.js:971`**: modal title `⚠️ Suspend User Account` → `Suspend User Account`.
2. **`app/admin/amenities/page.js:441-447`**: replace the `bi-box-seam` fallback box with the same inline-SVG image-unavailable glyph used in products (rounded frame + sun + mountains, unique clip-path id per row, e.g. `noimg-amenity-{amenityID}`), same 36×36 box. Uploaded images and layout untouched.

## 2. Verify
- `npx eslint` on both files (stash-compared) + `npm run build`; staging visual check of both spots.
- Commit/push only on `"push"`.
