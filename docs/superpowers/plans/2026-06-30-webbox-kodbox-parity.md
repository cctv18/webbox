# Webbox Kodbox-Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current Webbox shell into a working single-user file manager with Kodbox-style navigation, file operations, safe box, metadata, notifications, plugin discovery, admin configuration, resource reuse, build output, tests, and overwrite delivery.

**Architecture:** Keep Webbox React/Node-native. Add focused backend services for config, workspace tree, filesystem providers, safe box, metadata, watchers, mounts, and plugins; then wire the React explorer to those typed APIs. Reuse Kodbox icons, fonts, status assets, and compatible plugin static resources, but do not embed Kodbox's original `main.js` as the application shell.

**Tech Stack:** TypeScript, React, Vite, Express, Node filesystem APIs, chokidar, multer, archiver/unzipper, Vitest, Testing Library, Playwright-style smoke scripts where available.

---

## File Structure

- Modify `packages/shared/src/types.ts`: add typed DTOs for tree nodes, file details, recycle records, metadata, notifications, safe-box state, admin config, mounts, and events.
- Modify `packages/shared/src/language.ts`: add all UI/server strings used by the new explorer, admin panel, errors, notifications, and safe-box prompts.
- Modify `packages/server/src/config.ts`: parse and write Webbox-managed `server.conf` values and expose configured library paths.
- Create `packages/server/src/configFile.ts`: line-oriented server.conf reader/writer that preserves comments and updates managed keys.
- Create `packages/server/src/activityStore.ts`: append/query activity records by logical path.
- Create `packages/server/src/workspaceService.ts`: build the navigation tree and resolve logical roots.
- Create `packages/server/src/libraryService.ts`: manage configurable personal/library/safe/recycle directories and migration rules.
- Create `packages/server/src/safeBoxService.ts`: original Kodbox-style safe-box open/login/logout/change-password behavior.
- Create `packages/server/src/notificationService.ts`: persistent notifications and read/clear operations.
- Create `packages/server/src/watchService.ts`: filesystem watchers and SSE event fanout.
- Create `packages/server/src/mountService.ts`: local disk/root listing and configured FTP/WebDAV mount definitions with clear unsupported/unreachable errors.
- Modify `packages/server/src/fileService.ts`: add stat, recycle listing, permanent delete, multi-provider-compatible details, and activity hooks.
- Modify `packages/server/src/routes.ts`: mount file, tree, recycle, safe-box, metadata, admin, mounts, notifications, and event routes.
- Modify `packages/server/src/app.ts`: initialize the new services and pass them into routes.
- Modify `packages/plugin-compat/src/pluginRegistry.ts`: scan Kodbox plugin metadata and expose compatible plugin resources.
- Modify `apps/web/src/api/client.ts`: add typed client methods for every new route.
- Replace/split `apps/web/src/components/FileManager.tsx`: explorer shell, tree, toolbar, file grid/list, selection, context menu, inspector, notifications, and modals.
- Modify `apps/web/src/components/AdminPanel.tsx`: add storage config, plugin manager, notifications, and simplified overview.
- Modify `apps/web/src/components/BottomMenu.tsx`: add icons and notification popover integration.
- Modify `apps/web/src/components/ContextMenu.tsx`: make context menu dynamic and action-backed.
- Create `apps/web/src/components/InspectorPanel.tsx`: property, memo, and activity tabs.
- Create `apps/web/src/components/NavigationTree.tsx`: Kodbox-style tree sections.
- Create `apps/web/src/components/FileGrid.tsx`: list/grid view, selection, rectangle select, and keyboard handling.
- Modify `apps/web/src/styles.css`: Kodbox-inspired explorer layout, icon/list modes, tree, inspector, modals, and admin styles.
- Modify `apps/web/src/assets.ts`: point to copied Kodbox/Webbox assets.
- Modify `scripts/compile-webbox.mjs`: copy required Kodbox-derived assets and plugin static resources into build output.
- Modify tests under `packages/server/tests`, `packages/shared/tests`, `packages/plugin-compat/tests`, and `apps/web/tests`.

## Task 1: Baseline and Shared Contracts

**Files:**
- Create: `H:\oplus\kodbox\webbox-test\baseline-webbox-kodbox-parity.json`
- Modify: `H:\oplus\kodbox\webbox\packages\shared\src\types.ts`
- Modify: `H:\oplus\kodbox\webbox\packages\shared\src\language.ts`
- Test: `H:\oplus\kodbox\webbox\packages\shared\tests\api-contract.test.ts`

