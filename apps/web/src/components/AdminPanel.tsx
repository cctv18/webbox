import { useEffect, useState } from "react";
import type { AdminStorageConfig, PluginManifest } from "@webbox/shared";
import { client } from "../api/client";
import { text } from "../i18n";

interface AdminPanelProps {
  initialTab?: "overview" | "settings" | "storage" | "plugins" | "notice";
  plugins: readonly PluginManifest[];
  onClose: () => void;
}

const tabs = [
  ["overview", text.admin.tabs.overview],
  ["settings", text.admin.tabs.settings],
  ["storage", text.admin.tabs.storage],
  ["plugins", text.admin.tabs.plugins],
  ["notice", text.admin.tabs.notice]
] as const;

const storageFields: Array<[keyof AdminStorageConfig, string]> = [
  ["personal", text.admin.storage.personal],
  ["photos", text.admin.storage.photos],
  ["documents", text.admin.storage.documents],
  ["music", text.admin.storage.music],
  ["videos", text.admin.storage.videos],
  ["safeBox", text.admin.storage.safeBox],
  ["recycle", text.admin.storage.recycle]
];

export function AdminPanel({ initialTab = "overview", plugins, onClose }: AdminPanelProps) {
  const [tab, setTab] = useState(initialTab);
  const [storage, setStorage] = useState<AdminStorageConfig | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    client.storage().then(setStorage).catch((err: Error) => setMessage(err.message));
  }, []);

  const saveStorage = async () => {
    if (!storage) return;
    try {
      setStorage(await client.saveStorage(storage));
      setMessage(text.fileManager.operationDone);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : text.admin.storage.targetNotEmpty);
    }
  };

  return (
    <section className="admin-panel" aria-label={text.admin.panelLabel}>
      <header className="panel-header">
        <h2>{text.admin.title}</h2>
        <button type="button" onClick={onClose}>{text.admin.close}</button>
      </header>
      <nav className="tabs" aria-label={text.admin.navLabel}>
        {tabs.map(([id, label]) => (
          <button className={id === tab ? "active" : ""} type="button" key={id} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>
      {message && <div className="toast">{message}</div>}
      <div className="admin-grid">
        {tab === "overview" && <section>
          <h3>{text.admin.tabs.overview}</h3>
          <p>{text.admin.overviewStorage}</p>
          <p>{text.admin.overviewStatus}</p>
        </section>}
        {tab === "settings" && <section>
          <h3>{text.admin.tabs.settings}</h3>
          <p>{text.admin.settingsDescription}</p>
        </section>}
        {tab === "storage" && <section>
          <h3>{text.admin.tabs.storage}</h3>
          <p>{text.admin.storageDescription}</p>
          {storage && storageFields.map(([key, label]) => (
            <label key={key} className="storage-field">
              {label}
              <input value={storage[key]} onChange={(event) => setStorage({ ...storage, [key]: event.target.value })} />
            </label>
          ))}
          <button type="button" onClick={saveStorage}>{text.admin.storage.save}</button>
        </section>}
        {tab === "plugins" && <section>
          <h3>{text.admin.tabs.plugins}</h3>
          <ul>
            {plugins.length ? plugins.map((plugin) => (
              <li key={plugin.id}>{plugin.name} · {plugin.compatible ? text.admin.pluginCoreCompatible : plugin.reason}</li>
            )) : <li>{text.admin.noPlugins}</li>}
          </ul>
        </section>}
        {tab === "notice" && <section>
          <h3>{text.admin.tabs.notice}</h3>
          <p>{text.admin.noticeDescription}</p>
        </section>}
      </div>
    </section>
  );
}
