# Implementation Plan — User Creation: 18+ DOB, Province→City Suggest, Red Asterisks

## 1. Goal
In User Management user creation (and edit for consistency): DOB restricted to 18+; Province field first, then City; both use a PH province/city library with type-to-suggest dropdowns where City depends on Province. Admin-wide, required-field `*` markers become red. No API/DB changes (names still stored as plain text).

## 2. Current State (verified)
- `UsersClient.js:655-664` (create) and `:836-845` (edit): order is City then Province, both free-text inputs; DOB is `FlatDatePicker` with no max and validation only checks `isValidDate` (`:191-192`, `:257-258`).
- Labels are plain text like `First Name *` (`:635,647,659,663,...`); admin-wide grep shows the same pattern in amenities/discounts/etc. A bare `*` inside a text node cannot be colored by CSS alone — markup change required.
- No PH location library installed (`package.json` has only flatpickr added recently).

## 3. Scope
- IN: `UsersClient.js` create + edit modals (DOB 18+, Province-first order, suggest inputs, validation); new `app/components/PhLocationSelect.js` (or inline datalist logic); `npm install philippines` (darklight721, MIT, JSON data: provinces + cities keyed by province); red-asterisk markup swap across `app/admin/**/*.js` + one CSS rule.
- OUT: API validation, DB schema, receptionist/guest forms (follow-up if wanted), other pickers.

## 4. Design
- Library: `philippines` (`require('philippines/provinces')`, `require('philippines/cities')`; cities carry province key — verify exact key name in `node_modules/philippines/cities.json` after install and adapt).
- UX: `Province` = text input + `<datalist>` of all province names (typing filters natively); `City/Municipality` = text input + `<datalist>` of cities where `city.province === selectedProvinceKey` (disabled/placeholder prompt until province chosen; clears city when province changes to a non-matching one). Submit validates province ∈ list and city ∈ that province's list, else error toast naming the field.
- DOB 18+: `maxDate` = today minus 18 years (MM/DD/YYYY) on both DOB pickers + `isAdult(dob)` check in create/edit submit (reject <18 with "must be 18 years old or older"). Keep `isValidDate` check first.
- Order: Province block before City block in both modals (labels/inputs/validation move together).
- Red `*`: replace admin label trailing ` *</label>` with ` <span className="required-asterisk">*</span></label>` via careful edits per file (bounded: labels in admin modals/filters), plus CSS `.required-asterisk{color:#dc3545;font-weight:700}` in `globals.css`. Only touches labels where `*` means required (skip decorative `*`, e.g. `accept="image/*"`, multiplication, password `••••`).

## 5. Steps
1. `npm install philippines`; confirm cities→province key shape.
2. New location suggest component (province datalist + dependent city datalist, props fit `handleInputChange` event shape).
3. `UsersClient.js`: reorder Province/City, wire suggest inputs, DOB maxDate + 18+ guards in create/edit.
4. Admin-wide asterisk markup swap + CSS rule (verify each file compiles; no logic changes).
5. `npx eslint` changed files (fix only new issues) + `npm run build`; manual: under-18 blocked, province suggest filters, city list changes per province, asterisks red, stored names unchanged.
6. Update `walkthrough.md`; no commit/push until exact keyword `"push"`.

## 6. Acceptance
- DOB after (today−18y) rejected in UI + submit for create/edit.
- Province-first; typing suggests provinces; city suggestions follow province; invalid combos blocked with clear errors.
- Every required `*` in admin renders red; build passes.

## 7. Risks
- `philippines` data may be dated (e.g. renamed provinces) — acceptable for suggestions; validation errors guide users to list values.
- `datalist` styling is browser-native (fine for admin); custom dropdown only if you prefer (heavier).
