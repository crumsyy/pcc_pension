# Implementation Plan — Register: Inter Fonts, Province→City Suggest, Password Checklist

## 1. Goals
Guest register page (`app/auth/register/page.js`): (a) all fonts Inter; (b) Province-first + City with the same suggest-dropdown inputs as User Management; (c) real-time password checklist per the screenshot. No API changes.

## 2. Current State (verified)
- Fonts inherit the global theme (`section-title` Fraunces, `section-eyebrow`/mono tags); page has no font scope.
- City input (`:397-416`) comes before Province (`:418-437`); both free text via `handleAddressChange`; submit checks non-empty + address pattern (`:117-118`).
- Password: submit enforces `strongPw` (`:150-154`, 8+upper+lower+number+special set); backend (`api/auth/register/route.js:75-81`) enforces the same 5 (incl. lowercase). Neither checks the username rule, so the checklist's "not contain your username" row would be advisory-only unless submit also enforces it.
- `ProvinceCityInputs` (`app/components/ProvinceCityInputs.js`) hardcodes `col-md-6` wrappers and `form-label` labels; register grid uses `col-12 col-md-6` + `form-label small fw-bold`.

## 3. Scope
- IN: register page + additive optional props on `ProvinceCityInputs` + one Inter scope block in `globals.css`.
- OUT: APIs, DB, DOB logic (already 18+), other auth pages.

## 4. Design
- **Fonts**: wrap page return in `<div className="register-inter">` + CSS mirroring the admin-inter rule (Inter `!important`, excluding `i/svg/path/fa-*/bi-*` so icons survive). Portaled terms/privacy modals already use Bootstrap defaults (Inter) — verified no display-font classes inside.
- **Location**: `ProvinceCityInputs idPrefix="reg-loc"` with new optional `columnClassName` (default `'col-md-6'`) and `labelClassName` (default `'form-label'`) props — register passes `col-12 col-md-6` / `form-label small fw-bold`. Adapter maps its `{target:{name,value}}` events to `setProvince/setCity` + clears field errors (component already clears city on province mismatch). Submit adds `isKnownProvince` / `isCityInProvince` checks (same messages); `fieldOrder` reordered province-before-city.
- **Checklist** (replaces the static hint under Password; submit error stays): 6 live rows — 8+ chars; no username (email local-part, applied when ≥3 chars, case-insensitive); one allowed special (same set as `strongPw`); one uppercase; one lowercase; one numeric. Green `bi-check-circle-fill` when met, grey otherwise (screenshot style; "allowed" tinted primary). Submit additionally rejects username-containing passwords so the checklist never lies (backend remains a satisfied subset).

## 5. Steps
1. CSS scope + page wrapper; `ProvinceCityInputs` optional props.
2. Swap City/Province blocks; adapter + submit checks + fieldOrder.
3. Checklist UI + submit username rule.
4. `npx eslint` + `npm run build`; manual: fonts Inter everywhere, province suggest → city follows, checklist ticks live, submit/API agree.
5. Update `walkthrough.md`; no commit/push until exact keyword `"push"`.

## 6. Acceptance
- Inter-only register page; invalid province/city combos blocked with clear errors; all 6 rows green ⇔ submit passes ⇔ backend accepts; build passes.

## 7. Risks
- Extra lowercase row deviates from the 5-row screenshot — required for backend parity; flagged explicitly.
- Username rule ignored when email local-part <3 chars (avoids absurd single-char blocks); noted in helper text.
