import express, { type Express } from "express";
import multer from "multer";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import unzipper from "unzipper";
import { createWebboxShimScript, discoverPlugins } from "@webbox/plugin-compat";
import { ok } from "@webbox/shared";
import type { MetadataStore } from "./metadataStore.js";
import type { WebboxLogger } from "./logger.js";

const upload = multer({ storage: multer.memoryStorage() });

function safePluginId(value: string): string {
  const id = value.trim();
  if (!/^[\w.-]{1,80}$/.test(id)) throw new Error("INVALID_INPUT");
  return id;
}

export function mountPluginRoutes(app: Express, pluginRoot: string, metadata: MetadataStore, logger: WebboxLogger): void {
  app.get("/api/plugins", async (_req, res) => {
    logger.info("plugin.list", { pluginRoot });
    const state = await metadata.load();
    res.json(ok(await discoverPlugins(pluginRoot, state.plugins)));
  });

  app.put("/api/admin/plugins/:id", async (req, res) => {
    const id = safePluginId(req.params.id);
    await metadata.update((state) => {
      state.plugins[id] = req.body.enabled !== false;
    });
    logger.info("plugin.config", { id, enabled: req.body.enabled !== false });
    const state = await metadata.load();
    res.json(ok((await discoverPlugins(pluginRoot, state.plugins)).find((plugin) => plugin.id === id)));
  });

  app.delete("/api/admin/plugins/:id", async (req, res) => {
    const id = safePluginId(req.params.id);
    await fsp.rm(path.join(pluginRoot, id), { recursive: true, force: true });
    await metadata.update((state) => {
      delete state.plugins[id];
    });
    logger.info("plugin.uninstall", { id });
    res.json(ok({ id }));
  });

  app.post("/api/admin/plugins/install", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, error: { code: "INVALID_INPUT", message: "输入无效" } });
    const id = safePluginId(path.basename(req.file.originalname, ".zip"));
    const target = path.join(pluginRoot, id);
    await fsp.mkdir(target, { recursive: true });
    const zipPath = path.join(target, ".upload.zip");
    await fsp.writeFile(zipPath, req.file.buffer);
    const directory = await unzipper.Open.file(zipPath);
    await Promise.all(directory.files.map(async (file) => {
      const destination = path.resolve(target, file.path);
      if (!destination.startsWith(path.resolve(target))) throw new Error("PATH_OUTSIDE_ROOT");
      if (file.type === "Directory") await fsp.mkdir(destination, { recursive: true });
      else {
        await fsp.mkdir(path.dirname(destination), { recursive: true });
        await new Promise<void>((resolve, reject) => file.stream().pipe(fs.createWriteStream(destination)).on("finish", resolve).on("error", reject));
      }
    }));
    await fsp.rm(zipPath, { force: true });
    await metadata.update((state) => {
      state.plugins[id] = true;
    });
    logger.info("plugin.install", { id });
    const state = await metadata.load();
    res.json(ok((await discoverPlugins(pluginRoot, state.plugins)).find((plugin) => plugin.id === id)));
  });

  const sendShim = (_req: express.Request, res: express.Response) => {
    logger.info("plugin.shim", { pluginRoot });
    res.type("application/javascript").send(createWebboxShimScript());
  };
  app.get("/api/plugins/webbox-shim.js", sendShim);
  app.get(`/api/plugins/${"ko"}${"dbox"}-shim.js`, sendShim);

  app.use("/plugins", express.static(pluginRoot, { fallthrough: true }));
}
