# Webbox Explorer Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first Explorer Core slice so Webbox behaves like a standalone single-user file manager with safe abstract paths, recursive navigation, real toolbar actions, persisted UI preferences, and clean build/runtime assets.

**Architecture:** Add small backend primitives for path resolution, settings, favorites, recent activity, and safe downloads, then connect them to focused React components for tree, top bar, action bar, file surface, and inspector. Keep full admin overview/backup/network driver implementation outside this slice, but persist the settings schema those future screens need.

**Tech Stack:** TypeScript, React 18, Vite, Express, Vitest, Supertest, Node.js filesystem APIs, existing Webbox workspace packages.

---

## File Map

- Create `packages/shared/src/pathSafety.ts`: shared path/filename validation used by server tests and React UI.
- Modify `packages/shared/src/types.ts`: add `SortState`, `ExplorerPreferences`, `WebboxSettings`, `ResolvedLocation`, `FavoriteEntry`, `RecentSearch`, and template file types.
- Modify `packages/shared/src/language.ts`: add strings for tree nodes, toolbar commands, validation messages, inspector tabs, and notification/menu labels.
- Create `packages/server/src/settingsStore.ts`: read/write `.config/settings.json` with defaults and atomic persistence.
- Create `packages/server/src/pathResolver.ts`: map abstract Webbox paths to virtual locations or storage-backed filesystem paths.
- Modify `packages/server/src/metadataStore.ts`: persist favorites, recent searches, and activity queries required by Explorer Core.
- Modify `packages/server/src/workspaceService.ts`: remove automatic local disk/root enumeration and return only configured mounts.
- Modify `packages/server/src/fileService.ts`: validate names, create template files, expose download metadata, and keep activity records.
- Modify `packages/server/src/routes.ts`: add settings/favorite/recent/template endpoints, enforce resolver validation, and set download attachment headers.
- Modify `packages/server/src/app.ts`: wire `SettingsStore` and `PathResolver`.
- Modify `packages/server/tests/routes.test.ts`: add server/API regression tests for the slice.
- Create `apps/web/src/hooks/useExplorerController.ts`: own navigation, history, selection, sorting, preferences, search, create/rename state, and command dispatch.
- Create `apps/web/src/components/ExplorerTree.tsx`: recursive collapsible tree with clickable virtual folders.
- Create `apps/web/src/components/ExplorerTopBar.tsx`: back/forward, breadcrumb buttons/edit input, favorite star, and search history dropdown.
- Create `apps/web/src/components/ExplorerActionBar.tsx`: refresh/upload/download/new/view/size/sort/inspector/safe-lock controls.
- Create `apps/web/src/components/FileSurface.tsx`: list/grid rendering, sortable headers, inline name editor, drag selection, shift/ctrl selection.
- Modify `apps/web/src/components/FileGrid.tsx`: either reduce it to a compatibility wrapper around `FileSurface` or remove references after migration.
- Modify `apps/web/src/components/NavigationTree.tsx`: replace current button sections with wrapper exports for `ExplorerTree` if other imports remain.
- Modify `apps/web/src/components/InspectorPanel.tsx`: preview inside panel, connected tabs, fixed activity scroll, memo toolbar controls, multi-select summary.
- Modify `apps/web/src/components/FileManager.tsx`: compose the new controller and components, remove prompt-based flows.
- Modify `apps/web/src/components/BottomMenu.tsx`, `ContextMenu.tsx`, and `NotificationPanel.tsx`: switch from rounded button cards to list menus and make popovers mutually exclusive.
- Modify `apps/web/src/api/client.ts`: add typed calls for settings, favorites, template creation, search history, and abstract path navigation.
- Modify `apps/web/src/assets.ts`: update asset paths from `webbox-assets/kodbox` to Webbox-owned asset paths.
- Modify `apps/web/src/styles.css`: enforce full-height shell, two-row toolbar, fixed tree/footer, file surface scrolling, inspector layout, and original-style toolbar button treatment.
- Move `assets/kodbox/*` to `assets/webbox/*`, excluding unused login/desktop images.
- Modify `scripts/compile-webbox.mjs`, `scripts/build.ps1`, and `scripts/build.sh`: copy renamed assets, avoid external paths, keep tests behind the explicit test flag, and generate runtime scripts that keep Node in foreground.

