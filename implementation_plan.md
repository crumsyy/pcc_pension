# Implementation Plan — Dialog Inter Enforcement

## 1. Goal
Terms/Privacy dialog content fully Inter, including headings. No API/behavior changes.

## 2. Root Cause (verified)
- `globals.css:402-410`: global `h1–h4 { font-family: Fraunces }` directly targets the Dialog title (React Aria `Heading` renders a real heading element), beating the inherited `.pcc-dialog` Inter font.
- The dialog portals to `document.body`, outside the `.register-inter` page scope, so page-level Inter rules never reach it.

## 3. Scope
- IN: one CSS rule in `globals.css`.
- OUT: components, pages, APIs.

## 4. Design
- Add `.pcc-dialog, .pcc-dialog *:not(i):not(svg):not(path):not([class*="fa-"]):not([class*="bi-"]) { font-family: Inter... !important; }` (same icon-safe pattern as other scopes) so every dialog descendant is Inter regardless of portal placement or heading level.

## 5. Steps
1. One CSS edit. 2. Build. 3. Manual: titles + body Inter, icons intact. 4. Walkthrough; no commit/push until `"push"`.

## 6. Acceptance
- Zero serif text in either dialog; build passes.

## 7. Risks
- None; single scoped rule.
