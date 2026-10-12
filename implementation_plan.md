# Implementation Plan — Sticky order tray (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Request (Image 1)
Tray scrolls away with the page; restore follow-scroll behavior without reintroducing the overlap bug.

## 2. Approach
- `position: sticky` (not `fixed`): tray stays in normal flow inside its side column, sticks below the header while scrolling, and can never overlay the search bar or catalog.
- `globals.css`: new `.orders-tray-sticky { position: sticky; top: 96px; max-height: calc(100vh - 116px); }` (+ dark-theme safe, no color rules).
- Guest + receptionist tray cards use the class with internal scroll for long carts; guest column drops `align-self-start` (sticky needs the full row height to travel).

## 3. Verification
- Scroll long catalog: tray follows; no overlap at any width; short carts unaffected; `npm run build` passes.

## 4. Risks
- Low: positioning only.

## 5. Questions
- Q1: Proceed?
