# Walkthrough: Double Booking & Reservation Conflict Prevention

This update guarantees that no room can be double-booked or double-reserved for overlapping dates and times across the system. It adds comprehensive schedule conflict verification to both the backend APIs and receptionist user interfaces without affecting any existing billing calculations, guest check-in flows, or receipt generation.

---

## Root Causes Identified & Resolved

1. **Missing General Booking Overlap Check in `app/api/receptionist/bookings/route.js`**:
   - The booking route previously only checked whether the *same guest* had a conflicting booking on that room (`guestID = ? AND roomID = ?`). It **never checked if another guest had already booked the room**, allowing any two different walk-ins or guests to book the same room on identical dates.
2. **Missing Statuses in Reservation Overlap Detection in `app/api/receptionist/reservations/route.js`**:
   - The reservation route checked `status IN ('Pending', 'Confirmed', 'Booked')`. It missed normalized statuses such as `'Reserved'` and `'On Hold'`, permitting overlapping reservations.
3. **No Validation in Update Actions**:
   - Rescheduling an existing booking or reservation (`update_booking` / `update`) did not verify if the new date range overlapped with another guest's booking or courtesy hold.
4. **Permissive Client-Side Dropdowns & Missing Pre-Submit Checks in `app/receptionist/bookings/page.js`**:
   - When "Current time" was checked for check-in, `isRoomAvailableForDates` returned `room.status === 'Available'` without checking whether there was a scheduled reservation or booking later that day or week.
   - `handleSubmit` did not perform a pre-submit conflict check against loaded `roomSchedules`.

---

## Detailed Changes Implemented

### 1. Receptionist Bookings API (`app/api/receptionist/bookings/route.js`)
- **Booking Creation (`action === 'create'`)**:
  - Added global overlapping active booking check:
    ```sql
    SELECT bookingID, status, checkInDateTime, checkOutDateTime FROM booking 
    WHERE roomID = ? 
      AND status NOT IN ('Cancelled', 'Canceled', 'Checked Out', 'No Show', 'Completed')
      AND checkInDateTime < ? 
      AND checkOutDateTime > ?
    ```
    Returns `409 Conflict` notice if found.
  - Added overlapping active reservation & courtesy hold check (excluding converted reservation if applicable):
    ```sql
    SELECT reservationID, status, holdExpiryDateTime FROM reservation 
    WHERE roomID = ? 
      AND status NOT IN ('Cancelled', 'Canceled', 'Released', 'Expired', 'Completed')
      AND NOT (status IN ('Courtesy Hold', 'On Hold') AND holdExpiryDateTime IS NOT NULL AND NOW() > DATE_ADD(holdExpiryDateTime, INTERVAL 30 MINUTE))
      AND reservationDateTime < ? 
      AND COALESCE(checkOutDateTime, DATE_ADD(reservationDateTime, INTERVAL 1 DAY)) > ?
    ```
- **Booking Update (`action === 'update_booking'`)**:
  - Enforced overlapping booking verification (`bookingID != ?`) and active reservation verification before updating stay dates or room ID.
- **Advance Check-In (`action === 'checkin'`)**:
  - Added verification to ensure the room is not currently occupied by another active stay (`status IN ('Checked In', 'Active Stay', 'Pending Checkout', 'Room Verified')`) before an advance check-in can be confirmed.
- **Schedules Fetch**:
  - Updated `roomSchedules` query to ensure all active reservations with checkout dates extending into today or the future are included.

---

### 2. Receptionist Reservations API (`app/api/receptionist/reservations/route.js`)
- **Reservation Creation (`action === 'create'`)**:
  - Updated conflict detection to include all active statuses (`'Reserved'`, `'Confirmed'`, `'Pending'`, `'Booked'`, `'On Hold'`, `'Courtesy Hold'`), excluding only cancelled, released, or expired holds.
  - Concurrently queries both active bookings and active reservations using `Promise.all`.
- **Reservation Update (`action === 'update'`)**:
  - Added conflict queries against both active bookings and active reservations (excluding the current `reservationID`).
- **Convert to Booking (`action === 'confirm'` / `action === 'convert_to_booking'`)**:
  - Added pre-conversion conflict check ensuring no other guest has booked or occupied the room during the stay interval before conversion proceeds.

---

### 3. Receptionist Bookings UI (`app/receptionist/bookings/page.js`)
- **`checkScheduleConflict` Helper**:
  - Added helper comparing requested interval `[reqIn, reqOut)` against all active entries in `roomSchedules` and loaded `bookings`.
  - Returns structured conflict metadata (type: Booking / Reservation / Courtesy Hold, ID, and schedule time window).
- **`isRoomAvailableForDates` Enhancements**:
  - Excludes maintenance/out-of-order rooms.
  - Evaluates actual requested check-in and check-out times against schedule overlaps.
  - Correctly validates multi-day stays even when "Current time" check-in is selected.
- **Pre-Submit Validation in `handleCreateSubmit`**:
  - Validates room availability prior to submitting. Displays an immediate error notice if a conflicting booking, reservation, or hold exists.
- **Pre-Submit Validation in `handleUpdateBookingSubmit`**:
  - Validates new dates/times against other bookings before saving changes.

---

### 4. Receptionist Reservations UI (`app/receptionist/reservations/page.js`)
- **`checkScheduleConflict` Enhancements**:
  - Extended helper to accept explicit `inTime` and `outTime` rather than hardcoded 14:00/12:00.
  - Excluded inactive statuses (`'Cancelled'`, `'Canceled'`, `'Checked Out'`, `'No Show'`, `'Released'`, `'Completed'`).
  - Passed selected times into form submit validations and disabled state of the submit button.

---

### 5. Guest Reservations API (`app/api/guest/reservations/route.js`)
- Updated conflict detection during reservation updates to query all active bookings (`status NOT IN ('Cancelled', 'Canceled', 'Checked Out', 'No Show', 'Completed')`), ensuring `'Active Stay'` is never overlooked.

---

## Verification & Build Results

### Next.js Production Build
Executed `npm run build` using Next.js 16.2.9 with Turbopack:
```text
✓ Compiled successfully in 29.3s
✓ Running TypeScript in 505ms
✓ Generating static pages using 11 workers (96/96) in 4.8s
Exit code: 0
```
All 96 routes compiled cleanly with 0 errors.
