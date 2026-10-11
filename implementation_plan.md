# Implementation Plan — Dashboard stat cards: rename + dedupe (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. User requests
1. Rename `ACTIVE RESERV.` card → `ROOMS RESERVED`.
2. `ACTIVE STAYS` and `ROOMS OCCUPIED` are redundant (1 booking = 1 room, always the same number) — drop one.

## 2. Evidence / current state
- `ReceptionistDashboardClient.js:128-135`: 6-entry `stats` array → `Active Stays (totalCheckIns)`, `Today's Check-outs`, `Rooms Occupied (occupiedRooms)`, `Rooms Available`, `Active Reserv. (pendingRes)`, `Under Maintenance`.
- `totalCheckIns` used only in destructure (86) + stats entry (129); `occupiedRooms` also used at line 191 (kept regardless).
- Grid is `col-6 col-md-4 col-xl-2` × 6; dropping to 5 cards leaves a 2-col gap on xl unless adjusted.

## 3. Proposed changes (only `ReceptionistDashboardClient.js`)
1. Rename entry: `["Active Reserv.", pendingRes, ...]` → `["Rooms Reserved", pendingRes, ...]` (count semantics unchanged: one reservation holds one room).
2. Remove the `["Active Stays", totalCheckIns, ...]` entry (keep room-centric `Rooms Occupied`); remove `totalCheckIns = 0` from destructuring (else unused-var lint).
3. Grid: card wrapper `col-xl-2` → `col-xl` so 5 cards fill the row evenly on xl (`col-6 col-md-4` responsive behavior unchanged).

## 4. Verification
- `grep`: `Active Stays`/`Active Reserv.` gone; `Rooms Reserved`/`Rooms Occupied` present; no `totalCheckIns` references.
- `eslint` clean; `npm run build` 97/97; visual: 5 even cards.

## 5. Risks
- None: label + array entry removal only; counts/keys untouched; server snapshot unchanged.

## 6. Questions
- Q1: Remove `Active Stays` (recommended, keeps room-centric row) or `Rooms Occupied`?
