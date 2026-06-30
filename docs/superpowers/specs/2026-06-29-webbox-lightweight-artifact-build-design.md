# Webbox Lightweight Artifact Build Design

## Goal

Webbox should build into a clean deployable artifact under the terminal working directory `out` while keeping the source tree free of build output. The artifact must include runtime configuration, launcher scripts for Windows and Linux, backend logging, web assets, and a UI with language text pulled from a single resource file.

## Scope

This change covers the existing React/Vite web app, the Express backend, build scripts, runtime launcher scripts, documentation, and lightweight Kodbox-derived image assets. It does not restore removed Kodbox features such as login, users, permissions, departments, desktop, sharing, history, PHP status checks, or Adminer.

## Architecture

The build uses a new `scripts/compile-webbox.mjs` entry point. It resolves the repository root from the script location and resolves the output root as `path.join(process.cwd(), "out")`, matching the requirement that artifacts go to the directory where the build command is launched. Vite writes the frontend to `out/web`, and esbuild bundles the backend to `out/webbox-server.js` so runtime deployment does not depend on package-level `dist` directories in the source tree.

`scripts/build.ps1` and `scripts/build.sh` remain the public build commands. They set only process-local caches, install dependencies in the current project copy, run tests, and call the compile script. In normal delivery this is run from a clean checkout; in validation it is run from `H:\oplus\kodbox\webbox-test` so `node_modules` never enters `H:\oplus\kodbox\webbox`.

## Runtime Configuration

The artifact includes:

- `out/server.conf`
- `out/run-webbox.ps1`
- `out/run-webbox.sh`
- `out/webbox-log-timestamps.js`
- `out/webbox-server.js`
- `out/web`
- `out/plugins`
- `out/data`

`server.conf` defines `host`, `port`, `public-url`, `data-dir`, `storage-root`, `plugin-root`, `static-root`, and `log-file`. Relative paths are resolved from the artifact directory. Commenting out `log-file` disables file logging.

The launcher scripts parse `server.conf`, set process-local `WEBBOX_*` environment variables, and run `node webbox-server.js`. No system environment, service configuration, Apache, Nginx, PHP, or database setting is modified.

## Logging

The backend owns structured runtime logging through a small logger module. It writes timestamped lines to the terminal and, when configured, to the file specified by `WEBBOX_LOG_FILE`. The Express app logs startup, bootstrap, plugin discovery, every API request, success/failure status, and file operation intent such as list, upload, download, rename, copy, move, recycle, restore, zip, and unzip.

Launcher scripts also load a timestamp hook so unexpected direct `console.*` calls remain timestamped.

## Language Resources

All user-facing Webbox strings are centralized in one shared TypeScript language resource. The initial language is `zh-CN`, exported as `zhCN`. Frontend components import this resource for labels, menu text, empty states, admin panel text, aria labels, and loading/error text. Server routes use the same resource for stable error messages and fallback HTML text.

This keeps the current single-language behavior while making future multi-language selection a data swap instead of a component rewrite.

## Assets And UI Effects

The UI receives a small Webbox asset set copied from Kodbox static resources:

- dialog/status icons from `static/app/vender/artDialog-icon`
- empty-state SVGs from `static/images/common/status`
- loading images from `static/images/common`

Assets live under `apps/web/public/webbox-assets` and are copied automatically by Vite into `out/web/webbox-assets`. The UI uses them for loading, empty folder state, notification/menu affordances, status chips, and file-panel polish. CSS adds restrained transitions, focus states, empty-state animation, and menu surface effects without reintroducing removed desktop or sharing behavior.

## Testing And Delivery

Validation runs from `H:\oplus\kodbox\webbox-test`. The source tree is copied there, dependencies are installed there, tests are run there, and the build output is generated there under `H:\oplus\kodbox\webbox-test\out`.

After validation, only files changed in this task are copied to `H:\oplus\kodbox\overwrite` using the same relative layout as `webbox`. The overwrite directory must not contain `node_modules`, `out`, `dist`, runtime `data`, or unrelated previous artifacts.

## Self Review

- No placeholder requirements remain.
- The build output rule consistently uses the terminal working directory `out`.
- Runtime configuration is read from `server.conf` by launchers, not hardcoded in backend code.
- Logging has a terminal path and an optional file path.
- The design does not reintroduce any feature that was previously removed from Webbox.
