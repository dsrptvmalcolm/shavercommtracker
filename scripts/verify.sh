#!/usr/bin/env bash
# The project's quality gate: typecheck → lint → test. Stops at the first failure.
# Used by the `verify` skill and by the pre-commit hook in .claude/settings.json.
set -uo pipefail
cd "$(dirname "$0")/.."

run() {
  echo "▶ $1"
  if ! eval "$2"; then
    echo "✖ $1 failed — fix this before continuing."
    exit 1
  fi
  echo "✔ $1 passed"
  echo
}

run "Typecheck" "npm run --silent typecheck"
run "Lint" "npm run --silent lint"
run "Tests" "npm test --silent"
echo "✔ All checks passed"
