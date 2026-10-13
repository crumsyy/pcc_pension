# Implementation Plan — Modernize Types & Floors modal (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Request (Image 1)
Modal works but looks dated. Modernize UI/UX only — zero logic/API changes.

## 2. Proposed changes (only the lookups modal in `RoomsClient.js`)
- Cards with soft radius + subtle shadow instead of flat bordered boxes; section headers with count pills.
- Icon action buttons (pencil / trash) replacing blue/red text Edit/Delete buttons; delete guarded same as now.
- Room-type rows as icon-led tiles (bed icon, name, pax/foam meta chips); floors as compact rows.
- Forms: floating-style labels, full-width gradient primary submit, inline "editing" state with cancel-to-new; helper footnote with info icon.
- Footer: neutral Close (grey) instead of red.

## 3. Verification
- `npm run build` passes; visual matches modern admin styling; all flows identical (add/edit/delete/guards).

## 4. Risks
- Minimal: className-only changes.

## 5. Questions
- Q1: Proceed?
