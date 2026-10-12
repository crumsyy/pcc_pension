# Implementation Plan — Calendar status cleanup (for approval)

> RequestFeedback: true — approved ("proceed"). Implementing below.

## 1. Scope (calendar display only, both portals via shared component)
- `ReservationCalendar.js`: on-hold variants (Courtesy Hold / Hold / On Hold, incl. `isCourtesyHold` flag) map to **Reserved**; remove hold branch, priority entry, and `Hold` compact label. Booked mapping unchanged in logic.
- `globals.css`: `.calendar-status-booked` → sky-blue tint (`#cff4fc` bg / `#0dcaf0` border / `#055160` text, matching canonical badge); delete `.calendar-status-courtesy-hold`; update the palette comment.
- Legend in `ReservationCalendar.js`: delete the Courtesy Hold entry.
- No flow/API/status-model changes. Check-In/Out, Stay Range, Conflict, Reserved, Occupied, Maintenance rendering untouched.

## 2. Verification
- `npm run build` passes; visual: holds render Reserved blue, Booked sky blue, legend has no Hold entry, in guest + receptionist forms.

## 3. Risks
- Minimal: display mapping + CSS in one shared component.
