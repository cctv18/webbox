import fs from "node:fs/promises";
import path from "node:path";
import type { AdminStorageConfig } from "@webbox/shared";

export type LibraryKey = keyof AdminStorageConfig;

const keys: LibraryKey[] = ["personal", "photos", "documents", "music", "videos", "safeBox", "recycle"];

export function defaultStorageConfig(dataRoot: string): AdminStorageConfig {
  return {
    personal: path.join(dataRoot, "files"),
    photos: path.join(dataRoot, "photos"),
    documents: path.join(dataRoot, "documents"),
    music: path.join(dataRoot, "music"),
    videos: path.join(dataRoot, "videos"),
    safeBox: path.join(dataRoot, "safe-box"),
    recycle: path.join(dataRoot, "recycle")
  };
}

async function exists(value: string): Promise<boolean> {
  try {
    await fs.access(value);
    return true;
  } catch {
    return false;
  }
}

async function isNonEmptyDirectory(value: string): Promise<boolean> {
  try {
    const stat = await fs.stat(value);
    if (!stat.isDirectory()) return true;
    return (await fs.readdir(value)).length > 0;
  } catch {
    return false;
  }
}

async function moveContents(source: string, target: string): Promise<void> {
  if (!(await exists(source))) return;
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source);
  for (const entry of entries) {
    await fs.rename(path.join(source, entry), path.join(target, entry));
  }
}

export class LibraryService {
  private config: AdminStorageConfig;

  constructor(initial: Partial<AdminStorageConfig>, private readonly dataRoot: string, private readonly onChange?: (next: AdminStorageConfig) => Promise<void> | void) {
    const clean = Object.fromEntries(Object.entries(initial).filter(([, value]) => typeof value === "string" && value.length > 0)) as Partial<AdminStorageConfig>;
    this.config = { ...defaultStorageConfig(dataRoot), ...clean };
  }

  getConfig(): AdminStorageConfig {
    return { ...this.config };
  }

  async ensureAll(): Promise<void> {
    await Promise.all(keys.map((key) => fs.mkdir(this.config[key], { recursive: true })));
  }

  async updatePath(key: LibraryKey, nextPath: string): Promise<AdminStorageConfig> {
    const target = path.resolve(nextPath);
    const current = path.resolve(this.config[key]);
    if (target === current) return this.getConfig();
    if (await isNonEmptyDirectory(target)) {
      throw new Error("目标目录存在文件，请手工清理");
    }
    await fs.mkdir(target, { recursive: true });
    await moveContents(current, target);
    this.config = { ...this.config, [key]: target };
    await this.onChange?.(this.getConfig());
    return this.getConfig();
  }
}
