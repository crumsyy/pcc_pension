# Implementation Plan — Narrower tray, wider catalog (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. User requests
1. Slim the order tray so the catalog gets more room.
2. Confirm guest portal parity.

## 2. Guest parity status (already shipped, no work needed)
- Guest has everything receptionist has: fixed right rail, pinned footer, blue steppers, draft `QtyInput`, serving-time card pill, no Immediate pill, no FREE row, category pills removed. Same components, same behavior on desktop.

## 3. Proposed changes (grid classes only, both files)
- `xl` breakpoint only (tablets keep current split — `col-xl-3` would be ~250px there, too narrow for item rows):
  - Catalog `col-xl-8` → `col-xl-9`; tray `col-xl-4` → `col-xl-3`.
  - At ~1600px content width the tray lands ~370px usable: fits thumbnail + name + stepper + trash; scheduling inputs stack full-width as today.
- Fixed card needs no CSS change (`width:inherit` tracks the column live, incl. sidebar collapse).
- `lg` (992–1199px) split unchanged.

## 4. Verification
- `eslint`; `npm run build` 97/97; visual at xl: 3 catalog cards breathe, tray fully usable; lg/tablet/mobile unchanged.

## 5. Risks
- Low: grid class swap only. If ~370px feels tight on smaller xl screens, follow-up is a 320px `min-width` + horizontal scroll — not included.

## 6. Questions
- Q1: Proceed with xl-only 9/3 split in both files?
