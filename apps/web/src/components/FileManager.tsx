import { FilePlus2, FolderPlus, Grid2X2, RefreshCw, Search, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import type { BootstrapData, FileItem } from "@webbox/shared";
import { client } from "../api/client";
import { AdminPanel } from "./AdminPanel";
import { BottomMenu } from "./BottomMenu";
import { ContextMenu } from "./ContextMenu";
import { PluginViewer } from "./PluginViewer";
import { uiAssets } from "../assets";
import { text } from "../i18n";

export function FileManager({ bootstrap }: { bootstrap: BootstrapData }) {
  const [items, setItems] = useState<FileItem[]>([]);
  const [path, setPath] = useState("/");
  const [error, setError] = useState("");
  const [adminTab, setAdminTab] = useState<"overview" | "plugins" | null>(null);

  const load = () => {
    client.list(path).then(setItems).catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    load();
  }, [path]);

  return (
    <div className="file-manager">
      <aside className="tree">
        <h1>Webbox</h1>
        <nav aria-label={text.fileManager.treeLabel}>
          <button type="button" className="tree-item active" onClick={() => setPath("/")}>{text.fileManager.personalFiles}</button>
          <button type="button" className="tree-item">{text.fileManager.recycleBin}</button>
        </nav>
        <BottomMenu onAdmin={() => setAdminTab("overview")} onPlugins={() => setAdminTab("plugins")} />
      </aside>
      <section className="workspace">
        <header className="toolbar">
          <div className="breadcrumb">{path}</div>
          <button type="button" onClick={load}><RefreshCw size={16} />{text.fileManager.refresh}</button>
          <button type="button"><Upload size={16} />{text.fileManager.upload}</button>
          <button type="button"><FilePlus2 size={16} />{text.fileManager.newFile}</button>
          <button type="button"><FolderPlus size={16} />{text.fileManager.newFolder}</button>
          <button type="button"><Search size={16} />{text.fileManager.search}</button>
          <button type="button" aria-label={text.fileManager.gridView}><Grid2X2 size={16} /></button>
        </header>
        {error && <div className="toast">{error}</div>}
        <div className="content">
          <div className="file-list" role="table" aria-label={text.fileManager.fileList}>
            <div className="file-row header" role="row">
              <span>{text.fileManager.name}</span><span>{text.fileManager.size}</span><span>{text.fileManager.modifiedTime}</span>
            </div>
            {items.length ? items.map((item) => (
              <button className="file-row" role="row" type="button" key={item.path} onDoubleClick={() => item.kind === "directory" && setPath(item.path)}>
                <span>{item.name}</span><span>{item.kind === "directory" ? text.fileManager.directorySize : item.size}</span><span>{new Date(item.modifiedAt).toLocaleString()}</span>
              </button>
            )) : (
              <div className="empty">
                <img src={uiAssets.empty} alt="" />
                <strong>{text.fileManager.emptyFolder}</strong>
                <span>{text.fileManager.emptyHint}</span>
              </div>
            )}
          </div>
          <aside className="side-panel">
            <ContextMenu />
            <PluginViewer plugins={bootstrap.plugins} fileName={items[0]?.name} />
          </aside>
        </div>
      </section>
      {adminTab && (
        <div className="modal-backdrop">
          <AdminPanel initialTab={adminTab} plugins={bootstrap.plugins} onClose={() => setAdminTab(null)} />
        </div>
      )}
    </div>
  );
}
