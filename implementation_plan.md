# Implementation Plan — User Tabs Without Counts

## 1. Goal
Staffs/Guests tabs show plain labels (no counts). No other changes.

## 2. Current State
`UsersClient.js` tab labels interpolate `staffUsers.length` / `guestUsers.length`.

## 3. Design
- Labels become static "Staffs" / "Guests" (existing wording kept); counts no longer rendered. Tab logic, filtering, pagination untouched.

## 4. Steps
1. One-line edit. 2. Build. 3. Walkthrough; no commit/push until `"push"`.

## 5. Acceptance
- Tabs read Staffs/Guests with no numbers; build passes.
