# Implementation Plan — Remove category pill prefixes (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. User request
- In each catalog category header, remove the pill prefix — `Breakfast`, `Minibar & Store`, `Guest Service` — keeping the main titles (`Cooked Meals (Scheduled Delivery)`, `Beverages & Snacks (Immediate Delivery)`, `Hotel Amenities`).

## 2. Evidence
- Guest catalog (`GuestOrdersContent.js:1314-1316, 1341-1343, 1368-1370`): `<span pill><i icon/> Label</span>` + `<span>Title</span>` inside each section `h5`.
- Identical mirrored headers in receptionist orders (`orders/page.js:1312, 1339, 1366`).

## 3. Proposed changes
- Delete the three pill `<span>` blocks; keep title spans, slot notes, and grids untouched. No logic changes.

## 4. Verification
- `grep` pill labels/icons → zero matches in touched files; `eslint`; `npm run build` 97/97; visual headers show titles only.

## 5. Risks
- None (presentational deletion).

## 6. Questions
- Q1: Guest catalog only, or also the mirrored receptionist orders headers (recommended: both, for consistency)?
