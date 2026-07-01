#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const sourcePluginRoot = path.join(projectRoot, "plugins");
const sourceAssetRoot = path.join(projectRoot, "assets", "webbox");

const runtimeDependencies = {
  archiver: "^7.0.1",
  cors: "^2.8.5",
  express: "^4.21.2",
  "mime-types": "^2.1.35",
  multer: "^2.0.1",
  unzipper: "^0.12.3"
};

const options = parseArgs(process.argv.slice(2));
const outDir = path.resolve(options.outDir ?? path.join(process.cwd(), "out"));
const webOutDir = path.join(outDir, "web");
const buildLogPath = path.resolve(options.logFile ?? path.join(outDir, "webbox-build.log"));

process.env.NO_COLOR = process.env.NO_COLOR || "1";
process.env.FORCE_COLOR = process.env.FORCE_COLOR || "0";
process.env.CI = process.env.CI || "1";
process.stdout.setDefaultEncoding("utf8");
process.stderr.setDefaultEncoding("utf8");

function parseArgs(args) {
  const parsed = { install: false, test: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--install") parsed.install = true;
    else if (arg === "--test" || arg === "-test") parsed.test = true;
    else if (arg === "--out-dir") parsed.outDir = args[++index];
    else if (arg === "--log-file") parsed.logFile = args[++index];
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return parsed;
}

function printHelp() {
  process.stdout.write([
    "Usage: node scripts/compile-webbox.mjs [options]",
    "",
    "Options:",
    "  --install             Install build dependencies before compiling",
    "  --test, -test         Run tests before compiling",
    "  --out-dir <path>      Output directory. Default: ./out from the current shell",
    "  --log-file <path>     UTF-8 build log path. Default: <out-dir>/webbox-build.log",
    "  -h, --help            Show help",
    ""
  ].join("\n"));
}

function stripAnsi(value) {
  return String(value).replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
}

function initializeBuildLog() {
  fs.mkdirSync(path.dirname(buildLogPath), { recursive: true });
  fs.writeFileSync(buildLogPath, [
    "================ WEBBOX BUILD LOG ================",
    `Started at: ${new Date().toISOString()}`,
    `Project root: ${projectRoot}`,
    `Run directory: ${process.cwd()}`,
    `Output directory: ${outDir}`,
    `Node.js: ${process.version}`,
    `Tests: ${options.test ? "enabled" : "disabled"}`,
    "",
    ""
  ].join("\n"), "utf8");
}

function writeBoth(message, stream = "stdout") {
  const text = String(message);
  const target = stream === "stderr" ? process.stderr : process.stdout;
  target.write(text);
  fs.appendFileSync(buildLogPath, stripAnsi(text), "utf8");
}

function log(message) {
  writeBoth(`[webbox-build] ${message}\n`);
}

function runStep(name, command, args, spawnOptions = {}) {
  log(`==> ${name}`);
  log(`${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
    env: process.env,
    maxBuffer: 1024 * 1024 * 80,
    ...spawnOptions
  });
  if (result.stdout) writeBoth(result.stdout, "stdout");
  if (result.stderr) writeBoth(result.stderr, "stderr");
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${name} failed with exit code ${result.status}`);
  }
}

function cleanOut() {
  fs.mkdirSync(outDir, { recursive: true });
  for (const entry of [
    "web",
    "data",
    "plugins",
    "node_modules",
    "package-lock.json",
    "webbox-server.js",
    "package.json",
    "server.conf",
    "run-webbox.ps1",
    "run-webbox.sh",
    "webbox-log-timestamps.js",
    "webbox.log",
    ".webbox-command.log"
  ]) {
    fs.rmSync(path.join(outDir, entry), { recursive: true, force: true });
  }
  fs.mkdirSync(path.join(outDir, "data", "files"), { recursive: true });
  fs.mkdirSync(path.join(outDir, "plugins"), { recursive: true });
}

