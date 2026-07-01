# Webbox Kodbox-Parity Core Design

Date: 2026-06-30

## Purpose

Webbox will become a React/Electron-friendly single-user web file manager that reuses Kodbox's file-management behavior and visual resources without carrying forward Kodbox's PHP-era user, department, sharing, login, and server-environment management model.

The current Webbox shell already has a Node server, React frontend, central language file, build scripts, server.conf output, logger, and partial file APIs. The observed smoke-test failure is mostly caused by frontend actions not being wired to the existing backend, while larger features such as the navigation tree, private safe box, metadata, notifications, plugin discovery, admin configuration, and real-time refresh still require new Webbox-native services.

## Scope

This design covers one implementation cycle for the Webbox core file-management parity layer:

- Working file-management UI for upload, download, create, rename, copy, move, delete, recycle, restore, search, archive, and refresh.
- Kodbox-style navigation tree for personal file-management only.
- Private safe box using original Kodbox semantics: password-gated directory access, no content encryption.
- Metadata-backed favorites, recent documents, memos, tags/descriptions, activity logs, notifications, and plugin enablement.
- Simplified admin panel for local single-user use.
- Local plugin discovery from installed plugin directories only.
- Kodbox visual resource reuse for file/folder icons, status art, fonts, emoji/attachment resources, and compatible plugin static assets.
- Build output that remains clean and deployable from the caller's `out` directory.

This design does not restore account login, departments, user permission settings, share links, desktop features, online plugin install, Adminer/client plugins, login logs, PHP/Apache/Nginx/database diagnostics, or original Kodbox user/department columns.

## Architecture

### Server Modules

`ConfigService`

- Reads runtime settings from environment and `server.conf`.
- Writes Webbox-managed settings back to `server.conf` while preserving deployer-editable comments where practical.
- Stores directory paths for personal space, photos, documents, music, videos, safe box, recycle bin, data root, plugin root, and mount definitions.
- Applies directory updates atomically:
  - If the target directory exists and is non-empty, reject the change with `目标目录存在文件，请手工清理`.
  - If the old directory exists and contains files, move all contents into the new directory.
  - If the target does not exist or is empty, create it as needed and persist the new path.

`WorkspaceService`

- Owns the logical tree model:
  - `位置`: favorites, personal space.
  - `工具`: recent documents, photos, documents, music, videos, private safe box, recycle bin.
  - `网络挂载`: local disks/root directories and configured FTP/WebDAV mounts.
- Resolves logical paths such as `webbox://personal`, `webbox://photos`, `webbox://safe`, `mount://local/C`, and `mount://webdav/<id>` into concrete providers.
- Keeps frontend navigation independent from raw local paths.

`FileService`

- Extends the current file service into a provider-aware operation layer.
- Supports list, stat, upload, download, create file/folder, write text, rename, copy, move, recycle, restore, permanent delete, zip, unzip, search, and open/view tracking.
- Emits activity events for all mutating operations and file-open events.
- Uses the recycle provider by default for deletion, except when the user explicitly chooses permanent delete inside recycle bin.

`MetadataStore`

- Stores structured JSON metadata under the configured data root.
- Tracks:
  - Favorites.
  - Recent file events.
  - Memos with Markdown text, emoji text, image references, and attachment references.
  - File tags and custom descriptions.
  - Activity records.
  - Notifications.
  - Safe box password hash/salt and unlock session state.
  - Plugin enabled/disabled flags.
- Uses stable path IDs derived from provider and normalized path, so metadata follows logical paths consistently.

`SafeBoxService`

- Implements the original Kodbox behavior in Webbox-native form.
- States:
  - `notOpen`: safe box not initialized; tree entry opens a setup prompt.
  - `locked`: password exists; tree entry opens a login prompt and returns an empty/locked listing.
  - `unlocked`: current server session can list and manage safe-box files.
- Actions:
  - `open`: set initial password, create configured safe-box directory.
  - `login`: validate password hash and unlock.
  - `logout`: lock the current session.
  - `changePassword`: validate old password and update hash.
- Safe-box files are stored as normal files in the configured directory. This matches the requested original logic and intentionally does not encrypt file contents.

`WatchService`

- Watches configured personal, library, safe-box, recycle, and local mount directories where watching is supported.
- Sends server-sent events to the frontend for file changes, metadata changes, notifications, and config changes.
- Debounces bursts of local filesystem events to avoid repeated full refreshes.
- Logs all watcher start, stop, error, and change events to terminal and log file.

