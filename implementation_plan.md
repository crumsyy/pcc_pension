# Implementation Plan — Modal Inter Enforcement + shadcn Confirmations (Phase 0+1)

## Scope (user-approved)
- Phase 0: Inter enforcement rule for Bootstrap modal surfaces (`globals.css`, same pattern as tables/toasts).
- Phase 1: Rebuild `ModalDialog` internals on shadcn `Dialog` primitives (same props/API, all `showConfirm` calls upgrade with zero call-site changes); non-dismissable backdrop to match current behavior; dark-mode + Inter via existing `pcc-dialog` styles.
- Out of scope: form-modal migration (Phase 2), behavior/logic changes. Verify: eslint stash-compared, build 97/97. Commit/push only on "push".
