# Implementation Plan — shadcnUI tabs for Conversations filter (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Request (Image 1)
Replace the custom segmented buttons (All / Pending / Responded / Closed) in the Conversations panel header with shadcnUI tabs, matching the tab style already used elsewhere (e.g. Billing status filters).

## 2. Proposed changes (only `app/receptionist/inquiries/page.js`)
1. Import `Tabs, TabList, Tab` from `@/components/ui/tabs`.
2. Replace the `btn-group` block (lines ~362–375) with `<Tabs selectedKey={statusFilter} onSelectionChange={setStatusFilter}><TabList aria-label="Conversation status"><Tab id="All">…` etc. — same four values, same filtering behavior, no logic change.
3. Keep the per-status colors where they live now (list badges, detail header) — only the filter control changes.

## 3. Verification
- `npm run build` passes; visual: filter matches shadcn tab style; All/Pending/Responded/Closed filtering unchanged.

## 4. Risks
- Minimal: presentational swap on one control, state values unchanged.

## 5. Questions
- Q1: Proceed?
