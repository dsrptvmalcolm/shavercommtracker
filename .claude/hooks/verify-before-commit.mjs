// PreToolUse (Bash): any `git commit` must pass scripts/verify.sh (typecheck → lint → test) first.
import { spawnSync } from "node:child_process";
import { deny, projectDir, readInput } from "./lib.mjs";

const input = await readInput();
const command = input.tool_input?.command ?? "";
if (!/\bgit\b[^;&|]*\bcommit\b/.test(command)) process.exit(0);

const res = spawnSync("bash", ["scripts/verify.sh"], { cwd: projectDir, encoding: "utf8" });
if (res.status !== 0) {
  const output = `${res.stdout}${res.stderr}`.trim().split("\n").slice(-40).join("\n");
  deny(`Commit blocked: scripts/verify.sh failed. Fix the failure, then commit again.\n\n${output}`);
}
