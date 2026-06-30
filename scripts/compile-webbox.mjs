#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
function findKodboxWebRoot() {
  let current = projectRoot;
  for (let index = 0; index < 5; index += 1) {
    const candidate = path.join(current, "kodbox_web");
    if (fs.existsSync(candidate)) return candidate;
    current = path.dirname(current);
  }
  return path.join(path.dirname(projectRoot), "kodbox_web");
}

const kodboxWebRoot = findKodboxWebRoot();
const outDir = path.resolve(process.cwd(), "out");
const webOutDir = path.join(outDir, "web");

process.env.NO_COLOR = process.env.NO_COLOR || "1";
process.env.FORCE_COLOR = process.env.FORCE_COLOR || "0";

function log(message) {
  process.stdout.write(`[webbox-build] ${message}\n`);
}

function run(command, args, options = {}) {
  log(`${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
    ...options
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Command failed with exit code ${result.status}: ${command} ${args.join(" ")}`);
  }
}

function cleanOut() {
  fs.mkdirSync(outDir, { recursive: true });
  for (const entry of [
    "web",
    "data",
    "plugins",
    "webbox-server.js",
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

function copyKodboxResources() {
  const assetRoot = path.join(webOutDir, "webbox-assets", "kodbox");
  copyRecursive(path.join(kodboxWebRoot, "static", "images", "file_icon"), path.join(assetRoot, "file_icon"));
  copyRecursive(path.join(kodboxWebRoot, "static", "images", "common"), path.join(assetRoot, "common"));
  copyRecursive(path.join(kodboxWebRoot, "static", "style", "lib", "font-icon"), path.join(assetRoot, "font-icon"));
  copyRecursive(path.join(kodboxWebRoot, "static", "style", "lib", "alifont"), path.join(assetRoot, "alifont"));

  const compatiblePlugins = new Set(["DPlayer", "fileThumb", "htmlEditor", "jPlayer", "officeLive", "officeViewer", "pdfjs", "photoSwipe", "picasa", "webdav", "webodf", "yzOffice"]);
  const sourcePlugins = path.join(kodboxWebRoot, "plugins");
  if (fs.existsSync(sourcePlugins)) {
    for (const entry of fs.readdirSync(sourcePlugins, { withFileTypes: true })) {
      if (!entry.isDirectory() || !compatiblePlugins.has(entry.name)) continue;
      copyRecursive(path.join(sourcePlugins, entry.name), path.join(outDir, "plugins", entry.name), (candidate) => !candidate.includes(`${path.sep}.git${path.sep}`));
    }
  }
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
    external: ["@aws-sdk/client-s3"],
    banner: {
      js: "import { createRequire as __webboxCreateRequire } from 'node:module'; const require = __webboxCreateRequire(import.meta.url);"
    },
    plugins: [workspaceAliasPlugin()]
  });
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

function writeTimestampHook() {
  const content = [
    "\"use strict\";",
    "function pad(value, length) { return String(value).padStart(length, \"0\"); }",
    "function timestamp() {",
    "  const now = new Date();",
    "  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1, 2)}-${pad(now.getDate(), 2)}`;",
    "  const time = `${pad(now.getHours(), 2)}:${pad(now.getMinutes(), 2)}:${pad(now.getSeconds(), 2)}.${pad(now.getMilliseconds(), 3)}`;",
    "  return `[${date} ${time}]`;",
    "}",
    "for (const method of [\"log\", \"info\", \"warn\", \"error\", \"debug\"]) {",
    "  const original = console[method].bind(console);",
    "  console[method] = (...args) => original(timestamp(), ...args);",
    "}",
    ""
  ].join("\n");
  fs.writeFileSync(path.join(outDir, "webbox-log-timestamps.js"), content, "utf8");
}

function writePowerShellLauncher() {
  const content = String.raw`$ErrorActionPreference = "Stop"
$ScriptPath = $MyInvocation.MyCommand.Path
$ScriptDir = Split-Path -Parent $ScriptPath
$ConfigFile = Join-Path $ScriptDir "server.conf"

function Read-ServerConfig([string]$Path) {
  $values = @{}
  if (-not (Test-Path -LiteralPath $Path)) { return $values }
  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith("#")) { continue }
    $index = $trimmed.IndexOf("=")
    if ($index -lt 1) { continue }
    $key = $trimmed.Substring(0, $index).Trim()
    $value = $trimmed.Substring($index + 1).Trim()
    $values[$key] = $value
  }
  return $values
}

function Get-ConfigValue($Values, [string[]]$Names, [string]$Default) {
  foreach ($name in $Names) {
    if ($Values.ContainsKey($name) -and -not [string]::IsNullOrWhiteSpace($Values[$name])) {
      return $Values[$name]
    }
  }
  return $Default
}

function Resolve-ConfigPath([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return "" }
  if ([System.IO.Path]::IsPathRooted($Value)) { return $Value }
  return [System.IO.Path]::GetFullPath((Join-Path $ScriptDir $Value))
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
  New-Item -ItemType Directory -Force (Split-Path -Parent $env:WEBBOX_LOG_FILE) | Out-Null
} else {
  Remove-Item Env:\WEBBOX_LOG_FILE -ErrorAction SilentlyContinue
}

Set-Location $ScriptDir
node --require (Join-Path $ScriptDir "webbox-log-timestamps.js") (Join-Path $ScriptDir "webbox-server.js")
exit $LASTEXITCODE
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
    "      case \"$line\" in",
    "        \"\"|\\#*) continue ;;",
    "      esac",
    "      config_key=${line%%=*}",
    "      config_value=${line#*=}",
    "      if [ \"$config_key\" = \"$key\" ]; then",
    "        printf '%s' \"$config_value\"",
    "        return",
    "      fi",
    "    done < \"$CONFIG_FILE\"",
    "  fi",
    "  printf '%s' \"$default\"",
    "}",
    "",
    "resolve_config_path() {",
    "  value=$1",
    "  if [ -z \"$value\" ]; then",
    "    printf ''",
    "    return",
    "  fi",
    "  case \"$value\" in",
    "    /*) printf '%s' \"$value\" ;;",
    "    *) printf '%s/%s' \"$SCRIPT_DIR\" \"$value\" ;;",
    "  esac",
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
    "else",
    "  unset WEBBOX_LOG_FILE || true",
    "fi",
    "",
    "cd \"$SCRIPT_DIR\"",
    "exec node --require \"$SCRIPT_DIR/webbox-log-timestamps.js\" \"$SCRIPT_DIR/webbox-server.js\"",
    ""
  ].join("\n");
  const launcher = path.join(outDir, "run-webbox.sh");
  fs.writeFileSync(launcher, content, "utf8");
  fs.chmodSync(launcher, 0o755);
}

async function main() {
  log(`Project root: ${projectRoot}`);
  log(`Output directory: ${outDir}`);
  cleanOut();
  run("corepack", ["pnpm", "-C", projectRoot, "--filter", "@webbox/web", "exec", "vite", "build", "--outDir", webOutDir, "--emptyOutDir"]);
  copyKodboxResources();
  await bundleServer();
  writeServerConf();
  writeTimestampHook();
  writePowerShellLauncher();
  writeShellLauncher();
  log("Build complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
