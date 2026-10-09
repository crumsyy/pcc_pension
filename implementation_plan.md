# Implementation Plan — Discounts Polish + shadcn Pagination Everywhere

## 1. Goals
(a) Discounts headings: "Active Discounts" → "Discounts", "Active Promotions" → "Promotions" (archived variants untouched). (b) Discounts tables fit on screen with footers visible (same capped-scroll treatment as other fixes). (c) shadcn-style Pagination component used by every paginated table. No API/count/logic changes.

## 2. Current State (verified)
- Headings at `discounts/page.js:609` (`🏷 Active Discounts`) and `:663` (`🔥 Active Promotions`); archived headings separate.
- Both tables capped `calc(100vh - 300px)` — too tall given ~500px of header/tabs/search/section/footer chrome above and below; footers land below the fold.
- Pagination today: shared `AdminPagination` (Bootstrap buttons) in users/rooms/amenities/products/inventory/POs/discounts/bookings/reservations; reports has 4 custom Prev/Next footers (`currentPage/itemsPerPage`, `totalPages>1` gating). No Pagination component exists — will hand-build shadcn-style (React Aria-free; button-based), NOT CLI code.

## 3. Scope
- IN: 2 heading strings; 2 scroller caps; new `components/ui/pagination.jsx` + CSS; `AdminPagination` reimplemented on it (same props-behavior); 4 reports footers migrated (keeping `totalPages>1` gating).
- OUT: APIs, counts, table content, sorting.

## 4. Design
- Caps → `max(220px, calc(100vh - 500px))` for both discounts tables (footer + breathing room at laptop heights).
- `pagination.jsx` API per docs: `Pagination/Content/Item/Link(isActive)/Previous/Next/Ellipsis` as accessible buttons; `AdminPagination` keeps its props (`page/totalPages/onPage/start/end/total/label`) and "Showing X–Y of Z" text, rendering numbers via the new primitives — zero caller changes; reports footers swap to it with computed start/end.
- Theme-aware + Inter, dark parity, disabled states.

## 5. Steps
1. Headings + caps. 2. Pagination component + CSS. 3. AdminPagination rewrite (verify one consumer visually via build). 4. Reports 4 footers. 5. Lint + build; manual spot-checks. 6. Walkthrough; no commit/push until `"push"`.

## 6. Acceptance
- Headings renamed; discounts footers visible with room; all pagers render shadcn-style identically; reports paging behavior unchanged; build passes.

## 7. Risks
- AdminPagination rewrite touches all consumers at once — mitigated by identical props/output contract + full build + spot checks.
