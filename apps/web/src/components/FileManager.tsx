import { ArrowLeft, ArrowRight, Download, Eye, EyeOff, FolderPlus, Grid2X2, List, RefreshCw, Search, Star, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { BootstrapData, FavoriteEntry, FileItem, NotificationItem, SafeBoxStatus, SortKey, SortState, TemplateFileType, TreeNode, ViewMode } from "@webbox/shared";
import { client } from "../api/client";
import { AdminPanel } from "./AdminPanel";
import { BottomMenu } from "./BottomMenu";
import { ContextMenu, type ContextAction } from "./ContextMenu";
import { FileGrid, type InlineEditState } from "./FileGrid";
import { InspectorPanel } from "./InspectorPanel";
import { NavigationTree } from "./NavigationTree";
import { SafeBoxDialog } from "./SafeBoxDialog";
import { uiAssets } from "../assets";
import { text } from "../i18n";

interface ContextState {
  x: number;
  y: number;
  item: FileItem;
  actions: ContextAction[];
}

function joinPath(base: string, name: string): string {
  return `${base.replace(/\/$/, "")}/${name}`.replace(/\/+/g, "/");
}

function basename(value: string): string {
  return value.split("/").filter(Boolean).at(-1) ?? value;
}

function sortItems(items: FileItem[], sort: SortState): FileItem[] {
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    if (sort.key === "size") return (a.size - b.size) * direction;
    if (sort.key === "modifiedAt") return a.modifiedAt.localeCompare(b.modifiedAt) * direction;
    if (sort.key === "type") return (a.extension || a.kind).localeCompare(b.extension || b.kind) * direction;
    return a.name.localeCompare(b.name, "zh-CN") * direction;
  });
}

function defaultTree(): TreeNode[] {
  return [
    { id: "locations", label: "位置", section: "locations", kind: "virtual", path: "/位置", icon: "folder", children: [
      { id: "favorites", label: "收藏夹", section: "locations", kind: "virtual", path: "/位置/收藏夹", icon: "treeFav" },
      { id: "personal", label: "个人空间", section: "locations", kind: "directory", path: "/位置/个人空间", icon: "folder", children: [
        { id: "personal-safe", label: "私密保险箱", section: "locations", kind: "directory", path: "/位置/个人空间/私密保险箱", icon: "safe" },
        { id: "photos", label: "我的相册", section: "locations", kind: "directory", path: "/位置/个人空间/我的相册", icon: "image" },
        { id: "documents", label: "我的文档", section: "locations", kind: "directory", path: "/位置/个人空间/我的文档", icon: "folder" },
        { id: "music", label: "我的音乐", section: "locations", kind: "directory", path: "/位置/个人空间/我的音乐", icon: "music" },
        { id: "videos", label: "我的视频", section: "locations", kind: "directory", path: "/位置/个人空间/我的视频", icon: "video" }
      ] }
    ] },
    { id: "tools", label: "工具", section: "tools", kind: "virtual", path: "/工具", icon: "setting", children: [
      { id: "recent", label: "最近文档", section: "tools", kind: "virtual", path: "/工具/最近文档", icon: "search" },
      { id: "safe", label: "私密保险箱", section: "tools", kind: "directory", path: "/工具/私密保险箱", icon: "safe" },
      { id: "recycle", label: "回收站", section: "tools", kind: "virtual", path: "/工具/回收站", icon: "recycle" }
    ] },
    { id: "mounts", label: "网络挂载", section: "mounts", kind: "virtual", path: "/网络挂载", icon: "computer", children: [
      { id: "mount-add", label: "新增网络挂载", section: "mounts", kind: "virtual", path: "/网络挂载/新增网络挂载", icon: "computer" }
    ] }
  ];
}

