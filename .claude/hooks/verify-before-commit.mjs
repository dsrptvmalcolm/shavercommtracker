// PreToolUse (Bash): any `git commit` must pass scripts/verify.sh (typecheck → lint → test) first.
// Runs in the checkout being committed (main repo or a .claude/worktrees/ worktree), not always the main repo.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { deny, projectDir, readInput, repoRoot } from "./lib.mjs";

const input = await readInput();
const command = input.tool_input?.command ?? "";
if (!/\bgit\b[^;&|]*\bcommit\b/.test(command)) process.exit(0);

// Where the commit happens: `git -C <dir>`, else a leading `cd <dir> &&`, else the shell's cwd
const unquote = (s) => s.replace(/^["']|["']$/g, "");
const gitC = command.match(/\bgit\s+-C\s+("[^"]+"|'[^']+'|\S+)/);
const cdTo = command.match(/^\s*cd\s+("[^"]+"|'[^']+'|\S+)\s*&&/);
const dir = resolve(input.cwd ?? projectDir, unquote(gitC?.[1] ?? cdTo?.[1] ?? "."));
const root = repoRoot(dir);

const res = spawnSync("bash", ["scripts/verify.sh"], { cwd: root, encoding: "utf8" });
if (res.status !== 0) {
  const output = `${res.stdout}${res.stderr}`.trim().split("\n").slice(-40).join("\n");
  deny(`Commit blocked: scripts/verify.sh failed in ${root}. Fix the failure, then commit again.\n\n${output}`);
}
