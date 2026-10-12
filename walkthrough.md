# Walkthrough — Vercel git-fetch failure

## Changes
- Deleted stray untracked file `-` from repo root. No code changes (none applicable).

## Diagnosis recap
- Repo healthy, tiny, no submodules; commit on GitHub; local build green → failure is Vercel-side metadata fetch.

## Still needed (Vercel dashboard)
1. Click **Redeploy** on the failed deployment.
2. If it repeats, reconnect the GitHub integration under Project Settings → Git.
3. Rotate the PAT embedded in the git remote URL.
