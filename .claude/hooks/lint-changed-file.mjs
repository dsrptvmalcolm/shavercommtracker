// PostToolUse (Edit/Write/MultiEdit): auto-fix lint on the changed file and report anything left.
// Exit 2 sends the remaining problems back to Claude to fix.
import { spawnSync } from "node:child_process";
import { exists, readInput, target } from "./lib.mjs";

const input = await readInput();
const t = target(input);
if (!t) process.exit(0);
const { root, file } = t;
if (!/\.(ts|tsx|js|jsx|mjs)$/.test(file) || file.startsWith("node_modules/") || !exists(root, file)) process.exit(0);

// Lint inside the checkout that owns the file, so a worktree uses its own config and dependencies
const res = spawnSync("npx", ["eslint", "--fix", file], { cwd: root, encoding: "utf8" });
if (res.status !== 0) {
  process.stderr.write(`ESLint found problems in ${file} after auto-fix:\n${res.stdout}${res.stderr}`);
  process.exit(2);
}
