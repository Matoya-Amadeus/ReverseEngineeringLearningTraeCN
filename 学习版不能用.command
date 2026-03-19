#!/bin/zsh
set -euo pipefail

CONTENT_ROOT="$(cd "$(dirname "$0")" && pwd)"
APP_ROOT="$CONTENT_ROOT/Resources/app"
RUNTIME_APP_ROOT="$CONTENT_ROOT/electron-v39.2.7-darwin-arm64/Electron.app/Contents"
ELECTRON_BIN="$RUNTIME_APP_ROOT/MacOS/Electron"
LOG_DIR="$CONTENT_ROOT/反编译/反向框架/docs/runtime-logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/open-entry-$(date +%Y%m%d-%H%M%S).log"

if [[ ! -x "$ELECTRON_BIN" ]]; then
  osascript -e 'display alert "启动失败" message "未找到自有运行时：electron-v39.2.7-darwin-arm64/Electron.app" as critical'
  exit 1
fi

# 仅用于学习/测试：清理潜在隔离标记，避免运行时被系统误拦截。
/usr/bin/xattr -dr com.apple.quarantine "$CONTENT_ROOT/electron-v39.2.7-darwin-arm64/Electron.app" >/dev/null 2>&1 || true

# 仅用于学习/测试：硬自检（仅检查“未打补丁的私有导入模式”）。
# 若仍保留原始私有导入，而运行时缺少对应能力，则直接终止，避免反复拉起失败。
APP_HAS_UNPATCHED_AHA_IMPORT="0"
if rg -n --max-count 1 'import\{ahaIpc as C7e\}from"electron";' "$APP_ROOT/out/main.js" >/dev/null 2>&1; then
  APP_HAS_UNPATCHED_AHA_IMPORT="1"
fi
if rg -n --max-count 1 'import bU from"path";import\{ahaProcess as zhe,app as Ghe,ahaIpc as Jhe,ahaReporter as Khe\}from"electron";' "$APP_ROOT/out/main.js" >/dev/null 2>&1; then
  APP_HAS_UNPATCHED_AHA_IMPORT="1"
fi
RUNTIME_HAS_AHAIPC="0"
if rg -a -n --max-count 1 "ahaIpc" "$RUNTIME_APP_ROOT" >/dev/null 2>&1; then
  RUNTIME_HAS_AHAIPC="1"
fi

if [[ "$APP_HAS_UNPATCHED_AHA_IMPORT" == "1" && "$RUNTIME_HAS_AHAIPC" != "1" ]]; then
  echo "[open-entry] ts=$(date -Iseconds) preflight=fail reason=missing_ahaIpc_runtime_for_unpatched_app" >> "$LOG_FILE"
  osascript -e 'display alert "启动已阻止" message "检测到未打补丁的私有 aha 导入，但当前运行时不具备该能力。\n\n请先使用学习测试补丁，或换成包含 ahaIpc 的私有运行时。" as critical'
  exit 1
fi

RUNTIME_ROOT="$CONTENT_ROOT/.runtime-data-native"
USER_DATA_DIR="$RUNTIME_ROOT/user-data"
RUNTIME_HOME="$RUNTIME_ROOT/home"
CODEX_HOME_DIR="$RUNTIME_HOME/.codex"
mkdir -p "$USER_DATA_DIR" "$RUNTIME_HOME" "$CODEX_HOME_DIR" "$CODEX_HOME_DIR/skills" "$CODEX_HOME_DIR/memories" "$RUNTIME_ROOT/appdata"

# 仅用于学习/测试：隔离个人数据目录，避免读取真实规则与技能。
export HOME="$RUNTIME_HOME"
export CODEX_HOME="$CODEX_HOME_DIR"
export VSCODE_APPDATA="$RUNTIME_ROOT/appdata"
export TRAE_LEARNING_MODE="1"
export TRAE_NATIVE_FAKE_LOGIN="1"
export TRAE_DISABLE_NETWORK="1"
export TRAE_EMPTY_MODELS="1"
HOOK_REL="./反编译/反向框架/launcher/native-fake-login-hook.cjs"
export NODE_OPTIONS="--require=$HOOK_REL ${NODE_OPTIONS:-}"

# 仅用于学习/测试：确保只拉起 Contents 内自有运行时。
pkill -f "$ELECTRON_BIN $APP_ROOT" >/dev/null 2>&1 || true
sleep 1

echo "[open-entry] ts=$(date -Iseconds) runtime=self-electron app=$APP_ROOT preflight=ok" >> "$LOG_FILE"
cd "$CONTENT_ROOT"

# 仅用于学习/测试：以可见模式启动。若进程秒退，弹窗提示并给出日志路径，避免双击无感。
nohup "$ELECTRON_BIN" "$APP_ROOT" --user-data-dir="$USER_DATA_DIR" --new-window >> "$LOG_FILE" 2>&1 < /dev/null &
APP_PID=$!
(disown "$APP_PID" >/dev/null 2>&1 || true)
sleep 2
if ! kill -0 "$APP_PID" >/dev/null 2>&1; then
  osascript -e "display alert \"启动失败\" message \"学习版启动后立即退出。\\n请查看日志：$LOG_FILE\" as critical"
  exit 1
fi
exit 0
