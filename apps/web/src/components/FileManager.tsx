import { ArrowDownUp, ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, Download, Eye, EyeOff, FilePlus, FolderPlus, Grid2X2, List, RefreshCw, Search, SlidersHorizontal, Star, Upload, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { BootstrapData, FavoriteEntry, FileItem, NotificationItem, SafeBoxStatus, SortKey, SortState, TemplateFileType, TreeNode, ViewMode, WebboxSettings } from "@webbox/shared";
import { client } from "../api/client";
import { AdminPanel } from "./AdminPanel";
import { BottomMenu } from "./BottomMenu";
import { ContextMenu, type ContextAction } from "./ContextMenu";
import { FileGrid, type InlineEditState } from "./FileGrid";
import { InspectorPanel } from "./InspectorPanel";
import { MemoWorkspace } from "./MemoWorkspace";
import { NavigationTree } from "./NavigationTree";
import { NetworkMountPanel } from "./NetworkMountPanel";
import { PathActionDialog } from "./PathActionDialog";
import { SafeBoxDialog } from "./SafeBoxDialog";
import { uiAssets } from "../assets";
import { applyTheme, setLanguage, text } from "../i18n";

interface ContextState {
  x: number;
  y: number;
  item: FileItem;
  actions: ContextAction[];
}

type ToolbarMenu = "upload" | "new-file" | "sort" | "icon-size" | null;
type ToastState = { id: number; type: "success" | "error"; message: string } | null;
type PathDialogState = {
  action: "copy" | "move" | "zip" | "unzip";
  title: string;
  label: string;
  initialPath: string;
  item: FileItem;
} | null;

function joinPath(base: string, name: string): string {
  return `${base.replace(/\/$/, "")}/${name}`.replace(/\/+/g, "/");
}

function basename(value: string): string {
  return value.split("/").filter(Boolean).at(-1) ?? value;
}

function dirname(value: string): string {
  const parts = value.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

function isSafeBoxPath(value: string): boolean {
  return value === "/工具/私密保险箱" || value.startsWith("/工具/私密保险箱/") || value === "/位置/个人空间/私密保险箱" || value.startsWith("/位置/个人空间/私密保险箱/");
}

function uniqueName(base: string, existingNames: Set<string>): string {
  if (!existingNames.has(base)) return base;
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";
  let index = 2;
  while (existingNames.has(`${stem}（${index}）${ext}`)) index += 1;
  return `${stem}（${index}）${ext}`;
}

const templateLabels: Record<TemplateFileType, string> = {
  txt: "TXT 文件",
  md: "MD 文件",
  html: "HTML 文件",
  docx: "DOCX 文件",
  xlsx: "XLSX 文件",
  pptx: "PPTX 文件"
};

const sortLabels: Record<SortKey, string> = {
  name: "名称",
  type: "类型",
  size: "大小",
  modifiedAt: "修改时间"
};

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
      { id: "memos", label: "备忘录", section: "tools", kind: "virtual", path: "/工具/备忘录", icon: "memo" },
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
  const [expandedTreeIds, setExpandedTreeIds] = useState<string[]>(["locations", "personal", "tools", "mounts"]);
  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [activeNode, setActiveNode] = useState("personal");
  const [toast, setToast] = useState<ToastState>(null);
  const [adminTab, setAdminTab] = useState<"overview" | "settings" | "storage" | "plugins" | "notice" | null>(null);
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
  const [pendingSafePath, setPendingSafePath] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [pathEditing, setPathEditing] = useState(false);
  const [pathDraft, setPathDraft] = useState(path);
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [inlineEdit, setInlineEdit] = useState<InlineEditState | null>(null);
  const [toolbarMenu, setToolbarMenu] = useState<ToolbarMenu>(null);
  const [pathDialog, setPathDialog] = useState<PathDialogState>(null);
  const [operationProgress, setOperationProgress] = useState("");
  const [explorerSettings, setExplorerSettings] = useState<WebboxSettings["explorer"] | null>(null);
  const [language, setLanguageState] = useState<"zh-CN" | "en-US">(bootstrap.language === "en-US" ? "en-US" : "zh-CN");
  const [theme, setThemeState] = useState<"light" | "dark" | "system">(bootstrap.theme === "dark" || bootstrap.theme === "light" ? bootstrap.theme : "system");
  const uploadRef = useRef<HTMLInputElement>(null);
  const folderUploadRef = useRef<HTMLInputElement>(null);

  const sortedItems = useMemo(() => sortItems(items, sort), [items, sort]);
  const selectedPath = selected[0] ?? path;
  const selectedItem = useMemo(() => items.find((item) => item.path === selected[0]), [items, selected]);
  const selectedItems = useMemo(() => items.filter((item) => selected.includes(item.path)), [items, selected]);
  const favorite = favorites.find((entry) => entry.path === path);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ id: Date.now(), type, message });
  };

  const refreshTree = async () => {
    const nodes = await client.tree();
    if (nodes.length) setTree(nodes);
  };

  const load = async (nextPath = path) => {
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
      showToast(err instanceof Error && err.message === "输入无效" ? "文件名输入无效" : err instanceof Error ? err.message : String(err), "error");
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
      setExpandedTreeIds(settings.explorer.expandedTreeIds);
      setHistory(settings.explorer.historyBack ?? []);
      setFuture(settings.explorer.historyForward ?? []);
      if (settings.explorer.currentPath) setPath(settings.explorer.currentPath);
      setExplorerSettings(settings.explorer);
      setLanguageState(settings.explorer.language);
      setLanguage(settings.explorer.language);
      setThemeState(settings.explorer.theme);
      applyTheme(settings.explorer.theme);
    }).catch(() => undefined);
    void client.favorites().then(setFavorites).catch(() => undefined);
  }, []);

  useEffect(() => {
    setLanguage(language);
  }, [language]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!explorerSettings) return;
    void client.saveSettings({ explorer: { ...explorerSettings, viewMode, iconSize, sort, currentPath: path, expandedTreeIds, historyBack: history, historyForward: future } }).catch(() => undefined);
  }, [viewMode, iconSize, sort, path, expandedTreeIds, history, future]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast((current) => current?.id === toast.id ? null : current), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

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
    if (nextPath === "/网络挂载/新增网络挂载") {
      setPath("/网络挂载");
      return;
    }
    if (isSafeBoxPath(nextPath)) {
      const status = await client.safeStatus();
      setSafeStatus(status);
      if (status.state !== "unlocked") {
        setPendingSafePath(nextPath);
        setSafeDialogOpen(true);
        return;
      }
    }
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

  const pathExists = async (candidate: string) => {
    try {
      await client.list(candidate);
      return true;
    } catch {
      return false;
    }
  };

  const goBack = async () => {
    const stack = [...history];
    while (stack.length) {
      const previous = stack.pop()!;
      if (await pathExists(previous)) {
        setHistory(stack);
        setFuture((current) => [path, ...current]);
        setPath(previous);
        return;
      }
    }
    setHistory([]);
  };

  const goForward = async () => {
    const stack = [...future];
    while (stack.length) {
      const next = stack.shift()!;
      if (await pathExists(next)) {
        setFuture(stack);
        setHistory((current) => [...current, path]);
        setPath(next);
        return;
      }
    }
    setFuture([]);
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

  const replaceSelection = (paths: string[]) => {
    setSelected(paths);
    setSelectionAnchor(paths[0] ?? null);
  };

  const clearSelection = () => {
    setSelected([]);
    setSelectionAnchor(null);
  };

  const openItem = (item: FileItem) => {
    if (path === "/工具/回收站") return;
    if (item.kind === "directory") void navigate(item.path);
    else globalThis.open?.(client.openUrl(item.path), "_blank", "noopener");
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
      const message = err instanceof Error ? err.message : String(err);
      const invalidName = message.includes("输入无效") || message.includes("文件名输入无效");
      if (inlineEdit.mode === "rename") {
        setInlineEdit(null);
      } else if (invalidName) {
        const existing = new Set(items.map((item) => item.name));
        const fallback = inlineEdit.mode === "create-folder" ? uniqueName("新建文件夹", existing) : uniqueName(`new.${inlineEdit.templateType ?? "txt"}`, existing);
        try {
          if (inlineEdit.mode === "create-folder") await client.mkdir(joinPath(path, fallback));
          else await client.createTemplate(joinPath(path, fallback), inlineEdit.templateType ?? "txt");
        } catch {
          // Keep the original error visible; a fallback failure usually means storage is not writable.
        }
        setInlineEdit(null);
        await load();
      } else {
        setInlineEdit(null);
      }
      showToast(invalidName ? "文件名输入无效" : message.includes("目标已存在") ? "名称已存在，已自动避让或请重试" : message, "error");
    }
  };

  const runAction = async (action: ContextAction, item = context?.item ?? selectedItem) => {
    try {
      if (action === "refresh") {
        await load();
        setContext(null);
        return;
      }
      if (action === "newFolder") {
        if (path === "/位置/收藏夹" || path.startsWith("/网络挂载")) return;
        setInlineEdit({ mode: "create-folder", value: "新建文件夹" });
        setContext(null);
        return;
      }
      if (action === "newFile") {
        if (path === "/位置/收藏夹" || path.startsWith("/网络挂载")) return;
        setInlineEdit({ mode: "create-template", templateType: "txt", value: "new.txt" });
        setContext(null);
        return;
      }
      if (!item) return;
      if (action === "open") openItem(item);
      if (action === "download") downloadPath(item.path);
      if (action === "rename") setInlineEdit({ mode: "rename", path: item.path, value: item.name });
      if (action === "copy") {
        setPathDialog({ action: "copy", title: "复制", label: "复制到路径", initialPath: joinPath(path, item.name), item });
        return;
      }
      if (action === "move") {
        setPathDialog({ action: "move", title: "移动", label: "移动到路径", initialPath: joinPath(path, item.name), item });
        return;
      }
      if (action === "recycle") await client.recycle(item.path);
      if (action === "restore") await client.restore(item.path);
      if (action === "deleteForever") await client.recycleDelete(item.path);
      if (action === "favorite") {
        const existing = favorites.find((entry) => entry.path === item.path);
        if (existing) await client.removeFavorite(existing.id);
        else await client.addFavorite(item.path, item.name);
        setFavorites(await client.favorites());
      }
      if (action === "archive") {
        openArchiveDialog(item);
        return;
      }
      if (action === "properties") {
        setSelected([item.path]);
        setInspectorOpen(true);
      }
      if (!["open", "download", "rename", "favorite", "properties"].includes(action)) await load();
      await refreshNotifications();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "error");
    }
  };

  const openArchiveDialog = (item: FileItem) => {
    const activePaths = selected.length ? selected : [item.path];
    if (item.kind === "file" && item.extension === "zip") {
      setPathDialog({ action: "unzip", title: "解压", label: "解压到路径", initialPath: joinPath(path, basename(item.path).replace(/\.zip$/i, "")), item });
      return;
    }
    const defaultName = activePaths.length === 1 ? `${basename(activePaths[0]).replace(/\.[^.]+$/, "")}.zip` : "archive.zip";
    setPathDialog({ action: "zip", title: "压缩", label: "压缩文件保存为", initialPath: joinPath(path, defaultName), item });
  };

  const confirmPathDialog = async (targetPath: string) => {
    if (!pathDialog) return;
    try {
      if (pathDialog.action === "copy") await client.copy(pathDialog.item.path, targetPath);
      if (pathDialog.action === "move") await client.move(pathDialog.item.path, targetPath);
      if (pathDialog.action === "unzip") {
        setOperationProgress("正在解压...");
        await client.unzip(pathDialog.item.path, targetPath);
        setOperationProgress("解压完成");
      }
      if (pathDialog.action === "zip") {
        const activePaths = selected.length ? selected : [pathDialog.item.path];
        setOperationProgress("正在压缩...");
        await client.zip(activePaths, targetPath);
        setOperationProgress("压缩完成");
      }
      setPathDialog(null);
      await load();
      await refreshNotifications();
      showToast("操作完成");
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "error");
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
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? "";
      const relativeDir = dirname(relativePath);
      await client.upload(relativeDir ? joinPath(path, relativeDir) : path, file);
    }
    await load();
    await refreshNotifications();
  };

  const openContext = (event: MouseEvent, item: FileItem) => {
    event.preventDefault();
    event.stopPropagation();
    selectItem(item, false, false);
    setContext({
      x: event.clientX,
      y: event.clientY,
      item,
      actions: path === "/工具/回收站" ? ["restore", "deleteForever", "properties"] : ["open", "download", "rename", "copy", "move", "recycle", "archive", "favorite", "properties"]
    });
  };

  const openBlankContext = (event: MouseEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    setContext({
      x: event.clientX,
      y: event.clientY,
      item: { name: basename(path), path, kind: "directory", size: 0, modifiedAt: new Date().toISOString(), extension: "" },
      actions: path === "/位置/收藏夹" ? ["refresh", "favorite", "properties"] : path.startsWith("/网络挂载") ? ["refresh", "properties"] : ["refresh", "newFolder", "newFile", "properties"]
    });
  };

  const saveLanguage = async (next: "zh-CN" | "en-US") => {
    setLanguageState(next);
    setLanguage(next);
    const base = explorerSettings ?? { theme, language: next, viewMode, iconSize, sort, searchHistoryLimit: 10, currentPath: path, expandedTreeIds, historyBack: history, historyForward: future };
    const saved = await client.saveSettings({ explorer: { ...base, language: next } });
    setExplorerSettings(saved.explorer);
  };

  const saveTheme = async (next: "light" | "dark" | "system") => {
    setThemeState(next);
    applyTheme(next);
    const base = explorerSettings ?? { theme: next, language, viewMode, iconSize, sort, searchHistoryLimit: 10, currentPath: path, expandedTreeIds, historyBack: history, historyForward: future };
    const saved = await client.saveSettings({ explorer: { ...base, theme: next } });
    setExplorerSettings(saved.explorer);
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
      showToast("路径输入无效", "error");
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
        <NavigationTree
          tree={tree}
          activeId={activeNode}
          expandedIds={expandedTreeIds}
          onExpandedChange={setExpandedTreeIds}
          onSelect={(node) => void selectNode(node)}
        />
          <BottomMenu
            onAdmin={() => setAdminTab("overview")}
            onPlugins={() => setAdminTab("plugins")}
            notifications={notifications}
            onNotificationRead={(id) => void markNotification(id)}
            onNotificationClear={() => void clearNotifications()}
            onLanguage={(next) => void saveLanguage(next)}
            onTheme={(next) => void saveTheme(next)}
          />
      </aside>
      <section className="workspace">
        <header className="topbar">
          <button type="button" aria-label="后退" onClick={() => void goBack()} disabled={!history.length}><ArrowLeft size={16} /></button>
          <button type="button" aria-label="前进" onClick={() => void goForward()} disabled={!future.length}><ArrowRight size={16} /></button>
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
        {path === "/位置/收藏夹" ? (
          <header className="toolbar">
            <button type="button" onClick={() => void load()}><RefreshCw size={16} />{text.fileManager.refresh}</button>
            <button type="button" onClick={() => {
              const favoriteItem = favorites.find((entry) => selected.includes(entry.path));
              if (favoriteItem) void client.removeFavorite(favoriteItem.id).then(async () => { setFavorites(await client.favorites()); await load(); });
            }}>删除收藏</button>
            <button type="button" aria-label={viewMode === "grid" ? text.fileManager.listView : text.fileManager.gridView} onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}>{viewMode === "grid" ? <List size={16} /> : <Grid2X2 size={16} />}</button>
            <button type="button" aria-label="调整图标大小" onClick={() => setToolbarMenu(toolbarMenu === "icon-size" ? null : "icon-size")}><SlidersHorizontal size={16} /></button>
            <button type="button" aria-label="排序" onClick={() => setToolbarMenu(toolbarMenu === "sort" ? null : "sort")}><ArrowDownUp size={16} /></button>
            <button type="button" onClick={() => setInspectorOpen((value) => !value)}>{inspectorOpen ? <EyeOff size={16} /> : <Eye size={16} />}{inspectorOpen ? "隐藏属性" : "显示属性"}</button>
          </header>
        ) : path === "/网络挂载" ? null : <header className="toolbar">
          <button type="button" onClick={() => void load()}><RefreshCw size={16} />{text.fileManager.refresh}</button>
          <div className="toolbar-group">
            <button type="button" onClick={() => uploadRef.current?.click()}><Upload size={16} />{text.fileManager.upload}</button>
            <button type="button" className="toolbar-arrow" aria-label="展开上传菜单" onClick={() => setToolbarMenu(toolbarMenu === "upload" ? null : "upload")}><ChevronDown size={14} /></button>
            {toolbarMenu === "upload" && (
              <div className="toolbar-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { setToolbarMenu(null); folderUploadRef.current?.click(); }}>上传文件夹</button>
              </div>
            )}
          </div>
          <input ref={uploadRef} hidden multiple type="file" onChange={(event) => void uploadFiles(event.currentTarget.files)} />
          <input ref={folderUploadRef} hidden multiple type="file" webkitdirectory="" directory="" onChange={(event) => void uploadFiles(event.currentTarget.files)} />
          <button type="button" onClick={() => downloadPath()}><Download size={16} />下载</button>
          <button type="button" onClick={() => setInlineEdit({ mode: "create-folder", value: "新建文件夹" })}><FolderPlus size={16} />{text.fileManager.newFolder}</button>
          <div className="toolbar-group">
            <button type="button" onClick={() => setToolbarMenu(toolbarMenu === "new-file" ? null : "new-file")}><FilePlus size={16} />{text.fileManager.newFile}<ChevronDown size={14} /></button>
            {toolbarMenu === "new-file" && (
              <div className="toolbar-menu" role="menu">
                {(["txt", "md", "html", "docx", "xlsx", "pptx"] as TemplateFileType[]).map((type) => (
                  <button key={type} type="button" role="menuitem" onClick={() => { setInlineEdit({ mode: "create-template", templateType: type, value: `new.${type}` }); setToolbarMenu(null); }}>{templateLabels[type]}</button>
                ))}
              </div>
            )}
          </div>
          <button type="button" aria-label={viewMode === "grid" ? text.fileManager.listView : text.fileManager.gridView} onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}>{viewMode === "grid" ? <List size={16} /> : <Grid2X2 size={16} />}</button>
          <div className="toolbar-group">
            <button type="button" aria-label="调整图标大小" onClick={() => setToolbarMenu(toolbarMenu === "icon-size" ? null : "icon-size")}><SlidersHorizontal size={16} /></button>
            {toolbarMenu === "icon-size" && (
              <div className="toolbar-menu icon-size-popover" role="menu">
                <input aria-label="图标大小" aria-orientation="vertical" className="vertical-range" type="range" min="48" max="128" value={iconSize} onChange={(event) => setIconSize(Number(event.currentTarget.value))} />
              </div>
            )}
          </div>
          <div className="toolbar-group">
            <button type="button" aria-label="排序" onClick={() => setToolbarMenu(toolbarMenu === "sort" ? null : "sort")}><ArrowDownUp size={16} /></button>
            {toolbarMenu === "sort" && (
              <div className="toolbar-menu" role="menu">
                {(["name", "type", "size", "modifiedAt"] as SortKey[]).map((key) => (
                  <button key={key} type="button" role="menuitem" aria-label={sortLabels[key]} onClick={() => { toggleSort(key); setToolbarMenu(null); }}>{sortLabels[key]}{sort.key === key && <span aria-hidden="true">{sort.direction === "asc" ? " ↑" : " ↓"}</span>}</button>
                ))}
              </div>
            )}
          </div>
          <button type="button" onClick={() => setInspectorOpen((value) => !value)}>{inspectorOpen ? <EyeOff size={16} /> : <Eye size={16} />}{inspectorOpen ? "隐藏属性" : "显示属性"}</button>
          {path.includes("私密保险箱") && <button type="button" onClick={() => void client.safeLogout().then(async () => {
            setSafeStatus({ state: "locked", message: text.safeBox.locked, path });
            setItems([]);
            setSelected([]);
            await navigate("/位置/个人空间", "personal");
            void client.tree().then((nodes) => nodes.length && setTree(nodes)).catch(() => undefined);
          })}>锁定</button>}
        </header>}
        {toast && (
          <div className={`app-toast ${toast.type}`} role="status">
            {toast.type === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            <span>{toast.message}</span>
          </div>
        )}
        <div className={inspectorOpen && path !== "/工具/备忘录" && path !== "/网络挂载" ? "content" : "content inspector-closed"}>
          {path === "/工具/备忘录" ? (
            <MemoWorkspace defaultPath="/位置/个人空间" />
          ) : path === "/网络挂载" ? (
            <NetworkMountPanel onToast={showToast} onRefreshTree={() => void refreshTree()} />
          ) : <main
            className="file-surface"
            onContextMenu={openBlankContext}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) {
                clearSelection();
                if (inlineEdit) setInlineEdit(null);
              }
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); void uploadFiles(event.dataTransfer.files); }}
          >
            <FileGrid
              items={sortedItems}
              selected={selected}
              viewMode={viewMode}
              iconSize={iconSize}
              sort={sort}
              inlineEdit={inlineEdit}
              onOpen={openItem}
              onSelect={selectItem}
              onSelectionChange={replaceSelection}
              onClearSelection={clearSelection}
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
            {operationProgress && <div className="operation-progress">{operationProgress}</div>}
          </main>}
          {inspectorOpen && path !== "/工具/备忘录" && path !== "/网络挂载" && <InspectorPanel path={selectedPath} selectedItems={selectedItems} />}
        </div>
      </section>
      {context && <ContextMenu x={context.x} y={context.y} actions={context.actions} onAction={(action) => void runAction(action)} />}
      {pathDialog && (
        <PathActionDialog
          title={pathDialog.title}
          label={pathDialog.label}
          initialPath={pathDialog.initialPath}
          tree={tree}
          onClose={() => setPathDialog(null)}
          onConfirm={(target) => void confirmPathDialog(target)}
        />
      )}
      {safeDialogOpen && safeStatus && <SafeBoxDialog status={safeStatus} onClose={() => setSafeDialogOpen(false)} onUnlock={(status) => {
        setSafeStatus(status);
        setSafeDialogOpen(false);
        void navigate(pendingSafePath ?? "/工具/私密保险箱");
        setPendingSafePath(null);
      }} />}
      {adminTab && (
        <div className="modal-backdrop">
          <AdminPanel initialTab={adminTab} plugins={bootstrap.plugins} onClose={() => setAdminTab(null)} />
        </div>
      )}
    </div>
  );
}
