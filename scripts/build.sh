#!/usr/bin/env sh
set -eu

RUN_TESTS=0

usage() {
  cat <<'USAGE'
Usage: sh scripts/build.sh [options]

Options:
  --test, -test    Run tests before producing the out artifact
  -h, --help       Show this help
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --test|-test)
      RUN_TESTS=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

SCRIPT_PATH=$0
case "$SCRIPT_PATH" in
  /*) ;;
  *) SCRIPT_PATH=$PWD/$SCRIPT_PATH ;;
esac
ROOT=$(CDPATH= cd -- "$(dirname -- "$SCRIPT_PATH")/.." && pwd)
RUN_ROOT=$(pwd)
OUT_DIR="$RUN_ROOT/out"
BUILD_LOG="$OUT_DIR/webbox-build.log"
mkdir -p "$OUT_DIR"

export NO_COLOR="${NO_COLOR:-1}"
export FORCE_COLOR="${FORCE_COLOR:-0}"
export NODE_OPTIONS="${NODE_OPTIONS:---no-deprecation}"
export COREPACK_HOME="${COREPACK_HOME:-$(CDPATH= cd -- "$ROOT/.." && pwd)/.corepack}"
export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-$(CDPATH= cd -- "$ROOT/.." && pwd)/.npm-cache}"
export ELECTRON_CACHE="${ELECTRON_CACHE:-$NPM_CONFIG_CACHE/electron}"
export ELECTRON_MIRROR="${ELECTRON_MIRROR:-https://npmmirror.com/mirrors/electron/}"

command -v node >/dev/null 2>&1 || {
  echo "Node.js 20 or newer is required to build Webbox." >&2
  exit 1
}

NODE_MAJOR=$(node -p "Number(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Node.js 20 or newer is required to build Webbox. Current version: $(node -v)" >&2
  exit 1
fi

echo "==> Webbox build output: $OUT_DIR"
echo "==> Webbox build log: $BUILD_LOG"
if [ "$RUN_TESTS" -eq 1 ]; then
  echo "==> Tests: enabled"
  node "$ROOT/scripts/compile-webbox.mjs" --install --test --out-dir "$OUT_DIR" --log-file "$BUILD_LOG"
else
  echo "==> Tests: disabled"
  node "$ROOT/scripts/compile-webbox.mjs" --install --out-dir "$OUT_DIR" --log-file "$BUILD_LOG"
fi

echo "Build complete. Configure $OUT_DIR/server.conf, then run: sh $OUT_DIR/run-webbox.sh"
