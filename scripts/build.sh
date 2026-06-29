#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
export COREPACK_HOME="${COREPACK_HOME:-$(CDPATH= cd -- "$ROOT/.." && pwd)/.corepack}"
export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-$(CDPATH= cd -- "$ROOT/.." && pwd)/.npm-cache}"
export ELECTRON_CACHE="${ELECTRON_CACHE:-$NPM_CONFIG_CACHE/electron}"
export ELECTRON_MIRROR="${ELECTRON_MIRROR:-https://npmmirror.com/mirrors/electron/}"
corepack pnpm install --store-dir "$NPM_CONFIG_CACHE/pnpm-store"
if [ -f "$ROOT/apps/electron/node_modules/electron/install.js" ]; then
  node "$ROOT/apps/electron/node_modules/electron/install.js"
fi
corepack pnpm test
corepack pnpm build
mkdir -p "$ROOT/dist"
cat > "$ROOT/dist/run-webbox.sh" <<'EOF'
#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
export WEBBOX_PORT="${WEBBOX_PORT:-8787}"
node packages/server/dist/index.js
EOF
chmod +x "$ROOT/dist/run-webbox.sh"
cat > "$ROOT/dist/run-webbox.ps1" <<'EOF'
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$env:WEBBOX_PORT = if ($env:WEBBOX_PORT) { $env:WEBBOX_PORT } else { "8787" }
node packages/server/dist/index.js
EOF
echo "Build complete. Run: ./dist/run-webbox.sh"
