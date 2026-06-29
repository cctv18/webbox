import { FilePlus2, FolderPlus, Grid2X2, RefreshCw, Search, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import type { BootstrapData, FileItem } from "@webbox/shared";
import { client } from "../api/client";
import { AdminPanel } from "./AdminPanel";
import { BottomMenu } from "./BottomMenu";
import { ContextMenu } from "./ContextMenu";
import { PluginViewer } from "./PluginViewer";

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
        <nav aria-label="目录树">
          <button type="button" className="tree-item active" onClick={() => setPath("/")}>个人文件</button>
          <button type="button" className="tree-item">回收站</button>
        </nav>
        <BottomMenu onAdmin={() => setAdminTab("overview")} onPlugins={() => setAdminTab("plugins")} />
      </aside>
      <section className="workspace">
        <header className="toolbar">
          <div className="breadcrumb">{path}</div>
          <button type="button" onClick={load}><RefreshCw size={16} />刷新</button>
          <button type="button"><Upload size={16} />上传</button>
          <button type="button"><FilePlus2 size={16} />新建文件</button>
          <button type="button"><FolderPlus size={16} />新建文件夹</button>
          <button type="button"><Search size={16} />搜索</button>
          <button type="button" aria-label="网格视图"><Grid2X2 size={16} /></button>
        </header>
        {error && <div className="toast">{error}</div>}
        <div className="content">
          <div className="file-list" role="table" aria-label="文件列表">
            <div className="file-row header" role="row">
              <span>名称</span><span>大小</span><span>修改时间</span>
            </div>
            {items.length ? items.map((item) => (
              <button className="file-row" role="row" type="button" key={item.path} onDoubleClick={() => item.kind === "directory" && setPath(item.path)}>
                <span>{item.name}</span><span>{item.kind === "directory" ? "-" : item.size}</span><span>{new Date(item.modifiedAt).toLocaleString()}</span>
              </button>
            )) : <div className="empty">此文件夹为空</div>}
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
