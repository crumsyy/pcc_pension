# Implementation Plan — Rooms: Delete "Ro", Numeric-Only Numbers, Button Order

## 1. Goals
(a) Remove test room "Ro" from the database. (b) Room numbers accept digits only, enforced front-end + API on create and edit. (c) Create Room modal footer order becomes Cancel (left) → Create Room (right).

## 2. Current State (verified)
- `RoomsClient.js:648-649` table actions offer view/edit/archive only; `handleArchive (:379-393)` calls API `action: 'delete'`, which is a **soft-delete** (`route.js:176-190`, sets archive flag; blocked when Occupied). No hard-delete path exists in the app.
- Create validation (`:306-311`) checks non-empty only; API create (`route.js:65-94`) checks duplicates only — hence "Ro" got in.
- Create modal footer (`:860-861`) is currently Create Room → Cancel.

## 3. Scope
- IN: one-time verified hard-delete of room "Ro" via script; numeric guards in `RoomsClient.js` (create + edit submit + live digit-stripping on both room-number inputs) and `route.js` create/update actions; create-modal footer swap.
- OUT: schema changes, other entities, edit-modal footer (unchanged unless you ask).

## 4. Design
- **Delete "Ro"**: run a node script with repo `mysql2` + server env creds: 1) `SELECT` the room row and any referencing `reservation`/`booking` rows by `roomID`; 2) proceed with `DELETE FROM room WHERE roomNumber='Ro'` ONLY if zero references (else stop and report — never cascade blindly); 3) re-SELECT to confirm gone. Row dump shown before deleting. If DB is unreachable from here, fallback: archive "Ro" via the UI (reversible, same visible result).
- **Numeric-only**: front-end `handleInputChange` strips non-digits for `roomNumber` (both modals) + submit guards `/^\d+$/` with error toast; API create/update reject non-`^\d+$` with 400. Existing numbers unaffected.
- **Footer**: swap the two buttons in the create modal only.

## 5. Steps
1. Verify references → delete "Ro" → confirm (or report + UI-archive fallback).
2. Code edits (client + API + footer).
3. `npx eslint` + `npm run build`; manual: "Ro" gone from active + archived lists, letters rejected with clear error, footer order correct.
4. Update `walkthrough.md`; no commit/push until exact keyword `"push"`.

## 6. Acceptance
- No room "Ro" anywhere; non-numeric numbers impossible via UI or direct API POST; footer Cancel-left/Create-right; build passes.

## 7. Risks
- Hard delete is irreversible — mitigated by reference check + pre-delete row dump in this chat. Say the word if you'd rather archive instead.
