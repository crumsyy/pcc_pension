# Implementation Plan — Guest profile dropdown (mobile + desktop) (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Request (Image 1)
Mobile header profile name truncates awkwardly; make it fit and make the profile chip clickable with a Profile + Log Out dropdown — same behavior on desktop header.

## 2. Proposed changes
1. **New `app/guest/dashboard/GuestProfileMenu.js`**: pill button (avatar + name with `max-width`/ellipsis, smaller capped width on mobile, chevron) toggling a dropdown with **Profile** (opens existing in-dashboard Edit Profile modal, prefilled exactly like the Account tab button) and **Log Out** (existing logout confirm modal). Closes on outside click / Escape; shared by both headers.
2. **`GuestDashboardClient.js` (mobile nav)**: replace static `HeaderProfile` + standalone logout icon button with `GuestProfileMenu`.
3. **`GuestHeader.js` (desktop)**: replace static `HeaderProfile` with `GuestProfileMenu` (wider cap, same menu). Add an `openEditProfile()` helper in the client (extract prefill logic) reused by Account tab button + both menus.

## 3. Verification
- Mobile: name fits without pushing logout off-screen; tap opens Profile/Log Out menu; both actions work.
- Desktop header menu identical; `npm run build` passes.

## 4. Risks
- Low: new component + two swaps; modal flows reused unchanged.

## 5. Questions
- Q1: Proceed?
