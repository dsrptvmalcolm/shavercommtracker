---
name: verify
description: Run the project's quality gate (typecheck, lint, tests) and report the real output. Use before saying any task is done, before every commit, and whenever asked to "verify" or "check" the work.
allowed-tools: Bash(scripts/verify.sh) Bash(bash scripts/verify.sh)
---

# Verify

1. Run `scripts/verify.sh` from the project root. It runs, in order and stopping at the first failure:
   - `npm run typecheck` (tsc --noEmit)
   - `npm run lint` (eslint)
   - `npm test` (vitest)
2. Show the actual output — at minimum each ✔/✖ line and the test count. Never summarize a failure as a pass.
3. If a check fails, stop and fix the cause. Do not edit existing tests to make them pass (see CLAUDE.md, test integrity).
4. Passing checks is necessary, not sufficient. Also exercise the affected flow:
   - UI change → open it in the browser with a QA login (`@shaver.test`, deleted afterwards).
   - Database change → verify RLS as a salesperson inside a rolled-back transaction.
   - Pure logic → the tests above are the exercise.

## Known gaps
<!-- added 2026-10-02: initial setup -->
- No formatter (Prettier) — eslint `--fix` runs on edited files via hook instead.
<!-- added 2026-10-02: initial setup -->
- No CI — this skill and the pre-commit hook are the only gate before deploy.
<!-- added 2026-10-02: initial setup -->
- No automated UI/integration tests — UI flows are verified manually in the browser.
<!-- added 2026-10-02: initial setup -->
- `npm run build` isn't part of verify (slow); run it before pushing changes to config, routing or dependencies.
