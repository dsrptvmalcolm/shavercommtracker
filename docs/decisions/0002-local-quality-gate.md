# 0002 — Local quality gate instead of CI

**Date:** 2026-10-02
**Status:** Accepted

## Context
Work is committed straight to `main`, and every push deploys to production (team.shavercars.com) through Vercel. There is no pull-request flow and no CI, so nothing objective sits between a change and the live app unless it runs locally. Claude Code does not automatically run a `verify` skill before commits.

## Decision
- `scripts/verify.sh` is the single quality gate: `npm run typecheck` → `npm run lint` → `npm test`, stopping at the first failure.
- A Claude Code PreToolUse hook (`.claude/hooks/verify-before-commit.mjs`, registered in `.claude/settings.json`) runs `scripts/verify.sh` before any `git commit` and blocks the commit if it fails.
- Supporting hooks keep the gate meaningful: existing tests and fixtures can't be edited (`protect-tests.mjs`, override with `.claude/allow-test-edits`); secrets, the lockfile and applied migrations can't be written (`protect-sensitive.mjs`); edited files are lint-fixed (`lint-changed-file.mjs`).
- The `verify` skill runs the same script and must show its output before work is reported as done.

## Alternatives rejected
- **GitHub Actions on pushes/PRs** — declined by Malcolm (2026-10-02). With direct-to-`main` deploys it would only report failures after they were already live.
- **Git pre-commit hook (husky / `.git/hooks`)** — would need a new dependency or untracked local setup, and wouldn't explain failures back to Claude.
- **Written instruction only ("always run tests before committing")** — not mechanically enforced.

## Consequences
- The gate only covers commits made through Claude Code in this repo. Commits made by hand in a terminal bypass it — run `scripts/verify.sh` yourself first.
- `npm run build` and UI flows aren't in the gate (build is slow; there are no UI tests). They must be checked manually for config, routing, dependency and UI changes.
- Removing or loosening any of these hooks removes the only pre-deploy check. Treat that as reversing this decision: ask first and record a superseding entry.
- If a PR flow or CI is adopted later, CI should run `scripts/verify.sh` so local and remote checks stay identical.
