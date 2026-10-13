# Implementation Plan — Redesign Landing Page with Modern FLAT Design UI

> **RequestFeedback: true** — STOP here. No code changes made. Proceed only on explicit user approval.

## 1. Goal
Overhaul the landing page ([`app/page.js`](file:///c:/Users/Nitro/Downloads/From%20Old%20Laptop/Capstone%20file/pcc_pension/app/page.js)) to strictly implement **Modern Flat Design UI** (Style ID: `flat-design` from the UI/UX Pro Max architecture), replacing soft blurred gradients, mushy drop-shadows, and bubbly contours with crisp lines, bold color blocking, precise geometric cards, and high-contrast typography.

---

## 2. Flat Design UI Principles Applied
1. **Zero Gradients & Zero Heavy Drop Shadows**:
   - Remove fuzzy box-shadows (`box-shadow: none`), backdrop-blur gradients, and radial lighting.
   - Use crisp solid background fills (`#ffffff`, `#f8fafc`, `#f1f5f9`, `#0f172a`).
2. **Crisp 1px & 2px Geometric Borders**:
   - Clean, well-defined border strokes (`border: 1px solid #e2e8f0` or `2px solid #2563eb`) with uniform, crisp geometry (`rounded-md` / `rounded-lg` 4–8px radius instead of oversized bubbly pills).
3. **Bold Solid Color Blocking (4–5 Curated Palette Tokens)**:
   - **Primary Action**: Solid Cobalt/PCC Blue (`#1e40af` / `#2563eb`)
   - **Success / Available**: Solid Emerald (`#059669` / `#10b981`)
   - **Discount / Alert**: Solid Crimson/Rose (`#e11d48`)
   - **Surfaces**: Crisp White (`#ffffff`) & Light Slate (`#f8fafc`)
   - **Text Hierarchy**: Jet Slate (`#0f172a`) & Crisp Muted (`#475569`)
4. **Structured Geometric Layout**:
   - **Navigation**: Clean solid bar with sharp borders, bold active states, and crisp rectangular/pill action buttons.
   - **Hero & Booking Engine**: Clean side-by-side block layout with solid contrast; booking engine as a framed console with crisp input borders and bold solid submit button.
   - **About & Metric Blocks**: Flat solid metric tiles with high-contrast numbers and crisp dividers.
   - **Promotions**: Flat ticket-style cards with solid color header stripes, crisp percentage badges, and direct solid buttons.
   - **Rooms & Rates**: Clean grid of bordered cards with flat carousel buttons, solid status chips (no fuzzy glow), and clear tabular rate comparison.
   - **Amenities**: Clean geometric feature tiles with solid monoline SVG/Lucide icons and clear borders.
   - **Modal**: Clean high-contrast dialog with solid borders and crisp buttons.
5. **Immediate, Crisp Micro-Interactions**:
   - Instant or snappy (150ms) border/color shifts on hover instead of floaty multi-layer blur animations.

---

## 3. Preserved Business Logic (100% Intact)
- All booking lead constraints (today up to 2 days ahead max).
- Date validation logic (`isValidDate`, `toDbDate`).
- Real-time endpoints: `/api/landing`, `/api/rooms/availability`, `/api/guest/reservations`, `/api/auth/session-check`.
- Guest vs Staff redirection and reservation workflows.

---

## 4. Verification Plan
- Verify clean Turbopack build with `npm run build`.
- Verify responsive layout on mobile, tablet, and desktop viewports.
- Confirm complete absence of muddy shadows or radial blurs, replaced with sharp flat aesthetics.

---

## 5. Questions / Confirmation
- Ready to proceed with redesigning the landing page into a sharp, modern Flat Design UI? Click **Proceed** to execute.
