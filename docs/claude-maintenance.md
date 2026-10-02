# Maintaining the Claude Code setup

**Owner:** Malcolm Heath (malcolm@dsrptv.digital). Changes to `CLAUDE.md` files, `.claude/` and `docs/decisions/` are reviewed by Malcolm before commit (there is no PR flow; Claude asks before committing).

## What exists

| Layer | Files |
|---|---|
| Instructions | `CLAUDE.md` (≤ 200 lines), module `CLAUDE.md` files in `src/lib/commission`, `src/lib`, `src/app`, `src/components`, `supabase`; `.claude/rules/*.md` (lazy-loaded by `paths:`) |
| Decisions | `docs/decisions/` |
| Checks | `scripts/verify.sh` (typecheck → lint → test), `verify` skill |
| Hooks (`.claude/settings.json`) | `protect-sensitive` and `protect-tests` before edits; `lint-changed-file` after edits; `verify-before-commit` before `git commit` |
| Permissions | deny Read/Edit of `.env*`, `.vercel/**`, `*.pem` |
| Workflow | `dev/templates/` → `dev/active/<task>/` (gitignored); skills `new-task`, `save-progress`, `learn`, `config-maintenance`; agents `code-reviewer`, `test-writer` |

## Overrides
- **Allow editing existing tests:** `touch .claude/allow-test-edits` (gitignored). Delete it to re-lock: `rm .claude/allow-test-edits`.
- **Hooks off temporarily:** comment the hook out of `.claude/settings.json` (don't commit that) or use a `.claude/settings.local.json` override.

## Pruning test
For every rule, skill, and hook: **"Would removing this cause Claude to make mistakes?"** If no, cut it.

- **Evidence → act now:** a referenced path or command that no longer exists — fix or delete immediately.
- **Hypothesis → test first:** "this rule might be unnecessary" — try the task without it (see model-upgrade test) before removing.
- **Never auto-retire:** anything in `.claude/rules/domain-rules.md`. It changes only when the business rule changes.
- Every rule carries an origin comment: `<!-- added YYYY-MM-DD: reason -->`. HTML comments are stripped from Claude's context, so they cost nothing.

## Cadence
| When | What |
|---|---|
| Each session | `save-progress` before ending; read `dev/active/<task>/` first when resuming |
| Weekly | `/memory` — review and prune stale auto-memory |
| Monthly | Run the `config-maintenance` skill (it also suggests `/doctor prompt-audit` and `/insights`) |
| New model release | With-config vs. without-config comparison (in `config-maintenance`, step 6) |
| Quarterly | Conflict check across all CLAUDE.md files, rules and auto-memory |

## Symptoms → fixes
| Symptom | Likely fix |
|---|---|
| Claude asks something CLAUDE.md already answers | Reword that line so it's findable |
| Claude ignores rules broadly | A file is too long or rules conflict — trim / resolve |
| Claude skips one specific rule | Emphasize that one line, or promote it to a check (`learn` skill) |
| Quality drops after a model update | Suspect stale workaround rules first |

**Key metric:** how often the same correction has to be repeated. If it isn't falling, the loop isn't working — use the `learn` skill.

## Auto-memory vs. curated rules
Auto-memory (`~/.claude/projects/.../memory/`) holds Claude's working notes. Enforced standards live only in CLAUDE.md files, `.claude/rules/`, hooks, and tests. If a memory states a standard, move it into the right rules file (or a check) and delete the memory.

## Re-testing hooks
Ask Claude to trigger each hook once and report:
1. Edit an existing `*.test.ts` → blocked. Create a new `*.test.ts` → allowed.
2. Write to `.env.local` → blocked (by deny rule and/or hook). Edit an existing `supabase/migrations/*.sql` → blocked.
3. Edit a `.ts` file with a lint error → hook reports it back.
4. `git commit` while a check fails → blocked with the failing output.
