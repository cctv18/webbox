import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LibraryService } from "../src/libraryService.js";

describe("LibraryService", () => {
  let root: string;

  beforeEach(async () => {
    const testRoot = path.join(process.cwd(), ".webbox-test-data");
    await fs.mkdir(testRoot, { recursive: true });
    root = await fs.mkdtemp(path.join(testRoot, "library-"));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("moves old library contents into an empty target", async () => {
    const oldDir = path.join(root, "old-documents");
    const newDir = path.join(root, "new-documents");
    await fs.mkdir(oldDir, { recursive: true });
    await fs.writeFile(path.join(oldDir, "a.txt"), "alpha", "utf8");

    const service = new LibraryService({ documents: oldDir }, root);
    await service.updatePath("documents", newDir);

    await expect(fs.readFile(path.join(newDir, "a.txt"), "utf8")).resolves.toBe("alpha");
    expect(service.getConfig().documents).toBe(newDir);
  });

  it("rejects a non-empty target with the configured message", async () => {
    const oldDir = path.join(root, "old-photos");
    const newDir = path.join(root, "new-photos");
    await fs.mkdir(oldDir, { recursive: true });
    await fs.mkdir(newDir, { recursive: true });
    await fs.writeFile(path.join(newDir, "occupied.txt"), "busy", "utf8");

    const service = new LibraryService({ photos: oldDir }, root);
    await expect(service.updatePath("photos", newDir)).rejects.toThrow("目标目录存在文件，请手工清理");
  });
});
