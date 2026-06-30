import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MetadataStore } from "../src/metadataStore.js";
import { NotificationService } from "../src/notificationService.js";

describe("NotificationService", () => {
  let root: string;
  let service: NotificationService;

  beforeEach(async () => {
    const testRoot = path.join(process.cwd(), ".webbox-test-data");
    await fs.mkdir(testRoot, { recursive: true });
    root = await fs.mkdtemp(path.join(testRoot, "notice-"));
    service = new NotificationService(new MetadataStore(path.join(root, "metadata.json")));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("adds, marks, and clears notifications", async () => {
    const created = await service.add({ title: "上传完成", message: "a.txt", level: "success" });
    expect((await service.list())[0].read).toBe(false);
    await service.markRead(created.id);
    expect((await service.list())[0].read).toBe(true);
    await service.clear();
    expect(await service.list()).toEqual([]);
  });
});
