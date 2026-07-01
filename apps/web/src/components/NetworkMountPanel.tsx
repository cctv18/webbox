import { Edit3, FolderPlus, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { MountDefinition, MountInput } from "@webbox/shared";
import { client } from "../api/client";
import { text } from "../i18n";

interface NetworkMountPanelProps {
  onToast: (message: string, type?: "success" | "error") => void;
  onRefreshTree: () => void;
}

type MountTab = "ftp" | "webdav";

export function NetworkMountPanel({ onToast, onRefreshTree }: NetworkMountPanelProps) {
  const [mounts, setMounts] = useState<MountDefinition[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const load = async () => setMounts(await client.mounts());

  useEffect(() => {
    void load().catch((err: Error) => onToast(err.message, "error"));
  }, []);

  const rename = async (mount: MountDefinition) => {
    if (!renameValue.trim()) return;
    try {
      await client.renameMount(mount.id, renameValue.trim());
      setRenaming(null);
      await load();
      onRefreshTree();
      onToast(text.fileManager.operationDone);
    } catch (err) {
      onToast(err instanceof Error ? err.message : String(err), "error");
    }
  };

  const remove = async (mount: MountDefinition) => {
    if (!globalThis.confirm?.("确认删除网络挂载？")) return;
    try {
      await client.deleteMount(mount.id);
      await load();
      onRefreshTree();
      onToast(text.fileManager.operationDone);
    } catch (err) {
      onToast(err instanceof Error ? err.message : String(err), "error");
    }
  };

  return (
    <main className="mount-panel">
      <header className="mount-toolbar">
        <h2>{text.fileManager.mounts}</h2>
        <button type="button" onClick={() => void load()}><RefreshCw size={16} />{text.fileManager.refresh}</button>
        <button type="button" onClick={() => setDialogOpen(true)}><FolderPlus size={16} />新增网络挂载</button>
      </header>
      <div className="mount-list">
        <button type="button" className="mount-card add" onClick={() => setDialogOpen(true)}>
          <FolderPlus size={30} />
          <span>新增网络挂载</span>
        </button>
        {mounts.map((mount) => (
          <article className="mount-card" key={mount.id}>
            {renaming === mount.id ? (
              <input value={renameValue} autoFocus onChange={(event) => setRenameValue(event.currentTarget.value)} onKeyDown={(event) => event.key === "Enter" && void rename(mount)} onBlur={() => void rename(mount)} />
            ) : <strong>{mount.name}</strong>}
            <span>{mount.type.toUpperCase()} · {mount.root}</span>
            <footer>
              <button type="button" aria-label="重命名挂载" onClick={() => { setRenaming(mount.id); setRenameValue(mount.name); }}><Edit3 size={15} /></button>
              {mount.type !== "local" && <button type="button" aria-label="删除挂载" onClick={() => void remove(mount)}><Trash2 size={15} /></button>}
            </footer>
          </article>
        ))}
      </div>
      {dialogOpen && <MountDialog onClose={() => setDialogOpen(false)} onCreated={async () => {
        setDialogOpen(false);
        await load();
        onRefreshTree();
        onToast(text.fileManager.operationDone);
      }} />}
    </main>
  );
}

function MountDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const [tab, setTab] = useState<MountTab>("ftp");
  const [form, setForm] = useState<MountInput>({ type: "ftp", host: "", port: 21, mode: "passive", encoding: "utf8", anonymous: false });
  const [error, setError] = useState("");

  const update = (patch: Partial<MountInput>) => setForm((current) => ({ ...current, ...patch, type: tab }));
  const switchTab = (next: MountTab) => {
    setTab(next);
    setForm(next === "ftp" ? { type: "ftp", host: "", port: 21, mode: "passive", encoding: "utf8", anonymous: false } : { type: "webdav", host: "", port: 443, https: true });
  };
  const submit = async () => {
    try {
      await client.addMount({ ...form, type: tab });
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="modal-backdrop">
      <section className="mount-dialog" role="dialog" aria-label="新增网络挂载">
        <header>
          <h2>新增网络挂载</h2>
          <button type="button" aria-label="关闭" onClick={onClose}><X size={16} /></button>
        </header>
        <nav className="tabs" role="tablist">
          <button type="button" role="tab" className={tab === "ftp" ? "active" : ""} onClick={() => switchTab("ftp")}>FTP</button>
          <button type="button" role="tab" className={tab === "webdav" ? "active" : ""} onClick={() => switchTab("webdav")}>WebDAV</button>
        </nav>
        <div className="mount-form">
          <label>服务器地址<input aria-label="服务器地址" value={form.host} onChange={(event) => update({ host: event.currentTarget.value })} /></label>
          <label>端口<input type="number" value={form.port ?? ""} onChange={(event) => update({ port: Number(event.currentTarget.value) })} /></label>
          <label>自定义名称<input value={form.name ?? ""} onChange={(event) => update({ name: event.currentTarget.value })} /></label>
          {tab === "ftp" ? (
            <>
              <label>模式<select value={form.mode ?? "passive"} onChange={(event) => update({ mode: event.currentTarget.value as "active" | "passive" })}><option value="passive">被动</option><option value="active">主动</option></select></label>
              <label className="checkbox-row"><input type="checkbox" checked={Boolean(form.anonymous)} onChange={(event) => update({ anonymous: event.currentTarget.checked })} />匿名模式</label>
              <label>用户名<input disabled={Boolean(form.anonymous)} value={form.username ?? ""} onChange={(event) => update({ username: event.currentTarget.value })} /></label>
              <label>密码<input disabled={Boolean(form.anonymous)} type="password" value={form.password ?? ""} onChange={(event) => update({ password: event.currentTarget.value })} /></label>
              <label>编码模式<input value={form.encoding ?? "utf8"} onChange={(event) => update({ encoding: event.currentTarget.value })} /></label>
            </>
          ) : (
            <>
              <label className="checkbox-row"><input type="checkbox" checked={Boolean(form.https)} onChange={(event) => update({ https: event.currentTarget.checked, port: event.currentTarget.checked ? 443 : 80 })} />HTTPS 加密</label>
              <label>用户名<input value={form.username ?? ""} onChange={(event) => update({ username: event.currentTarget.value })} /></label>
              <label>密码<input type="password" value={form.password ?? ""} onChange={(event) => update({ password: event.currentTarget.value })} /></label>
            </>
          )}
        </div>
        {error && <div className="panel-toast error">{error}</div>}
        <footer>
          <button type="button" onClick={onClose}>取消</button>
          <button type="button" onClick={() => void submit()}>确认</button>
        </footer>
      </section>
    </div>
  );
}