## Task 1: Baseline And Test Harness

**Files:**
- Create: `H:\oplus\kodbox\webbox-test\baseline-webbox-explorer-core.json`
- Modify: none in source

- [ ] **Step 1: Save the source baseline**

Run:

```powershell
$root = Resolve-Path 'H:\oplus\kodbox\webbox'
$out = 'H:\oplus\kodbox\webbox-test\baseline-webbox-explorer-core.json'
New-Item -ItemType Directory -Force -Path 'H:\oplus\kodbox\webbox-test' | Out-Null
$items = Get-ChildItem -LiteralPath $root -Recurse -File -Force | Where-Object {
  $rel = $_.FullName.Substring($root.Path.Length + 1).Replace('\','/')
  $rel -notmatch '(^|/)\.git(/|$)' -and
  $rel -notmatch '(^|/)node_modules(/|$)' -and
  $rel -notmatch '(^|/)out(/|$)' -and
  $rel -notmatch '(^|/)dist(/|$)' -and
  $rel -notmatch '(^|/)coverage(/|$)' -and
  $rel -notmatch '(^|/)\.webbox-test-data(/|$)' -and
  $rel -notmatch '\.log$'
} | ForEach-Object {
  [pscustomobject]@{
    path = $_.FullName.Substring($root.Path.Length + 1).Replace('\','/')
    hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
  }
}
$items | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $out -Encoding UTF8
```

Expected: `baseline-webbox-explorer-core.json` exists and contains one object per tracked delivery file.

- [ ] **Step 2: Sync clean source to the test directory**

Run:

```powershell
robocopy 'H:\oplus\kodbox\webbox' 'H:\oplus\kodbox\webbox-test' /E /XD .git node_modules out dist coverage .webbox-test-data .superpowers /XF *.log
if ($LASTEXITCODE -le 7) { exit 0 } else { exit $LASTEXITCODE }
```

Expected: command exits `0`; `H:\oplus\kodbox\webbox-test\package.json` exists.

## Task 2: Shared Types And Safety Validation

