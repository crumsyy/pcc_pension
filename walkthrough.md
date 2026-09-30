# Walkthrough: Fix Receptionist Booking Bugs

## Commit Summary
**Message:** `fix(receptionist): resolve discounted guest removal bug and database insert type errors`

---

## Changes

### 1. Booking UI Fix (`app/receptionist/bookings/page.js`)
- Fixed the "X" button behavior in the discounted guests list.
- Changed the click handler to clear the entire `discountedGuests` array (`setDiscountedGuests([])`) when the last/only entry is removed.

### 2. Database Insert Fix (`app/api/receptionist/bookings/route.js`)
- Sanitized financial parameters before inserting into the `booking` table.
- Added explicit defaults/fallbacks (`|| 0` or `|| null`) to ensure all numeric fields receive valid numbers, preventing "Truncated incorrect DOUBLE value" SQL errors caused by `NaN` or uninitialized variables.

---

## Build & Verification
- `next build`: **PASSES** — all pages compiled successfully.

---

## Impact
- **Improved UI**: Discounted guest list management now functions as expected.
- **Improved Backend Robustness**: Database operations are now guarded against `NaN` or invalid numeric inputs, preventing crashes during booking and payment processes.
