# Implementation Plan — User Tabs, STF/GST IDs, ID Search

## 1. Goals
User Management: (a) Staffs | Guests tabs (shadcn-style Tabs). (b) Column back to "User ID" with role-prefixed codes (`STF-XXXXXX` staff, `GST-XXXXXX` guests). (c) Search matches User ID (the navigation key). No API/DB changes.

## 2. Current State (verified from prior work)
- `UsersClient.js`: `toPublicUserCode` (unprefixed `USR-`), guests filtered out everywhere, `User Code` column + view-modal row, server-side `search` (debounced) matching name/email only, client pagination, staff-only create guards + Guest edit lock.

## 3. Scope
- IN: `UsersClient.js` only (tabs, prefixed codes, client-side search incl. code, header/modal relabel).
- OUT: APIs, create-staff-only rule (kept), edit Guest lock (kept), other pages.

## 4. Design
- Codes: `toPublicUserCode(userID, role)` → `STF-` (default) / `GST-` (role === 'Guest'), same hash otherwise; real `userID` stays in keys + API payloads.
- Guests return to the table; `staffUsers`/`guestUsers` derived; Tabs (`components/ui/tabs.jsx`, controlled) with counts: `Staffs (N)` / `Guests (M)`; tab switch resets page + search + role filter.
- Role filter options follow the tab (staff roles vs Guest); create/edit guards unchanged.
- Search moves client-side for this page (list is tiny; server already returns full sets): drop `search` from API query + cache key, filter the tab's set by name/email/code (code matched case-insensitively with and without dash); placeholder updated; committed/instant states collapse to one (debounce no longer needed — filtering is local and instant).
- Header + view-modal row relabeled "User ID".

## 5. Steps
1. Codes, tabs, search rework, relabels.
2. `npx eslint` + `npm run build`; manual: tabs + counts, STF/GST display, ID search (full + partial), guests visible but not creatable, pagination per tab.
3. Update `walkthrough.md`; no commit/push until exact keyword `"push"`.

## 6. Acceptance
- Staffs/Guests tabs with counts; IDs prefixed correctly and stable; typing an ID finds the user; guests listed, staff-only creation intact; build passes.

## 7. Risks
- Search no longer hits the server (local-only) — fine at this table size and strictly faster; noted.