export function FileManager({ bootstrap }: { bootstrap: BootstrapData }) {
  const [items, setItems] = useState<FileItem[]>([]);
  const [tree, setTree] = useState<TreeNode[]>(bootstrap.tree?.length ? [...bootstrap.tree] : defaultTree());
  const [path, setPath] = useState("/位置/个人空间");
  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [activeNode, setActiveNode] = useState("personal");
  const [error, setError] = useState("");
  const [adminTab, setAdminTab] = useState<"overview" | "plugins" | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sort, setSort] = useState<SortState>({ key: "name", direction: "asc" });
  const [iconSize, setIconSize] = useState(72);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [context, setContext] = useState<ContextState | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([...(bootstrap.notifications ?? [])]);
  const [safeStatus, setSafeStatus] = useState<SafeBoxStatus | null>(null);
  const [safeDialogOpen, setSafeDialogOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [pathEditing, setPathEditing] = useState(false);
  const [pathDraft, setPathDraft] = useState(path);
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [inlineEdit, setInlineEdit] = useState<InlineEditState | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const folderUploadRef = useRef<HTMLInputElement>(null);

  const sortedItems = useMemo(() => sortItems(items, sort), [items, sort]);
  const selectedPath = selected[0] ?? path;
  const selectedItem = useMemo(() => items.find((item) => item.path === selected[0]), [items, selected]);
  const favorite = favorites.find((entry) => entry.path === path);

  const load = async (nextPath = path) => {
    setError("");
    try {
      if (nextPath === "/工具/回收站") {
        const recycleItems = await client.recycleList();
        setItems(recycleItems.map((item) => ({ name: item.name, path: item.recycleId, kind: item.kind, size: item.size, modifiedAt: item.deletedAt, extension: "" })));
      } else {
        setItems(await client.list(nextPath));
      }
      setSelected([]);
      setContext(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    void client.tree().then((nodes) => nodes.length && setTree(nodes)).catch(() => undefined);
    void client.notifications().then(setNotifications).catch(() => undefined);
    void client.safeStatus().then(setSafeStatus).catch(() => undefined);
    void client.settings().then((settings) => {
      setViewMode(settings.explorer.viewMode);
      setIconSize(settings.explorer.iconSize);
      setSort(settings.explorer.sort);
    }).catch(() => undefined);
    void client.favorites().then(setFavorites).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const events = new EventSource("/api/events");
    events.onmessage = () => {
      void load(path);
      void refreshNotifications();
    };
    return () => events.close();
  }, [path]);

  useEffect(() => {
    void load(path);
    setPathDraft(path);
  }, [path]);

  const refreshNotifications = async () => setNotifications(await client.notifications());

  const navigate = async (nextPath: string, nodeId?: string) => {
    if (nextPath === path) return;
    setHistory((current) => [...current, path]);
    setFuture([]);
    setActiveNode(nodeId ?? nextPath);
    setPath(nextPath);
  };

  const selectNode = async (node: TreeNode) => {
    if (node.id === "safe" || node.id === "personal-safe") {
      const status = await client.safeStatus();
      setSafeStatus(status);
      if (status.state !== "unlocked") {
        setSafeDialogOpen(true);
        return;
      }
    }
    await navigate(node.path, node.id);
  };

  const goBack = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((current) => current.slice(0, -1));
    setFuture((current) => [path, ...current]);
    setPath(previous);
  };

  const goForward = () => {
    const next = future[0];
    if (!next) return;
    setFuture((current) => current.slice(1));
    setHistory((current) => [...current, path]);
    setPath(next);
  };

  const selectItem = (item: FileItem, additive: boolean, range: boolean) => {
    setSelected((current) => {
      if (range && selectionAnchor) {
        const start = sortedItems.findIndex((entry) => entry.path === selectionAnchor);
        const end = sortedItems.findIndex((entry) => entry.path === item.path);
        if (start >= 0 && end >= 0) return sortedItems.slice(Math.min(start, end), Math.max(start, end) + 1).map((entry) => entry.path);
      }
      if (additive) return current.includes(item.path) ? current.filter((value) => value !== item.path) : [...current, item.path];
      return [item.path];
    });
    setSelectionAnchor(item.path);
  };

  const openItem = (item: FileItem) => {
    if (path === "/工具/回收站") return;
    if (item.kind === "directory") void navigate(item.path);
    else downloadPath(item.path);
  };

  const downloadPath = (targetPath = selected[0]) => {
    if (!targetPath) return;
    const anchor = document.createElement("a");
    anchor.href = client.downloadUrl(targetPath);
    anchor.download = basename(targetPath);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  };

  const commitInlineEdit = async () => {
    if (!inlineEdit) return;
    const value = inlineEdit.value.trim();
    if (!value) return;
    try {
      if (inlineEdit.mode === "rename" && inlineEdit.path) await client.rename(inlineEdit.path, value);
      if (inlineEdit.mode === "create-folder") await client.mkdir(joinPath(path, value));
      if (inlineEdit.mode === "create-template") await client.createTemplate(joinPath(path, value), inlineEdit.templateType ?? "txt");
      setInlineEdit(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const runAction = async (action: ContextAction, item = context?.item ?? selectedItem) => {
    if (!item) return;
    try {
      if (action === "open") openItem(item);
      if (action === "download") downloadPath(item.path);
      if (action === "rename") setInlineEdit({ mode: "rename", path: item.path, value: item.name });
      if (action === "recycle") await client.recycle(item.path);
      if (action === "restore") await client.restore(item.path);
      if (action === "deleteForever") await client.recycleDelete(item.path);
      if (action === "favorite") {
        await client.addFavorite(item.path, item.name);
        setFavorites(await client.favorites());
      }
      if (action === "properties") setSelected([item.path]);
      if (!["open", "download", "rename", "favorite", "properties"].includes(action)) await load();
      await refreshNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const runSearch = async () => {
    const query = searchText.trim();
    if (!query) return;
    await client.addRecentSearch(query, path);
    setItems(await client.search(path, query));
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      await client.upload(path, file);
    }
    await load();
    await refreshNotifications();
  };

  const openContext = (event: MouseEvent, item: FileItem) => {
    event.preventDefault();
    selectItem(item, false, false);
    setContext({
      x: event.clientX,
      y: event.clientY,
      item,
      actions: path === "/工具/回收站" ? ["restore", "deleteForever", "properties"] : ["open", "download", "rename", "copy", "move", "recycle", "archive", "favorite", "properties"]
    });
  };

  const toggleSort = (key: SortKey) => {
    setSort((current) => current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" });
  };

  const toggleFavorite = async () => {
    if (favorite) await client.removeFavorite(favorite.id);
    else await client.addFavorite(path, basename(path));
    setFavorites(await client.favorites());
  };

  const commitPath = () => {
    if (!pathDraft.startsWith("/") || pathDraft.includes("..") || pathDraft.includes("\\") || /^[a-zA-Z]:/.test(pathDraft)) {
      setError("路径输入无效");
      setPathDraft(path);
      setPathEditing(false);
      return;
    }
    void navigate(pathDraft);
    setPathEditing(false);
  };

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") void runSearch();
  };

  const markNotification = async (id: string) => {
    await client.notificationRead(id);
    await refreshNotifications();
  };

  const clearNotifications = async () => {
    await client.notificationsClear();
    await refreshNotifications();
  };

  return (
    <div className="file-manager" onClick={() => setContext(null)}>
      <aside className="tree">
        <h1>Webbox</h1>
        <NavigationTree tree={tree} activeId={activeNode} onSelect={(node) => void selectNode(node)} />
        <BottomMenu
          onAdmin={() => setAdminTab("overview")}
          onPlugins={() => setAdminTab("plugins")}
          notifications={notifications}
          onNotificationRead={(id) => void markNotification(id)}
          onNotificationClear={() => void clearNotifications()}
        />
      </aside>
      <section className="workspace">
        <header className="topbar">
          <button type="button" aria-label="后退" onClick={goBack} disabled={!history.length}><ArrowLeft size={16} /></button>
          <button type="button" aria-label="前进" onClick={goForward} disabled={!future.length}><ArrowRight size={16} /></button>
          <div className="breadcrumb">
            {pathEditing ? (
              <input aria-label="路径输入" value={pathDraft} onChange={(event) => setPathDraft(event.currentTarget.value)} onKeyDown={(event) => event.key === "Enter" && commitPath()} onBlur={() => setPathEditing(false)} autoFocus />
            ) : (
              <>
                {path.split("/").filter(Boolean).map((part, index, parts) => (
                  <button key={`${part}-${index}`} type="button" onClick={() => void navigate(`/${parts.slice(0, index + 1).join("/")}`)}>{part}</button>
                ))}
                <button type="button" className="breadcrumb-blank" aria-label="切换为路径输入" onClick={() => setPathEditing(true)} />
              </>
            )}
          </div>
          <button type="button" aria-label={favorite ? "取消收藏" : "收藏"} className={favorite ? "favorite active" : "favorite"} onClick={() => void toggleFavorite()}><Star size={16} /></button>
          <label className="search-box">
            <Search size={16} />
            <input placeholder={text.fileManager.search} value={searchText} onChange={(event) => setSearchText(event.currentTarget.value)} onKeyDown={onSearchKey} />
          </label>
        </header>
        <header className="toolbar">
          <button type="button" onClick={() => void load()}><RefreshCw size={16} />{text.fileManager.refresh}</button>
          <button type="button" onClick={() => uploadRef.current?.click()}><Upload size={16} />{text.fileManager.upload}</button>
          <button type="button" onClick={() => folderUploadRef.current?.click()}>上传文件夹</button>
          <input ref={uploadRef} hidden multiple type="file" onChange={(event) => void uploadFiles(event.currentTarget.files)} />
          <input ref={folderUploadRef} hidden multiple type="file" webkitdirectory="" directory="" onChange={(event) => void uploadFiles(event.currentTarget.files)} />
          <button type="button" onClick={() => downloadPath()}><Download size={16} />下载</button>
          <button type="button" onClick={() => setInlineEdit({ mode: "create-folder", value: "新建文件夹" })}><FolderPlus size={16} />{text.fileManager.newFolder}</button>
          {(["txt", "md", "html", "docx", "xlsx", "pptx"] as TemplateFileType[]).map((type) => (
            <button key={type} type="button" onClick={() => setInlineEdit({ mode: "create-template", templateType: type, value: `new.${type}` })}>{type}</button>
          ))}
          <button type="button" aria-label={viewMode === "grid" ? text.fileManager.listView : text.fileManager.gridView} onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}>{viewMode === "grid" ? <List size={16} /> : <Grid2X2 size={16} />}</button>
          <label className="icon-size-control">图标大小<input type="range" min="48" max="128" value={iconSize} onChange={(event) => setIconSize(Number(event.currentTarget.value))} /></label>
          <select aria-label="排序方式" value={`${sort.key}:${sort.direction}`} onChange={(event) => {
            const [key, direction] = event.currentTarget.value.split(":") as [SortKey, "asc" | "desc"];
            setSort({ key, direction });
          }}>
            <option value="name:asc">名称升序</option>
            <option value="name:desc">名称降序</option>
            <option value="type:asc">类型升序</option>
            <option value="size:desc">大小降序</option>
            <option value="modifiedAt:desc">修改时间降序</option>
          </select>
          <button type="button" onClick={() => setInspectorOpen((value) => !value)}>{inspectorOpen ? <EyeOff size={16} /> : <Eye size={16} />}{inspectorOpen ? "隐藏属性" : "显示属性"}</button>
          {path.includes("私密保险箱") && <button type="button" onClick={() => void client.safeLogout()}>锁定</button>}
        </header>
        {error && <div className="toast">{error}</div>}
        <div className="content">
          <main className="file-surface" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void uploadFiles(event.dataTransfer.files); }}>
            <FileGrid
              items={sortedItems}
              selected={selected}
              viewMode={viewMode}
              iconSize={iconSize}
              inlineEdit={inlineEdit}
              onOpen={openItem}
              onSelect={selectItem}
              onContextMenu={openContext}
              onSort={toggleSort}
              onInlineChange={(value) => setInlineEdit((current) => current ? { ...current, value } : current)}
              onInlineCommit={() => void commitInlineEdit()}
              onInlineCancel={() => setInlineEdit(null)}
            />
            {!sortedItems.length && !inlineEdit && (
              <div className="empty">
                <img src={uiAssets.empty} alt="" />
                <strong>{text.fileManager.emptyFolder}</strong>
                <span>{text.fileManager.emptyHint}</span>
              </div>
            )}
          </main>
          {inspectorOpen && <InspectorPanel path={selectedPath} />}
        </div>
      </section>
      {context && <ContextMenu x={context.x} y={context.y} actions={context.actions} onAction={(action) => void runAction(action)} />}
      {safeDialogOpen && safeStatus && <SafeBoxDialog status={safeStatus} onClose={() => setSafeDialogOpen(false)} onUnlock={(status) => setSafeStatus(status)} />}
      {adminTab && (
        <div className="modal-backdrop">
          <AdminPanel initialTab={adminTab} plugins={bootstrap.plugins} onClose={() => setAdminTab(null)} />
        </div>
      )}
    </div>
  );
}
