# Implementation Plan — Billing filter labels + full Inter font (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. User requests
1. Billing stay filter tabs → `All`, `Booked`, `Occupied`, `Completed` ([Image 1] shows current `All Stays / Upcoming / Booked / Active Stays / Completed Stays`).
2. “In receptionist really use full Inter font family, in guest portal as well” — stop mixing the Fraunces serif display font into headings; use Inter everywhere in receptionist + guest portal.

## 2. Evidence / current state
- Filters: `app/receptionist/billing-checkout/BillingTab.js:630-670` — `statusFilter` (`all/upcoming/active/completed`), `UPCOMING_STATUS_LIST = [Pending, Pending Check-in, Confirmed, Booked]`, `ACTIVE_STATUS_LIST = UPCOMING + [Active Stay, Checked In, Checked-In, Late Checkout, Pending Room Verification, Pending Checkout, Checkout Requested, Room Verified, Bill Finalized, Final Billing Updated, Payment Completed, Paid]`, completed = `Completed/Checked Out`.
- Tabs UI (just converted): `BillingTab.js` shadcn `TabList` with ids `all/upcoming/active/completed`.
- Fonts: `app/globals.css:4` imports `Inter:wght@400;500;600;700` (+ Fraunces + Space Mono); `body:439-444` is Inter, but `h1-h4,.display-font:446-454` use Fraunces serif — this is why headings (“Guest Billing”, “Payment Management & POS”) render serif while body/tabs render Inter.
- Scope hooks: receptionist content wraps in `.pcc-main-wrapper` (`SidebarClient.js:429`); guest `app/guest/layout.js` is a bare passthrough (no wrapper class).

## 3. Proposed changes
### A. Filter labels + semantics (`BillingTab.js` only)
- Tab ids/labels: `all`→`All`, `booked`→`Booked`, `occupied`→`Occupied`, `completed`→`Completed`.
- Lists: `BOOKED_STATUS_LIST = [Pending, Pending Check-in, Confirmed, Booked]` (current UPCOMING, renamed); new `OCCUPIED_STATUS_LIST = [Active Stay, Checked In, Checked-In, Late Checkout, Pending Room Verification, Pending Checkout, Checkout Requested, Room Verified, Bill Finalized, Final Billing Updated, Payment Completed, Paid]` (current ACTIVE minus upcoming — i.e. truly in-house/finalizing stays); completed unchanged.
- Note: stays with any other/edge status fall under `All` only (same as today).
- Default tab stays `all`; no URL keys involved (`statusFilter` is local state).

### B. Full Inter in receptionist + guest portal (`globals.css` + `guest/layout.js`)
- Add override block (near tabs CSS ~line 3300):
```css
.pcc-main-wrapper h1, .pcc-main-wrapper h2, .pcc-main-wrapper h3, .pcc-main-wrapper h4,
.pcc-main-wrapper .display-font,
.guest-portal h1, .guest-portal h2, .guest-portal h3, .guest-portal h4,
.guest-portal .display-font {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}
```
- Wrap guest layout children in `<div className="guest-portal">` so the override scopes to guest portal.
- Admin/auth pages untouched (still Fraunces headings) unless user wants global.
- Font weights: extend Inter import to `400;500;600;700;800` for bolder headings (headings use 600-800). Optional.

## 4. Verification
- `grep`: tab ids `upcoming/active` gone from BillingTab; `Booked/Occupied` present; occupancy filter behavior (booked room ≠ in-house room) per lists.
- `eslint` on touched JS files (pre-existing families only).
- Visual: four tabs All/Booked/Occupied/Completed; receptionist + guest headings render Inter (no serif), tabs/body unchanged.

## 5. Risks / notes
- “Occupied” semantics = in-house + finalizing/bill-ready stays (mirrors room Occupied state). If user means strictly physically-checked-in (`Checked In`/`Active Stay` only), the later billing states would vanish from Occupied — confirm via Q1.
- Global `h1-h4` rule stays Fraunces; overrides win by specificity (0,2,0+element vs 0,0,1). `.display-font` class usages inside receptionist/guest also convert.

## 6. Questions for user
- Q1: Occupied = all in-house + finalizing/bill-ready/paid-awaiting-checkout states (recommended), or strictly Checked-In/Active-Stay only?
- Q2: Font scope = receptionist + guest portal only (recommended), or global (admin/auth too)?
- Q3: Extend Inter import with 800 weight for headings (recommended, tiny payload), or keep 400-700?
