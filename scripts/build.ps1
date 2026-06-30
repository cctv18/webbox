param(
  [switch]$Test
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
$env:NO_COLOR = if ($env:NO_COLOR) { $env:NO_COLOR } else { "1" }
$env:FORCE_COLOR = if ($env:FORCE_COLOR) { $env:FORCE_COLOR } else { "0" }
$env:NODE_OPTIONS = if ($env:NODE_OPTIONS) { $env:NODE_OPTIONS } else { "--no-deprecation" }

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$RunRoot = (Get-Location).Path
$OutDir = Join-Path $RunRoot "out"
$BuildLog = Join-Path $OutDir "webbox-build.log"
New-Item -ItemType Directory -Force $OutDir | Out-Null

$cacheRoot = Split-Path -Parent $Root
$env:COREPACK_HOME = if ($env:COREPACK_HOME) { $env:COREPACK_HOME } else { Join-Path $cacheRoot ".corepack" }
$env:NPM_CONFIG_CACHE = if ($env:NPM_CONFIG_CACHE) { $env:NPM_CONFIG_CACHE } else { Join-Path $cacheRoot ".npm-cache" }
$env:ELECTRON_CACHE = if ($env:ELECTRON_CACHE) { $env:ELECTRON_CACHE } else { Join-Path $env:NPM_CONFIG_CACHE "electron" }
$env:ELECTRON_MIRROR = if ($env:ELECTRON_MIRROR) { $env:ELECTRON_MIRROR } else { "https://npmmirror.com/mirrors/electron/" }

function Test-Command([string]$Name) {
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

if (-not (Test-Command "node")) {
  throw "Node.js 20 or newer is required to build Webbox."
}

$nodeMajor = [int](& node -p "Number(process.versions.node.split('.')[0])")
if ($nodeMajor -lt 20) {
  throw "Node.js 20 or newer is required to build Webbox. Current version: $(& node -v)"
}

$arguments = @(
  (Join-Path $Root "scripts\compile-webbox.mjs"),
  "--install",
  "--out-dir",
  $OutDir,
  "--log-file",
  $BuildLog
)
if ($Test) {
  $arguments += "--test"
}

Write-Host "==> Webbox build output: $OutDir"
Write-Host "==> Webbox build log: $BuildLog"
if ($Test) {
  Write-Host "==> Tests: enabled"
} else {
  Write-Host "==> Tests: disabled"
}

& node @arguments
if ($LASTEXITCODE -ne 0) {
  throw "Webbox build failed with exit code $LASTEXITCODE"
}

Write-Host "Build complete. Configure $OutDir\server.conf, then run:"
Write-Host "powershell -ExecutionPolicy Bypass -File $OutDir\run-webbox.ps1"