function copyRecursive(source, target, filter = () => true) {
  if (!fs.existsSync(source) || !filter(source)) return;
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      copyRecursive(path.join(source, entry), path.join(target, entry), filter);
    }
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function copyRuntimeResources() {
  copyRecursive(sourceAssetRoot, path.join(webOutDir, "webbox-assets"));
  copyRecursive(sourcePluginRoot, path.join(outDir, "plugins"), (candidate) => !candidate.includes(`${path.sep}.git${path.sep}`));
}

function workspaceAliasPlugin() {
  const aliases = new Map([
    ["@webbox/shared", path.join(projectRoot, "packages", "shared", "src", "index.ts")],
    ["@webbox/plugin-compat", path.join(projectRoot, "packages", "plugin-compat", "src", "index.ts")]
  ]);
  return {
    name: "webbox-workspace-alias",
    setup(buildContext) {
      buildContext.onResolve({ filter: /^@webbox\/(shared|plugin-compat)$/ }, (args) => ({
        path: aliases.get(args.path)
      }));
    }
  };
}

async function bundleServer() {
  await build({
    entryPoints: [path.join(projectRoot, "packages", "server", "src", "index.ts")],
    outfile: path.join(outDir, "webbox-server.js"),
    bundle: true,
    platform: "node",
    target: "node20",
    format: "esm",
    sourcemap: false,
    external: Object.keys(runtimeDependencies),
    banner: {
      js: "import { createRequire as __webboxCreateRequire } from 'node:module'; const require = __webboxCreateRequire(import.meta.url);"
    },
    plugins: [workspaceAliasPlugin()]
  });
}

function writeRuntimePackage() {
  const content = {
    name: "webbox-runtime",
    private: true,
    version: "0.1.0",
    type: "module",
    dependencies: runtimeDependencies
  };
  fs.writeFileSync(path.join(outDir, "package.json"), `${JSON.stringify(content, null, 2)}\n`, "utf8");
}

function writeServerConf() {
  const content = [
    "# Webbox runtime configuration.",
    "# Lines beginning with # are comments. Values are read by run-webbox.sh and run-webbox.ps1.",
    "# Relative paths are resolved from the directory containing webbox-server.js.",
    "",
    "host=127.0.0.1",
    "port=8787",
    "public-url=http://127.0.0.1:8787",
    "data-dir=data",
    "storage-root=data/files",
    "photos-root=data/photos",
    "documents-root=data/documents",
    "music-root=data/music",
    "videos-root=data/videos",
    "safe-root=data/safe-box",
    "recycle-root=data/recycle",
    "plugin-root=plugins",
    "static-root=web",
    "# Append backend output to a file. Comment this line to disable file logging.",
    "log-file=webbox.log",
    ""
  ].join("\n");
  fs.writeFileSync(path.join(outDir, "server.conf"), content, "utf8");
}

