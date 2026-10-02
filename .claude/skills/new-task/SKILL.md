---
name: new-task
description: Create the per-task working folder dev/active/<task-name>/ from templates once a plan has been approved. Use at the start of any multi-step task, feature, or bug fix spanning more than one session.
---

# New task

Only after Malcolm has approved the plan:

1. Pick a short kebab-case task name (e.g. `split-deal-reporting`).
2. Create `dev/active/<task-name>/` and copy in `dev/templates/plan.md`, `context.md`, `tasks.md`.
3. Fill `plan.md` with the approved plan (goal, approach, affected areas, verification, risks). Link any `docs/decisions/` entries it depends on.
4. Fill `tasks.md` with the concrete checklist; keep the template's verify/exercise/confirm items at the end.
5. Fill `context.md` with today's date, status `in progress`, and the next step.
6. Tell Malcolm the folder path. `dev/active/` is gitignored — these are working notes, not deliverables.

If the work involves a significant architectural choice, also draft a `docs/decisions/NNNN-*.md` from `0000-template.md` and ask Malcolm to approve it.
