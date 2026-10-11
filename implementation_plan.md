# Implementation Plan — Collapsed receptionist sidebar shows icons only (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. User request
- Collapsed receptionist sidebar is broken: labels are clipped to a single letter ([Image 1]). When collapsed, hide labels, leave icons.

## 2. Evidence / root cause
- Desktop sidebar shrinks `240px → 76px` when `collapsed` (`SidebarClient.js:338`); logo, section caption, profile block, and Log Out button all respect `collapsed` (lines 349-423).
- Admin links hide labels + center icons when collapsed (lines 234-251: `title={collapsed ? label}`, `justifyContent: collapsed ? 'center' : 'flex-start'`, `{!(collapsed) && <span>{label}</span>}`).
- Receptionist links render through `ReceptionistSidebarNav` (`SidebarClient.js:224-227`), which receives only `pathname` + `icons` and **unconditionally renders `<span>{label}</span>`** (`ReceptionistSidebarNav.js:60`). At 76px width the labels clip to one letter — exactly the screenshot.
- `renderNavLinksList()` is shared by the mobile offcanvas (always 260px, labels must stay) and the desktop sidebar (collapsible).

## 3. Proposed changes
1. `ReceptionistSidebarNav.js`: accept `collapsed = false` prop.
   - `title={collapsed ? label : undefined}` on the `Link` (tooltip, mirrors admin).
   - Link style `justifyContent: collapsed ? 'center' : 'space-between'` (keep `space-between` expanded so the Inquiries alert badge stays right-aligned; `center` when collapsed).
   - `{!collapsed && <span>{label}</span>}`; hide the Inquiries alert badge when collapsed (`{!collapsed && isInquiries && ...}`) so it can't overflow the 76px rail (badge reappears on expand; count keeps polling).
   - Inner icon wrapper keeps `width 20px / flexShrink 0`; add `margin: collapsed ? '0 auto' : undefined` if needed for perfect centering (verify visually).
2. `SidebarClient.js`: `renderNavLinksList(forCollapsed=false)` — pass `collapsed` only for the desktop sidebar call (line 392: `renderNavLinksList(true)` → `<ReceptionistSidebarNav ... collapsed={collapsed} />` and admin branch uses the flag instead of closure state); offcanvas call (line ~304) stays expanded so mobile drawer always shows labels even if desktop is collapsed.
   - Simplest: change signature to `renderNavLinksList(isDesktopSidebar)` and use `const hideLabels = isDesktopSidebar && collapsed`.

## 4. Verification
- `eslint` on both files (pre-existing families only).
- Visual: expand → full labels + badge; collapse → centered icons only with tooltips; mobile offcanvas unaffected; admin sidebar untouched.
- No API/state changes; `collapsed` still persisted in `localStorage`.

## 5. Risks / notes
- None behavioral; pure presentational, mirrors the existing admin collapsed pattern.

## 6. Questions for user
- Q1: When collapsed, hide the Inquiries unread badge too (recommended, avoids overflow), or keep a dot/count on the icon?
