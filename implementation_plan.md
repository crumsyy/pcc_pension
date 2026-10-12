# Implementation Plan — 3-stage booking display (Booked > Occupied > Completed) (for approval)

> RequestFeedback: true — approved ("proceed A"). Implementing below.

## 1. Scope (display only; backend, transitions, gating untouched)
- `StatusBadge.js`: new optional prop `foldBookingFlow` — booking norms Bill Finalized / Final Billing Updated / Bill Ready / Paid / Payment Completed render as **Occupied** (text + Occupied color). Reservation behavior unchanged.
- Guest: booking timeline 5 nodes → 3 (Booked, Occupied, Completed; finalized/paid map to Occupied index); booking card + ActiveStayPanel badges use folded display.
- Receptionist: bookings list + check-in list badges use folded display; local badge-color helpers map the folded states to Occupied blue; status filter dropdown keeps raw options (filtering logic unchanged).
- Cancelled / No Show rendering unchanged everywhere.

## 2. Verification
- `npm run build` passes; guest timeline shows 3 nodes; paid/finalized stays show blue Occupied in both portals; money paths untouched (no API/transition edits).

## 3. Risks
- Low: presentational only. Staff temporarily lose the green "Paid" badge signal (balance still shown); full removal stays a separate project.
