# Walkthrough — Register DOB Flatpickr

## Changes (no commit/push yet)
- Register DOB: `DateInput` (native) → `FlatDatePicker dateFormat="m/d/Y" name="dob"` with `max` = today − 18y in slash format; string-or-event safe handler; dead `maxDobStr` removed. Helpers import kept; 18+ submit logic untouched.

## Verification
- `npx eslint`: only the pre-existing DOB-effect finding (same line as before, renamed state) + img warning.
- `npm run build` success, 96/96 pages.

## Manual check
1. DOB opens the flatpickr calendar; dates newer than 18 years ago blocked; valid 18+ submit unchanged.

Awaiting review. Say `"push"` only when you want commit + push.
