import fs from "node:fs/promises";
import path from "node:path";
import type { WebboxSettings } from "@webbox/shared";

export const defaultSettings: WebboxSettings = {
  explorer: {
    theme: "system",
    language: "zh-CN",
    viewMode: "list",
    iconSize: 72,
    sort: { key: "name", direction: "asc" },
    searchHistoryLimit: 10
  },
  upload: {
    chunkSizeMb: 8,
    concurrency: 3,
    ignorePatterns: [".DS_Store", "Thumbs.db"],
    retryCount: 2
  },
  download: {
    speedLimitKb: 0,
    frontendZip: true,
    backendZipSizeLimitMb: 1024
  }
};

function mergeSettings(current: WebboxSettings, patch: Partial<WebboxSettings>): WebboxSettings {
  return {
    explorer: { ...current.explorer, ...(patch.explorer ?? {}), sort: { ...current.explorer.sort, ...(patch.explorer?.sort ?? {}) } },
    upload: { ...current.upload, ...(patch.upload ?? {}) },
    download: { ...current.download, ...(patch.download ?? {}) }
  };
}

export class SettingsStore {
  private readonly filePath: string;

  constructor(dataRoot: string) {
    this.filePath = path.join(dataRoot, ".config", "settings.json");
  }

  async get(): Promise<WebboxSettings> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      return mergeSettings(defaultSettings, JSON.parse(raw) as Partial<WebboxSettings>);
    } catch {
      await this.save(defaultSettings);
      return structuredClone(defaultSettings);
    }
  }

  async update(patch: Partial<WebboxSettings>): Promise<WebboxSettings> {
    const next = mergeSettings(await this.get(), patch);
    await this.save(next);
    return next;
  }

  private async save(settings: WebboxSettings): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  }
}
