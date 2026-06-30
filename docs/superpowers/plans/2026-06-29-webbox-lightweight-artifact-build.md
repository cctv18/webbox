# Webbox Lightweight Artifact Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Webbox into a clean `out` artifact with configurable runtime scripts, centralized language resources, backend logging, Kodbox-derived UI assets, and a copied overwrite package.

**Architecture:** Keep Webbox source modular. Add a Node compile script that writes `process.cwd()/out`, bundle the backend with esbuild, let Vite copy frontend public assets, and make launcher scripts translate `server.conf` into process-local environment variables.

**Tech Stack:** pnpm workspace, TypeScript, React, Vite, Express, esbuild, Vitest, PowerShell, POSIX shell.

---

## File Structure

- Create `scripts/compile-webbox.mjs`: clean and generate `out`, run Vite, bundle backend with esbuild, write `server.conf`, run scripts, timestamp hook, and runtime folders.
- Modify `scripts/build.ps1`: wrapper that installs dependencies, runs tests, calls `compile-webbox.mjs`, and writes build logs to `out`.
- Modify `scripts/build.sh`: Linux equivalent of the PowerShell wrapper.
- Modify `docs/BUILD.md`: document `out` artifact, `server.conf`, logging, and deploy commands.
- Create `packages/shared/src/language.ts`: one exported `zhCN` language resource for web and server.
- Modify `packages/shared/src/index.ts`: export the language resource.
- Create `packages/server/src/logger.ts`: terminal and optional file logger plus Express request middleware.
- Modify `packages/server/src/config.ts`: support `host`, `publicUrl`, `logFile`, and artifact-relative environment values.
- Modify `packages/server/src/index.ts`: listen on configured host and log startup.
- Modify `packages/server/src/app.ts`: wire logger, request logging, bootstrap/plugin logs, and shared language strings.
- Modify `packages/server/src/routes.ts`: log file operations and use shared server messages.
- Modify `packages/server/src/pluginRoutes.ts`: log plugin operations.
- Create `apps/web/src/i18n.ts`: frontend alias for shared `zhCN`.
- Create `apps/web/src/assets.ts`: stable asset URL constants.
- Modify `apps/web/src/App.tsx`: remove hardcoded loading/error text.
- Modify `apps/web/src/components/AdminPanel.tsx`: use language resource.
- Modify `apps/web/src/components/BottomMenu.tsx`: use language resource and asset-backed affordances.
- Modify `apps/web/src/components/ContextMenu.tsx`: use language resource.
- Modify `apps/web/src/components/FileManager.tsx`: use language resource, asset-backed empty/loading states, and polished UI hooks.
- Modify `apps/web/src/components/PluginViewer.tsx`: use language resource.
- Modify `apps/web/src/styles.css`: add asset-aware states, transitions, focus, menu, and empty-state effects.
- Create `apps/web/public/webbox-assets/...`: copy selected Kodbox assets.
- Modify tests under `apps/web/tests` and `packages/server/tests` only when language or logging changes require stable expectations.

## Task 1: Build Script And Artifact Layout

**Files:**
- Create: `scripts/compile-webbox.mjs`
- Modify: `scripts/build.ps1`
- Modify: `scripts/build.sh`
- Modify: `docs/BUILD.md`

- [ ] **Step 1: Add the compile script**

Create `scripts/compile-webbox.mjs` with functions for `run`, `cleanOut`, `buildWeb`, `bundleServer`, `writeServerConf`, `writeLaunchers`, and `writeTimestampHook`. It must compute `outDir = path.resolve(process.cwd(), "out")`, `projectRoot = path.resolve(import.meta.dirname, "..")`, and write frontend output to `out/web`.

- [ ] **Step 2: Update build wrappers**

Change `build.ps1` and `build.sh` so they keep caches process-local, install with pnpm, run `corepack pnpm test`, then run `node scripts/compile-webbox.mjs`. The wrappers should create `out/webbox-build.log` under the caller working directory.

- [ ] **Step 3: Verify artifact paths**

