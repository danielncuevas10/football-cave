---
name: feedback-no-commits
description: Never commit — committing is always the user's decision
metadata:
  type: feedback
---

Never create git commits. Committing is always the user's decision, not mine.

**Why:** User was explicit: "never commit, that's up to me." Taking this action unprompted breaks their workflow.

**How to apply:** After finishing code changes, stop. Do not run `git add`, `git commit`, or `git push` unless the user explicitly says "commit this" or "push this."
