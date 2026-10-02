// Shared helpers for Claude Code hooks. Hooks receive the tool call as JSON on stdin.
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";

export const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

export const readInput = async () => {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  return raw ? JSON.parse(raw) : {};
};

/** Path of the file a file-editing tool is about to touch, relative to the project. */
export const targetPath = (input) => {
  const t = input.tool_input ?? {};
  const p = t.file_path ?? t.path ?? t.notebook_path;
  return p ? relative(projectDir, resolve(projectDir, p)) : null;
};

export const exists = (rel) => existsSync(resolve(projectDir, rel));

/** Block a PreToolUse call and tell Claude why. */
export const deny = (reason) => {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason },
    }),
  );
  process.exit(0);
};
