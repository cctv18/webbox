import { useEffect, useState } from "react";
import { CheckCircle2, Download, XCircle } from "lucide-react";
import type { ActivityRecord, AdminOverview, AdminStorageConfig, BackupItem, BackupSchedule, PluginManifest, WebboxSettings } from "@webbox/shared";
import { client } from "../api/client";
import { text } from "../i18n";
import { formatBytes } from "../utils/format";

interface AdminPanelProps {
  initialTab?: "overview" | "settings" | "storage" | "plugins" | "notice";
  plugins: readonly PluginManifest[];
  onClose: () => void;
}

type AdminTab = NonNullable<AdminPanelProps["initialTab"]> | "logs";

const tabs = [
  ["overview", text.admin.tabs.overview],
  ["settings", text.admin.tabs.settings],
  ["storage", "数据存储"],
  ["notice", "备份管理"],
  ["plugins", text.admin.tabs.plugins]
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
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const [storage, setStorage] = useState<AdminStorageConfig | null>(null);
  const [settings, setSettings] = useState<WebboxSettings | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [logs, setLogs] = useState<ActivityRecord[]>([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [backupName, setBackupName] = useState("");
  const overviewData = overview && "storage" in overview ? overview : null;

  const show = (value: string, type: "success" | "error" = "success") => {
    setMessageType(type);
    setMessage(value);
  };

  const load = async () => {
    const [nextStorage, nextSettings, nextOverview, backupData, logData] = await Promise.all([
      client.storage(),
      client.adminSettings(),
      client.adminOverview(),
      client.backups(),
      client.adminLogs("range=today")
    ]);
    setStorage(nextStorage);
    setSettings(nextSettings);
    setOverview(nextOverview);
    setBackups(backupData.items);
    setSchedules(backupData.schedules);
    setLogs(logData.items);
  };

  useEffect(() => {
    void load().catch((err: Error) => show(err.message, "error"));
  }, []);

  const saveStorage = async () => {
    if (!storage) return;
    try {
      setStorage(await client.saveStorage(storage));
      show(text.fileManager.operationDone);
    } catch (err) {
      show(err instanceof Error ? err.message : text.admin.storage.targetNotEmpty, "error");
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    try {
      setSettings(await client.saveAdminSettings(settings));
      show(text.fileManager.operationDone);
    } catch (err) {
      show(err instanceof Error ? err.message : String(err), "error");
    }
  };

  const createBackup = async () => {
    await client.createBackup(backupName, { settings: true, data: ["personal", "photos", "documents", "music", "videos", "safeBox"], plugins: true });
    setBackupName("");
    await load();
    show(text.fileManager.operationDone);
  };

  return (
    <section className="admin-panel" aria-label={text.admin.panelLabel}>
      <header className="panel-header">
        <h2>{text.admin.title}</h2>
        <button type="button" onClick={onClose}>{text.admin.close}</button>
      </header>
      <div className="admin-layout">
        <nav className="admin-tree" aria-label={text.admin.navLabel}>
          {tabs.map(([id, label]) => (
            <button className={id === tab ? "active" : ""} type="button" key={id} onClick={() => setTab(id)}>{label}</button>
          ))}
          <button type="button" className={tab === "logs" ? "active" : ""} onClick={() => setTab("logs")}>操作日志</button>
        </nav>
        <div className="admin-content">
          {message && <div className={`panel-toast ${messageType}`} role="status">{messageType === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}{message}</div>}
          {tab === "overview" && <section className="admin-section">
            <h3>{text.admin.tabs.overview}</h3>
            <div className="admin-cards">
              <article><strong>{formatBytes(overviewData?.storage.totalBytes ?? 0)}</strong><span>目录占用总空间</span></article>
              <article><strong>{overviewData?.system.cpuUsagePercent ?? 0}%</strong><span>CPU 占用率</span></article>
              <article><strong>{overviewData?.system.memoryUsagePercent ?? 0}%</strong><span>内存占用率</span></article>
              <article><strong>{formatBytes(overviewData?.storage.device.usedBytes ?? 0)}</strong><span>存储设备占用</span></article>
            </div>
            <div className="admin-cards">
              <article><strong>{formatBytes(overviewData?.visits24h.uploadBytes ?? 0)}</strong><span>24h 上传数据量</span></article>
              <article><strong>{formatBytes(overviewData?.visits24h.downloadBytes ?? 0)}</strong><span>24h 下载数据量</span></article>
              <article><strong>{overviewData?.visits24h.fileCreateCount ?? 0}</strong><span>创建次数</span></article>
              <article><strong>{overviewData?.visits24h.fileDeleteCount ?? 0}</strong><span>删除次数</span></article>
            </div>
            <dl className="admin-details">
              <dt>服务器信息</dt><dd>{overviewData?.serverInfo.platform} {overviewData?.serverInfo.release} · {overviewData?.serverInfo.hostname}</dd>
              <dt>服务器时间</dt><dd>{overviewData?.serverInfo.serverTime}</dd>
              <dt>服务器 IP</dt><dd>{overviewData?.serverInfo.ip.join(", ")}</dd>
              <dt>持续运行时间</dt><dd>{overviewData?.serverInfo.uptimeSeconds}s</dd>
              <dt>当前访问端</dt><dd>{overviewData?.clientInfo.ip} · {overviewData?.clientInfo.userAgent} · {overviewData?.clientInfo.language}</dd>
            </dl>
          </section>}
          {tab === "settings" && settings && <section className="admin-section">
            <h3>上传/下载</h3>
            <label>上传分块大小(MB)<input type="number" value={settings.upload.chunkSizeMb} onChange={(event) => setSettings({ ...settings, upload: { ...settings.upload, chunkSizeMb: Number(event.currentTarget.value) } })} /></label>
            <label>上传并发线程<input type="number" value={settings.upload.concurrency} onChange={(event) => setSettings({ ...settings, upload: { ...settings.upload, concurrency: Number(event.currentTarget.value) } })} /></label>
            <label>上传忽略文件<input value={settings.upload.ignorePatterns.join(",")} onChange={(event) => setSettings({ ...settings, upload: { ...settings.upload, ignorePatterns: event.currentTarget.value.split(",").map((item) => item.trim()).filter(Boolean) } })} /></label>
            <label>上传失败自动重传尝试次数<input type="number" value={settings.upload.retryCount} onChange={(event) => setSettings({ ...settings, upload: { ...settings.upload, retryCount: Number(event.currentTarget.value) } })} /></label>
            <label>下载限速(KB/s)<input type="number" value={settings.download.speedLimitKb} onChange={(event) => setSettings({ ...settings, download: { ...settings.download, speedLimitKb: Number(event.currentTarget.value) } })} /></label>
            <label className="checkbox-row"><input type="checkbox" checked={settings.download.frontendZip} onChange={(event) => setSettings({ ...settings, download: { ...settings.download, frontendZip: event.currentTarget.checked } })} />开启前端打包压缩下载</label>
            <label>后端打包压缩文件总大小限制(MB)<input type="number" value={settings.download.backendZipSizeLimitMb} onChange={(event) => setSettings({ ...settings, download: { ...settings.download, backendZipSizeLimitMb: Number(event.currentTarget.value) } })} /></label>
            <h3>通知中心</h3>
            <label className="checkbox-row"><input type="checkbox" checked={settings.notifications?.enabled ?? true} onChange={(event) => setSettings({ ...settings, notifications: { enabled: event.currentTarget.checked, maxItems: settings.notifications?.maxItems ?? 100 } })} />启用通知</label>
            <label>通知最大保存条数<input type="number" value={settings.notifications?.maxItems ?? 100} onChange={(event) => setSettings({ ...settings, notifications: { enabled: settings.notifications?.enabled ?? true, maxItems: Number(event.currentTarget.value) } })} /></label>
            <footer><button type="button" onClick={() => void saveSettings()}>{text.inspector.save}</button></footer>
          </section>}
          {tab === "storage" && storage && <section className="admin-section">
            <h3>数据存储</h3>
            {storageFields.map(([key, label]) => (
              <label key={key}>{label}<input value={storage[key]} onChange={(event) => setStorage({ ...storage, [key]: event.target.value })} /></label>
            ))}
            <footer><button type="button" onClick={() => void saveStorage()}>{text.admin.storage.save}</button></footer>
          </section>}
          {tab === "notice" && <section className="admin-section">
            <h3>备份管理</h3>
            <label>备份文件名<input value={backupName} placeholder="YYYYMMDD-hhmmss" onChange={(event) => setBackupName(event.currentTarget.value)} /></label>
            <button type="button" onClick={() => void createBackup()}>手动备份</button>
            <div className="admin-list">{backups.map((backup) => (
              <article key={backup.name}><span>{backup.name}</span><span>{formatBytes(backup.size)}</span><time>{new Date(backup.createdAt).toLocaleString()}</time><button type="button" onClick={() => void client.restoreBackup(backup.name).then(() => show(text.fileManager.operationDone))}>还原</button><button type="button" onClick={() => void client.deleteBackups([backup.name]).then(load)}>删除</button></article>
            ))}</div>
            <h3>自动备份计划</h3>
            <button type="button" onClick={() => void client.addBackupSchedule({ name: "daily", cron: "0 2 * * *", include: { settings: true, data: ["personal"], plugins: true } }).then(load)}>添加每日计划</button>
            <div className="admin-list">{schedules.map((schedule) => (
              <article key={schedule.id}><span>{schedule.name}</span><span>{schedule.cron}</span><button type="button" onClick={() => void client.deleteBackupSchedule(schedule.id).then(load)}>删除</button></article>
            ))}</div>
          </section>}
          {tab === "plugins" && <section className="admin-section">
            <h3>{text.admin.tabs.plugins}</h3>
            <div className="admin-list">{plugins.length ? plugins.map((plugin) => (
              <article key={plugin.id}><span>{plugin.name}</span><span>{plugin.category}</span><span>{plugin.compatible ? text.admin.pluginCoreCompatible : plugin.reason}</span><button type="button">配置</button><button type="button">禁用</button><button type="button">卸载</button></article>
            )) : <p>{text.admin.noPlugins}</p>}</div>
          </section>}
          {tab === "logs" && <section className="admin-section">
            <h3>操作日志</h3>
            <a className="download-link" href={client.adminLogsExportUrl("range=today")}><Download size={15} />导出 Excel</a>
            <div className="admin-list">{logs.map((log) => (
              <article key={log.id}><time>{new Date(log.createdAt).toLocaleString()}</time><span>{log.action}</span><span>{log.path}</span><strong>{log.message}</strong></article>
            ))}</div>
          </section>}
        </div>
      </div>
    </section>
  );
}
