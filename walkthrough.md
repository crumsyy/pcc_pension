# Walkthrough — Palette TDZ Crash Fix (The Real Cause)

## Root cause (verified by reading)
My rewrite referenced `safeActive` inside the render pass before its declaration line — a temporal-dead-zone `ReferenceError` on EVERY render with results. The error boundary swallowed it, so the palette silently never appeared: button visible, click seemingly dead, typing impossible. No deployment or browser issue.

## Changes (no commit/push yet)
- `command.jsx`: count-first ordering (`countKids` → `safeActive` → render), single positional counters, keyboard Enter/hover aligned to the same positions. No identity tracking, no TDZ hazard.

## Verification
- `npx eslint`: 0 errors (1 resubscribe warning, harmless).
- `npm run build` success, 97/97 pages.

## Manual check
1. Header search opens with Pages listed; type "rooms" → Room Management; Enter/click navigates; room results appear and navigate prefiltered.

Awaiting review. Say `"push"` only when you want commit + push.