function writePowerShellLauncher() {
  const content = String.raw`$ErrorActionPreference = "Stop"
$ScriptPath = $MyInvocation.MyCommand.Path
$ScriptDir = Split-Path -Parent $ScriptPath
$ConfigFile = Join-Path $ScriptDir "server.conf"

function Read-ServerConfig([string]$Path) {
  $values = @{}
  if (-not (Test-Path -LiteralPath $Path)) { return $values }
  foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
    $trimmed = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith("#")) { continue }
    $index = $trimmed.IndexOf("=")
    if ($index -lt 1) { continue }
    $values[$trimmed.Substring(0, $index).Trim()] = $trimmed.Substring($index + 1).Trim()
  }
  return $values
}

function Get-ConfigValue($Values, [string[]]$Names, [string]$Default) {
  foreach ($name in $Names) {
    if ($Values.ContainsKey($name) -and -not [string]::IsNullOrWhiteSpace($Values[$name])) { return $Values[$name] }
  }
  return $Default
}

function Resolve-ConfigPath([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return "" }
  if ([System.IO.Path]::IsPathRooted($Value)) { return $Value }
  return [System.IO.Path]::GetFullPath((Join-Path $ScriptDir $Value))
}

function Ensure-Node {
  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if ($null -eq $nodeCommand) { throw "Node.js 20 or newer is required to run Webbox." }
  $major = [int](& $nodeCommand.Source -p "Number(process.versions.node.split('.')[0])")
  if ($major -lt 20) { throw "Node.js 20 or newer is required to run Webbox. Current version: $(& $nodeCommand.Source -v)" }
  return $nodeCommand
}

function Test-RuntimeDependencies {
  $packagePath = Join-Path $ScriptDir "package.json"
  if (-not (Test-Path -LiteralPath $packagePath)) { return $true }
  $package = Get-Content -LiteralPath $packagePath -Encoding UTF8 -Raw | ConvertFrom-Json
  if ($null -eq $package.dependencies) { return $true }
  foreach ($dependency in $package.dependencies.PSObject.Properties.Name) {
    if (-not (Test-Path -LiteralPath (Join-Path $ScriptDir "node_modules\$dependency"))) { return $false }
  }
  return $true
}

function Ensure-RuntimeDependencies {
  if (Test-RuntimeDependencies) { return }
  if ($null -eq (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm was not found. Install Node.js with npm, then rerun this script." }
  Write-Host "Installing Webbox runtime dependencies into $ScriptDir"
  & npm install --omit=dev --no-audit --no-fund --prefix $ScriptDir
  if ($LASTEXITCODE -ne 0) { throw "Runtime dependency install failed with exit code $LASTEXITCODE" }
}

$config = Read-ServerConfig $ConfigFile
$hostValue = Get-ConfigValue $config @("host") "127.0.0.1"
$portValue = Get-ConfigValue $config @("port") "8787"
$publicUrlValue = Get-ConfigValue $config @("public-url", "publicUrl") ("http://" + $hostValue + ":" + $portValue)
$dataDirValue = Get-ConfigValue $config @("data-dir", "dataDir") "data"
$storageRootValue = Get-ConfigValue $config @("storage-root", "storageRoot") "data/files"
$pluginRootValue = Get-ConfigValue $config @("plugin-root", "pluginRoot") "plugins"
$staticRootValue = Get-ConfigValue $config @("static-root", "staticRoot") "web"
$logFileValue = Get-ConfigValue $config @("log-file", "logFile") ""

Write-Host "Starting Webbox on $publicUrlValue"
$nodeCommand = Ensure-Node
Ensure-RuntimeDependencies

$env:WEBBOX_HOST = $hostValue
$env:WEBBOX_CONFIG = $ConfigFile
$env:WEBBOX_PORT = $portValue
$env:WEBBOX_PUBLIC_URL = $publicUrlValue
$env:WEBBOX_DATA = Resolve-ConfigPath $dataDirValue
$env:WEBBOX_ROOT = Resolve-ConfigPath $storageRootValue
$env:WEBBOX_PLUGIN_ROOT = Resolve-ConfigPath $pluginRootValue
$env:WEBBOX_WEB_DIST = Resolve-ConfigPath $staticRootValue
if (-not [string]::IsNullOrWhiteSpace($logFileValue)) {
  $env:WEBBOX_LOG_FILE = Resolve-ConfigPath $logFileValue
  $logDir = Split-Path -Parent $env:WEBBOX_LOG_FILE
  if (-not [string]::IsNullOrWhiteSpace($logDir)) { New-Item -ItemType Directory -Force $logDir | Out-Null }
  Add-Content -LiteralPath $env:WEBBOX_LOG_FILE -Encoding UTF8 -Value "Starting Webbox on $publicUrlValue"
} else {
  Remove-Item Env:\WEBBOX_LOG_FILE -ErrorAction SilentlyContinue
}

Set-Location $ScriptDir
$env:WEBBOX_PARENT_PID = "$PID"
$nodeProcess = $null
try {
  $nodeProcess = Start-Process -FilePath $nodeCommand.Source -ArgumentList @((Join-Path $ScriptDir "webbox-server.js")) -NoNewWindow -PassThru
  Wait-Process -Id $nodeProcess.Id
  $nodeProcess.Refresh()
  exit $nodeProcess.ExitCode
} finally {
  if ($null -ne $nodeProcess -and -not $nodeProcess.HasExited) {
    Stop-Process -Id $nodeProcess.Id -Force -ErrorAction SilentlyContinue
  }
}
`;
  fs.writeFileSync(path.join(outDir, "run-webbox.ps1"), content, "utf8");
}