- [ ] **Step 1: Capture a baseline manifest**

Run a PowerShell script from `H:\oplus\kodbox` that hashes all files in `webbox`, excluding `.git`, `node_modules`, `out`, `dist`, and generated test data. Save the manifest to `H:\oplus\kodbox\webbox-test\baseline-webbox-kodbox-parity.json`. Use it later to copy only this-cycle changed files into `overwrite`.

- [ ] **Step 2: Add shared DTO tests**

Create `packages/shared/tests/api-contract.test.ts` with tests that construct `TreeNode`, `SafeBoxStatus`, `NotificationItem`, `ActivityRecord`, `MemoEntry`, and `AdminStorageConfig` objects and assert their required fields. This protects the frontend/server contract from drifting while implementation proceeds.

- [ ] **Step 3: Extend shared types**

Add explicit TypeScript interfaces for tree nodes, logical roots, file details, recycle records, safe-box status/actions, metadata entries, activity records, notifications, admin storage config, plugin states, mount definitions, and SSE events.

- [ ] **Step 4: Extend language resources**

Move every new visible string into `zhCN`, including tree labels, toolbar labels, context menu actions, inspector tabs, safe-box prompts, admin storage labels, migration errors, mount errors, notification actions, and server log events.

- [ ] **Step 5: Run shared tests**

Run `pnpm --filter @webbox/shared test`. Expected result: shared tests pass.

## Task 2: Config, Libraries, Metadata, and Activity

**Files:**
- Create: `H:\oplus\kodbox\webbox\packages\server\src\configFile.ts`
- Create: `H:\oplus\kodbox\webbox\packages\server\src\libraryService.ts`
- Create: `H:\oplus\kodbox\webbox\packages\server\src\activityStore.ts`
- Modify: `H:\oplus\kodbox\webbox\packages\server\src\config.ts`
- Modify: `H:\oplus\kodbox\webbox\packages\server\src\metadataStore.ts`
- Test: `H:\oplus\kodbox\webbox\packages\server\tests\configFile.test.ts`
- Test: `H:\oplus\kodbox\webbox\packages\server\tests\libraryService.test.ts`
- Test: `H:\oplus\kodbox\webbox\packages\server\tests\activityStore.test.ts`

- [ ] **Step 1: Write config-file tests**

Test reading key/value pairs from `server.conf`, resolving relative paths against the config directory, preserving commented log-file behavior, and writing managed directory keys without deleting unrelated comments.

- [ ] **Step 2: Implement config-file parser/writer**

Implement a small parser for `key=value` lines and comments. Add `updateServerConfValue(file, key, value)` and `readServerConf(file)` helpers.

- [ ] **Step 3: Write library migration tests**

Test that changing a configured library directory succeeds when the target is missing/empty, moves files from old to new, updates config, and rejects a non-empty target with `TARGET_NOT_EMPTY`.

- [ ] **Step 4: Implement library service**

Add default directory layout under data root and migration logic for personal, photos, documents, music, videos, safe box, and recycle bin.

- [ ] **Step 5: Write activity store tests**

Test append/query by exact path and directory subtree. Directory queries must include child paths.

- [ ] **Step 6: Implement activity store and metadata extensions**

Persist activities, favorites, memos, tags/descriptions, attachment refs, notifications, and plugin states as JSON under data root.

- [ ] **Step 7: Run server tests for this task**

Run `pnpm --filter @webbox/server test -- configFile libraryService activityStore`. Expected result: all tests pass.

## Task 3: File Operations, Recycle Bin, Safe Box, and Watch Events

**Files:**
- Create: `H:\oplus\kodbox\webbox\packages\server\src\safeBoxService.ts`
- Create: `H:\oplus\kodbox\webbox\packages\server\src\notificationService.ts`
- Create: `H:\oplus\kodbox\webbox\packages\server\src\watchService.ts`
- Modify: `H:\oplus\kodbox\webbox\packages\server\src\fileService.ts`
- Modify: `H:\oplus\kodbox\webbox\packages\server\src\routes.ts`
- Modify: `H:\oplus\kodbox\webbox\packages\server\src\app.ts`
- Test: `H:\oplus\kodbox\webbox\packages\server\tests\fileService.test.ts`
- Test: `H:\oplus\kodbox\webbox\packages\server\tests\routes.test.ts`
- Test: `H:\oplus\kodbox\webbox\packages\server\tests\safeBoxService.test.ts`
- Test: `H:\oplus\kodbox\webbox\packages\server\tests\notificationService.test.ts`

