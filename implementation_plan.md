# Implementation Plan — Products/Meals Image-Unavailable Placeholder

## 1. Current state
`app/admin/products/page.js:508-514`: items without `p.image` show 🍳 (meals) / 🥤 (products) emoji in the 36×36 box. (Amenities uses the grey package icon from the last change — untouched.)

## 2. Proposal (no binary available — your reference is a screenshot, so I recreate it)
- Inline SVG replica of the grey image-unavailable glyph (rounded frame + sun + mountains, muted greys) at the same 36×36 size, replacing the emoji branch. Pure JSX/SVG: no new files, no layout shift, readable in light and dark mode.
- Fallback chain stays: uploaded `p.image` → placeholder. Applies to both Products and Cooked Meals tabs (shared cell).

## 3. Verify
- `npx eslint` (stash-compared) + `npm run build`; staging visual check.
- Commit/push only on `"push"`.

## 4. Questions
1. Inline SVG replica (Recommended) vs you upload the exact PNG file first?
2. Also switch Amenities to this same placeholder for consistency, or leave its package icon?
3. Proceed?
