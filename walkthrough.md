# Walkthrough: Two-Column Split Layout for Booking Modal

## Commit Summary
**Message:** `feat(receptionist): redesign booking modal into two-column split workspace`

---

## Changes

### 1. Two-Column Layout (`app/receptionist/ConfirmReservationModal.js`)
- Refactored the modal structure to use Tailwind grid (`grid grid-cols-12`).
- **Left Column (65%)**: Handles guest details, room selection, special discounts, stay schedule, and down payment tier selection.
- **Right Column (35%)**: A sticky billing summary panel that stays pinned while the left form scrolls.
- **UI/UX**: Modal resized to `modal-xl` for better workspace area.

---

## Build & Verification
- `next build`: **PASSES** — all pages compiled successfully.

---

## Impact
- **Improved Workflow**: Receptionists can now input reservation details and view the resulting billing changes in real-time without vertical scrolling.
- **Better Visual Hierarchy**: Separated input and output (billing) data into dedicated columns.
- **Fixed Layout**: Modal is now constrained and sticky-scrolling, eliminating the previous long-form scroll experience.
