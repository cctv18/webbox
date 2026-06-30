import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ActivityRecord } from "@webbox/shared";

function normalizePath(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  if (!normalized.startsWith("/")) return `/${normalized}`;
  return normalized.replace(/\/+/g, "/");
}

export class ActivityStore {
  constructor(private readonly filePath: string) {}

  async append(input: Omit<ActivityRecord, "id" | "createdAt"> & { createdAt?: string }): Promise<ActivityRecord> {
    const records = await this.read();
    const record: ActivityRecord = {
      id: randomUUID(),
      createdAt: input.createdAt ?? new Date().toISOString(),
      action: input.action,
      path: normalizePath(input.path),
      message: input.message,
      details: input.details
    };
    records.unshift(record);
    await this.write(records.slice(0, 1000));
    return record;
  }

  async query(targetPath = "/"): Promise<ActivityRecord[]> {
    const target = normalizePath(targetPath).replace(/\/$/, "") || "/";
    const records = await this.read();
    if (target === "/") return records;
    return records.filter((record) => record.path === target || record.path.startsWith(`${target}/`));
  }

  private async read(): Promise<ActivityRecord[]> {
    try {
      return JSON.parse(await fs.readFile(this.filePath, "utf8")) as ActivityRecord[];
    } catch {
      return [];
    }
  }

  private async write(records: ActivityRecord[]): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  }
}
