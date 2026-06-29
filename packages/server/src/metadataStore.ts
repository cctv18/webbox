import fs from "node:fs/promises";
import path from "node:path";

export interface WebboxMetadata {
  theme: string;
  language: string;
  notifications: string[];
  recycle: Record<string, { originalPath: string; deletedAt: string }>;
  plugins: Record<string, boolean>;
}

const defaultMetadata: WebboxMetadata = {
  theme: "system",
  language: "zh-CN",
  notifications: [],
  recycle: {},
  plugins: {}
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
}
