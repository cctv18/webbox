import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { zhCN } from "@webbox/shared";
import { createApp } from "../src/app.js";

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
