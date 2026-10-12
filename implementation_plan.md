# Implementation Plan — Guest desktop header bar (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Request (Image 1)
Desktop guest portal has sidebar + content but no top header bar, unlike receptionist/admin. Add a matching sticky header on desktop only; mobile keeps its existing top nav.

## 2. Findings
- Staff header (`SidebarClient.js:438`): sticky pcc-blue bar with eyebrow+title, Ctrl+K command palette (pages + rooms), `NotificationBell`, `ThemeToggle`, profile dropdown.
- Staff `NotificationBell` routes to staff URLs (`/receptionist/...`, `/admin/...`, `/guest/inquiries` which doesn't exist) — **not reusable** for guests. Guest header gets its own bell button (unread badge from existing `unreadCount`, click → notifications tab).
- `ThemeToggle` and `HeaderProfile` are already imported in `GuestDashboardClient.js` — reusable as-is.

## 3. Proposed changes
1. **New `app/guest/dashboard/GuestHeader.js`**: `d-none d-lg-flex` sticky pcc-blue bar — left: eyebrow `Hotel Guest Portal` + per-tab title (Home/Rooms/Bookings/Orders/Notifications/Account); center: search field (Ctrl+K to focus) filtering `NAV_ITEMS`, Enter navigates via `setActiveTab`; right: bell with unread badge → notifications tab, `ThemeToggle`, `HeaderProfile`.
2. **`GuestDashboardClient.js`**: wrap desktop right side in a flex column (`sidebar + (header + main)`); render `GuestHeader` above `main` on desktop only. No mobile changes, no API changes.

## 3. Verification
- Desktop shows header matching staff portals; search jumps tabs; bell badge mirrors sidebar count; theme toggle works from header; `npm run build` passes.
- Mobile layout untouched.

## 4. Risks
- Low: new presentational component + layout wrapper; tab search only (no room-record search — proposed follow-up).

## 5. Questions
- Q1: Proceed? Q2: Tab-only search OK, or include room-number search too?
