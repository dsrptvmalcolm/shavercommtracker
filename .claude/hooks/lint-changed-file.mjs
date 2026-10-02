// PostToolUse (Edit/Write/MultiEdit): auto-fix lint on the changed file and report anything left.
// Exit 2 sends the remaining problems back to Claude to fix.
import { spawnSync } from "node:child_process";
import { exists, projectDir, readInput, targetPath } from "./lib.mjs";

const input = await readInput();
const file = targetPath(input);
if (!file || !/\.(ts|tsx|js|jsx|mjs)$/.test(file) || file.startsWith("node_modules/") || !exists(file)) process.exit(0);

const res = spawnSync("npx", ["eslint", "--fix", file], { cwd: projectDir, encoding: "utf8" });
if (res.status !== 0) {
  process.stderr.write(`ESLint found problems in ${file} after auto-fix:\n${res.stdout}${res.stderr}`);
  process.exit(2);
}
