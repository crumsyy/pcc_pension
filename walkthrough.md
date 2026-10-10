# Walkthrough — Recent Stock Movements Fits Content (pushed)

## Change
- `app/admin/inventory/page.js`: removed the `maxHeight`/`overflowY` inner-scroll cap on the dashboard Recent Stock Movements wrapper. The card now grows to fit all 10 paginated rows; pagination sits directly under the last row; `table-responsive` kept for narrow screens. Other inventory tabs untouched.

## Verification (actually performed)
- `npx eslint`: clean (no findings). `npm run build`: Compiled successfully, 97/97.
- Visual fit needs a browser — confirm on staging that all 10 rows show without an inner scrollbar.
