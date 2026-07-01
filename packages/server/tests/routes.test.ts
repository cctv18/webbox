import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { zhCN } from "@webbox/shared";
import { createApp } from "../src/app.js";

function collectTreeLabels(nodes: Array<{ label: string; children?: Array<{ label: string; children?: unknown[] }> }>): string[] {
  return nodes.flatMap((node) => [node.label, ...collectTreeLabels((node.children ?? []) as Array<{ label: string; children?: Array<{ label: string; children?: unknown[] }> }>)]);
}

describe("server routes", () => {
  let dataRoot: string;
  let storageRoot: string;
  let pluginRoot: string;

  beforeEach(async () => {
    const testRoot = path.join(process.cwd(), ".webbox-test-data");
    await fs.mkdir(testRoot, { recursive: true });
    dataRoot = await fs.mkdtemp(path.join(testRoot, "route-data-"));
    storageRoot = path.join(dataRoot, "files");
    pluginRoot = path.join(dataRoot, "plugins");
  });

  afterEach(async () => {
    await fs.rm(dataRoot, { recursive: true, force: true });
  });

  it("returns local full-permission user and disabled removed features", async () => {
    const app = await createApp({ storageRoot, dataRoot, pluginRoot });
    const response = await request(app).get("/api/bootstrap").expect(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data.user).toEqual({
      id: "local",
      name: "Local User",
      isAdmin: true,
      permissions: ["*"]
    });
    expect(response.body.data.features.share).toBe(false);
    expect(response.body.data.features.desktop).toBe(false);
    expect(response.body.data.features.users).toBe(false);
    expect(response.body.data.features.history).toBe(false);
    expect(response.body.data.features.phpStatus).toBe(false);
  });

  it("lists, creates, renames, copies, moves, and deletes files", async () => {
    const app = await createApp({ storageRoot, dataRoot, pluginRoot });
    await request(app).post("/api/files/folder").send({ path: "/docs" }).expect(200);
    await request(app).post("/api/files/text").send({ path: "/docs/a.txt", content: "alpha" }).expect(200);
    await request(app).post("/api/files/rename").send({ path: "/docs/a.txt", name: "b.txt" }).expect(200);
    await request(app).post("/api/files/copy").send({ source: "/docs/b.txt", target: "/docs/c.txt" }).expect(200);
    await request(app).post("/api/files/move").send({ source: "/docs/c.txt", target: "/c.txt" }).expect(200);
    await request(app).delete("/api/files").send({ path: "/c.txt" }).expect(200);
    const list = await request(app).get("/api/files").query({ path: "/docs" }).expect(200);
    expect(list.body.data.map((item: { name: string }) => item.name)).toEqual(["b.txt"]);
  });

  it("supports recycle, restore, search, and download", async () => {
    const app = await createApp({ storageRoot, dataRoot, pluginRoot });
    await request(app).post("/api/files/text").send({ path: "/hello.txt", content: "webbox" }).expect(200);
    const search = await request(app).get("/api/files/search").query({ path: "/", q: "hello" }).expect(200);
    expect(search.body.data[0].name).toBe("hello.txt");
    const recycled = await request(app).post("/api/files/recycle").send({ path: "/hello.txt" }).expect(200);
    await request(app).post("/api/files/restore").send({ recycleId: recycled.body.data.recycleId }).expect(200);
    const download = await request(app).get("/api/files/download").query({ path: "/hello.txt" }).expect(200);
    expect(download.text).toBe("webbox");
    expect(download.headers["content-disposition"]).toMatch(/attachment/);
  });

  it("rejects unsafe abstract paths and filenames", async () => {
    const app = await createApp({ storageRoot, dataRoot, pluginRoot });
    await request(app).get("/api/files").query({ path: "/位置/个人空间/../secret" }).expect(400);
    await request(app).get("/api/files").query({ path: "C:/Windows" }).expect(400);
    await request(app).get("/api/files").query({ path: "\\\\server\\share" }).expect(400);
    await request(app).post("/api/files/folder").send({ path: "/位置/个人空间/CON" }).expect(400);
    await request(app).post("/api/files/rename").send({ path: "/位置/个人空间/a.txt", name: "bad/name.txt" }).expect(400);
  });

  it("persists explorer settings and returns the requested tree hierarchy without local roots", async () => {
    const app = await createApp({ storageRoot, dataRoot, pluginRoot });
    await request(app).put("/api/settings").send({
      explorer: { theme: "dark", language: "zh-CN", viewMode: "grid", iconSize: 96, sort: { key: "type", direction: "desc" }, searchHistoryLimit: 8 }
    }).expect(200);
    const settings = await request(app).get("/api/settings").expect(200);
    expect(settings.body.data.explorer.iconSize).toBe(96);
    expect(settings.body.data.explorer.sort).toEqual({ key: "type", direction: "desc" });

    const tree = await request(app).get("/api/tree").expect(200);
    expect(tree.body.data.map((node: { label: string }) => node.label)).toEqual(["位置", "工具", "网络挂载"]);
    expect(JSON.stringify(tree.body.data)).toContain("个人空间");
    expect(JSON.stringify(tree.body.data)).toContain("新增网络挂载");
    expect(JSON.stringify(tree.body.data)).not.toMatch(/[A-Z]:\\\\|本地磁盘|local-root/);
  });

  it("loads configured local network mounts and lists their files through abstract paths", async () => {
    const mountRoot = path.join(dataRoot, "mounted-data");
    await fs.mkdir(mountRoot, { recursive: true });
    await fs.writeFile(path.join(mountRoot, "mounted.txt"), "mounted", "utf8");
    const configFile = path.join(dataRoot, "server.conf");
    await fs.writeFile(configFile, `mount.local.docs=${mountRoot}\n`, "utf8");

    const app = await createApp({ storageRoot, dataRoot, pluginRoot, configFile });
    const tree = await request(app).get("/api/tree").expect(200);
    expect(JSON.stringify(tree.body.data)).toContain("docs");

    const mounts = await request(app).get("/api/files").query({ path: "/网络挂载" }).expect(200);
    expect(mounts.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "docs", path: "/网络挂载/docs", kind: "directory" })
    ]));

    const mountedList = await request(app).get("/api/files").query({ path: "/网络挂载/docs" }).expect(200);
    expect(mountedList.body.data[0]).toMatchObject({
      name: "mounted.txt",
      path: "/网络挂载/docs/mounted.txt",
      kind: "file"
    });
  });

  it("supports template creation, favorites, recent searches, and attachment downloads", async () => {
    const app = await createApp({ storageRoot, dataRoot, pluginRoot });
    await request(app).post("/api/files/template").send({ path: "/位置/个人空间/我的文档/readme.md", type: "md" }).expect(200);
    await request(app).post("/api/favorites").send({ path: "/位置/个人空间/我的文档", label: "我的文档" }).expect(200);
    const favorites = await request(app).get("/api/favorites").expect(200);
    expect(favorites.body.data[0].path).toBe("/位置/个人空间/我的文档");
    await request(app).post("/api/search/recent").send({ text: "readme", scope: "/位置/个人空间" }).expect(200);
    const recent = await request(app).get("/api/search/recent").expect(200);
    expect(recent.body.data[0].text).toBe("readme");
    const download = await request(app).get("/api/files/download").query({ path: "/位置/个人空间/我的文档/readme.md" }).expect(200);
    expect(download.headers["content-disposition"]).toMatch(/attachment/);
  });

  it("keeps abstract paths when listing and editing media library folders", async () => {
    const app = await createApp({ storageRoot, dataRoot, pluginRoot });

    await request(app).post("/api/files/folder").send({ path: "/位置/个人空间/我的相册/123" }).expect(200);
    const list = await request(app).get("/api/files").query({ path: "/位置/个人空间/我的相册" }).expect(200);
    expect(list.body.data[0]).toMatchObject({
      name: "123",
      path: "/位置/个人空间/我的相册/123",
      kind: "directory"
    });

    await request(app).post("/api/files/rename").send({ path: "/位置/个人空间/我的相册/123", name: "renamed" }).expect(200);
    const renamed = await request(app).get("/api/files/details").query({ path: "/位置/个人空间/我的相册/renamed" }).expect(200);
    expect(renamed.body.data.path).toBe("/位置/个人空间/我的相册/renamed");

    await request(app).post("/api/files/recycle").send({ path: "/位置/个人空间/我的相册/renamed" }).expect(200);
    const afterRecycle = await request(app).get("/api/files").query({ path: "/位置/个人空间/我的相册" }).expect(200);
    expect(afterRecycle.body.data).toEqual([]);
  });

  it("keeps ordinary personal-space folders inside the personal files root", async () => {
    const app = await createApp({ storageRoot, dataRoot, pluginRoot });

    await request(app).post("/api/files/folder").send({ path: "/位置/个人空间/普通目录" }).expect(200);
    await request(app).post("/api/files/text").send({ path: "/位置/个人空间/普通目录/a.txt", content: "alpha" }).expect(200);

    const personal = await request(app).get("/api/files").query({ path: "/位置/个人空间" }).expect(200);
    expect(personal.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "普通目录", path: "/位置/个人空间/普通目录", kind: "directory" })
    ]));

    const nested = await request(app).get("/api/files").query({ path: "/位置/个人空间/普通目录" }).expect(200);
    expect(nested.body.data[0]).toMatchObject({
      name: "a.txt",
      path: "/位置/个人空间/普通目录/a.txt",
      kind: "file"
    });
  });

  it("returns recursive size for directory details", async () => {
    const app = await createApp({ storageRoot, dataRoot, pluginRoot });

    await request(app).post("/api/files/folder").send({ path: "/位置/个人空间/普通目录" }).expect(200);
    await request(app).post("/api/files/text").send({ path: "/位置/个人空间/普通目录/a.txt", content: "12345" }).expect(200);
    await request(app).post("/api/files/text").send({ path: "/位置/个人空间/普通目录/sub/b.txt", content: "1234567" }).expect(200);

    const details = await request(app).get("/api/files/details").query({ path: "/位置/个人空间/普通目录" }).expect(200);
    expect(details.body.data).toMatchObject({
      path: "/位置/个人空间/普通目录",
      kind: "directory",
      size: 12
    });
  });

  it("shows personal-space shortcut folders and serves virtual favorites and recent documents", async () => {
    const app = await createApp({ storageRoot, dataRoot, pluginRoot });

    await request(app).post("/api/files/text").send({ path: "/位置/个人空间/我的文档/readme.md", content: "hello" }).expect(200);
    await request(app).post("/api/favorites").send({ path: "/位置/个人空间/我的文档/readme.md", label: "readme.md" }).expect(200);

    const personal = await request(app).get("/api/files").query({ path: "/位置/个人空间" }).expect(200);
    expect(personal.body.data.map((item: { path: string }) => item.path)).toEqual(expect.arrayContaining([
      "/位置/个人空间/私密保险箱",
      "/位置/个人空间/我的相册",
      "/位置/个人空间/我的文档",
      "/位置/个人空间/我的音乐",
      "/位置/个人空间/我的视频"
    ]));

    const favorites = await request(app).get("/api/files").query({ path: "/位置/收藏夹" }).expect(200);
    expect(favorites.body.data[0]).toMatchObject({ name: "readme.md", path: "/位置/个人空间/我的文档/readme.md" });

    const recent = await request(app).get("/api/files").query({ path: "/工具/最近文档" }).expect(200);
    expect(recent.body.data[0]).toMatchObject({ name: "readme.md", path: "/位置/个人空间/我的文档/readme.md" });
  });

  it("separates browser open from attachment download", async () => {
    const app = await createApp({ storageRoot, dataRoot, pluginRoot });

    await request(app).post("/api/files/text").send({ path: "/位置/个人空间/我的文档/open.txt", content: "inline" }).expect(200);
    const open = await request(app).get("/api/files/open").query({ path: "/位置/个人空间/我的文档/open.txt" }).expect(200);
    expect(open.text).toBe("inline");
    expect(open.headers["content-disposition"] ?? "").not.toMatch(/attachment/);

    const download = await request(app).get("/api/files/download").query({ path: "/位置/个人空间/我的文档/open.txt" }).expect(200);
    expect(download.headers["content-disposition"]).toMatch(/attachment/);
  });

  it("zips and unzips files addressed by abstract paths", async () => {
    const app = await createApp({ storageRoot, dataRoot, pluginRoot });

    await request(app).post("/api/files/text").send({ path: "/位置/个人空间/我的文档/a.txt", content: "zip me" }).expect(200);
    const zipped = await request(app).post("/api/files/zip").send({
      paths: ["/位置/个人空间/我的文档/a.txt"],
      target: "/位置/个人空间/我的文档/archive.zip"
    }).expect(200);
    expect(zipped.body.data.path).toBe("/位置/个人空间/我的文档/archive.zip");

    await request(app).post("/api/files/unzip").send({
      path: "/位置/个人空间/我的文档/archive.zip",
      targetDir: "/位置/个人空间/我的文档/unpacked"
    }).expect(200);
    const unpacked = await request(app).get("/api/files/details").query({ path: "/位置/个人空间/我的文档/unpacked/a.txt" }).expect(200);
    expect(unpacked.body.data.name).toBe("a.txt");
  });

  it("returns webbox tree, storage config, notifications, and safe-box routes", async () => {
    const app = await createApp({ storageRoot, dataRoot, pluginRoot });
    const bootstrap = await request(app).get("/api/bootstrap").expect(200);
    expect(collectTreeLabels(bootstrap.body.data.tree))
      .toEqual(expect.arrayContaining(["收藏夹", "个人空间", "最近文档", "我的相册", "我的文档", "我的音乐", "我的视频", "私密保险箱", "回收站"]));

    const storage = await request(app).get("/api/admin/storage").expect(200);
    expect(storage.body.data.personal).toBe(storageRoot);

    expect((await request(app).get("/api/safe-box/status").expect(200)).body.data.state).toBe("notOpen");
    await request(app).post("/api/safe-box/open").send({ password: "secret" }).expect(200);
    await request(app).post("/api/safe-box/logout").send({}).expect(200);
    expect((await request(app).get("/api/safe-box/status").expect(200)).body.data.state).toBe("locked");
    await request(app).post("/api/safe-box/login").send({ password: "secret" }).expect(200);

    await request(app).post("/api/files/text").send({ path: "/notice.txt", content: "notice" }).expect(200);
    await request(app).post("/api/files/recycle").send({ path: "/notice.txt" }).expect(200);
    const notifications = await request(app).get("/api/notifications").expect(200);
    expect(notifications.body.data[0].message).toContain("notice.txt");
  });

  it("stores properties, memos, and directory activity", async () => {
    const app = await createApp({ storageRoot, dataRoot, pluginRoot });
    await request(app).post("/api/files/text").send({ path: "/docs/a.txt", content: "a" }).expect(200);
    await request(app).post("/api/metadata/properties").send({ path: "/docs/a.txt", description: "重要", tags: ["work"] }).expect(200);
    const properties = await request(app).get("/api/metadata/properties").query({ path: "/docs/a.txt" }).expect(200);
    expect(properties.body.data.tags).toEqual(["work"]);

    await request(app).post("/api/metadata/memos").send({ path: "/docs", content: "memo **markdown** 😀" }).expect(200);
    const memos = await request(app).get("/api/metadata/memos").query({ path: "/docs" }).expect(200);
    expect(memos.body.data[0].content).toContain("markdown");

    const activity = await request(app).get("/api/metadata/activity").query({ path: "/docs" }).expect(200);
    expect(activity.body.data.some((item: { path: string }) => item.path === "/docs/a.txt")).toBe(true);
  });

  it("does not expose removed share, desktop, user, or history routes", async () => {
    const app = await createApp({ storageRoot, dataRoot, pluginRoot });
    await request(app).get("/api/share").expect(404);
    await request(app).get("/api/desktop").expect(404);
    await request(app).get("/api/users").expect(404);
    await request(app).get("/api/history").expect(404);
  });

  it("writes request and file operation logs to the configured log file", async () => {
    const logFile = path.join(dataRoot, "webbox.log");
    const app = await createApp({ storageRoot, dataRoot, pluginRoot, logFile });

    await request(app).get("/api/files").query({ path: "/" }).expect(200);

    const logText = await fs.readFile(logFile, "utf8");
    expect(logText).toContain("GET /api/files");
    expect(logText).toContain("file.list");
    expect(logText).toContain(zhCN.server.logs.requestComplete);
  });
});
