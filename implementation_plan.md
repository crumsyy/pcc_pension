# Implementation Plan — User-friendly SOA: clear editable vs view-only sections (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Goal
Make the Statement of Account instantly scannable so the receptionist knows **what section this is** and **what they can modify here** — without mistaking read-only totals for editable areas.

## 2. Changes (only `app/receptionist/billing-checkout/BillingTab.js`, UI text/structure only)

### A. Right card truly read-only (fixes Image 1 complaint)
- Remove `Edit / Adjust Guest Discounts` button from `Bill Totals Summary (Read-Only)` Applied Discounts mini-card.
- Replace with hint text: `To modify discounts, use Apply / Edit Discounts in the Billing statement.` No button.

### B. Shared SOA section header component (left card)
Add one consistent header pattern for all 9 sections: `number badge + icon + title + Editable/View-only badge + one-line "what you can do here" hint`:
1. Guest & Booking Details — View only — "Booking record, cannot edit here."
2. Room Rent Charges — View only — "Auto-computed from rate × nights."
3. Occupancy & Capacity — **Editable** — "Adjust guest discounts here." Keeps the ONE `Apply / Edit Discounts` button.
4. Breakfast Schedule — View only — "From booking package."
5. Applied Discounts — Editable (via #3) — "Shows beneficiaries; edit in Occupancy."
6. Orders & Room Service — View only — "Managed in Orders tab."
7. Room Check-Out Inspection — Editable — "Tick returned items; untick to bill."
8. Incidental & Damage Charges — Editable — "Add/remove charges."
9. Borrowed Room Items — Editable — "Return or report lost/damaged."

### C. Structural clarity
- Wrap each section in separated spacing so headers never crowd content (fixes Image 2).
- Move discount apportionment out of the Room Rent `<table>` into its own `Applied Discounts` section block so it stops reading as a line item.
- Empty states keep headers visible (`None recorded`) so no mystery sections.

## 3. Verification
- Billing tab: right card zero buttons; left card modify buttons only in Editable sections.
- `npm run build` passes; visual check both screenshots.
- `grep "Edit / Adjust" BillingTab.js` → one hit (Occupancy only).

## 4. Risks
- Low: presentational only. Single discount entry point — confirm accepted.

## 5. Questions
- Q1: Proceed as above?