`MountService`

- Lists local disks on Windows and root folders on Linux.
- Stores manual FTP/WebDAV mount definitions in `server.conf` or metadata with host, path, username, and saved non-secret connection fields.
- Provides connection test, list, upload, download, mkdir, rename, delete, and move operations for WebDAV and FTP where credentials are configured.
- Degrades gracefully with clear errors when a mount is unreachable.

`PluginService`

- Scans the configured plugin root and installed plugin folders copied from Kodbox.
- Blocks removed plugins such as `adminer` and `client`.
- Marks known viewer/editor/media plugins as compatible and exposes static resources under `/plugins/<id>/`.
- Provides a Kodbox-style browser shim only for local plugin viewer/editor integration; it does not re-enable online install or removed system features.

### API Surface

The API should remain Webbox-native and typed through `@webbox/shared`.

Core groups:

- `/api/bootstrap`: user-less bootstrap, feature flags, plugins, config summary, tree roots.
- `/api/tree`: navigation tree, children, refresh.
- `/api/files`: provider-aware file operations.
- `/api/recycle`: list, restore, permanent delete, clear.
- `/api/safe-box`: status, open, login, logout, change password.
- `/api/metadata`: favorites, tags/descriptions, memos, attachments, activities, notifications.
- `/api/admin`: overview, storage configuration, plugin settings, notification management.
- `/api/mounts`: local roots, mount definitions, connection tests.
- `/api/events`: SSE stream for file/config/metadata/plugin notifications.

All file and admin operations are logged through the existing Webbox logger.

## Frontend Design

### Explorer Shell

The file manager becomes a Kodbox-inspired but Webbox-native explorer:

- Left navigation tree with `位置`, `工具`, and `网络挂载`.
- Main workspace with breadcrumb, toolbar, list/grid view modes, selection state, and empty/loading/error states.
- Right inspector panel with three bottom tabs: `属性`, `备忘录`, `动态`.
- Bottom-left notification button and folded menu button with icons.
- Modal/popup layer for rename, create, upload progress, safe-box setup/login, mount setup, and admin panel.

### Toolbar and File Operations

Every visible toolbar button must call a real action:

- Upload uses hidden file input and drag/drop upload.
- New file and new folder prompt for names and call the backend.
- Refresh reloads current provider path.
- Search calls backend search and displays results without losing current path.
- View switch toggles list and icon layout.
- Download supports selected files; multiple items are archived first or downloaded individually according to backend support.

### Selection Model

Selection is centralized in the explorer state:

- Single click selects one item.
- Ctrl toggles selection.
- Shift selects ranges in list mode.
- Icon mode supports drag rectangle multi-select.
- Keyboard shortcuts support delete, F2 rename, Enter open, Escape clear selection.

### Context Menu

Right-click opens a contextual menu near the pointer.

Allowed actions:

- Open/preview.
- Download.
- Rename.
- Copy.
- Move.
- Delete to recycle.
- Restore or permanent delete in recycle bin.
- Compress/extract where applicable.
- Add/remove favorite where applicable.
- Properties.

Removed actions stay absent:

- Edit lock.
- Quick external share.
- Create shortcut.
- Send to desktop shortcut.
- Any external-link sharing action.

### Navigation Tree Behavior

`收藏夹`

- Lists favorite files/folders stored in metadata.
- Missing targets are shown as missing and can be removed.

`个人空间`

- Points to the configured personal data directory.

`最近文档`

- Shows files ranked by recent create, modify, and open events.

`我的相册`, `我的文档`, `我的音乐`, `我的视频`

- Point to configurable directories.
- Default to subdirectories under the data root.
- Use file-type icons and filters only when showing synthetic recent/category views; direct directory navigation still shows all children.

`私密保险箱`

- Shows setup/login prompts according to safe-box status.
- Lists files only after unlock.

`回收站`

- Shows deleted items with original path and deletion time.

`网络挂载`

- Shows local disks/root directories and configured FTP/WebDAV mounts.

### Right Inspector

`属性`

- Shows file/folder type, size, absolute/logical path, created/modified/accessed times, extension, and custom tags/description.
- Allows editing tags and description.

`备忘录`

