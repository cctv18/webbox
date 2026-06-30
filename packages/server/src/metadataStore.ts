import fs from "node:fs/promises";
import path from "node:path";
import type { ActivityRecord, FavoriteEntry, MemoEntry, NotificationItem, PathMetadata, RecentSearch } from "@webbox/shared";

export interface WebboxMetadata {
  theme: string;
  language: string;
  notifications: string[];
  recycle: Record<string, { originalPath: string; deletedAt: string }>;
  plugins: Record<string, boolean>;
  favoritePaths: string[];
  favorites: FavoriteEntry[];
  recentSearches: RecentSearch[];
  pathMetadata: Record<string, PathMetadata>;
  memos: MemoEntry[];
  activity: ActivityRecord[];
  notificationItems: NotificationItem[];
  safeBox?: {
    passwordHash: string;
    salt: string;
  };
}

const defaultMetadata: WebboxMetadata = {
  theme: "system",
  language: "zh-CN",
  notifications: [],
  recycle: {},
  plugins: {},
  favoritePaths: [],
  favorites: [],
  recentSearches: [],
  pathMetadata: {},
  memos: [],
  activity: [],
  notificationItems: []
};

export class MetadataStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<WebboxMetadata> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      return { ...defaultMetadata, ...JSON.parse(raw) };
    } catch {
      await this.save(defaultMetadata);
      return { ...defaultMetadata };
    }
  }

  async save(next: WebboxMetadata): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  }

  async update(mutator: (state: WebboxMetadata) => void | Promise<void>): Promise<WebboxMetadata> {
    const state = await this.load();
    await mutator(state);
    await this.save(state);
    return state;
  }
}