- [ ] **Step 1: Add failing route tests**

Extend route tests to cover upload/download, create file/folder, rename, copy, move, recycle, restore, permanent delete, recycle listing, file stat, search, and activity creation.

- [ ] **Step 2: Add safe-box tests**

Test initial `notOpen`, open with password, locked listing, failed login, successful login, logout, and password change.

- [ ] **Step 3: Implement safe-box service**

Store password hash/salt in metadata, keep process-local unlock state, and expose original-style safe-box status and actions.

- [ ] **Step 4: Extend file service**

Add stat/details, recycle listing, permanent delete, restore collision handling, and operation activity hooks. Keep path safety rooted in configured directories.

- [ ] **Step 5: Implement notification service**

Persist notifications, mark read, clear, and create notifications from file operations and watcher events.

- [ ] **Step 6: Implement event stream**

Expose `/api/events` as SSE and make WatchService broadcast debounced file changes.

- [ ] **Step 7: Wire routes and app initialization**

Initialize config, metadata, libraries, activities, notifications, safe box, file service, plugins, and watchers in `createApp`.

- [ ] **Step 8: Run server tests**

Run `pnpm --filter @webbox/server test`. Expected result: all server tests pass.

## Task 4: Workspace Tree, Mounts, Plugins, and Asset Copy

**Files:**
- Create: `H:\oplus\kodbox\webbox\packages\server\src\workspaceService.ts`
- Create: `H:\oplus\kodbox\webbox\packages\server\src\mountService.ts`
- Modify: `H:\oplus\kodbox\webbox\packages\plugin-compat\src\pluginRegistry.ts`
- Modify: `H:\oplus\kodbox\webbox\packages\server\src\pluginRoutes.ts`
- Modify: `H:\oplus\kodbox\webbox\scripts\compile-webbox.mjs`
- Modify: `H:\oplus\kodbox\webbox\apps\web\src\assets.ts`
- Test: `H:\oplus\kodbox\webbox\packages\server\tests\workspaceService.test.ts`
- Test: `H:\oplus\kodbox\webbox\packages\server\tests\mountService.test.ts`
- Test: `H:\oplus\kodbox\webbox\packages\plugin-compat\tests\pluginRegistry.test.ts`

- [ ] **Step 1: Test workspace tree output**

Assert the tree contains `位置`, `收藏夹`, `个人空间`, `工具`, `最近文档`, `我的相册`, `我的文档`, `我的音乐`, `我的视频`, `私密保险箱`, `回收站`, and `网络挂载`.

- [ ] **Step 2: Implement workspace tree service**

Generate stable tree nodes with logical IDs and route targets.

- [ ] **Step 3: Test local roots and mount definitions**

Assert Windows returns available drive roots and Linux returns `/`. Assert FTP/WebDAV definitions are persisted and hidden secrets are not returned by bootstrap.

- [ ] **Step 4: Implement mount service**

Add local roots now; add FTP/WebDAV definitions, connection-test stubs with clear error output when clients are not configured, and typed route responses.

- [ ] **Step 5: Expand plugin discovery**

Discover installed Kodbox plugins, block `adminer` and `client`, mark compatible viewer/editor/media plugins, and expose static base URLs.

- [ ] **Step 6: Copy Kodbox assets in build**

Copy required images, fonts, status art, and compatible plugin directories from `H:\oplus\kodbox\kodbox_web` into public/build assets. Ensure output appears in caller `out`.

- [ ] **Step 7: Run workspace/plugin tests**

Run server and plugin-compat tests. Expected result: all pass.

## Task 5: React Explorer UI and Interaction Wiring

**Files:**
- Modify: `H:\oplus\kodbox\webbox\apps\web\src\api\client.ts`
- Modify: `H:\oplus\kodbox\webbox\apps\web\src\components\FileManager.tsx`
- Modify: `H:\oplus\kodbox\webbox\apps\web\src\components\ContextMenu.tsx`
- Modify: `H:\oplus\kodbox\webbox\apps\web\src\components\BottomMenu.tsx`
- Modify: `H:\oplus\kodbox\webbox\apps\web\src\components\AdminPanel.tsx`
- Create: `H:\oplus\kodbox\webbox\apps\web\src\components\NavigationTree.tsx`
- Create: `H:\oplus\kodbox\webbox\apps\web\src\components\FileGrid.tsx`
- Create: `H:\oplus\kodbox\webbox\apps\web\src\components\InspectorPanel.tsx`
- Create: `H:\oplus\kodbox\webbox\apps\web\src\components\SafeBoxDialog.tsx`
- Create: `H:\oplus\kodbox\webbox\apps\web\src\components\NotificationPanel.tsx`
- Modify: `H:\oplus\kodbox\webbox\apps\web\src\styles.css`
- Test: `H:\oplus\kodbox\webbox\apps\web\tests\file-manager.test.tsx`

