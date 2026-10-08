# Walkthrough — Register: Inter, Location Suggest, Password Checklist

## Changes (no commit/push yet)
- Inter everywhere: page wrapped in `register-inter` + CSS scope (same icon-safe pattern as admin); portaled modals already use Bootstrap defaults.
- Province-first + shared `ProvinceCityInputs` (new optional `columnClassName`/`labelClassName` props, defaults keep User Management styling); submit validates against the province/city lists with clear errors; error scroll order updated.
- Real-time 6-row password checklist (green/grey checks, "allowed" tinted) replacing the static hint; submit additionally rejects username-containing passwords so the checklist never lies (backend remains a satisfied subset).

## Verification
- `npx eslint`: the 2 findings are pre-existing on untouched lines (DOB effect, terms-modal apostrophe) — verified zero added lines involved.
- `npm run build` success, 96/96 pages.

## Manual check
1. Whole page renders Inter, icons intact.
2. Province suggest → city follows it; invalid combos blocked on submit.
3. Checklist ticks live as you type; all-green ⇔ submit passes ⇔ backend accepts.

Awaiting review. Say `"push"` only when you want commit + push.
