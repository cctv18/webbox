import type { PluginManifest } from "@webbox/shared";
import { text } from "../i18n";

interface AdminPanelProps {
  initialTab?: "overview" | "settings" | "storage" | "plugins" | "notice";
  plugins: PluginManifest[];
  onClose: () => void;
}

const tabs = [
  ["overview", text.admin.tabs.overview],
  ["settings", text.admin.tabs.settings],
  ["storage", text.admin.tabs.storage],
  ["plugins", text.admin.tabs.plugins],
  ["notice", text.admin.tabs.notice]
] as const;

export function AdminPanel({ initialTab = "overview", plugins, onClose }: AdminPanelProps) {
  return (
    <section className="admin-panel" aria-label={text.admin.panelLabel}>
      <header className="panel-header">
        <h2>{text.admin.title}</h2>
        <button type="button" onClick={onClose}>{text.admin.close}</button>
      </header>
      <nav className="tabs" aria-label={text.admin.navLabel}>
        {tabs.map(([id, label]) => (
          <button className={id === initialTab ? "active" : ""} type="button" key={id}>{label}</button>
        ))}
      </nav>
      <div className="admin-grid">
        <section>
          <h3>{text.admin.tabs.overview}</h3>
          <p>{text.admin.overviewStorage}</p>
          <p>{text.admin.overviewStatus}</p>
        </section>
        <section>
          <h3>{text.admin.tabs.settings}</h3>
          <p>{text.admin.settingsDescription}</p>
        </section>
        <section>
          <h3>{text.admin.tabs.storage}</h3>
          <p>{text.admin.storageDescription}</p>
        </section>
        <section>
          <h3>{text.admin.tabs.plugins}</h3>
          <ul>
            {plugins.length ? plugins.map((plugin) => (
              <li key={plugin.id}>{plugin.name} · {plugin.compatible ? text.admin.pluginCoreCompatible : plugin.reason}</li>
            )) : <li>{text.admin.noPlugins}</li>}
          </ul>
        </section>
        <section>
          <h3>{text.admin.tabs.notice}</h3>
          <p>{text.admin.noticeDescription}</p>
        </section>
      </div>
    </section>
  );
}
