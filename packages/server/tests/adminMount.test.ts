import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

describe("admin and mount routes", () => {
  let dataRoot: string;
  let storageRoot: string;
  let pluginRoot: string;

  beforeEach(async () => {
    const testRoot = path.join(process.cwd(), ".webbox-test-data");
    await fs.mkdir(testRoot, { recursive: true });
    dataRoot = await fs.mkdtemp(path.join(testRoot, "admin-data-"));
    storageRoot = path.join(dataRoot, "files");
    pluginRoot = path.join(dataRoot, "plugins");
  });

  afterEach(async () => {
    await fs.rm(dataRoot, { recursive: true, force: true });
  });

  it("returns the full admin overview and persists admin settings under .config", async () => {
    const app = await createApp({ storageRoot, dataRoot, pluginRoot });
    await request(app).post("/api/files/text").send({ path: "/a.txt", content: "hello" }).expect(200);
    await request(app).get("/api/files/download").query({ path: "/a.txt" }).expect(200);

    const overview = await request(app)
      .get("/api/admin/overview")
      .set("user-agent", "vitest-agent")
      .set("accept-language", "en-US")
      .expect(200);
    expect(overview.body.data.storage.totalBytes).toBeGreaterThanOrEqual(5);
    expect(overview.body.data.serverInfo).toEqual(expect.objectContaining({
      platform: expect.any(String),
      hostname: expect.any(String),
      serverTime: expect.any(String),
      uptimeSeconds: expect.any(Number)
    }));
    expect(overview.body.data.clientInfo.userAgent).toBe("vitest-agent");
    expect(overview.body.data.visits24h).toEqual(expect.objectContaining({
      fileCreateCount: expect.any(Number),
      fileDownloadCount: expect.any(Number)
    }));

    const saved = await request(app).put("/api/admin/settings").send({
      upload: { chunkSizeMb: 16, concurrency: 5, ignorePatterns: ["*.tmp"], retryCount: 4 },
      download: { speedLimitKb: 512, frontendZip: false, backendZipSizeLimitMb: 2048 },
      explorer: { theme: "dark", language: "en-US" },
      notifications: { enabled: true, maxItems: 50 }
    }).expect(200);
    expect(saved.body.data.upload.chunkSizeMb).toBe(16);
    expect(saved.body.data.explorer.language).toBe("en-US");

    const raw = await fs.readFile(path.join(dataRoot, ".config", "settings.json"), "utf8");
    expect(raw).toContain("\"chunkSizeMb\": 16");
    expect(raw).toContain("\"language\": \"en-US\"");
  });

  it("creates, lists, deletes, restores, and schedules backups", async () => {
    const app = await createApp({ storageRoot, dataRoot, pluginRoot });
    await request(app).post("/api/files/text").send({ path: "/backup.txt", content: "backup" }).expect(200);

    const created = await request(app).post("/api/admin/backups").send({
      name: "manual-test",
      include: { settings: true, data: ["personal"], plugins: true }
    }).expect(200);
    expect(created.body.data.name).toBe("manual-test.zip");

    const list = await request(app).get("/api/admin/backups").expect(200);
    expect(list.body.data.items[0]).toEqual(expect.objectContaining({ name: "manual-test.zip", size: expect.any(Number) }));

    const schedule = await request(app).post("/api/admin/backups/schedules").send({
      name: "daily",
      cron: "0 2 * * *",
      include: { settings: true, data: ["personal"], plugins: false }
    }).expect(200);
    expect(schedule.body.data.name).toBe("daily");

    await request(app).post("/api/admin/backups/restore").send({ name: "manual-test.zip" }).expect(200);
    await request(app).delete("/api/admin/backups").send({ names: ["manual-test.zip"] }).expect(200);
    expect((await request(app).get("/api/admin/backups").expect(200)).body.data.items).toEqual([]);
  });

  it("filters operation logs and exports an excel-compatible file", async () => {
    const app = await createApp({ storageRoot, dataRoot, pluginRoot });
    await request(app).post("/api/files/text").send({ path: "/log.txt", content: "log" }).expect(200);

    const logs = await request(app).get("/api/admin/logs").query({ range: "today" }).expect(200);
    expect(logs.body.data.items.some((item: { action: string }) => item.action === "file.writeText")).toBe(true);

    const exported = await request(app).get("/api/admin/logs/export").query({ range: "today" }).expect(200);
    expect(exported.headers["content-type"]).toMatch(/spreadsheet|csv|octet-stream/);
    expect(exported.headers["content-disposition"]).toMatch(/operation-logs/);
  });

  it("persists ftp and webdav mount CRUD and exposes them in the tree", async () => {
    const app = await createApp({ storageRoot, dataRoot, pluginRoot });

    const ftp = await request(app).post("/api/mounts").send({
      type: "ftp",
      host: "ftp.example.test",
      port: 21,
      name: "ftp-docs",
      mode: "passive",
      username: "tester",
      password: "secret",
      encoding: "utf8"
    }).expect(200);
    expect(ftp.body.data).toEqual(expect.objectContaining({ type: "ftp", name: "ftp-docs" }));

    const webdav = await request(app).post("/api/mounts").send({
      type: "webdav",
      host: "dav.example.test",
      port: 443,
      https: true,
      username: "tester",
      password: "secret"
    }).expect(200);
    expect(webdav.body.data.name).toBe("dav.example.test");

    await request(app).put(`/api/mounts/${ftp.body.data.id}`).send({ name: "ftp-renamed" }).expect(200);
    const mounts = await request(app).get("/api/mounts").expect(200);
    expect(mounts.body.data.map((mount: { name: string }) => mount.name)).toEqual(expect.arrayContaining(["ftp-renamed", "dav.example.test"]));

    const tree = await request(app).get("/api/tree").expect(200);
    expect(JSON.stringify(tree.body.data)).toContain("ftp-renamed");
    expect(JSON.stringify(tree.body.data)).toContain("新增网络挂载");

    const persisted = await fs.readFile(path.join(dataRoot, ".config", "mounts.json"), "utf8");
    expect(persisted).toContain("ftp-renamed");
    expect(persisted).not.toContain("secret");

    await request(app).delete(`/api/mounts/${webdav.body.data.id}`).expect(200);
    expect((await request(app).get("/api/mounts").expect(200)).body.data.map((mount: { id: string }) => mount.id)).not.toContain(webdav.body.data.id);
  });

  it("updates memo bindings when a bound path is renamed", async () => {
    const app = await createApp({ storageRoot, dataRoot, pluginRoot });
    await request(app).post("/api/files/folder").send({ path: "/位置/个人空间/docs" }).expect(200);
    await request(app).post("/api/metadata/memos").send({ path: "/位置/个人空间/docs", content: "bound" }).expect(200);

    await request(app).post("/api/files/rename").send({ path: "/位置/个人空间/docs", name: "renamed" }).expect(200);
    const memos = await request(app).get("/api/metadata/memos").query({ path: "/位置/个人空间/renamed" }).expect(200);
    expect(memos.body.data[0]).toEqual(expect.objectContaining({ content: "bound", path: "/位置/个人空间/renamed" }));
  });
});
