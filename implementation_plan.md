# Implementation Plan — Rooms Tabs, Header Search, User Menu, Receptionist Parity

## 1. Goals
(a) Rooms: shadcn Tabs, "Active Rooms"→"Rooms". (b) Header search bar (admin + receptionist): pages + rooms palette. (c) Clickable header user → shadcn DropdownMenu (Profile dialog + Logout) + Avatar, both portals. (d) Receptionist collapsible sidebar. (e) Remove receptionist skeleton loading. No API/DB changes.

## 2. Current State (assumed from prior work, to verify during implementation)
- Rooms uses Bootstrap `nav-tabs` (`showArchived` state); rename is one string.
- Header (`SidebarClient.js` desktop header + mobile bar) has empty middle; session available as prop.
- No `DropdownMenu`/`Avatar`/command-palette components exist.
- Receptionist collapse gated by `isAdmin`; receptionist skeleton usage to be inventoried (`ReceptionistSkeletons`, `SkeletonTable`).

## 3. Scope and Design
- Rooms Tabs via `components/ui/tabs.jsx`; rename only the active-tab label.
- `components/ui/command.jsx` (shadcn-style palette: input + grouped results, keyboard up/down/enter/esc) fed by a static per-role destination map + live room-number results from existing list APIs (debounced); Enter navigates (management pages; rooms pre-filtered only where the page honors query — else plain navigation, stated in walkthrough).
- `components/ui/dropdown-menu.jsx` + `avatar.jsx` (shadcn-style API, theme/Inter, dark parity); Avatar = initial circle (existing look); menu items Profile (opens read-only session-info dialog — no new route) + Logout (existing confirm modal).
- Sidebar: drop `isAdmin` gate on collapse (persist key shared or per-role? shared key, simplest).
- Skeletons: cache-first + background revalidate per receptionist page, mirroring the admin playbook; skeleton files kept.

## 4. Steps
1. Rooms tabs + rename. 2. Command palette + header search wiring (desktop; mobile bar keeps drawer toggle). 3. Dropdown + Avatar + Profile dialog. 4. Collapse gate. 5. Skeleton inventory + removal. 6. Lint + build + manual. 7. Walkthrough; no commit/push until `"push"`.

## 5. Acceptance
- Rooms tabs renamed/styled; header search finds pages + rooms and navigates; user menu shows avatar/initial with Profile dialog + Logout; receptionist rail collapses/persists; no skeleton flash in receptionist; build passes.

## 6. Risks
- Palette room-prefilter only where supported (stated); new-component hand-built styling reviewed visually.
