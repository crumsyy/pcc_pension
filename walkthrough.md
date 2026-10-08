# Walkthrough — User Creation: 18+ DOB, Province→City Suggest, Red Asterisks

## Changes (no commit/push yet)
- Installed `philippines` (province/city JSON data, MIT).
- New `lib/phLocations.js` — province names, exact-match lookup, cities-per-province, validators.
- New `app/components/ProvinceCityInputs.js` — Province-first inputs with type-to-suggest `<datalist>` dropdowns; city list follows the exactly-matched province (disabled until province chosen; clears city when province changes away); emits `handleInputChange`-compatible events.
- `app/admin/users/UsersClient.js`:
  - Create + edit modals: Province block now before City block, both via `ProvinceCityInputs`.
  - DOB 18+: picker `max` = today minus 18 years + submit guard rejecting under-18 in both modals; province/city validated against suggestion lists with clear error toasts.
- Red required markers: all 86 required `*` labels across `app/admin` (amenities, discounts, inventory, products, rooms, users) converted to `<span className="required-asterisk">*</span>`; CSS `.required-asterisk { color:#dc3545; font-weight:700 }` in `globals.css` (global scope so portaled modals are covered).
- Stored values unchanged (plain province/city names, `YYYY-MM-DD` DOB); no API/DB changes.

## Verification
- `npx eslint` on new files clean; `UsersClient.js` shows only pre-existing `set-state-in-effect`/`exhaustive-deps` findings.
- `npm run build` success, 96/96 pages.

## Manual check (please review)
1. Create User: DOB picker blocks dates newer than 18 years ago; submitting under-18 shows validation error.
2. Type in Province → suggestions appear; pick e.g. South Cotabato → City suggests its cities/municipalities; changing province clears mismatched city; invalid combos blocked on submit.
3. All required `*` in admin render red; edit modal behaves the same.

Awaiting review. Say `"push"` only when you want commit + push.
