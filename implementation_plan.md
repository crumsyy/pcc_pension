# Implementation Plan — Guest dashboard reskin (pilot) (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Scope (pilot = guest dashboard Home tab + shared shell)
- **Tokens first**: add CSS-variable token layer (`globals.css`): brand blues, semantic status colors (matching canonical badges), spacing scale, radii, shadows, dark-mode pairs. No visual change yet — just variables.
- **Reskin**: Home tab (hero card, metrics widgets, active-stay panel, bookings history cards, quick actions, promos) + already-shared shell (GuestHeader, sidebar, bottom nav) to consume tokens; dark-mode parity checked per section.
- **Out of scope**: other tabs (Rooms/Bookings/Orders/Notifications/Account), receptionist/admin portals, any logic/API/status changes. Design constraints from `PRODUCT.md` respected (PCC name, Osmeña St, logo, English + ₱, business rules untouched).

## 2. Method (skills)
- `ui-ux-pro-max` built-in reference (no Python on this machine): hospitality product guidance, dark-mode contrast rules, spacing rhythm, touch targets.
- `impeccable` principles from `PRODUCT.md`; no `DESIGN.md` baseline exists — visual review happens against the live page.

## 3. Verification
- `npm run build` passes; light + dark screenshots reviewed per section; 375px mobile + desktop checked; no logic diffs (className/style-only plus token vars).

## 4. Risks
- Medium: large file, purely presentational but wide. Rollback = revert commit. Mitigation: single commit, visual checklist before push.

## 5. Questions
- Q1: Proceed with Home tab + shell as the pilot?
