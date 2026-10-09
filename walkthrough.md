# Walkthrough — DataTable Foundation + Inventory Pilot

## Changes (no commit/push yet)
- Installed `@tanstack/react-table@8.21.3` (pinned v8 — v9 renamed the APIs; verified against installed package).
- New `components/ui/table.jsx` (Table/Header/Body/Row/Head/Cell primitives, Bootstrap-compatible classes) + `components/ui/data-table.jsx` (TanStack shell: header groups, rows, stable keys, empty states) + Inter enforcement CSS. Hand-built shadcn-style, not CLI code.
- Pilot: inventory logs tab disposal + audit tables migrated with verbatim cell renderers (badges, colors, nowrap dates, sticky headers via existing global rule); pagination footers untouched.

## Verification
- `npx eslint`: pre-existing inventory finding + expected TanStack memoization warning only.
- `npm run build` success, 97/97 pages.

## Manual check (pilot)
1. Logs tab tables render identically (content, badges, actions, empty states); pagination works.
2. Remaining 49 tables untouched this round — phased rollout continues on approval.

Awaiting review. Say `"push"` only when you want commit + push.
