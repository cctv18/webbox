$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$env:COREPACK_HOME = if ($env:COREPACK_HOME) { $env:COREPACK_HOME } else { Join-Path (Split-Path -Parent $Root) ".corepack" }
$env:NPM_CONFIG_CACHE = if ($env:NPM_CONFIG_CACHE) { $env:NPM_CONFIG_CACHE } else { Join-Path (Split-Path -Parent $Root) ".npm-cache" }
$env:ELECTRON_CACHE = if ($env:ELECTRON_CACHE) { $env:ELECTRON_CACHE } else { Join-Path $env:NPM_CONFIG_CACHE "electron" }
$env:ELECTRON_MIRROR = if ($env:ELECTRON_MIRROR) { $env:ELECTRON_MIRROR } else { "https://npmmirror.com/mirrors/electron/" }

corepack pnpm install --store-dir (Join-Path $env:NPM_CONFIG_CACHE "pnpm-store")
$ElectronInstall = Join-Path $Root "apps\electron\node_modules\electron\install.js"
if (Test-Path $ElectronInstall) {
  node $ElectronInstall
}
corepack pnpm test
corepack pnpm build

New-Item -ItemType Directory -Force "$Root\dist" | Out-Null
@"
`$ErrorActionPreference = "Stop"
`$Root = Split-Path -Parent `$PSScriptRoot
Set-Location `$Root
`$env:WEBBOX_PORT = if (`$env:WEBBOX_PORT) { `$env:WEBBOX_PORT } else { "8787" }
node packages/server/dist/index.js
"@ | Set-Content -Encoding UTF8 "$Root\dist\run-webbox.ps1"
@"
#!/usr/bin/env sh
set -eu
ROOT=`$(CDPATH= cd -- "`$(dirname -- "`$0")/.." && pwd)
cd "`$ROOT"
export WEBBOX_PORT="`${WEBBOX_PORT:-8787}"
node packages/server/dist/index.js
"@ | Set-Content -Encoding UTF8 "$Root\dist\run-webbox.sh"

Write-Host "Build complete. Run: powershell -ExecutionPolicy Bypass -File dist\run-webbox.ps1"
