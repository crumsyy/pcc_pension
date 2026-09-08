<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# User Workflow Rules
1. **Implementation Plan First**: On any task or modification, always create an `implementation_plan.md` first (with `RequestFeedback: true`) and STOP. Never write code, modify files, or run modifying commands until the user explicitly clicks Proceed or gives approval.
2. **Git Commit & Push**: Never commit or push to Git until the user reviews `walkthrough.md` and explicitly issues the exact keyword `"push"`.

