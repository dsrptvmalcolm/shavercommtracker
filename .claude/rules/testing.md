---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "src/lib/commission/**"
  - "src/lib/months.ts"
---

# Testing

<!-- added 2026-10-02: initial setup -->
- Vitest, colocated `*.test.ts` next to the module. Run with `npm test`.
<!-- added 2026-10-02: initial setup -->
- Test pure logic (engine, months, formatting) directly — no mocks needed. Don't mock Supabase to test pages; exercise those in the browser with a QA login instead.
<!-- added 2026-10-02: initial setup -->
- Write tests from the rule/spec, not from the implementation's output (use the `test-writer` agent for new rules).
<!-- added 2026-10-02: initial setup -->
- Fixtures contain no customer names. The Airtable fixture is regenerated from exports, never hand-edited.
<!-- added 2026-10-02: initial setup -->
- Time-dependent code takes a `now: Date` parameter so tests can pin it (see `months.test.ts`).
