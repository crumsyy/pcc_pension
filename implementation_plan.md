# Implementation Plan — Discount apportionment move, breakfast regroup, Orders rename, icon removal (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. User feedback (Images 1–6)
1. **Discount split box misplaced (Image 1):** yellow "How the discount was split per guest" box sits under Room Rent Charges — should live in the discount part (Section 5 Applied Discounts). Notes Apply button correctly stays in Occupancy (Section 3).
2. **Breakfast info misplaced (Image 2):** complimentary package line + Breakfast Schedule dates currently render inside Occupancy & Capacity — should belong to Room Rent Charges (Section 2), since breakfast is part of room package/fee.
3. **Rename:** `Orders & Room Service` → `Orders` only.
4. **Remove emoji/icons on labels generally in Billing (Images 3–6):** section headers show cart/clipboard/receipt/person/house icons; body labels show coffee-cup icon + other glyphs. Strip them for a clean text-only look.

## 2. Proposed changes (only `app/receptionist/billing-checkout/BillingTab.js`, structure/text only)
1. **Move apportionment box:** cut yellow per-guest split box from below Room Rent table → paste as first block inside Section 5 Applied Discounts (above beneficiary badges). Room Rent keeps only charge rows.
2. **Move breakfast blocks:** cut complimentary-breakfast line + Breakfast Schedule dates block out of Section 3 Occupancy → paste directly under Room Rent table (after Net/fee rows, before apportionment's old spot), labeled as part of Section 2 content. Occupancy keeps headcount cards + capacity status + Apply/Edit button only.
3. **Rename:** Section 6 title `Orders & Room Service` → `Orders`; hint kept ("Charged from the Orders tab — view only here."). Leave empty-state copy unchanged unless trivial.
4. **Icon removal (Billing tab statement + read-only totals card):**
   - `SectionHeader`: drop icon rendering (keep number badge + title + Editable/View-only badge + hint). Remove `icon` prop usage at all 9 call sites.
   - Body labels: remove decorative glyphs — coffee-cup `bi-cup-hot-fill` in complimentary line, `bi-calendar-check` in breakfast date badges, `bi-people-fill`, `fa-percent` kept only inside the Apply/Edit button itself (functional button icon stays), `fa-tags`/`fa-user-check` in totals discount mini-card, `fa-calculator` in Net Total row. Replace with plain text; no layout change.
   - No changes to Payments tab, modals, or logic.

## 3. Verification
- Visual: apportionment yellow box inside Applied Discounts; breakfast lines under Room Rent; Section 6 reads "Orders"; no icons/emoji in Billing statement or totals card (buttons' own small glyphs excepted).
- `grep -n "bi-.*\|fa-solid\|🍳\|☕" BillingTab.js` → zero hits in statement/totals JSX (excluding Apply/Edit button + unrelated modal icons if kept).
- `npm run build` passes.

## 4. Risks
- Low: moves + text only. Breakfast relocation changes familiar layout — confirm receptionists accept breakfast under Room Rent.

## 5. Questions
- Q1: Proceed exactly as above?
- Q2: Should the Apply/Edit button keep its `%` glyph, or go fully text-only too?
