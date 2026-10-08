# Implementation Plan — Register DOB Flatpickr (+ shadcn provenance note)

## 1. Note on the shadcn question (no code)
The Terms/Privacy UI is **shadcn-style, not shadcn CLI code**: same component names/props/structure as the pasted docs (`Checkbox`, `DialogTrigger/Dialog/Header/Title/Description/Body/Footer/Close` over React Aria), hand-written as `.jsx` because the CLI was never initialized here and the registry sources are `.tsx`. Behavior and API match the docs; the implementation is ours.

## 2. Goal
Register Date of Birth uses Flatpickr like the rest of the app. No API/validation changes (still 18+, `MM/DD/YYYY` state).

## 3. Current State (verified)
- `register/page.js` DOB uses `DateInput` (native `type="date"`) with `max={maxDobStr}` in `YYYY-MM-DD` + 18+ submit check.
- `FlatDatePicker` supports `dateFormat="m/d/Y"`, `min/max` in slash format, and event-mode `onChange` when `name` is set — the existing `(e) => setDob(e.target.value)` handler works unchanged with `name="dob"`.

## 4. Design
- Swap `DateInput` → `FlatDatePicker dateFormat="m/d/Y" name="dob"`, add `maxDobSlash` (`MM/DD/YYYY`, today − 18y) alongside existing `maxDobStr`, pass as `max`. Keep `id`, classes, error text, submit logic.
- `DateInput` import stays for `isValidDate`/`toDbDate` helpers.

## 5. Steps
1. Two-part edit (state + JSX swap).
2. `npx eslint` + `npm run build`; manual: calendar popup, under-18 blocked, valid submit unchanged.
3. Update `walkthrough.md`; no commit/push until exact keyword `"push"`.

## 6. Acceptance
- DOB opens flatpickr, 18+ enforced in UI + submit; build passes.

## 7. Risks
- None; same value contract.
