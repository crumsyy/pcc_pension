# Walkthrough — Hard reset to 2ae4116

## Action taken (user-confirmed)
- `git reset --hard 2ae4116` — local tree now exactly at "Cancel dialogs confirm button labeled Confirm". Build passes.
- Dropped from history: per-room rates + revert, guest header, profile dropdown, calendar cleanup, 3-stage statuses, guest confirms fix, dialog button colors, order tray move, Vercel notes.

## NOT yet done — publishing requires a force-push
- `origin/main` is ahead (at `5fd7851`). Publishing this reset needs `git push --force origin main`, which rewrites shared history. Awaiting explicit `push` confirmation before doing that.
- Untracked files untouched: `FUNCTIONAL_REQUIREMENTS.md.backup`, `FUNCTIONAL_REQUIREMENTS_original.md`, `output_dfd/`.
