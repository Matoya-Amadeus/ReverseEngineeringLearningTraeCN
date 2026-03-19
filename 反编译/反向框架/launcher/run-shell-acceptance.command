#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTENT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

cd "$ROOT_DIR"

node tests/shell/run-shell-tests.mjs
echo "PHASE1_ACCEPTANCE_OK"
