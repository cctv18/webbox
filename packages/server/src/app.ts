import express from "express";
import type { Express } from "express";
import path from "node:path";
import fs from "node:fs/promises";
import cors from "cors";
import { fail, ok } from "@webbox/shared";
import { discoverPlugins } from "@webbox/plugin-compat";
import { loadConfig, type WebboxConfig } from "./config.js";
import { FileService } from "./fileService.js";
import { MetadataStore } from "./metadataStore.js";
import { mountFileRoutes } from "./routes.js";
import { mountPluginRoutes } from "./pluginRoutes.js";

export async function createApp(overrides: Partial<WebboxConfig> = {}): Promise<Express> {
  const config = loadConfig(overrides);
  const metadata = new MetadataStore(path.join(config.dataRoot, "metadata.json"));
  const files = new FileService(config.storageRoot, config.dataRoot);
  const app = express();

  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "8mb" }));

  app.get("/api/bootstrap", async (_req, res) => {
    const state = await metadata.load();
    res.json(ok({
      user: { id: "local", name: "Local User", isAdmin: true, permissions: ["*"] },
      features: {
        login: false,
        users: false,
        permissions: false,
        departments: false,
        share: false,
        desktop: false,
        history: false,
        client: false,
        phpStatus: false
      },
      theme: state.theme,
      language: state.language,
      plugins: await discoverPlugins(config.pluginRoot, state.plugins)
    }));
  });

  mountFileRoutes(app, files);
  mountPluginRoutes(app, config.pluginRoot, metadata);

  app.use(express.static(config.webDist, { fallthrough: true }));
  app.get("*", async (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    const indexPath = path.join(config.webDist, "index.html");
    try {
      await fs.access(indexPath);
      res.sendFile(indexPath);
    } catch {
      res.type("html").send("<!doctype html><title>Webbox</title><div id=\"root\">Webbox server is running. Build the web app to enable the UI.</div>");
    }
  });

  app.use((_req, res) => res.status(404).json(fail("PATH_NOT_FOUND", "Route not found")));
  return app;
}
