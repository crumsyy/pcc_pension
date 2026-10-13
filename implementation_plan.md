# Implementation Plan — Aurora UI Redesign for PCC Pension Landing Page

> **RequestFeedback: true** — STOP here. No code changes made. Proceed only on explicit user approval.

## 1. Goal
Transform the **PCC Home Suite Home Landing Page** ([`app/page.js`](file:///c:/Users/Nitro/Downloads/From%20Old%20Laptop/Capstone%20file/pcc_pension/app/page.js)) into an inspiring, modern **Aurora UI** experience while strictly staying within the **official PCC brand color family**:
- **PCC Royal Blue**: `#2155B5` & `#163E82`
- **PCC Emerald / Leaf Green**: `#3FA34D` & `#10B981`
- **PCC Mint & Light Glow**: `#CDEBCF` & `#A7F3D0`
- **PCC Cream & Mist**: `#F6FAF7` & `#E5EFE6`
- **Charcoal Text**: `#0f172a` & `#1F2A24`

---

## 2. Aurora UI Concepts Adapted for PCC Pension
1. **Luminous PCC Aurora Mesh Gradients**:
   - Multi-stop atmospheric mesh gradients blending deep PCC Royal Blue into Emerald Green and soft Mint glow.
   - Smooth iridescent border glows (`border: 1px solid rgba(33, 85, 181, 0.18)` or `rgba(255, 255, 255, 0.6)`).
2. **Frosted Glassmorphism Surfaces**:
   - Translucent card containers (`backdrop-filter: blur(16px)`, `background: rgba(255, 255, 255, 0.88)` in light mode, `rgba(15, 23, 42, 0.8)` in dark mode).
3. **Hero Experience ("Your sanctuary away from home")**:
   - Ambient aurora backdrop with radial illumination.
   - Gradient-clipped headline and floating feature badges (*"✨ Zone 1 Center &bull; 🌿 Restful Stay &bull; 🛡️ Verified Direct Booking"*).
   - Elevated glassmorphic Booking Console with date pickers, room selectors, and glowing aurora search button.
4. **Room & Stay Showcase**:
   - Polished room cards with frosted glass carousel controls, glowing availability pills (live pulsing green dot for `Available`), occupancy badges, and side-by-side breakfast pricing comparison.
   - Floor directory with luminous floor tags.
5. **Special Offers & Voucher Cards**:
   - Elegant promotional cards with emerald & blue aurora accent lines, discount pill badges, and validity dates.
6. **Guest Testimonials & Trust Experience**:
   - Social proof cards featuring guest experiences in Koronadal City, star ratings, and hospitality highlights.
7. **Stay Planner / Concierge CTA**:
   - Luminous trip & stay planner banner inviting guests to inquire about group bookings, extended stays, or family packages.
8. **100% Business Logic Integrity**:
   - All booking rules (0–2 day lead limit), API requests (`/api/landing`, `/api/rooms/availability`, `/api/guest/reservations`, `/api/auth/session-check`), date validations, and guest/staff redirection remain 100% intact.

---

## 3. Verification Plan
- **Build Verification**: Run `npm run build` to ensure zero compilation or syntax errors with Turbopack.
- **Visual & Contrast Verification**: Ensure text contrast meets WCAG AA standards (minimum 4.5:1) across all frosted cards and aurora backgrounds.
- **Workflow Verification**: Test date picking, search availability modal trigger, and booking redirection flows.

---

## 4. Questions / Confirmation
- Ready to proceed with transforming [`app/page.js`](file:///c:/Users/Nitro/Downloads/From%20Old%20Laptop/Capstone%20file/pcc_pension/app/page.js) into the Aurora UI style with PCC's color family? Click **Proceed** to execute.