- Targets selected item, or current directory when nothing is selected.
- Supports Markdown text, emoji text, image upload, and attachments.
- Stores attachments through metadata attachment routes.

`动态`

- Shows activity records for selected item, or current directory when nothing is selected.
- Directory activity includes child-path operations, similar to viewing a git log for a directory subtree.

### Notifications

The notification button opens a popover with unread/read state.

Notification sources:

- File operation success/failure.
- Watcher-detected external changes.
- Admin config changes.
- Plugin scan changes.
- Safe-box state changes.

Actions:

- Mark one/all as read.
- Clear all.
- Open related path when the notification has a target.

### Admin Panel

The admin panel is single-user and local-only:

- `概览`: storage usage, configured roots, plugin count, watcher status, recent activity count. No user-info card and no access-user count.
- `系统设置`: language, theme, file behavior, notification behavior.
- `存储/文件`: personal/library/safe/recycle directory configuration and migration.
- `插件管理`: local installed plugins, compatible status, enabled flag, static resource path.
- `通知管理`: notification history and clear controls.

The admin panel excludes removed Kodbox functionality: users, departments, login logs, share management, clients/apps, server/PHP/database checks, and original logo.

## Resource Reuse

Resources copied from `H:\oplus\kodbox\kodbox_web`:

- File/folder/status icons from `static/images/file_icon` and `static/images/common`.
- Font icon assets from `static/style/lib/font-icon` and `static/style/lib/alifont`.
- Compatible plugin static assets from `plugins`.
- Emoji/attachment assets needed by memos and notifications where available.

Resources are copied into Webbox public assets and included by the build script so the generated `out` directory is self-contained.

The implementation should not import the original Kodbox `static/app/dist/main.js` as the application shell.

## Data Flow

1. The server starts and reads `server.conf`.
2. Config and metadata stores initialize required directories.
3. PluginService scans local plugins.
4. WatchService starts watchers for configured filesystem roots.
5. The frontend loads `/api/bootstrap` and `/api/tree`.
6. The user selects a tree entry; WorkspaceService resolves it into a provider path.
7. FileService performs provider operations and writes activity records.
8. Metadata changes and filesystem watcher events push through `/api/events`.
9. The frontend refreshes affected views and shows notifications.

## Error Handling

Errors must be visible in UI and logs.

- Invalid path: `路径超出文件根目录`.
- Missing path: `路径不存在`.
- Duplicate name: `目标已存在`.
- Non-empty target directory during library migration: `目标目录存在文件，请手工清理`.
- Locked safe box: safe-box login prompt, not a generic failure toast.
- Network mount unreachable: mount-specific error with retry/test action.
- Plugin incompatible: shown in plugin manager with reason, not loaded into viewer.

## Testing

### Unit and API Tests

- Config parsing and writing.
- Directory migration success and non-empty target rejection.
- File CRUD, upload, download, copy, move, rename, recycle, restore, permanent delete.
- Safe-box open/login/logout/change password.
- Favorites, recent documents, memos, tags, descriptions, activity logs, notifications.
- Plugin discovery and blocked plugin filtering.
- Mount provider path normalization.

### Frontend Tests

- Toolbar buttons call API and update UI.
- Left tree entries load the expected routes.
- List/grid view toggles without layout breakage.
- Multi-select and context menu actions work.
- Inspector tabs display and persist metadata.
- Notification popover opens, marks read, and clears.
- Admin directory config writes and refreshes tree state.

### Dynamic Smoke Tests

Run from `H:\oplus\kodbox\webbox-test` to avoid dependency pollution in `webbox`:

- Copy/sync current code into the test directory.
- Install test dependencies only there when needed.
- Build Webbox and run from test output.
- Exercise file operations with a temporary data root.
- Verify external local file changes trigger SSE refresh/notification.
- Compare key UI states against the original Kodbox instance at `http://localhost:1145`.
- Confirm `H:\oplus\kodbox\overwrite` contains only files changed in this implementation cycle.

## Delivery

After implementation:

- Build output remains under the caller's `out` directory.
- `server.conf`, `run-webbox.ps1`, and `run-webbox.sh` are produced in the build output.
- Runtime logs go to both terminal and configured log file when enabled.
- Only this-cycle modified files are copied to `H:\oplus\kodbox\overwrite` using the Webbox-relative directory structure.
- A conventional git commit message is provided for the user to apply.

