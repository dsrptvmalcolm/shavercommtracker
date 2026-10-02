---
name: save-progress
description: Save the active task's state to dev/active/<task>/context.md and tasks.md before a session ends or context is compacted, and read them first when resuming. Use when wrapping up, pausing, or resuming work on a task.
---

# Save progress

## When ending or pausing
1. Find the active task in `dev/active/` (ask if there are several).
2. Update `context.md`: date, status, current state, decisions made (with why), the full list of files touched, open questions, and the exact next step.
3. Update `tasks.md`: tick completed items, add newly discovered ones.
4. Note whether `scripts/verify.sh` currently passes and whether anything is uncommitted.

## When resuming
1. Read `dev/active/<task>/context.md`, then `tasks.md`, then `plan.md` — before touching code.
2. Confirm the "next step" still makes sense against the current code (`git status`, `git log -5`).
3. Continue from the next step.
