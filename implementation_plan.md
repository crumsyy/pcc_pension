# Implementation Plan — Guest Bookings nav tab (for approval)

> RequestFeedback: true — approved ("yes proceed with bookings"). Implementing below.

## 1. Agreed scope
- New guest-dashboard nav item **Bookings** (icon `bi-journal-bookmark-fill`) between Rooms and Orders.
- Move reservation history + booking history sections out of Home/Account into the new tab as **Upcoming** (holds + upcoming stays) and **Past** groups, keeping hold badges; card components reused, element IDs (`bookings-history-section`, `reservations-history-section`, per-item anchors) preserved so notification deep-links keep working.
- No API/logic changes.

## 2. Verification
- `npm run build` passes; tab shows both histories; home/account tabs unchanged apart from relocation; deep-links scroll correctly.

## 3. Risks
- Low-medium: JSX relocation in a large file; duplicated sections (if any) consolidated carefully.
