# Walkthrough — Sonner Message Toasts + Quick Replies

## Changes (no commit/push yet)
- `components/ui/toast.jsx`: new `toast.message(title, description?)` (same call shape as `info()`), neutral chat-bubble icon + slate accent with dark-theme parity.
- `app/components/GuestChatBubble.js`: both native `alert()` failure popups → `toast.message(...)` notices; defined the missing `handleQuickOption(key, label)` with a key→query map so all 5 menu buttons post and answer (Room Service included) on the existing typing-indicator path.

## Verification
- Zero native `alert()` in the chat component; `npx eslint` shows only pre-existing findings on untouched lines.
- `npm run build` success, 96/96 pages.

## Manual check
1. Force a connect failure (e.g. offline) → message toast, no browser popup.
2. Click each menu button (Rates, Check-In Times, Amenities, Location, Room Service) → correct answers, no console errors.

Awaiting review. Say `"push"` only when you want commit + push.
