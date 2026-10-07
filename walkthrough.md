# Walkthrough: Restrict Admin Notifications to Inventory Low Stock & Payments Received

This update ensures that **Administrators do not receive inquiry, reservation, or booking notifications**, and exclusively receive **inventory low stock alerts** and **payments received notifications** (along with critical account security notices).

---

## Changes Implemented

### 1. Inquiries Notifications Dispatched Only to Receptionists
- **[`app/api/guest/inquiries/route.js`](file:///c:/Users/Nitro/Downloads/From%20Old%20Laptop/Capstone%20file/pcc_pension/app/api/guest/inquiries/route.js)**:
  - Updated staff notification query from `roleID IN (1, 2)` to `roleID = 2`.
  - Admin (`roleID = 1`) no longer receives `'New Inquiry Live Message'` alerts. Only front-desk receptionists receive live guest chat/inquiry notifications.

---

### 2. Reservation Notifications Dispatched Only to Receptionists
- **[`app/api/guest/reservations/route.js`](file:///c:/Users/Nitro/Downloads/From%20Old%20Laptop/Capstone%20file/pcc_pension/app/api/guest/reservations/route.js)**:
  - Updated queries from `roleID IN (1, 2)` to `roleID = 2` for `'Reservation Auto-Cancelled'` and `'New Courtesy Hold'`.
- **[`app/api/guest/reservations/convert/route.js`](file:///c:/Users/Nitro/Downloads/From%20Old%20Laptop/Capstone%20file/pcc_pension/app/api/guest/reservations/convert/route.js)**:
  - Updated query from `roleID IN (1, 2)` to `roleID = 2` for `'Reservation Converted to Booking'`.
- **[`app/api/receptionist/reservations/route.js`](file:///c:/Users/Nitro/Downloads/From%20Old%20Laptop/Capstone%20file/pcc_pension/app/api/receptionist/reservations/route.js)**:
  - Updated queries from `roleID IN (1, 2)` to `roleID = 2` for `'Reservation Conflict Cancelled'`, `'Reservation Cancelled Audit'`, and `'Courtesy Hold Released'`.

---

### 3. Booking & Operational Alerts Dispatched Only to Receptionists
- **[`app/api/guest/bookings/route.js`](file:///c:/Users/Nitro/Downloads/From%20Old%20Laptop/Capstone%20file/pcc_pension/app/api/guest/bookings/route.js)**:
  - Updated queries from `roleID IN (1, 2)` to `roleID = 2` for `'Guest Checkout Requested'`, `'Booking Canceled by Guest'`, and `'New Guest Booking Request'`.
  - **Payments Preserved for Admin**: If a down payment was paid on booking creation, `'New GCash Online Payment'` is specifically sent to both Receptionists and Admin (`roleID = 1`).
- **[`app/api/receptionist/bookings/checkout-request/route.js`](file:///c:/Users/Nitro/Downloads/From%20Old%20Laptop/Capstone%20file/pcc_pension/app/api/receptionist/bookings/checkout-request/route.js)**:
  - Updated query from `roleID IN (1, 2)` to `roleID = 2`.
- **[`app/api/guest/checkout-request/route.js`](file:///c:/Users/Nitro/Downloads/From%20Old%20Laptop/Capstone%20file/pcc_pension/app/api/guest/checkout-request/route.js)**:
  - Updated query from `roleID IN (1, 2)` to `roleID = 2`.
- **[`app/api/receptionist/billing/route.js`](file:///c:/Users/Nitro/Downloads/From%20Old%20Laptop/Capstone%20file/pcc_pension/app/api/receptionist/billing/route.js)**:
  - Updated query from `roleID IN (1, 2)` to `roleID = 2` for `'Guest Checked Out'`.
- **[`app/api/guest/orders/route.js`](file:///c:/Users/Nitro/Downloads/From%20Old%20Laptop/Capstone%20file/pcc_pension/app/api/guest/orders/route.js)**:
  - Updated queries from `roleID IN (1, 2)` to `roleID = 2` for front-desk room orders and delivery changes.
- **[`app/api/notifications/route.js`](file:///c:/Users/Nitro/Downloads/From%20Old%20Laptop/Capstone%20file/pcc_pension/app/api/notifications/route.js)**:
  - In auto-reminder generator, updated target from `roleID IN (1, 2)` to `roleID = 2` so `Pre-Check-In Alert`, `Pre-Check-Out Alert`, and `Exceeded Check-Out Alert` only notify Receptionists.

---

### 4. Admin Notification Fetch Filter ([`app/api/notifications/route.js`](file:///c:/Users/Nitro/Downloads/From%20Old%20Laptop/Capstone%20file/pcc_pension/app/api/notifications/route.js))
In `GET /api/notifications`, added a role-based query filter for `session.role === 'Administrator'`:
```sql
AND (
  title LIKE '%Payment%' 
  OR title LIKE '%GCash%' 
  OR title LIKE '%Inventory%' 
  OR title LIKE '%Stock%' 
  OR title LIKE '%Password%' 
  OR title LIKE '%Security%'
)
AND title NOT LIKE '%Inquiry%' 
AND title NOT LIKE '%Reservation%' 
AND title NOT LIKE '%Courtesy Hold%' 
AND title NOT LIKE '%Pre-Check%' 
AND title NOT LIKE '%Exceeded Check%' 
AND (title NOT LIKE '%Booking%' OR title LIKE '%Payment%') 
AND title NOT LIKE '%Inspection%'
```
- Guarantees that even if older operational or inquiry alerts exist in the database, the Admin notification bell will **only show Inventory Low Stock and Payments Received** (and account security notices).
- Enhanced low inventory auto-generation to check both active `products` and `amenities` whose stock is at or below `minStock`.

---

### 5. Admin Notification Navigation ([`app/components/NotificationBell.js`](file:///c:/Users/Nitro/Downloads/From%20Old%20Laptop/Capstone%20file/pcc_pension/app/components/NotificationBell.js))
- When an Administrator clicks an **Inventory Low Stock** notification, routes to `/admin/inventory`.
- When an Administrator clicks a **Payment Received** notification, routes to `/admin/reports` (financial & payment audit logs).
- Receptionists continue to route to `/receptionist/payments`, `/receptionist/checkin`, etc.

---

## Verification & Build Results

### Next.js Production Build
Executed `npm run build` using Next.js 16.2.9 with Turbopack:
```text
✓ Compiled successfully in 6.0s
✓ Running TypeScript in 146ms
✓ Generating static pages using 11 workers (96/96) in 1547ms
Exit code: 0
```
All 96 routes compiled cleanly with 0 errors.
