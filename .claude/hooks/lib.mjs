// Shared helpers for Claude Code hooks. Hooks receive the tool call as JSON on stdin.
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

export const readInput = async () => {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  return raw ? JSON.parse(raw) : {};
};

/**
 * Root of the checkout that contains `path` — the main repo or a git worktree under
 * .claude/worktrees/ (a worktree has a `.git` file instead of a folder). Falls back to projectDir.
 */
export const repoRoot = (path) => {
  let dir = resolve(path);
  while (!existsSync(join(dir, ".git"))) {
    const up = dirname(dir);
    if (up === dir) return projectDir;
    dir = up;
  }
  return dir;
};

/** The file a file-editing tool is about to touch: its checkout root and its path relative to that root. */
export const target = (input) => {
  const t = input.tool_input ?? {};
  const p = t.file_path ?? t.path ?? t.notebook_path;
  if (!p) return null;
  const abs = resolve(input.cwd ?? projectDir, p);
  const root = repoRoot(dirname(abs));
  return { root, file: relative(root, abs) };
};

export const exists = (root, rel) => existsSync(resolve(root, rel));

/** Block a PreToolUse call and tell Claude why. */
export const deny = (reason) => {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason },
    }),
  );
  process.exit(0);
};
