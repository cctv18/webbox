import { FilePlus2, FolderPlus, Grid2X2, List, RefreshCw, Search, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { BootstrapData, FileItem, NotificationItem, SafeBoxStatus, TreeNode, ViewMode } from "@webbox/shared";
import { client } from "../api/client";
import { AdminPanel } from "./AdminPanel";
import { BottomMenu } from "./BottomMenu";
import { ContextMenu, type ContextAction } from "./ContextMenu";
import { FileGrid } from "./FileGrid";
import { InspectorPanel } from "./InspectorPanel";
import { NavigationTree } from "./NavigationTree";
import { PluginViewer } from "./PluginViewer";
import { SafeBoxDialog } from "./SafeBoxDialog";
import { uiAssets } from "../assets";
import { text } from "../i18n";

interface ContextState {
  x: number;
  y: number;
  item: FileItem;
  actions: ContextAction[];
}

function parentPath(value: string): string {
  if (value === "/") return "/";
  const next = value.replace(/\/+$/, "").split("/").slice(0, -1).join("/");
  return next || "/";
}

function joinPath(base: string, name: string): string {
  return `${base.replace(/\/$/, "")}/${name}`.replace(/\/+/g, "/");
}

export function FileManager({ bootstrap }: { bootstrap: BootstrapData }) {
  const [items, setItems] = useState<FileItem[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([...(bootstrap.tree ?? [])]);
  const [path, setPath] = useState("/");
  const [space, setSpace] = useState("personal");
  const [activeNode, setActiveNode] = useState("personal");
  const [error, setError] = useState("");
  const [adminTab, setAdminTab] = useState<"overview" | "plugins" | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [context, setContext] = useState<ContextState | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([...(bootstrap.notifications ?? [])]);
  const [safeStatus, setSafeStatus] = useState<SafeBoxStatus | null>(null);
  const [safeDialogOpen, setSafeDialogOpen] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  const selectedPath = selected[0] ?? path;
  const selectedItem = useMemo(() => items.find((item) => item.path === selected[0]), [items, selected]);

  const load = async (nextPath = path) => {
    setError("");
    try {
      if (activeNode === "recycle") {
        const recycleItems = await client.recycleList();
        setItems(recycleItems.map((item) => ({
          name: item.name,
          path: item.recycleId,
          kind: item.kind,
          size: item.size,
          modifiedAt: item.deletedAt,
          extension: ""
        })));
      } else {
        setItems(await client.list(nextPath, space));
      }
      setSelected([]);
      setContext(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    void client.tree().then(setTree).catch(() => undefined);
    void client.notifications().then(setNotifications).catch(() => undefined);
    void client.safeStatus().then(setSafeStatus).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const events = new EventSource("/api/events");
    events.onmessage = () => {
      void load(path);
      void refreshNotifications();
    };
    return () => events.close();
  }, [path, activeNode, space]);

  useEffect(() => {
    void load(path);
  }, [path, activeNode, space]);

  const refreshNotifications = async () => setNotifications(await client.notifications());

  const selectNode = async (node: TreeNode) => {
    setActiveNode(node.id);
    setSpace(["photos", "documents", "music", "videos", "safe"].includes(node.id) ? node.id : "personal");
    if (node.id === "safe") {
      const status = await client.safeStatus();
      setSafeStatus(status);
      if (status.state !== "unlocked") {
        setSafeDialogOpen(true);
        return;
      }
    }
    if (node.id === "recycle") {
      setPath("webbox://recycle");
      return;
    }
    if (node.id === "recent" || node.id === "favorites") {
      setPath("/");
      return;
    }
    setPath("/");
  };

  const selectItem = (item: FileItem, additive: boolean) => {
    setSelected((current) => additive ? (current.includes(item.path) ? current.filter((value) => value !== item.path) : [...current, item.path]) : [item.path]);
  };

  const openItem = (item: FileItem) => {
    if (activeNode === "recycle") return;
    if (item.kind === "directory") setPath(item.path);
    else window.open(client.downloadUrl(item.path, space), "_blank");
  };

  const promptName = (label: string, fallback: string) => window.prompt(label, fallback)?.trim();

  const runAction = async (action: ContextAction, item = context?.item ?? selectedItem) => {
    if (!item) return;
    try {
      if (action === "open") openItem(item);
      if (action === "download") window.open(client.downloadUrl(item.path, space), "_blank");
      if (action === "rename") {
        const name = promptName(text.contextMenu.actions.rename, item.name);
        if (name) await client.rename(item.path, name, space);
      }
      if (action === "copy") {
        const target = promptName(text.contextMenu.actions.copy, joinPath(path, `copy-${item.name}`));
        if (target) await client.copy(item.path, target, space);
      }
      if (action === "move") {
        const target = promptName(text.contextMenu.actions.move, joinPath(parentPath(item.path), item.name));
        if (target) await client.move(item.path, target, space);
      }
      if (action === "recycle") await client.recycle(item.path, space);
      if (action === "restore") await client.restore(item.path);
      if (action === "deleteForever") await client.recycleDelete(item.path);
      if (action === "properties") setSelected([item.path]);
      await load();
      await refreshNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const createFile = async () => {
    const name = promptName(text.fileManager.newFile, "new.txt");
    if (!name) return;
    await client.writeText(joinPath(path, name), "", space);
    await load();
  };

  const createFolder = async () => {
    const name = promptName(text.fileManager.newFolder, "New Folder");
    if (!name) return;
    await client.mkdir(joinPath(path, name), space);
    await load();
  };

  const search = async () => {
    const query = promptName(text.fileManager.search, "");
    if (!query) return;
    setItems(await client.search(path, query, space));
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      await client.upload(path, file, space);
    }
    await load();
    await refreshNotifications();
  };

  const openContext = (event: MouseEvent, item: FileItem) => {
    event.preventDefault();
    selectItem(item, false);
    setContext({
      x: event.clientX,
      y: event.clientY,
      item,
      actions: activeNode === "recycle" ? ["restore", "deleteForever", "properties"] : ["open", "download", "rename", "copy", "move", "recycle", "archive", "favorite", "properties"]
    });
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
        <header className="toolbar">
          <div className="breadcrumb">{path}</div>
          <button type="button" onClick={() => void load()}><RefreshCw size={16} />{text.fileManager.refresh}</button>
          <button type="button" onClick={() => uploadRef.current?.click()}><Upload size={16} />{text.fileManager.upload}</button>
          <input ref={uploadRef} hidden multiple type="file" onChange={(event) => void uploadFiles(event.currentTarget.files)} />
          <button type="button" onClick={() => void createFile()}><FilePlus2 size={16} />{text.fileManager.newFile}</button>
          <button type="button" onClick={() => void createFolder()}><FolderPlus size={16} />{text.fileManager.newFolder}</button>
          <button type="button" onClick={() => void search()}><Search size={16} />{text.fileManager.search}</button>
          <button type="button" aria-label={text.fileManager.gridView} onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}>{viewMode === "grid" ? <List size={16} /> : <Grid2X2 size={16} />}</button>
        </header>
        {error && <div className="toast">{error}</div>}
        <div className="content">
          <main className="file-surface" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void uploadFiles(event.dataTransfer.files); }}>
            {items.length ? (
              <FileGrid items={items} selected={selected} viewMode={viewMode} onOpen={openItem} onSelect={selectItem} onContextMenu={openContext} />
            ) : (
              <div className="empty">
                <img src={uiAssets.empty} alt="" />
                <strong>{text.fileManager.emptyFolder}</strong>
                <span>{text.fileManager.emptyHint}</span>
              </div>
            )}
          </main>
          <InspectorPanel path={selectedPath} space={space} />
          <aside className="side-panel">
            <PluginViewer plugins={bootstrap.plugins} fileName={selectedItem?.name ?? items[0]?.name} />
          </aside>
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