function writeShellLauncher() {
  const content = [
    "#!/usr/bin/env sh",
    "set -eu",
    "",
    "SCRIPT_PATH=$0",
    "case \"$SCRIPT_PATH\" in",
    "  /*) ;;",
    "  *) SCRIPT_PATH=$PWD/$SCRIPT_PATH ;;",
    "esac",
    "SCRIPT_DIR=$(CDPATH= cd -- \"$(dirname -- \"$SCRIPT_PATH\")\" && pwd)",
    "CONFIG_FILE=${WEBBOX_CONFIG:-$SCRIPT_DIR/server.conf}",
    "",
    "get_config_value() {",
    "  key=$1",
    "  default=$2",
    "  if [ -f \"$CONFIG_FILE\" ]; then",
    "    while IFS= read -r line || [ -n \"$line\" ]; do",
    "      line=$(printf '%s' \"$line\" | sed 's/\\r$//')",
    "      case \"$line\" in \"\"|\\#*) continue ;; esac",
    "      config_key=${line%%=*}",
    "      config_value=${line#*=}",
    "      if [ \"$config_key\" = \"$key\" ]; then printf '%s' \"$config_value\"; return; fi",
    "    done < \"$CONFIG_FILE\"",
    "  fi",
    "  printf '%s' \"$default\"",
    "}",
    "",
    "resolve_config_path() {",
    "  value=$1",
    "  [ -n \"$value\" ] || { printf ''; return; }",
    "  case \"$value\" in /*) printf '%s' \"$value\" ;; *) printf '%s/%s' \"$SCRIPT_DIR\" \"$value\" ;; esac",
    "}",
    "",
    "ensure_node() {",
    "  command -v node >/dev/null 2>&1 || { echo 'Node.js 20 or newer is required to run Webbox.' >&2; exit 1; }",
    "  major=$(node -p \"Number(process.versions.node.split('.')[0])\")",
    "  [ \"$major\" -ge 20 ] || { echo \"Node.js 20 or newer is required to run Webbox. Current version: $(node -v)\" >&2; exit 1; }",
    "}",
    "",
    "runtime_dependencies_present() {",
    "  [ -f \"$SCRIPT_DIR/package.json\" ] || return 0",
    "  node - \"$SCRIPT_DIR\" <<'NODE'",
    "const fs = require('fs');",
    "const path = require('path');",
    "const root = process.argv[2];",
    "const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));",
    "const deps = Object.keys(pkg.dependencies || {});",
    "process.exit(deps.every(name => fs.existsSync(path.join(root, 'node_modules', name))) ? 0 : 1);",
    "NODE",
    "}",
    "",
    "ensure_runtime_dependencies() {",
    "  runtime_dependencies_present && return 0",
    "  command -v npm >/dev/null 2>&1 || { echo 'npm was not found. Install Node.js with npm, then rerun this script.' >&2; exit 1; }",
    "  echo \"Installing Webbox runtime dependencies into $SCRIPT_DIR\"",
    "  npm install --omit=dev --no-audit --no-fund --prefix \"$SCRIPT_DIR\"",
    "}",
    "",
    "HOST=$(get_config_value host 127.0.0.1)",
    "PORT=$(get_config_value port 8787)",
    "PUBLIC_URL=$(get_config_value public-url \"http://$HOST:$PORT\")",
    "DATA_DIR=$(get_config_value data-dir data)",
    "STORAGE_ROOT=$(get_config_value storage-root data/files)",
    "PLUGIN_ROOT=$(get_config_value plugin-root plugins)",
    "STATIC_ROOT=$(get_config_value static-root web)",
    "LOG_FILE=$(get_config_value log-file \"\")",
    "",
    "echo \"Starting Webbox on $PUBLIC_URL\"",
    "ensure_node",
    "ensure_runtime_dependencies",
    "",
    "export WEBBOX_HOST=$HOST",
    "export WEBBOX_CONFIG=$CONFIG_FILE",
    "export WEBBOX_PORT=$PORT",
    "export WEBBOX_PUBLIC_URL=$PUBLIC_URL",
    "export WEBBOX_DATA=$(resolve_config_path \"$DATA_DIR\")",
    "export WEBBOX_ROOT=$(resolve_config_path \"$STORAGE_ROOT\")",
    "export WEBBOX_PLUGIN_ROOT=$(resolve_config_path \"$PLUGIN_ROOT\")",
    "export WEBBOX_WEB_DIST=$(resolve_config_path \"$STATIC_ROOT\")",
    "if [ -n \"$LOG_FILE\" ]; then",
    "  WEBBOX_LOG_FILE=$(resolve_config_path \"$LOG_FILE\")",
    "  export WEBBOX_LOG_FILE",
    "  mkdir -p \"$(dirname \"$WEBBOX_LOG_FILE\")\"",
    "  printf '%s\\n' \"Starting Webbox on $PUBLIC_URL\" >> \"$WEBBOX_LOG_FILE\"",
    "else",
    "  unset WEBBOX_LOG_FILE || true",
    "fi",
    "",
    "cd \"$SCRIPT_DIR\"",
    "export WEBBOX_PARENT_PID=$$",
    "node \"$SCRIPT_DIR/webbox-server.js\" &",
    "WEBBOX_NODE_PID=$!",
    "cleanup() {",
    "  if kill -0 \"$WEBBOX_NODE_PID\" >/dev/null 2>&1; then",
    "    kill \"$WEBBOX_NODE_PID\" >/dev/null 2>&1 || true",
    "    wait \"$WEBBOX_NODE_PID\" >/dev/null 2>&1 || true",
    "  fi",
    "}",
    "trap cleanup INT TERM EXIT",
    "wait \"$WEBBOX_NODE_PID\"",
    "status=$?",
    "trap - INT TERM EXIT",
    "exit \"$status\"",
    ""
  ].join("\n");
  const launcher = path.join(outDir, "run-webbox.sh");
  fs.writeFileSync(launcher, content, "utf8");
  fs.chmodSync(launcher, 0o755);
}

