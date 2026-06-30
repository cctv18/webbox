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
