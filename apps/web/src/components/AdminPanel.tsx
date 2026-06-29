import type { PluginManifest } from "@webbox/shared";

interface AdminPanelProps {
  initialTab?: "overview" | "settings" | "storage" | "plugins" | "notice";
  plugins: PluginManifest[];
  onClose: () => void;
}

const tabs = [
  ["overview", "概览"],
  ["settings", "系统设置"],
  ["storage", "存储/文件"],
  ["plugins", "插件管理"],
  ["notice", "通知管理"]
] as const;

export function AdminPanel({ initialTab = "overview", plugins, onClose }: AdminPanelProps) {
  return (
    <section className="admin-panel" aria-label="后台管理面板">
      <header className="panel-header">
        <h2>后台管理</h2>
        <button type="button" onClick={onClose}>关闭</button>
      </header>
      <nav className="tabs" aria-label="后台管理">
        {tabs.map(([id, label]) => (
          <button className={id === initialTab ? "active" : ""} type="button" key={id}>{label}</button>
        ))}
      </nav>
      <div className="admin-grid">
        <section>
          <h3>概览</h3>
          <p>存储使用：等待服务端统计</p>
          <p>运行状态：Webbox 本地服务</p>
        </section>
        <section>
          <h3>系统设置</h3>
          <p>语言、主题、上传限制和编辑器行为由 Webbox 设置管理。</p>
        </section>
        <section>
          <h3>存储/文件</h3>
          <p>个人文件根目录、回收站维护和缩略图选项。</p>
        </section>
        <section>
          <h3>插件管理</h3>
          <ul>
            {plugins.length ? plugins.map((plugin) => (
              <li key={plugin.id}>{plugin.name} · {plugin.compatible ? "核心兼容" : plugin.reason}</li>
            )) : <li>未发现核心插件</li>}
          </ul>
        </section>
        <section>
          <h3>通知管理</h3>
          <p>站内消息会通过左下角通知入口展示。</p>
        </section>
      </div>
    </section>
  );
}
