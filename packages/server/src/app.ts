import express from "express";
import type { Express } from "express";
import path from "node:path";
import fs from "node:fs/promises";
import cors from "cors";
import { fail, ok, zhCN } from "@webbox/shared";
import { discoverPlugins } from "@webbox/plugin-compat";
import { loadConfig, type WebboxConfig } from "./config.js";
import { FileService } from "./fileService.js";
import { MetadataStore } from "./metadataStore.js";
import { mountFileRoutes } from "./routes.js";
import { mountPluginRoutes } from "./pluginRoutes.js";
import { createLogger, requestLogger, type WebboxLogger } from "./logger.js";

export interface CreateAppOptions extends Partial<WebboxConfig> {
  logger?: WebboxLogger;
}

export async function createApp(overrides: CreateAppOptions = {}): Promise<Express> {
  const { logger: providedLogger, ...configOverrides } = overrides;
  const config = loadConfig(configOverrides);
  const logger = providedLogger ?? createLogger({ logFile: config.logFile });
  const metadata = new MetadataStore(path.join(config.dataRoot, "metadata.json"));
  const files = new FileService(config.storageRoot, config.dataRoot);
  const app = express();

  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "8mb" }));
  app.use(requestLogger(logger));

  app.get("/api/bootstrap", async (_req, res) => {
    logger.info("bootstrap.load", { message: zhCN.server.logs.bootstrap });
    const state = await metadata.load();
    const plugins = await discoverPlugins(config.pluginRoot, state.plugins);
    logger.info("plugin.discover", { message: zhCN.server.logs.plugins, count: plugins.length });
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
      plugins
    }));
  });

  mountFileRoutes(app, files, logger);
  mountPluginRoutes(app, config.pluginRoot, metadata, logger);

  app.use(express.static(config.webDist, { fallthrough: true }));
  app.get("*", async (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    const indexPath = path.join(config.webDist, "index.html");
    try {
      await fs.access(indexPath);
      res.sendFile(indexPath);
    } catch {
      res.type("html").send(`<!doctype html><title>Webbox</title><div id="root">${zhCN.server.fallbackHtml}</div>`);
    }
  });

  app.use((_req, res) => res.status(404).json(fail("PATH_NOT_FOUND", zhCN.server.errors.routeNotFound)));
  return app;
}
