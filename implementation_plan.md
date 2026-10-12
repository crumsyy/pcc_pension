# Implementation Plan — Tray Immediate badge + meal serving-time label (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. User requests (scope already agreed in discussion)
1. Order tray: remove the green `Immediate` pill below each non-meal item; when bundled, keep the blue `With Breakfast` pill; when immediate, show nothing.
2. Catalog meal cards: `Scheduled Breakfast (6:00 AM – 10:30 AM)` pill → serving window only (`6:00 AM – 10:30 AM`, clock icon kept, same pill styling).
3. Mirror in both guest (`GuestOrdersContent.js`) and receptionist (`orders/page.js`) catalogs.

## 2. Evidence
- Guest tray badge: `GuestOrdersContent.js:1072-1074` (`With Breakfast` vs `Immediate` ternary).
- Guest card pill: `GuestOrdersContent.js:68-70`; tray cooked-meal row pill: `1054-1056` (out of scope, unchanged).
- Receptionist mirrors: `orders/page.js:~119` (card pill), `:~853` (tray meal row, unchanged), `:~871` (tray badge ternary — verify exact block on implementation).
- Untouched: top `Cooked Meal (Scheduled)` pill, `Cooked to Order` pill, descriptions, Add buttons, mobile mini-badges, tray checkboxes, scheduling picker section.

## 3. Proposed changes
1. Tray ternary → render badge only when `deliveryType === 'scheduled'` (blue pill), else render nothing.
2. Card pill text → `6:00 AM – 10:30 AM` (keep icon + pill classes), both files.

## 4. Verification
- `grep` removed strings → zero in touched files; `eslint`; `npm run build` 97/97; visual tray + catalog in both portals.

## 5. Risks
- None (presentational text/conditional only).

## 6. Questions
- Q1: Proceed as planned?