- [ ] **Step 1: Add frontend tests for user-visible behavior**

Test that tree entries render, toolbar buttons call API, upload uses `FormData`, view switch changes layout, context menu opens, inspector tabs switch, notification popover opens, safe-box dialog appears, and admin storage fields render.

- [ ] **Step 2: Extend API client**

Add typed methods for bootstrap, tree, file operations, recycle, safe-box, metadata, notifications, admin config, mounts, and event connection.

- [ ] **Step 3: Implement explorer state**

Track current tree node, current path, items, loading/error, selection, view mode, context menu state, inspector tab, notifications, and safe-box status.

- [ ] **Step 4: Implement navigation tree**

Render sections and entries using backend tree nodes. Select entries and trigger safe-box flow where required.

- [ ] **Step 5: Implement file grid/list**

Support list view, icon view, double-click open, single/multi-selection, Ctrl/Shift selection, rectangle select, keyboard actions, and item icons.

- [ ] **Step 6: Wire toolbar and context menu actions**

Connect all visible actions to backend routes and refresh/event updates. Remove all prohibited Kodbox menu actions.

- [ ] **Step 7: Implement inspector panel**

Load and save properties, tags/descriptions, memos, memo attachments, and activity logs.

- [ ] **Step 8: Implement notifications and bottom menu**

Add icons to notification/menu buttons, notification popover, read/clear actions, and folded menu entries for admin, plugin manager, language, and theme.

- [ ] **Step 9: Implement admin panel**

Add overview, storage directory config, plugin manager, notification manager, and simplified settings.

- [ ] **Step 10: Run frontend tests**

Run `pnpm --filter @webbox/web test`. Expected result: all frontend tests pass.

## Task 6: Build, Dynamic Smoke, Overwrite, and Commit Message

**Files:**
- Modify: `H:\oplus\kodbox\webbox\docs\BUILD.md`
- Modify: `H:\oplus\kodbox\webbox\scripts\build.ps1`
- Modify: `H:\oplus\kodbox\webbox\scripts\build.sh`
- Modify: `H:\oplus\kodbox\webbox\scripts\compile-webbox.mjs`
- Create/refresh: `H:\oplus\kodbox\overwrite\...`

- [ ] **Step 1: Run full test suite**

Run `pnpm test` from `H:\oplus\kodbox\webbox`. Expected result: all package tests pass.

- [ ] **Step 2: Build in isolated test directory**

Sync Webbox to `H:\oplus\kodbox\webbox-test`, install dependencies there only if needed, and run the build script from that test directory. Expected result: `webbox-test\out` contains server, web assets, copied Kodbox assets, plugins, `server.conf`, `run-webbox.ps1`, and `run-webbox.sh`.

- [ ] **Step 3: Run smoke server**

Start the built server from `webbox-test\out` without changing system configuration. Verify `/api/bootstrap`, `/api/tree`, `/api/files`, `/api/events`, `/api/plugins`, and the web UI load.

- [ ] **Step 4: Exercise core operations**

Create a temporary personal root under `webbox-test`, upload a file, download it, rename it, move it, recycle it, restore it, update a library directory, create a memo, add a favorite, open safe box, unlock safe box, and verify a local file change produces a notification/event.

- [ ] **Step 5: Compare with original Kodbox**

Use `http://localhost:1145` as the reference for tree/menu/property-panel behavior and verify Webbox implements the requested single-user subset.

- [ ] **Step 6: Generate overwrite from baseline**

Compare current files against `baseline-webbox-kodbox-parity.json`. Copy only changed/new files from `H:\oplus\kodbox\webbox` into `H:\oplus\kodbox\overwrite` preserving Webbox-relative paths. Exclude `.git`, `node_modules`, `out`, `dist`, test temp data, logs, and package-manager caches.

- [ ] **Step 7: Provide commit message**

Prepare:

```text
feat: implement kodbox-style webbox explorer core

- add configurable workspace libraries, safe box, recycle, metadata, notifications, and activity services
- wire React explorer actions, tree navigation, view modes, context menu, inspector, and admin storage settings
- reuse Kodbox assets/plugins in clean build output and generate overwrite delivery files
```