**Files:**
- Create: `packages/shared/src/pathSafety.ts`
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/server/tests/routes.test.ts`

- [ ] **Step 1: Write failing validation tests**

Append these cases to `packages/server/tests/routes.test.ts`:

```ts
it("rejects unsafe abstract paths and filenames", async () => {
  const app = await createApp({ storageRoot, dataRoot, pluginRoot });
  await request(app).get("/api/files").query({ path: "/位置/个人空间/../secret" }).expect(400);
  await request(app).get("/api/files").query({ path: "C:/Windows" }).expect(400);
  await request(app).get("/api/files").query({ path: "\\\\server\\share" }).expect(400);
  await request(app).post("/api/files/folder").send({ path: "/位置/个人空间/CON" }).expect(400);
  await request(app).post("/api/files/rename").send({ path: "/位置/个人空间/a.txt", name: "bad/name.txt" }).expect(400);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
corepack pnpm vitest run packages/server/tests/routes.test.ts -t "rejects unsafe abstract paths and filenames"
```

Expected: FAIL because `PathResolver` and shared validation are not implemented or routes still accept old raw paths.

- [ ] **Step 3: Add shared validation implementation**

Create `packages/shared/src/pathSafety.ts`:

```ts
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export function splitAbstractPath(input: string): string[] {
  const decoded = decodeURIComponent(String(input || ""));
  if (!decoded.startsWith("/") || decoded.includes("\\") || /^[a-zA-Z]:/.test(decoded) || decoded.startsWith("//")) {
    throw new Error("invalidPath");
  }
  const parts = decoded.split("/").filter(Boolean);
  for (const part of parts) {
    if (part === "." || part === ".." || CONTROL_CHARS.test(part)) {
      throw new Error("invalidPath");
    }
  }
  return parts;
}

export function assertSafeFileName(name: string): string {
  const trimmed = String(name || "").trim();
  if (!trimmed || trimmed.includes("/") || trimmed.includes("\\") || trimmed === "." || trimmed === "..") {
    throw new Error("invalidName");
  }
  if (CONTROL_CHARS.test(trimmed) || WINDOWS_RESERVED.test(trimmed) || /[<>:"|?*]/.test(trimmed)) {
    throw new Error("invalidName");
  }
  return trimmed;
}
```

Update `packages/shared/src/types.ts` with:

```ts
export type SortKey = "name" | "type" | "size" | "modifiedAt";
export type SortDirection = "asc" | "desc";
export type TemplateFileType = "txt" | "md" | "html" | "docx" | "xlsx" | "pptx";

export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

export interface ExplorerPreferences {
  theme: "light" | "dark";
  language: "zh-CN" | "en-US";
  viewMode: ViewMode;
  iconSize: number;
  sort: SortState;
  searchHistoryLimit: number;
}

export interface RecentSearch {
  id: string;
  text: string;
  scope: string;
  createdAt: string;
}

export interface FavoriteEntry {
  id: string;
  path: string;
  label: string;
  kind: "file" | "directory" | "virtual";
  createdAt: string;
}

export interface WebboxSettings {
  explorer: ExplorerPreferences;
  upload: {
    chunkSizeMb: number;
    concurrency: number;
    ignorePatterns: string[];
    retryCount: number;
  };
  download: {
    speedLimitKb: number;
    frontendZip: boolean;
    backendZipSizeLimitMb: number;
  };
}
```

Export the new helpers from `packages/shared/src/index.ts`:

```ts
export * from "./pathSafety.js";
```

- [ ] **Step 4: Run validation test and keep expected route failures for resolver work**

Run the same Vitest command. Expected: still FAIL at route behavior, proving the server must call the new helper.

## Task 3: Settings Store And Abstract Path Resolver

**Files:**
- Create: `packages/server/src/settingsStore.ts`
- Create: `packages/server/src/pathResolver.ts`
- Modify: `packages/server/src/app.ts`
- Modify: `packages/server/src/routes.ts`
- Test: `packages/server/tests/routes.test.ts`

- [ ] **Step 1: Write failing tests for settings and abstract tree**

Add:

```ts
it("persists explorer settings and returns the requested tree hierarchy without local roots", async () => {
  const app = await createApp({ storageRoot, dataRoot, pluginRoot });
  await request(app).put("/api/settings").send({
    explorer: { theme: "dark", language: "zh-CN", viewMode: "grid", iconSize: 96, sort: { key: "type", direction: "desc" }, searchHistoryLimit: 8 }
  }).expect(200);
  const settings = await request(app).get("/api/settings").expect(200);
  expect(settings.body.data.explorer.iconSize).toBe(96);
  const tree = await request(app).get("/api/tree").expect(200);
  expect(tree.body.data.map((node: { label: string }) => node.label)).toEqual(["位置", "工具", "网络挂载"]);
  expect(JSON.stringify(tree.body.data)).toContain("个人空间");
  expect(JSON.stringify(tree.body.data)).toContain("新增网络挂载");
  expect(JSON.stringify(tree.body.data)).not.toMatch(/[A-Z]:\\\\|本地磁盘|root/);
});
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
corepack pnpm vitest run packages/server/tests/routes.test.ts -t "persists explorer settings"
```

Expected: FAIL because `/api/settings` does not exist or tree still exposes old structure.

- [ ] **Step 3: Implement `SettingsStore` defaults and persistence**

Create `settingsStore.ts` with a class that:

```ts
export const defaultSettings: WebboxSettings = {
  explorer: {
    theme: "light",
    language: "zh-CN",
    viewMode: "list",
    iconSize: 72,
    sort: { key: "name", direction: "asc" },
    searchHistoryLimit: 10
  },
  upload: { chunkSizeMb: 8, concurrency: 3, ignorePatterns: [".DS_Store", "Thumbs.db"], retryCount: 2 },
  download: { speedLimitKb: 0, frontendZip: true, backendZipSizeLimitMb: 1024 }
};
```

The class constructor receives `dataRoot`, stores data in `path.join(dataRoot, ".config", "settings.json")`, and exposes `get()` plus `update(partial)` that deep-merges only known top-level objects.

- [ ] **Step 4: Implement `PathResolver`**

Create `pathResolver.ts` that resolves:

```ts
"/位置" -> { kind: "virtual", displayPath: "/位置", virtualId: "locations" }
"/位置/个人空间" -> { kind: "space", displayPath: "/位置/个人空间", space: "personal", filePath: "/" }
"/位置/个人空间/我的文档/a.txt" -> { kind: "space", space: "documents", filePath: "/a.txt" }
"/工具/回收站" -> { kind: "recycle", displayPath: "/工具/回收站" }
"/网络挂载" -> { kind: "virtual", virtualId: "mounts" }
```

It must call `splitAbstractPath` and reject unrecognized roots with `invalidPath`.

- [ ] **Step 5: Wire `/api/settings` and `/api/tree`**

Update `createApp` to instantiate `SettingsStore` and pass it into routes. Update routes so:

```ts
router.get("/settings", ...);
router.put("/settings", ...);
router.get("/tree", ...);
```

`/api/tree` returns exactly the hierarchy in the design document, with `网络挂载` containing `新增网络挂载` and configured mounts only.

- [ ] **Step 6: Verify GREEN**

Run:

```powershell
corepack pnpm vitest run packages/server/tests/routes.test.ts -t "persists explorer settings|rejects unsafe abstract paths"
```

Expected: PASS for the new settings/tree and safety tests.

## Task 4: File Operations, Templates, Favorites, Recent, And Downloads

**Files:**
- Modify: `packages/server/src/fileService.ts`
- Modify: `packages/server/src/metadataStore.ts`
- Modify: `packages/server/src/routes.ts`
- Test: `packages/server/tests/routes.test.ts`

- [ ] **Step 1: Write failing API tests**

Add:

```ts
it("supports template creation, favorites, recent searches, and attachment downloads", async () => {
  const app = await createApp({ storageRoot, dataRoot, pluginRoot });
  await request(app).post("/api/files/template").send({ path: "/位置/个人空间/我的文档/readme.md", type: "md" }).expect(200);
  await request(app).post("/api/favorites").send({ path: "/位置/个人空间/我的文档", label: "我的文档" }).expect(200);
  const favorites = await request(app).get("/api/favorites").expect(200);
  expect(favorites.body.data[0].path).toBe("/位置/个人空间/我的文档");
  await request(app).post("/api/search/recent").send({ text: "readme", scope: "/位置/个人空间" }).expect(200);
  const recent = await request(app).get("/api/search/recent").expect(200);
  expect(recent.body.data[0].text).toBe("readme");
  const download = await request(app).get("/api/files/download").query({ path: "/位置/个人空间/我的文档/readme.md" }).expect(200);
  expect(download.headers["content-disposition"]).toMatch(/attachment/);
});
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
corepack pnpm vitest run packages/server/tests/routes.test.ts -t "supports template creation"
```

Expected: FAIL because the endpoints or abstract path support are missing.

- [ ] **Step 3: Add template creation**

Implement `/api/files/template` with these exact initial contents:

```ts
const TEMPLATE_TEXT: Record<"txt" | "md" | "html", string> = {
  txt: "",
  md: "# New Document\n",
  html: "<!doctype html>\n<html>\n<head><meta charset=\"utf-8\"><title>New Document</title></head>\n<body></body>\n</html>\n"
};
```

For `docx`, `xlsx`, and `pptx`, create a minimal binary placeholder file in this slice with the correct extension and a clear text marker inside; the UI can open or replace it through plugins later.

- [ ] **Step 4: Add favorites and recent-search persistence**

Store favorites and recent searches in `MetadataStore` JSON. Use IDs of the form:

```ts
const id = createHash("sha1").update(`${path}\0${label}`).digest("hex").slice(0, 16);
```

Recent searches are newest-first and trimmed to `settings.explorer.searchHistoryLimit`.

- [ ] **Step 5: Enforce attachment download**

Set:

```ts
res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
```

Only preview routes may use inline display.

- [ ] **Step 6: Verify GREEN**

Run:

```powershell
corepack pnpm vitest run packages/server/tests/routes.test.ts -t "supports template creation"
```

Expected: PASS.

## Task 5: Explorer Controller And API Client

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Create: `apps/web/src/hooks/useExplorerController.ts`
- Test: `apps/web/src/components/FileManager.test.tsx`

- [ ] **Step 1: Write failing React behavior tests**

Create `apps/web/src/components/FileManager.test.tsx` with tests that mock `fetch` and assert:

```ts
expect(screen.getByRole("treeitem", { name: "位置" })).toBeInTheDocument();
await user.click(screen.getByRole("button", { name: "切换为路径输入" }));
await user.type(screen.getByLabelText("路径输入"), "/位置/个人空间/我的文档{enter}");
expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/files?path=%2F%E4%BD%8D%E7%BD%AE"), expect.anything());
```

Also assert pressing Enter in search calls `/api/search/recent`.

- [ ] **Step 2: Verify RED**

Run:

```powershell
corepack pnpm vitest run apps/web/src/components/FileManager.test.tsx
```

Expected: FAIL because the accessible controls and controller do not exist.

- [ ] **Step 3: Implement API client methods**

Add `getSettings`, `updateSettings`, `getTree`, `listFiles(path)`, `createTemplate`, `listFavorites`, `toggleFavorite`, `listRecentSearches`, `saveRecentSearch`, `downloadUrl`, and `lockSafeBox` methods. Encode path query values with `URLSearchParams`.

- [ ] **Step 4: Implement `useExplorerController`**

The hook returns:

```ts
{
  tree, currentPath, breadcrumbs, items, selectedPaths, settings,
  canGoBack, canGoForward, inspectorOpen, inlineEdit,
  navigate, goBack, goForward, refresh, search, createFolder,
  createTemplate, renameInline, commitInlineEdit, cancelInlineEdit,
  toggleFavorite, setViewMode, setIconSize, setSort, toggleInspector,
  selectOne, toggleSelection, selectRange, selectBox
}
```

Selection state stores an anchor path for Shift selection.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
corepack pnpm vitest run apps/web/src/components/FileManager.test.tsx
```

Expected: PASS for navigation and search-history tests.

## Task 6: Tree, Top Bar, Action Bar, And File Surface

**Files:**
- Create: `apps/web/src/components/ExplorerTree.tsx`
- Create: `apps/web/src/components/ExplorerTopBar.tsx`
- Create: `apps/web/src/components/ExplorerActionBar.tsx`
- Create: `apps/web/src/components/FileSurface.tsx`
- Modify: `apps/web/src/components/FileManager.tsx`
- Modify: `apps/web/src/components/NavigationTree.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `apps/web/src/components/FileManager.test.tsx`

- [ ] **Step 1: Add failing tests for visible UI behavior**

Extend the React tests to assert:

```ts
expect(screen.getByText("刷新")).toBeInTheDocument();
expect(screen.getByText("上传文件夹")).toBeInTheDocument();
expect(screen.getByText("txt")).toBeInTheDocument();
expect(screen.getByRole("columnheader", { name: "类型" })).toBeInTheDocument();
```

Add a test that clicking the `名称` column header calls `setSort` and re-renders sort direction.

- [ ] **Step 2: Verify RED**

Run the React test file. Expected: FAIL because the new UI is absent.

- [ ] **Step 3: Implement `ExplorerTree`**

Render a semantic tree:

```tsx
<nav className="explorer-tree" aria-label="目录树">
  <div role="tree">{nodes.map(renderNode)}</div>
</nav>
```

Each node row has an expand/collapse button when children exist and a label button that calls `navigate(node.path)`.

- [ ] **Step 4: Implement `ExplorerTopBar`**

Render back/forward buttons, breadcrumb segment buttons, a blank path-edit button labelled `切换为路径输入`, a favorite star button, and a search input that saves recent search on Enter.

- [ ] **Step 5: Implement `ExplorerActionBar`**

Render dropdown menus for upload and new templates. Use hidden file inputs:

```tsx
<input type="file" multiple hidden />
<input type="file" multiple hidden webkitdirectory="" directory="" />
```

The icon-size button opens `<input type="range" min="48" max="128">`.

- [ ] **Step 6: Implement `FileSurface`**

List mode columns are `名称`, `类型`, `大小`, `修改时间`. Grid mode applies `style={{ "--webbox-icon-size": `${iconSize}px` } as React.CSSProperties }`. Inline create/rename uses an input in the row/tile and commits on Enter.

- [ ] **Step 7: Verify GREEN**

Run:

```powershell
corepack pnpm vitest run apps/web/src/components/FileManager.test.tsx
```

Expected: PASS.

## Task 7: Inspector, Menus, Notifications, Theme, And Language

**Files:**
- Modify: `apps/web/src/components/InspectorPanel.tsx`
- Modify: `apps/web/src/components/BottomMenu.tsx`
- Modify: `apps/web/src/components/ContextMenu.tsx`
- Modify: `apps/web/src/components/NotificationPanel.tsx`
- Modify: `apps/web/src/components/FileManager.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `apps/web/src/components/FileManager.test.tsx`

- [ ] **Step 1: Add failing tests**

Assert:

```ts
expect(screen.getByRole("tab", { name: "属性" })).toBeInTheDocument();
expect(screen.getByRole("tab", { name: "备忘录" })).toBeInTheDocument();
expect(screen.getByRole("tab", { name: "动态" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "Markdown" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "表情" })).toBeInTheDocument();
```

Add a popover test that opening notifications closes the bottom menu and opening the bottom menu closes notifications.

- [ ] **Step 2: Verify RED**

Run the React test file. Expected: FAIL.

- [ ] **Step 3: Implement inspector layout**

Move preview markup inside `.inspector-panel`, render tabs as:

```tsx
<div className="inspector-tabs" role="tablist">
  <button role="tab" aria-selected={tab === "properties"}>属性</button>
  <button role="tab" aria-selected={tab === "memos"}>备忘录</button>
  <button role="tab" aria-selected={tab === "activity"}>动态</button>
</div>
```

Activity list uses `.activity-list { overflow: auto; min-height: 0; }`.

- [ ] **Step 4: Implement menu and notification list behavior**

Use `ul/li/button` menu structures. Notification panel has fixed width, wrapped text, and full-width read button.

- [ ] **Step 5: Implement persisted theme/language**

Theme and language menu actions call `updateSettings({ explorer: { theme, language } })`, update document attributes immediately, and refresh labels from `language.ts`.

- [ ] **Step 6: Verify GREEN**

Run:

```powershell
corepack pnpm vitest run apps/web/src/components/FileManager.test.tsx
```

Expected: PASS.

## Task 8: Assets, Build, Runtime, And Naming Cleanup

**Files:**
- Move: `assets/kodbox/file_icon` to `assets/webbox/file_icon`
- Move: `assets/kodbox/common/status` to `assets/webbox/status`
- Move: `assets/kodbox/common/default-avata.png` to `assets/webbox/avatar/default.png`
- Delete from Webbox-owned assets: login and desktop-only images that are not referenced by source code.
- Modify: `apps/web/src/assets.ts`
- Modify: `scripts/compile-webbox.mjs`
- Modify: `scripts/build.ps1`
- Modify: `scripts/build.sh`
- Test: existing script/build tests or smoke commands.

- [ ] **Step 1: Scan current owned naming**

Run:

```powershell
rg -n "kod|kodbox|kodbox_web" H:\oplus\kodbox\webbox --glob '!plugins/**' --glob '!docs/**' --glob '!pnpm-lock.yaml'
```

Expected: matches show only current asset paths and compatibility comments before cleanup.

- [ ] **Step 2: Move assets with PowerShell**

Run:

```powershell
New-Item -ItemType Directory -Force -Path 'H:\oplus\kodbox\webbox\assets\webbox' | Out-Null
Move-Item -LiteralPath 'H:\oplus\kodbox\webbox\assets\kodbox\file_icon' -Destination 'H:\oplus\kodbox\webbox\assets\webbox\file_icon'
Move-Item -LiteralPath 'H:\oplus\kodbox\webbox\assets\kodbox\common\status' -Destination 'H:\oplus\kodbox\webbox\assets\webbox\status'
New-Item -ItemType Directory -Force -Path 'H:\oplus\kodbox\webbox\assets\webbox\avatar' | Out-Null
Move-Item -LiteralPath 'H:\oplus\kodbox\webbox\assets\kodbox\common\default-avata.png' -Destination 'H:\oplus\kodbox\webbox\assets\webbox\avatar\default.png'
```

Then delete only empty Webbox-owned `assets/kodbox` directories after verifying no needed files remain.

- [ ] **Step 3: Update asset references and compile output**

Set frontend public URLs to `/webbox-assets/file_icon/...`, `/webbox-assets/status/...`, and `/webbox-assets/avatar/default.png`. Update `compile-webbox.mjs` to copy `assets/webbox` into `out/public/webbox-assets` and `apps/web/public/webbox-assets`.

- [ ] **Step 4: Runtime logging script check**

Ensure generated `run-webbox.ps1` starts Node in the foreground and does not pipe through `Tee-Object` or set host font-related console properties. Logging to file is controlled by `WEBBOX_LOG_FILE` and the Node logger.

- [ ] **Step 5: Verify naming cleanup**

Run:

```powershell
rg -n "kod|kodbox|kodbox_web" H:\oplus\kodbox\webbox --glob '!plugins/**' --glob '!docs/**' --glob '!pnpm-lock.yaml'
```

Expected: no matches in Webbox-owned source/build scripts/assets paths.

## Task 9: Full Verification And Overwrite Packaging

**Files:**
- Create/update: `H:\oplus\kodbox\overwrite\...` matching changed Webbox paths

- [ ] **Step 1: Sync to test directory**

Run:

```powershell
robocopy 'H:\oplus\kodbox\webbox' 'H:\oplus\kodbox\webbox-test' /E /XD .git node_modules out dist coverage .webbox-test-data .superpowers /XF *.log
if ($LASTEXITCODE -le 7) { exit 0 } else { exit $LASTEXITCODE }
```

Expected: source copied without node modules.

- [ ] **Step 2: Install test dependencies only in test directory**

Run:

```powershell
corepack pnpm install --dir 'H:\oplus\kodbox\webbox-test'
```

Expected: dependencies installed under `H:\oplus\kodbox\webbox-test\node_modules`.

- [ ] **Step 3: Build without tests**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File 'H:\oplus\kodbox\webbox-test\scripts\build.ps1'
```

Expected: builds `H:\oplus\kodbox\out` with server, web assets, `server.conf`, `run-webbox.ps1`, and `run-webbox.sh`; tests are not executed.

- [ ] **Step 4: Build with tests**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File 'H:\oplus\kodbox\webbox-test\scripts\build.ps1' -Test
```

Expected: server/API and React tests pass, then build output is refreshed.

- [ ] **Step 5: Runtime smoke**

Start the generated PowerShell runner from `H:\oplus\kodbox\out`, request `/api/bootstrap`, `/api/tree`, and `/`, then stop the runner with Ctrl+C or process termination. Verify the Node backend process exits immediately and the browser receives React HTML rather than the fallback message.

- [ ] **Step 6: Generate overwrite**

Compare `baseline-webbox-explorer-core.json` to current `H:\oplus\kodbox\webbox`, copy only changed or new files into `H:\oplus\kodbox\overwrite` preserving relative paths, and write a separate deletion/move note for asset paths moved out of `assets/kodbox`.

Use this commit message:

```text
feat: implement webbox explorer core shell

- add safe abstract path/settings APIs for standalone explorer behavior
- rebuild file manager tree, toolbar, file surface, inspector, and menu interactions
- clean webbox-owned assets/build output naming and runtime logging
```

## Self-Review

- Spec coverage: tasks cover the recursive tree, two-row toolbar, safe breadcrumb/input paths, favorites/recent/search, inline create/rename, sorting, icon size persistence, attachment download, multi-select surface, inspector layout, theme/language persistence, asset naming cleanup, and build/runtime logging boundary. Full admin overview/backup/network drivers remain outside this Explorer Core slice by the approved scope.
- Placeholder scan: no task uses open-ended `TBD`, `TODO`, or unspecified “handle edge cases” instructions. Each implementation task has concrete files, APIs, commands, and expected results.
- Type consistency: `ExplorerPreferences`, `WebboxSettings`, `SortState`, `FavoriteEntry`, `RecentSearch`, `TemplateFileType`, and `ResolvedLocation` are defined before use and reused consistently by server and web tasks.
