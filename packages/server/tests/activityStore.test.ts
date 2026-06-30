import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ActivityStore } from "../src/activityStore.js";

describe("ActivityStore", () => {
  let root: string;
  let store: ActivityStore;

  beforeEach(async () => {
    const testRoot = path.join(process.cwd(), ".webbox-test-data");
    await fs.mkdir(testRoot, { recursive: true });
    root = await fs.mkdtemp(path.join(testRoot, "activity-"));
    store = new ActivityStore(path.join(root, "activity.json"));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("queries directory activity including child paths", async () => {
    await store.append({ action: "file.create", path: "/docs/a.txt", message: "created" });
    await store.append({ action: "file.create", path: "/music/a.mp3", message: "created" });

    const docs = await store.query("/docs");

    expect(docs).toHaveLength(1);
    expect(docs[0].path).toBe("/docs/a.txt");
  });
});
