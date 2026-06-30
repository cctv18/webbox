import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileService } from "../src/fileService.js";

describe("FileService", () => {
  let root: string;
  let dataRoot: string;
  let service: FileService;

  beforeEach(async () => {
    const testRoot = path.join(process.cwd(), ".webbox-test-data");
    await fs.mkdir(testRoot, { recursive: true });
    dataRoot = await fs.mkdtemp(path.join(testRoot, "file-data-"));
    root = path.join(dataRoot, "files");
    service = new FileService(root, dataRoot);
  });

  afterEach(async () => {
    await fs.rm(dataRoot, { recursive: true, force: true });
  });

  it("creates folders and files, then lists them", async () => {
    await service.mkdir("/docs");
    await service.writeText("/docs/readme.txt", "hello");
    const list = await service.list("/docs");
    expect(list.map((item) => item.name)).toEqual(["readme.txt"]);
  });

  it("renames files", async () => {
    await service.writeText("/a.txt", "a");
    await service.rename("/a.txt", "b.txt");
    const list = await service.list("/");
    expect(list[0].name).toBe("b.txt");
  });

  it("copies and moves files", async () => {
    await service.writeText("/a.txt", "a");
    await service.copy("/a.txt", "/copy.txt");
    await service.move("/copy.txt", "/moved.txt");
    const list = await service.list("/");
    expect(list.map((item) => item.name).sort()).toEqual(["a.txt", "moved.txt"]);
  });

  it("moves deleted files to recycle and restores them", async () => {
    await service.writeText("/trash.txt", "trash");
    const recycled = await service.recycle("/trash.txt");
    expect((await service.list("/")).map((item) => item.name)).toEqual([]);
    await service.restore(recycled.recycleId);
    expect((await service.list("/")).map((item) => item.name)).toEqual(["trash.txt"]);
  });

  it("searches by file name", async () => {
    await service.writeText("/docs/needle.txt", "hello");
    await service.writeText("/docs/other.md", "hello");
    const matches = await service.search("needle", "/");
    expect(matches.map((item) => item.path)).toEqual(["/docs/needle.txt"]);
  });

  it("rejects traversal", async () => {
    await expect(service.list("/../outside")).rejects.toThrow("PATH_OUTSIDE_ROOT");
  });
});
