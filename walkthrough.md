# Walkthrough — Suspend Title + Amenities Placeholder (no commit/push yet)

## Changes
- `app/admin/users/UsersClient.js`: suspend modal title without the warning emoji.
- `app/admin/amenities/page.js`: no-image fallback is now the same inline-SVG image-unavailable glyph as products (unique clip-path id per row, same 36×36 box). Uploaded images and layout untouched.

## Verification (actually performed)
- `npx eslint`: 7 problems before = 7 after (pre-existing). `npm run build`: 97/97.

Say `"push"` only when you want commit + push.