async function main() {
  initializeBuildLog();
  log(`Project root: ${projectRoot}`);
  log(`Output directory: ${outDir}`);
  cleanOut();
  if (options.install) {
    const storeDir = process.env.NPM_CONFIG_CACHE ? path.join(process.env.NPM_CONFIG_CACHE, "pnpm-store") : path.join(path.dirname(projectRoot), ".npm-cache", "pnpm-store");
    runStep("Install dependencies", "corepack", [
      "pnpm",
      "-C",
      projectRoot,
      "install",
      "--frozen-lockfile",
      "--config.confirmModulesPurge=false",
      "--store-dir",
      storeDir
    ]);
    const electronInstall = path.join(projectRoot, "apps", "electron", "node_modules", "electron", "install.js");
    if (fs.existsSync(electronInstall)) runStep("Install Electron runtime", "node", [electronInstall]);
  }
  if (options.test) runStep("Run tests", "corepack", ["pnpm", "-C", projectRoot, "test"]);
  runStep("Build web app", "corepack", ["pnpm", "-C", projectRoot, "--filter", "@webbox/web", "exec", "vite", "build", "--outDir", webOutDir, "--emptyOutDir"]);
  log("Bundle server");
  await bundleServer();
  copyRuntimeResources();
  writeRuntimePackage();
  writeServerConf();
  writePowerShellLauncher();
  writeShellLauncher();
  log("Build complete.");
}

main().catch((error) => {
  writeBoth(`${error instanceof Error && error.stack ? error.stack : String(error)}\n`, "stderr");
  process.exitCode = 1;
});
