#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTENT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

CONTENT_ROOT="$CONTENT_ROOT"
RUNTIME_HOME="$CONTENT_ROOT/.runtime-home"
if ! mkdir -p "$RUNTIME_HOME" 2>/dev/null || ! touch "$RUNTIME_HOME/.rwtest" 2>/dev/null; then
  RUNTIME_HOME="/tmp/learning-edition-runtime/home"
  mkdir -p "$RUNTIME_HOME"
fi
CODEX_HOME_DIR="$RUNTIME_HOME/.codex"
mkdir -p "$CODEX_HOME_DIR" "$CODEX_HOME_DIR/skills" "$CODEX_HOME_DIR/memories"

# 仅用于学习/测试：仅隔离 CODEX_HOME，避免读取真实个人规则与技能目录。
export CODEX_HOME="$CODEX_HOME_DIR"
export TRAE_LEARNING_MODE="${TRAE_LEARNING_MODE:-1}"

cd "$ROOT_DIR"

# 仅用于学习/测试：默认启用假登录，避免离线环境触发真实认证流程。
export TRAE_FAKE_LOGIN="${TRAE_FAKE_LOGIN:-1}"

exec node src/shell/start-shell.mjs
