#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
RUN_ROOT=$(pwd)
OUT_DIR="$RUN_ROOT/out"
mkdir -p "$OUT_DIR"
BUILD_LOG="$OUT_DIR/webbox-build.log"

export COREPACK_HOME="${COREPACK_HOME:-$(CDPATH= cd -- "$ROOT/.." && pwd)/.corepack}"
export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-$(CDPATH= cd -- "$ROOT/.." && pwd)/.npm-cache}"
export ELECTRON_CACHE="${ELECTRON_CACHE:-$NPM_CONFIG_CACHE/electron}"
export ELECTRON_MIRROR="${ELECTRON_MIRROR:-https://npmmirror.com/mirrors/electron/}"
export NODE_OPTIONS="${NODE_OPTIONS:---no-deprecation}"

cat > "$BUILD_LOG" <<EOF
================ WEBBOX BUILD LOG ================
Started at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
Project root: $ROOT
Run directory: $RUN_ROOT
Output directory: $OUT_DIR
Node.js: $(node --version)

EOF

run_step() {
  name=$1
  shift
  echo "==> $name" | tee -a "$BUILD_LOG"
  tmp_log="$OUT_DIR/.webbox-command.log"
  if "$@" > "$tmp_log" 2>&1; then
    cat "$tmp_log" | tee -a "$BUILD_LOG"
    rm -f "$tmp_log"
  else
    status=$?
    cat "$tmp_log" | tee -a "$BUILD_LOG"
    rm -f "$tmp_log"
    echo "$name failed with exit code $status" | tee -a "$BUILD_LOG" >&2
    exit "$status"
  fi
}

run_step "Install dependencies" corepack pnpm -C "$ROOT" install --store-dir "$NPM_CONFIG_CACHE/pnpm-store"
if [ -f "$ROOT/apps/electron/node_modules/electron/install.js" ]; then
  run_step "Install Electron runtime" node "$ROOT/apps/electron/node_modules/electron/install.js"
fi
run_step "Run tests" corepack pnpm -C "$ROOT" test
run_step "Compile artifact" node "$ROOT/scripts/compile-webbox.mjs"
echo "Build complete. Configure $OUT_DIR/server.conf, then run: sh $OUT_DIR/run-webbox.sh"