Run from `H:\oplus\kodbox\webbox-test`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1
```

Expected: `H:\oplus\kodbox\webbox-test\out\web`, `out\webbox-server.js`, `out\server.conf`, `out\run-webbox.ps1`, and `out\run-webbox.sh` exist.

## Task 2: Runtime Config And Logging

**Files:**
- Create: `packages/server/src/logger.ts`
- Modify: `packages/server/src/config.ts`
- Modify: `packages/server/src/index.ts`
- Modify: `packages/server/src/app.ts`
- Modify: `packages/server/src/routes.ts`
- Modify: `packages/server/src/pluginRoutes.ts`
- Test: `packages/server/tests/routes.test.ts`

- [ ] **Step 1: Add logger module**

Implement a logger with `info`, `warn`, `error`, `debug`, `child`, and `requestMiddleware`. The logger writes timestamped lines to console and appends to `config.logFile` when present.

- [ ] **Step 2: Expand config**

Add `host`, `publicUrl`, and `logFile` to `WebboxConfig`. Resolve relative paths from `process.cwd()` so launcher scripts can set `cwd` to the artifact directory.

- [ ] **Step 3: Wire logging**

Pass the logger through `createApp`, mount request logging before routes, log bootstrap/plugin discovery, and log each file operation before success or error response.

- [ ] **Step 4: Verify runtime logging**

Start from `H:\oplus\kodbox\webbox-test\out`:

```powershell
powershell -ExecutionPolicy Bypass -File .\run-webbox.ps1
```

Expected: terminal shows timestamped startup and request logs; `webbox.log` contains the same backend operation lines.

## Task 3: Language Resource Extraction

**Files:**
- Create: `packages/shared/src/language.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `apps/web/src/i18n.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/AdminPanel.tsx`
- Modify: `apps/web/src/components/BottomMenu.tsx`
- Modify: `apps/web/src/components/ContextMenu.tsx`
- Modify: `apps/web/src/components/FileManager.tsx`
- Modify: `apps/web/src/components/PluginViewer.tsx`
- Modify: `packages/server/src/app.ts`
- Modify: `packages/server/src/routes.ts`

- [ ] **Step 1: Add shared text object**

Create `zhCN` with nested keys for `app`, `fileManager`, `bottomMenu`, `admin`, `contextMenu`, `pluginViewer`, and `server`.

- [ ] **Step 2: Replace frontend strings**

Replace component literals with imports from `apps/web/src/i18n.ts`. Keep dynamic values such as file names, byte counts, and dates as data, not language entries.

- [ ] **Step 3: Replace server strings**

Use `zhCN.server` for bootstrap fallback HTML and route errors. Keep machine-readable error codes unchanged.

- [ ] **Step 4: Run tests**

Run:

```powershell
corepack pnpm test
```

Expected: all Vitest suites pass.

## Task 4: Kodbox Assets And UI Effects

**Files:**
- Create: `apps/web/public/webbox-assets/status/error.png`
- Create: `apps/web/public/webbox-assets/status/loading.png`
- Create: `apps/web/public/webbox-assets/status/succeed.png`
- Create: `apps/web/public/webbox-assets/status/warning.png`
- Create: `apps/web/public/webbox-assets/status/empty.svg`
- Create: `apps/web/public/webbox-assets/status/empty_msg.svg`
- Create: `apps/web/src/assets.ts`
- Modify: `apps/web/src/components/FileManager.tsx`
- Modify: `apps/web/src/components/BottomMenu.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Copy assets**

Copy selected files from `H:\oplus\kodbox\kodbox-deobfuscated\static` into `apps/web/public/webbox-assets/status`.

- [ ] **Step 2: Add asset constants**

Create `apps/web/src/assets.ts` exporting URL strings such as `/webbox-assets/status/empty.svg` and `/webbox-assets/status/loading.png`.

- [ ] **Step 3: Use assets in UI**

Use the empty SVG in the empty folder state, loading image in loading surfaces, and status icons for notification/menu surfaces where appropriate.

- [ ] **Step 4: Add effects**

Update CSS with restrained hover/focus transitions, menu popover animation, empty-state animation, loading pulse, and table row affordances.

- [ ] **Step 5: Verify build output includes assets**

After build, confirm:

```powershell
Test-Path .\out\web\webbox-assets\status\empty.svg
```

Expected: `True`.

## Task 5: Test Copy, Dynamic Validation, And Overwrite Package

**Files:**
- Modify only generated copy location: `H:\oplus\kodbox\overwrite`

- [ ] **Step 1: Sync source to test directory**

Copy `H:\oplus\kodbox\webbox` to `H:\oplus\kodbox\webbox-test` excluding `node_modules`, `out`, `dist`, and runtime `data`.

- [ ] **Step 2: Install and test in test directory**

Run:

```powershell
corepack pnpm install --store-dir H:\oplus\kodbox\.npm-cache\pnpm-store
corepack pnpm test
powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1
```

Expected: tests pass and the artifact is generated under `H:\oplus\kodbox\webbox-test\out`.

- [ ] **Step 3: Dynamic smoke test**

Start the generated server, request `/api/bootstrap` and `/api/files?path=/`, then stop the server.

Expected: both endpoints return JSON success responses and `out\webbox.log` contains startup, request, and route operation lines.

- [ ] **Step 4: Copy current-task changed files**

Compare `H:\oplus\kodbox\webbox-test\baseline-webbox-before-current-task.json` with current `H:\oplus\kodbox\webbox`, then copy changed and new files to `H:\oplus\kodbox\overwrite` preserving relative paths.

- [ ] **Step 5: Final message**

Report verification results, overwrite location, and this commit message:

```text
feat: add configurable artifact build for webbox
```

## Self Review

- The plan covers artifact output, server configuration, runtime logging, language extraction, assets, tests, and overwrite packaging.
- No step depends on modifying files outside `H:\oplus\kodbox` except reading Codex skill files.
- The plan keeps dependency installation inside `webbox-test` for validation.
- No removed Kodbox feature is restored.
