#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTENT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

cd "$ROOT_DIR"

export TRAE_AUTH_REQUIRE_REAL_HAR="1"
export TRAE_AUTH_REQUIRE_REAL_LIVE_COVERAGE="1"
export TRAE_AUTH_REAL_LIVE_COVERAGE_MIN="1"
export TRAE_AUTH_AUTO_DISCOVER_REAL_HAR="1"

node replay/promote-real-capture-batch.mjs
node tests/auth/run-real-live-quality-strict-check.mjs
