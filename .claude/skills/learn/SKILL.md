---
name: learn
description: Turn a recurring mistake or a repeated correction from Malcolm into a durable fix using the promotion ladder (mechanical check first, then one targeted rule line). Use when the same correction has come up more than once.
---

# Learn — promotion ladder

Given a mistake that recurred:

1. **Can something objective catch it?** A test, an ESLint rule, a hook in `.claude/hooks/`, or a Postgres constraint/RLS check. If yes, build that, prove it fires (trigger it once), and stop here.
2. **If not, add ONE line** to the most specific place: a module `CLAUDE.md` or a `.claude/rules/*.md` file whose `paths:` match where the mistake happens. Add an origin comment above it: `<!-- added YYYY-MM-DD: <what went wrong> -->`. Root `CLAUDE.md` only if it applies to nearly every task.
3. **If a written rule is now enforced mechanically, delete the rule** (and say which check replaced it).

Never create or append to a general "lessons learned" file. Never edit `.claude/rules/domain-rules.md` unless the business rule itself changed and Malcolm confirmed it.

Report to Malcolm: the mistake, which rung you used, the exact change, and how you verified it.
