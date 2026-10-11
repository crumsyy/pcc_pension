# Implementation Plan — Discount/Promo Modal UX Overhaul

## Agreed scope (Plan-mode discussion + "proceed")
1. Field hierarchy: grouped sections (Identity → Value → Rules / Applicability / Validity) with dividers + consistent labels in Create Discount, Update Discount, Create Promotion, Update Promotion modals.
2. Eligibility explainer: live "How this works" summary + plain-meaning option labels; conditional Req. Bookings states (already in place — keep).
3. Toasts: create/update/archive/restore success + validation/API errors go through shadcn `toast.success`/`toast.error` (same system `showAlert` already routes to — direct calls, no behavior change); confirms stay as dialogs.
4. Promo inline sanity: end-date ≥ start-date message; room-limit one-liner.
5. No changes to apply/billing/eligibility logic. Verify: eslint stash-compared, build 97/97. Commit/push only on "push".
