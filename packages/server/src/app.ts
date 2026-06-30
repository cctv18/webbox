import express from "express";
import type { Express } from "express";
import path from "node:path";
import fs from "node:fs/promises";
import cors from "cors";
import { fail, ok, zhCN } from "@webbox/shared";
import { discoverPlugins } from "@webbox/plugin-compat";
import { loadConfig, type WebboxConfig } from "./config.js";
import { readServerConf, updateServerConfValue } from "./configFile.js";
import { ActivityStore } from "./activityStore.js";
import { FileService } from "./fileService.js";
import { defaultStorageConfig, LibraryService } from "./libraryService.js";
import { MetadataStore } from "./metadataStore.js";
import { NotificationService } from "./notificationService.js";
import { SafeBoxService } from "./safeBoxService.js";
import { mountFileRoutes } from "./routes.js";
import { mountPluginRoutes } from "./pluginRoutes.js";
import { WatchService } from "./watchService.js";
import { WorkspaceService } from "./workspaceService.js";
import { PathResolver } from "./pathResolver.js";
import { SettingsStore } from "./settingsStore.js";
import { createLogger, requestLogger, type WebboxLogger } from "./logger.js";

export interface CreateAppOptions extends Partial<WebboxConfig> {
  logger?: WebboxLogger;
  disableWatcher?: boolean;
}

export async function createApp(overrides: CreateAppOptions = {}): Promise<Express> {
  const { logger: providedLogger, disableWatcher, ...configOverrides } = overrides;
  const config = loadConfig(configOverrides);
  const logger = providedLogger ?? createLogger({ logFile: config.logFile });
  const metadata = new MetadataStore(path.join(config.dataRoot, "metadata.json"));
  const conf = config.configFile ? await readServerConf(config.configFile) : {};
  const storageDefaults = {
    ...defaultStorageConfig(config.dataRoot),
    personal: conf["storage-root"] ?? config.storageRoot,
    photos: conf["photos-root"],
    documents: conf["documents-root"],
    music: conf["music-root"],
    videos: conf["videos-root"],
    safeBox: conf["safe-root"],
    recycle: conf["recycle-root"]
  };
  const library = new LibraryService(storageDefaults, config.dataRoot, async (next) => {
    if (!config.configFile) return;
    await updateServerConfValue(config.configFile, "storage-root", next.personal);
    await updateServerConfValue(config.configFile, "photos-root", next.photos);
    await updateServerConfValue(config.configFile, "documents-root", next.documents);
    await updateServerConfValue(config.configFile, "music-root", next.music);
    await updateServerConfValue(config.configFile, "videos-root", next.videos);
    await updateServerConfValue(config.configFile, "safe-root", next.safeBox);
    await updateServerConfValue(config.configFile, "recycle-root", next.recycle);
  });
  await library.ensureAll();
  const storage = library.getConfig();
  const files = new FileService(storage.personal, config.dataRoot);
  const fileSpaces = {
    personal: files,
    photos: new FileService(storage.photos, config.dataRoot),
    documents: new FileService(storage.documents, config.dataRoot),
    music: new FileService(storage.music, config.dataRoot),
    videos: new FileService(storage.videos, config.dataRoot),
    safe: new FileService(storage.safeBox, config.dataRoot)
  };
  const activity = new ActivityStore(path.join(config.dataRoot, "activity.json"));
  const notifications = new NotificationService(metadata);
  const safeBox = new SafeBoxService(metadata, storage.safeBox);
  const workspace = new WorkspaceService(storage, safeBox);
  const resolver = new PathResolver();
  const settings = new SettingsStore(config.dataRoot);
  const watcher = new WatchService([storage.personal, storage.photos, storage.documents, storage.music, storage.videos, storage.safeBox], logger, async (event) => {
    await notifications.add({ title: zhCN.server.logs.watcher, message: event.message, level: "info", targetPath: event.path });
  });
  if (!disableWatcher && process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") watcher.start();
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
      plugins,
      tree: await workspace.tree(),
      storage: library.getConfig(),
      notifications: await notifications.list()
    }));
  });

  mountFileRoutes(app, files, logger, { activity, fileSpaces, library, metadata, notifications, resolver, safeBox, settings, watcher, workspace });
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
