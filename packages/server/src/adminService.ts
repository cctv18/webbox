import archiver from "archiver";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import unzipper from "unzipper";
import type { ActivityRecord, AdminOverview, AdminStorageConfig, BackupInclude, BackupItem, BackupSchedule, WebboxSettings } from "@webbox/shared";
import type { ActivityStore } from "./activityStore.js";
import type { LibraryService } from "./libraryService.js";
import type { SettingsStore } from "./settingsStore.js";

const storageKeys: Array<keyof AdminStorageConfig> = ["personal", "photos", "documents", "music", "videos", "safeBox", "recycle"];

async function exists(value: string): Promise<boolean> {
  try {
    await fsp.access(value);
    return true;
  } catch {
    return false;
  }
}

async function directorySize(root: string): Promise<number> {
  let total = 0;
  async function walk(current: string): Promise<void> {
    let entries;
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else total += (await fsp.stat(full)).size;
    }
  }
  await walk(root);
  return total;
}

function defaultInclude(): BackupInclude {
  return { settings: true, data: ["personal"], plugins: true };
}

function backupName(value?: string): string {
  const fallback = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const clean = (value?.trim() || fallback).replace(/[<>:"\\|?*\x00-\x1f]/g, "_");
  return clean.toLowerCase().endsWith(".zip") ? clean : `${clean}.zip`;
}

export class AdminService {
  private readonly backupsRoot: string;
  private readonly schedulePath: string;

  constructor(
    private readonly dataRoot: string,
    private readonly pluginRoot: string,
    private readonly library: LibraryService,
    private readonly settings: SettingsStore,
    private readonly activity: ActivityStore
  ) {
    this.backupsRoot = path.join(dataRoot, "backups");
    this.schedulePath = path.join(dataRoot, ".config", "backup-schedules.json");
  }

  async overview(req: { ip?: string; headers: Record<string, string | string[] | undefined> }): Promise<AdminOverview> {
    const storage = this.library.getConfig();
    const roots = await Promise.all(storageKeys.map(async (key) => ({
      key,
      path: storage[key],
      bytes: await directorySize(storage[key])
    })));
    const totalBytes = roots.reduce((total, item) => total + item.bytes, 0);
    const records = await this.activity.query("/");
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const last24h = records.filter((record) => new Date(record.createdAt).getTime() >= since);
    const memoryUsagePercent = Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 1000) / 10;
    return {
      storage: {
        totalBytes,
        roots,
        device: {
          totalBytes: os.totalmem(),
          freeBytes: os.freemem(),
          usedBytes: os.totalmem() - os.freemem()
        }
      },
      system: {
        cpuUsagePercent: Math.min(100, Math.round(os.loadavg()[0] * 10) / 10),
        memoryUsagePercent
      },
      visits24h: {
        uploadBytes: this.sumBytes(last24h, "file.upload"),
        downloadBytes: this.sumBytes(last24h, "file.download"),
        fileCreateCount: last24h.filter((record) => ["file.mkdir", "file.template", "file.writeText", "file.upload"].includes(record.action)).length,
        fileDownloadCount: last24h.filter((record) => record.action === "file.download").length,
        fileEditCount: last24h.filter((record) => ["file.rename", "file.move", "metadata.properties", "metadata.memo"].includes(record.action)).length,
        fileDeleteCount: last24h.filter((record) => ["file.delete", "file.recycle", "file.deleteForever"].includes(record.action)).length
      },
      serverInfo: {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        hostname: os.hostname(),
        serverTime: new Date().toISOString(),
        ip: Object.values(os.networkInterfaces()).flat().filter((item): item is os.NetworkInterfaceInfo => Boolean(item) && !item.internal).map((item) => item.address),
        uptimeSeconds: Math.floor(os.uptime())
      },
      clientInfo: {
        accessTime: new Date().toISOString(),
        ip: req.ip ?? "",
        userAgent: String(req.headers["user-agent"] ?? ""),
        language: String(req.headers["accept-language"] ?? "")
      }
    };
  }

  async updateSettings(patch: Partial<WebboxSettings>): Promise<WebboxSettings> {
    const next = await this.settings.update(patch);
    await this.activity.append({ action: "system.settings", path: "/后台管理/系统设置", message: "修改系统设置" });
    return next;
  }

  async createBackup(input: { name?: string; include?: Partial<BackupInclude> }): Promise<BackupItem> {
    const include = { ...defaultInclude(), ...(input.include ?? {}) };
    const name = backupName(input.name);
    await fsp.mkdir(this.backupsRoot, { recursive: true });
    const target = path.join(this.backupsRoot, name);
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(target);
      const archive = archiver("zip", { zlib: { level: 9 } });
      output.on("close", resolve);
      archive.on("error", reject);
      archive.pipe(output);
      if (include.settings) archive.directory(path.join(this.dataRoot, ".config"), ".config");
      const storage = this.library.getConfig();
      for (const key of include.data) {
        const root = storage[key];
        if (root) archive.directory(root, `data/${key}`);
      }
      if (include.plugins) archive.directory(this.pluginRoot, "plugins");
      void archive.finalize();
    });
    await this.activity.append({ action: "system.backup", path: `/backups/${name}`, message: "创建备份" });
    return this.backupItem(target);
  }

  async listBackups(): Promise<{ items: BackupItem[]; schedules: BackupSchedule[] }> {
    await fsp.mkdir(this.backupsRoot, { recursive: true });
    const entries = await fsp.readdir(this.backupsRoot).catch(() => []);
    const items = (await Promise.all(entries.filter((entry) => entry.toLowerCase().endsWith(".zip")).map((entry) => this.backupItem(path.join(this.backupsRoot, entry)))))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { items, schedules: await this.listSchedules() };
  }

  async deleteBackups(names: string[]): Promise<{ deleted: string[] }> {
    const deleted: string[] = [];
    for (const name of names.map(backupName)) {
      const target = path.join(this.backupsRoot, path.basename(name));
      if (await exists(target)) {
        await fsp.rm(target, { force: true });
        deleted.push(path.basename(name));
      }
    }
    await this.activity.append({ action: "system.backup.delete", path: "/backups", message: "删除备份", details: { deleted } });
    return { deleted };
  }

  async restoreBackup(name: string): Promise<{ restored: string }> {
    const source = path.join(this.backupsRoot, path.basename(backupName(name)));
    if (!(await exists(source))) throw new Error("PATH_NOT_FOUND");
    const directory = await unzipper.Open.file(source);
    await Promise.all(directory.files.map(async (file) => {
      if (!file.path.startsWith(".config/")) return;
      const destination = path.join(this.dataRoot, file.path);
      if (file.type === "Directory") await fsp.mkdir(destination, { recursive: true });
      else {
        await fsp.mkdir(path.dirname(destination), { recursive: true });
        await new Promise<void>((resolve, reject) => file.stream().pipe(fs.createWriteStream(destination)).on("finish", resolve).on("error", reject));
      }
    }));
    await this.activity.append({ action: "system.backup.restore", path: `/backups/${path.basename(source)}`, message: "还原备份" });
    return { restored: path.basename(source) };
  }

  async addSchedule(input: { name?: string; cron?: string; include?: BackupInclude }): Promise<BackupSchedule> {
    const schedules = await this.listSchedules();
    const schedule: BackupSchedule = {
      id: randomUUID(),
      name: input.name?.trim() || "auto-backup",
      cron: input.cron?.trim() || "0 2 * * *",
      include: { ...defaultInclude(), ...(input.include ?? {}) },
      createdAt: new Date().toISOString()
    };
    await this.writeSchedules([schedule, ...schedules]);
    return schedule;
  }

  async deleteSchedule(id: string): Promise<{ id: string }> {
    await this.writeSchedules((await this.listSchedules()).filter((schedule) => schedule.id !== id));
    return { id };
  }

  async logs(query: { range?: string; from?: string; to?: string }): Promise<{ items: ActivityRecord[] }> {
    const records = await this.activity.query("/");
    const { from, to } = this.range(query);
    return { items: records.filter((record) => {
      const time = new Date(record.createdAt).getTime();
      return time >= from && time <= to;
    }) };
  }

  exportLogs(items: ActivityRecord[]): string {
    const rows = [["时间", "操作", "路径", "说明"], ...items.map((item) => [item.createdAt, item.action, item.path, item.message])];
    return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  }

  private async backupItem(filePath: string): Promise<BackupItem> {
    const stat = await fsp.stat(filePath);
    return { name: path.basename(filePath), size: stat.size, createdAt: stat.birthtime.toISOString() };
  }

  private async listSchedules(): Promise<BackupSchedule[]> {
    try {
      return JSON.parse(await fsp.readFile(this.schedulePath, "utf8")) as BackupSchedule[];
    } catch {
      return [];
    }
  }

  private async writeSchedules(schedules: BackupSchedule[]): Promise<void> {
    await fsp.mkdir(path.dirname(this.schedulePath), { recursive: true });
    await fsp.writeFile(this.schedulePath, `${JSON.stringify(schedules, null, 2)}\n`, "utf8");
  }

  private range(query: { range?: string; from?: string; to?: string }): { from: number; to: number } {
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (query.range === "today") return { from: startOfToday.getTime(), to: now };
    if (query.range === "7d") return { from: now - 7 * 24 * 60 * 60 * 1000, to: now };
    if (query.range === "30d") return { from: now - 30 * 24 * 60 * 60 * 1000, to: now };
    return {
      from: query.from ? new Date(query.from).getTime() : 0,
      to: query.to ? new Date(query.to).getTime() : now
    };
  }

  private sumBytes(records: ActivityRecord[], action: string): number {
    return records
      .filter((record) => record.action === action)
      .reduce((total, record) => total + Number(record.details?.bytes ?? 0), 0);
  }
}
