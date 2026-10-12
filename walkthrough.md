# Walkthrough — shadcnUI tabs for Conversations filter

## Changes (only `app/receptionist/inquiries/page.js`)
- Replaced the custom `btn-group` filter buttons with shadcn `Tabs/TabList/Tab` (All / Pending / Responded / Closed), same state values and filtering behavior.
- Per-status colors retained where they belong (list badges, detail header).

## Verification
- `npm run build` → success.
- Manual: each tab filters the conversation list as before.
