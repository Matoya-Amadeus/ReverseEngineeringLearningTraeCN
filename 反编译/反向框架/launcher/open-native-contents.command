#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTENT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

CONTENT_ROOT="$CONTENT_ROOT"
RECON_LAUNCHER="$ROOT_DIR/launcher/open-reconstructed.command"
LOG_DIR="$ROOT_DIR/docs/runtime-logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/native-launch-$(date +%Y%m%d-%H%M%S).log"

# 默认原生启动；如需走重建链路，可设置 TRAE_LAUNCH_MODE=reconstructed
LAUNCH_MODE="${TRAE_LAUNCH_MODE:-native}"

echo "[native-launch] ts=$(date -Iseconds) mode=$LAUNCH_MODE" >> "$LOG_FILE"

if [[ "$LAUNCH_MODE" == "reconstructed" ]]; then
  echo "[native-launch] route=reconstructed launcher=$RECON_LAUNCHER" >> "$LOG_FILE"
  export TRAE_FAKE_LOGIN="${TRAE_FAKE_LOGIN:-1}"
  exec "$RECON_LAUNCHER"
fi

APP_ROOT="$CONTENT_ROOT/Resources/app"
ELECTRON_BIN="$CONTENT_ROOT/MacOS/Electron"
HOOK_REL="./反编译/反向框架/launcher/native-fake-login-hook.cjs"

# 仅用于学习/测试：默认启用原生假登录 hook，拦截登录 IPC，避免弹出真实网页登录。
if [[ "${TRAE_NATIVE_FAKE_LOGIN:-1}" != "0" ]]; then
  export TRAE_NATIVE_FAKE_LOGIN="1"
  export NODE_OPTIONS="--require=$HOOK_REL ${NODE_OPTIONS:-}"
  echo "[native-launch] native_fake_login=on hook=$HOOK_REL" >> "$LOG_FILE"
else
  echo "[native-launch] native_fake_login=off" >> "$LOG_FILE"
fi

# 仅用于学习/测试：先结束旧进程，确保本次双击加载到 Contents 内最新补丁。
pkill -f "$CONTENT_ROOT/MacOS/Electron $APP_ROOT" >/dev/null 2>&1 || true
sleep 1

echo "[native-launch] route=native electron=$ELECTRON_BIN app=$APP_ROOT" >> "$LOG_FILE"
cd "$CONTENT_ROOT"
exec "$ELECTRON_BIN" "$APP_ROOT" --user-data-dir="$USER_DATA_DIR" --enable-logging=stderr --v=1 --new-window "$@" >> "$LOG_FILE" 2>&1
