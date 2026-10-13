# Implementation Plan — Manage room types & floors in Room Management (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Request
Room Management must create room types and floors; room create/edit then uses them from dropdowns (already dropdown-driven — no change needed there beyond refreshing lists).

## 2. Proposed changes
1. **API (`api/admin/rooms/route.js`, new actions, admin-authenticated):**
   - `create_room_type` (type unique, description, min/max occupancy, extraFoam) / `update_room_type` / `delete_room_type` (blocked while rooms reference it).
   - `create_floor` (name unique) / `update_floor` (rename) / `delete_floor` (blocked while rooms reference it).
2. **UI (`RoomsClient.js`):** "Manage Types & Floors" section (modal or inline cards): type list with add/edit/delete; floor list with add/rename/delete; validation + guards surfaced as toasts; room form dropdowns refresh from the same fetch so new entries appear immediately.
3. New types get no rates until set — room creation with a new type+floor requires rates (form already requires them; shared fallback covers display until per-room rows exist).

## 3. Verification
- Create type + floor → usable in room create immediately; duplicate names rejected; in-use delete blocked; `npm run build` passes.

## 4. Risks
- Low-medium: new write paths on lookup tables; guarded deletes; no existing-data changes.

## 5. Questions
- Q1: Proceed? Q2: Allow deleting floors/types with history (bookings referencing them), or block on any reference including past stays?
