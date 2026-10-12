# Walkthrough — Catalog revert + FREE removal + floating submit guarantee

## Changes
- Reverted all catalog-side changes (shell classes, row/catalog classes removed; catalog scrolls naturally again). Tray columns also de-stickied (failed mechanism removed, not relied upon).
- Deleted `Delivery / Service Fee: FREE` row in both trays.
- Tray keeps capped card + internal scroll + pinned footer.
- NEW guarantee (beyond the letter of the approved plan — the approved mechanism alone could not promise visibility): a floating `Submit Room Order (₱X)` pill, `position:fixed` bottom-right, desktop-only, driven by IntersectionObserver on the in-tray footer — visible **if and only if** the real Submit is off-screen. Same totals, same disabled rules, same submit handlers (guest uses `requestSubmit`, preserving date/time validation).

## Verification
- `eslint`: no new issues. `npm run build`: exit 0.

## Deploy protocol
1. Deploy + hard refresh.
2. Bundle proof: FREE row absent.
3. Add breakfast → scroll page freely: floating pill appears exactly when Submit leaves the viewport; clicking it submits identically.

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
