# Walkthrough — Modern shadcn Catalog Picker with Smart Flip (no commit/push yet)

## Change (`app/admin/purchase-orders/page.js`, Combobox only)
- Option list rebuilt on shadcn `CommandList`/`CommandItem` (PCC-blue active highlight, dark-mode aware, keyboard ↑↓/Enter selection, Escape closes).
- Smart flip: measures space above/below on open; drops upward (capped to available space) when the footer crowds it, otherwise downward as before.
- Preserved: search filter (now via `keywords`), stock rows, selection + clear-on-empty, disabled state, blur-to-close, toggle button. Empty state uses the standard "No results found."
- Untouched: dialog shell/size, table, footer, submit logic.

## Verification (actually performed)
- `npx eslint`: 5 problems before = 5 after (pre-existing). `npm run build`: 97/97.

Say `"push"` only when you want commit + push.
