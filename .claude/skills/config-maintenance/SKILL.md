---
name: config-maintenance
description: Monthly audit of the Claude Code setup (CLAUDE.md files, .claude/rules, skills, hooks, agents, decisions). Finds broken paths and commands, unsourced or conflicting rules, rules duplicated by checks, and CLAUDE.md length; optionally prepares a model-upgrade comparison. Proposes changes only — never deletes without approval.
disable-model-invocation: true
---

# Config maintenance (monthly)

See `docs/claude-maintenance.md` for the policy. Steps:

1. **Built-in audits.** Recommend Malcolm runs `/doctor prompt-audit` and `/insights` in an interactive Claude Code terminal (not available in every client). Offer to act on their findings.
2. **Broken references.** For every file path and command mentioned in `CLAUDE.md`, `src/**/CLAUDE.md`, `supabase/CLAUDE.md`, `.claude/rules/*.md`, `.claude/skills/*/SKILL.md`, `.claude/agents/*.md`: check the path exists and the command exists in `package.json` scripts or `scripts/`. Broken = evidence → propose fix or deletion.
3. **Rule hygiene.** Flag:
   - rules with no `<!-- added … -->` origin comment;
   - rules that contradict each other (across all instruction files and auto-memory);
   - rules that duplicate what ESLint, TypeScript, a hook, a test or RLS already enforces (candidates for deletion — mechanical beats written).
   - Never propose removing anything in `.claude/rules/domain-rules.md`.
4. **Length.** Report `wc -l CLAUDE.md` against the 200-line limit.
5. **Hooks still fire.** Re-run the hook trigger tests described in `docs/claude-maintenance.md`.
6. **Model-upgrade test (on request).** List 3–5 representative tasks (e.g. add a spiff type with tests; add an admin page; write a migration with RLS; fix a UI bug). Plan to run each on a copy of the repo twice: full config vs. only `domain-rules.md` + `verify`. Recommend removing only workaround rules the bare run didn't need.
7. **Output:** a numbered list of proposed changes (file, change, evidence vs. hypothesis). Apply nothing until Malcolm approves each item.
