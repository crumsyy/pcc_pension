# Implementation Plan — Sonner Message Toasts in Inquiries + Quick-Replay Fix

## 1. Goals
(a) Add a `toast.message()` API (Sonner-style neutral message toast) to the toast wrapper and use it for inquiry notices instead of native `alert()` popups. (b) Fix the dead quick-reply menu buttons. No API/DB changes.

## 2. Findings (verified)
- Wrapper `components/ui/toast.jsx` exposes `add/success/error/warning/info/promise/close/dismiss` — no `message` type; icon renderer + accent CSS keyed by type.
- `GuestChatBubble.js` uses native `alert()` on connect/ticket failures (`:241, :283`) — the popups to replace. Receptionist inquiries (`receptionist/inquiries/page.js`) already notifies via the wrapper — untouched.
- Quick replies (`GuestChatBubble.js:661-693`) call undefined `handleQuickOption` → ReferenceError on every click. "Room Service Info" label matches no bot keyword, so it needs an explicit query map.

## 3. Scope
- IN: `toast.message()` (+ `pcc-toast-message` accent/icon styling), 2 alert swaps in `GuestChatBubble.js`, new `handleQuickOption` with key→query map.
- OUT: thread/bubble markup, bot knowledge content, APIs.

## 4. Design
- `toast.message(title, description?)` mirrors the `info()` helper shape: `manager.add({ type: 'message', ... })`, tracked in `activeToastIds`, neutral chat-bubble icon + slate accent (full dark-theme parity like other types).
- GuestChatBubble failures → `toast.message('Connection failed', err.message)` (notice UI, no blocking popup). In-thread success messages stay as-is.
- `handleQuickOption(key, label)`: appends user `label`, replies via existing `getBotReply` over mapped queries `{rates:'room rates price', checkin:'check-in checkout time', amenities:'amenities wifi', location:'location address contact', orders:'order food breakfast'}` on the existing 400ms typing-indicator path.

## 5. Steps
1. Wrapper `message` API + styles.
2. Alert swaps + `handleQuickOption`.
3. `npx eslint` touched files + `npm run build`; manual: failures show message toasts (no `alert`), all 5 menu buttons answer correctly, other toast types unchanged.
4. Update `walkthrough.md`; no commit/push until exact keyword `"push"`.

## 6. Acceptance
- Zero native `alert()` in inquiries flows; message toasts styled consistently; menu buttons work with no console errors; build passes.

## 7. Risks
- None; additive API + local handlers.
