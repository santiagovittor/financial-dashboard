#!/usr/bin/env bash
# PostToolUse hook: run targeted typecheck after editing source files.
# Receives the tool call as JSON on stdin.
# Exits 0 always — output is shown to Claude so it can fix any type errors.

INPUT=$(cat)

FILE=$(python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('file_path', ''))
except Exception:
    print('')
" <<< "$INPUT" 2>/dev/null || echo "")

[ -z "$FILE" ] && exit 0

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
[ -z "$REPO_ROOT" ] && exit 0

if echo "$FILE" | grep -q "apps.api"; then
    echo "→ typecheck @fin/api"
    (cd "$REPO_ROOT" && pnpm --filter @fin/api typecheck 2>&1 | tail -30)
elif echo "$FILE" | grep -q "apps.web"; then
    echo "→ typecheck @fin/web"
    (cd "$REPO_ROOT" && pnpm --filter @fin/web typecheck 2>&1 | tail -30)
elif echo "$FILE" | grep -q "packages.shared"; then
    echo "→ typecheck @fin/shared"
    (cd "$REPO_ROOT" && pnpm --filter @fin/shared typecheck 2>&1 | tail -30)
fi

exit 0
