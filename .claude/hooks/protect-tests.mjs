// PreToolUse (Edit/Write/MultiEdit/NotebookEdit): block changes to EXISTING test files and test fixtures.
// New test files are allowed. Override: create .claude/allow-test-edits (gitignored) in the checkout
// being edited; delete it to re-lock.
import { deny, exists, readInput, target } from "./lib.mjs";

const TEST_FILE = /(\.test\.[cm]?[jt]sx?$)|(\/__fixtures__\/)|(\/__tests__\/)/;

const input = await readInput();
const t = target(input);
if (!t || !TEST_FILE.test(`/${t.file}`) || !exists(t.root, t.file)) process.exit(0);
if (exists(t.root, ".claude/allow-test-edits")) process.exit(0);

deny(
  `"${t.file}" is an existing test file and is protected. Don't change existing test expectations to make code pass. ` +
    "Stop and explain to Malcolm which test is failing and why you believe it is wrong. " +
    "If he agrees the test must change, he will create .claude/allow-test-edits to unlock test edits.",
);
