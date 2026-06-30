$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$RunRoot = (Get-Location).Path
$OutDir = Join-Path $RunRoot "out"
New-Item -ItemType Directory -Force $OutDir | Out-Null
$BuildLog = Join-Path $OutDir "webbox-build.log"

$env:COREPACK_HOME = if ($env:COREPACK_HOME) { $env:COREPACK_HOME } else { Join-Path (Split-Path -Parent $Root) ".corepack" }
$env:NPM_CONFIG_CACHE = if ($env:NPM_CONFIG_CACHE) { $env:NPM_CONFIG_CACHE } else { Join-Path (Split-Path -Parent $Root) ".npm-cache" }
$env:ELECTRON_CACHE = if ($env:ELECTRON_CACHE) { $env:ELECTRON_CACHE } else { Join-Path $env:NPM_CONFIG_CACHE "electron" }
$env:ELECTRON_MIRROR = if ($env:ELECTRON_MIRROR) { $env:ELECTRON_MIRROR } else { "https://npmmirror.com/mirrors/electron/" }
$env:NODE_OPTIONS = if ($env:NODE_OPTIONS) { $env:NODE_OPTIONS } else { "--no-deprecation" }

@"
================ WEBBOX BUILD LOG ================
Started at: $(Get-Date -Format o)
Project root: $Root
Run directory: $RunRoot
Output directory: $OutDir
Node.js: $(node --version)

"@ | Set-Content -Encoding UTF8 -LiteralPath $BuildLog

function Invoke-Step([string]$Name, [scriptblock]$Command) {
  Write-Host "==> $Name"
  "==> $Name" | Add-Content -Encoding UTF8 -LiteralPath $BuildLog
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & $Command 2>&1 | Tee-Object -FilePath $BuildLog -Append
    $status = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  if ($status -ne 0) {
    throw "$Name failed with exit code $status"
  }
}

Invoke-Step "Install dependencies" { corepack pnpm -C $Root install --store-dir (Join-Path $env:NPM_CONFIG_CACHE "pnpm-store") }
$ElectronInstall = Join-Path $Root "apps\electron\node_modules\electron\install.js"
if (Test-Path $ElectronInstall) {
  Invoke-Step "Install Electron runtime" { node $ElectronInstall }
}
Invoke-Step "Run tests" { corepack pnpm -C $Root test }
Invoke-Step "Compile artifact" { node (Join-Path $Root "scripts\compile-webbox.mjs") }

Write-Host "Build complete. Configure $OutDir\server.conf, then run:"
Write-Host "powershell -ExecutionPolicy Bypass -File $OutDir\run-webbox.ps1"
