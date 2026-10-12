# Walkthrough — Order Tray above tabs (guest + receptionist)

## Changes
- Guest (`GuestOrdersContent.js`): tray card moved above tabs + search toolbar, full width in normal flow; side-column tray deleted; mobile floating bar + modal kept; mobile bottom spacer added so the floating bar never covers catalog items.
- Receptionist (`orders/page.js`): same relocation (hidden in history mode as before); catalog full width.
- `globals.css`: deleted the fixed-rail rule that overlayed the tray on content (zero remaining usages).

## Verification
- `grep orders-tray-fixed/orders-tray-col` → zero code hits; `npm run build` → success.
- Manual: no overlap at any width; tray visible above tabs; history mode unchanged; cart/checkout logic untouched.
