# Walkthrough — Red Cancel + blue confirm on guest cancel dialogs

## Changes (only `GuestDashboardClient.js`, 2 call sites)
- Cancel Booking + Cancel Reservation confirms now pass `('primary', 'danger', 'Yes, Cancel')`: left Cancel red filled, right Yes-Cancel blue filled. Checkout and all other dialogs unchanged.

## Verification
- `npm run build` → success.
- Manual: both cancel dialogs match the requested button colors and order.
