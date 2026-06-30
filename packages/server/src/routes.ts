import type { Express } from "express";
import multer from "multer";
import path from "node:path";
import { fail, ok, zhCN, type AdminStorageConfig, type PathMetadata } from "@webbox/shared";
import type { ActivityStore } from "./activityStore.js";
import { FileService } from "./fileService.js";
import type { LibraryService } from "./libraryService.js";
import type { WebboxLogger } from "./logger.js";
import type { MetadataStore } from "./metadataStore.js";
import type { NotificationService } from "./notificationService.js";
import type { SafeBoxService } from "./safeBoxService.js";
import type { WatchService } from "./watchService.js";
import type { WorkspaceService } from "./workspaceService.js";

const upload = multer({ storage: multer.memoryStorage() });

export interface RouteServices {
  activity?: ActivityStore;
  fileSpaces?: Record<string, FileService>;
  library?: LibraryService;
  metadata?: MetadataStore;
  notifications?: NotificationService;
  safeBox?: SafeBoxService;
  watcher?: WatchService;
  workspace?: WorkspaceService;
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : zhCN.server.errors.operationFailed;
  if (message === "PATH_OUTSIDE_ROOT") return fail("PATH_OUTSIDE_ROOT", zhCN.server.errors.pathOutsideRoot);
  if (message === "INVALID_INPUT") return fail("INVALID_INPUT", zhCN.server.errors.invalidInput);
  if (message === "PATH_NOT_FOUND" || message.includes("ENOENT")) return fail("PATH_NOT_FOUND", zhCN.server.errors.pathNotFound);
  if (message.includes("EEXIST")) return fail("DUPLICATE_NAME", zhCN.server.errors.duplicateName);
  if (message === "SAFE_BOX_LOCKED") return fail("SAFE_BOX_LOCKED", zhCN.server.errors.safeBoxLocked);
  if (message === "ERROR_USER_PASSWORD_ERROR") return fail("AUTH_FAILED", zhCN.safeBox.loginFailed);
  if (message === zhCN.server.errors.targetNotEmpty) return fail("TARGET_NOT_EMPTY", zhCN.server.errors.targetNotEmpty);
  return fail("FILESYSTEM_DENIED", message);
}

function logFailure(logger: WebboxLogger, event: string, error: unknown, details: Record<string, unknown>) {
  logger.warn(`${event}.failed`, {
    message: zhCN.server.logs.fileOperationFailed,
    error: error instanceof Error ? error.message : String(error),
    ...details
  });
}

async function record(services: RouteServices | undefined, action: string, filePath: string, message: string): Promise<void> {
  await services?.activity?.append({ action, path: filePath, message });
}

function serviceFor(req: { query?: { space?: unknown }; body?: { space?: unknown } }, fallback: FileService, services: RouteServices): FileService {
  const space = String(req.query?.space ?? req.body?.space ?? "personal");
  return services.fileSpaces?.[space] ?? fallback;
}

export function mountFileRoutes(app: Express, files: FileService, logger: WebboxLogger, services: RouteServices = {}): void {
  app.get("/api/files", async (req, res) => {
    const requestedPath = String(req.query.path ?? "/");
    const activeFiles = serviceFor(req, files, services);
    logger.info("file.list", { path: requestedPath });
    try {
      res.json(ok(await activeFiles.list(requestedPath)));
    } catch (error) {
      logFailure(logger, "file.list", error, { path: requestedPath });
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/folder", async (req, res) => {
    const folderPath = String(req.body.path);
    const activeFiles = serviceFor(req, files, services);
    logger.info("file.mkdir", { path: folderPath });
    try {
      await activeFiles.mkdir(folderPath);
      await record(services, "file.mkdir", folderPath, "新建文件夹");
      res.json(ok({ path: req.body.path }));
    } catch (error) {
      logFailure(logger, "file.mkdir", error, { path: folderPath });
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/text", async (req, res) => {
    const filePath = String(req.body.path);
    const activeFiles = serviceFor(req, files, services);
    logger.info("file.writeText", { path: filePath });
    try {
      await activeFiles.writeText(filePath, String(req.body.content ?? ""));
      await record(services, "file.writeText", filePath, "写入文件");
      res.json(ok({ path: req.body.path }));
    } catch (error) {
      logFailure(logger, "file.writeText", error, { path: filePath });
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/rename", async (req, res) => {
    const filePath = String(req.body.path);
    const name = String(req.body.name);
    const activeFiles = serviceFor(req, files, services);
    logger.info("file.rename", { path: filePath, name });
    try {
      await activeFiles.rename(filePath, name);
      await record(services, "file.rename", filePath, "重命名文件");
      res.json(ok({ path: req.body.path, name: req.body.name }));
    } catch (error) {
      logFailure(logger, "file.rename", error, { path: filePath, name });
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/copy", async (req, res) => {
    const source = String(req.body.source);
    const target = String(req.body.target);
    const activeFiles = serviceFor(req, files, services);
    logger.info("file.copy", { source, target });
    try {
      await activeFiles.copy(source, target);
      await record(services, "file.copy", target, "复制文件");
      res.json(ok({ target: req.body.target }));
    } catch (error) {
      logFailure(logger, "file.copy", error, { source, target });
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/move", async (req, res) => {
    const source = String(req.body.source);
    const target = String(req.body.target);
    const activeFiles = serviceFor(req, files, services);
    logger.info("file.move", { source, target });
    try {
      await activeFiles.move(source, target);
      await record(services, "file.move", target, "移动文件");
      res.json(ok({ target: req.body.target }));
    } catch (error) {
      logFailure(logger, "file.move", error, { source, target });
      res.status(400).json(routeError(error));
    }
  });

  app.delete("/api/files", async (req, res) => {
    const filePath = String(req.body.path);
    const activeFiles = serviceFor(req, files, services);
    logger.info("file.delete", { path: filePath });
    try {
      await activeFiles.remove(filePath);
      await record(services, "file.delete", filePath, "删除文件");
      res.json(ok({ path: req.body.path }));
    } catch (error) {
      logFailure(logger, "file.delete", error, { path: filePath });
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/recycle", async (req, res) => {
    const filePath = String(req.body.path);
    const activeFiles = serviceFor(req, files, services);
    logger.info("file.recycle", { path: filePath });
    try {
      const result = await activeFiles.recycle(filePath);
      await record(services, "file.recycle", filePath, "删除到回收站");
      await services.notifications?.add({ title: zhCN.fileManager.recycleBin, message: `${filePath} 已移入回收站`, level: "info", targetPath: filePath });
      res.json(ok(result));
    } catch (error) {
      logFailure(logger, "file.recycle", error, { path: filePath });
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/restore", async (req, res) => {
    const recycleId = String(req.body.recycleId);
    logger.info("file.restore", { recycleId });
    try {
      const result = await files.restore(recycleId);
      await record(services, "file.restore", result.path, "从回收站恢复");
      res.json(ok(result));
    } catch (error) {
      logFailure(logger, "file.restore", error, { recycleId });
      res.status(400).json(routeError(error));
    }
  });

  app.get("/api/files/search", async (req, res) => {
    const query = String(req.query.q ?? "");
    const searchPath = String(req.query.path ?? "/");
    logger.info("file.search", { path: searchPath, query });
    try {
      res.json(ok(await serviceFor(req, files, services).search(query, searchPath)));
    } catch (error) {
      logFailure(logger, "file.search", error, { path: searchPath, query });
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/zip", async (req, res) => {
    const target = String(req.body.target);
    const activeFiles = serviceFor(req, files, services);
    logger.info("file.zip", { target, count: Array.isArray(req.body.paths) ? req.body.paths.length : 0 });
    try {
      res.json(ok(await activeFiles.zip(req.body.paths ?? [], target)));
    } catch (error) {
      logFailure(logger, "file.zip", error, { target });
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/unzip", async (req, res) => {
    const filePath = String(req.body.path);
    const targetDir = String(req.body.targetDir);
    const activeFiles = serviceFor(req, files, services);
    logger.info("file.unzip", { path: filePath, targetDir });
    try {
      res.json(ok(await activeFiles.unzip(filePath, targetDir)));
    } catch (error) {
      logFailure(logger, "file.unzip", error, { path: filePath, targetDir });
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/upload", upload.single("file"), async (req, res) => {
    const dir = String(req.query.path ?? "/");
    const activeFiles = serviceFor(req, files, services);
    logger.info("file.upload", { path: dir, name: req.file?.originalname });
    try {
      if (!req.file) throw new Error("INVALID_INPUT");
      await activeFiles.writeBuffer(path.posix.join(dir.replace(/\\/g, "/"), req.file.originalname), req.file.buffer);
      await record(services, "file.upload", path.posix.join(dir.replace(/\\/g, "/"), req.file.originalname), "上传文件");
      await services.notifications?.add({ title: zhCN.fileManager.uploadDone, message: req.file.originalname, level: "success", targetPath: dir });
      res.json(ok({ name: req.file.originalname }));
    } catch (error) {
      logFailure(logger, "file.upload", error, { path: dir, name: req.file?.originalname });
      res.status(400).json(routeError(error));
    }
  });

  app.get("/api/files/download", async (req, res) => {
    const filePath = String(req.query.path ?? "/");
    const activeFiles = serviceFor(req, files, services);
    logger.info("file.download", { path: filePath });
    try {
      const absolute = activeFiles.getAbsolutePath(filePath);
      res.sendFile(absolute);
    } catch (error) {
      logFailure(logger, "file.download", error, { path: filePath });
      res.status(400).json(routeError(error));
    }
  });

  app.get("/api/files/details", async (req, res) => {
    const filePath = String(req.query.path ?? "/");
    const activeFiles = serviceFor(req, files, services);
    logger.info("file.details", { path: filePath });
    try {
      const details = await activeFiles.details(filePath);
      const state = await services.metadata?.load();
      const metadata = state?.pathMetadata[filePath];
      if (metadata) {
        details.tags = metadata.tags;
        details.description = metadata.description;
      }
      res.json(ok(details));
    } catch (error) {
      logFailure(logger, "file.details", error, { path: filePath });
      res.status(400).json(routeError(error));
    }
  });

  app.get("/api/recycle", async (_req, res) => {
    logger.info("recycle.list", {});
    try {
      res.json(ok(await files.listRecycle()));
    } catch (error) {
      logFailure(logger, "recycle.list", error, {});
      res.status(400).json(routeError(error));
    }
  });

  app.delete("/api/recycle/:id", async (req, res) => {
    logger.info("recycle.delete", { recycleId: req.params.id });
    try {
      await files.removeRecycle(req.params.id);
      res.json(ok({ recycleId: req.params.id }));
    } catch (error) {
      logFailure(logger, "recycle.delete", error, { recycleId: req.params.id });
      res.status(400).json(routeError(error));
    }
  });

  app.delete("/api/recycle", async (_req, res) => {
    logger.info("recycle.clear", {});
    try {
      await files.clearRecycle();
      res.json(ok({ cleared: true }));
    } catch (error) {
      logFailure(logger, "recycle.clear", error, {});
      res.status(400).json(routeError(error));
    }
  });

  app.get("/api/tree", async (_req, res) => {
    if (!services.workspace) return res.json(ok([]));
    res.json(ok(await services.workspace.tree()));
  });

  app.get("/api/events", (req, res) => {
    logger.info("events.connect", { ip: req.ip });
    if (!services.watcher) {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      res.write("\n");
      return;
    }
    services.watcher.addClient(res);
  });

  app.get("/api/safe-box/status", async (_req, res) => {
    if (!services.safeBox) return res.status(404).json(fail("PATH_NOT_FOUND", zhCN.server.errors.routeNotFound));
    res.json(ok(await services.safeBox.status()));
  });

  app.post("/api/safe-box/open", async (req, res) => {
    try {
      res.json(ok(await services.safeBox?.open(String(req.body.password ?? ""))));
    } catch (error) {
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/safe-box/login", async (req, res) => {
    try {
      res.json(ok(await services.safeBox?.login(String(req.body.password ?? ""))));
    } catch (error) {
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/safe-box/logout", (_req, res) => {
    services.safeBox?.logout();
    res.json(ok({ state: "locked" }));
  });

  app.post("/api/safe-box/password", async (req, res) => {
    try {
      res.json(ok(await services.safeBox?.changePassword(String(req.body.oldPassword ?? ""), String(req.body.password ?? ""))));
    } catch (error) {
      res.status(400).json(routeError(error));
    }
  });

  app.get("/api/notifications", async (_req, res) => {
    res.json(ok(await services.notifications?.list() ?? []));
  });

  app.post("/api/notifications/:id/read", async (req, res) => {
    await services.notifications?.markRead(req.params.id);
    res.json(ok({ id: req.params.id }));
  });

  app.post("/api/notifications/read-all", async (_req, res) => {
    await services.notifications?.markAllRead();
    res.json(ok({ read: true }));
  });

  app.delete("/api/notifications", async (_req, res) => {
    await services.notifications?.clear();
    res.json(ok({ cleared: true }));
  });

  app.get("/api/metadata/activity", async (req, res) => {
    res.json(ok(await services.activity?.query(String(req.query.path ?? "/")) ?? []));
  });

  app.get("/api/metadata/properties", async (req, res) => {
    const filePath = String(req.query.path ?? "/");
    const state = await services.metadata?.load();
    res.json(ok(state?.pathMetadata[filePath] ?? { path: filePath, description: "", tags: [] }));
  });

  app.post("/api/metadata/properties", async (req, res) => {
    const value: PathMetadata = {
      path: String(req.body.path ?? "/"),
      description: String(req.body.description ?? ""),
      tags: Array.isArray(req.body.tags) ? req.body.tags.map(String) : []
    };
    await services.metadata?.update((state) => {
      state.pathMetadata[value.path] = value;
    });
    res.json(ok(value));
  });

  app.get("/api/metadata/memos", async (req, res) => {
    const filePath = String(req.query.path ?? "/");
    const state = await services.metadata?.load();
    res.json(ok((state?.memos ?? []).filter((memo) => memo.path === filePath)));
  });

  app.post("/api/metadata/memos", async (req, res) => {
    const now = new Date().toISOString();
    const memo = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      path: String(req.body.path ?? "/"),
      content: String(req.body.content ?? ""),
      attachments: [],
      createdAt: now,
      updatedAt: now
    };
    await services.metadata?.update((state) => {
      state.memos.unshift(memo);
    });
    res.json(ok(memo));
  });

  app.get("/api/admin/storage", async (_req, res) => {
    res.json(ok(services.library?.getConfig()));
  });

  app.post("/api/admin/storage", async (req, res) => {
    try {
      const body = req.body as Partial<AdminStorageConfig>;
      let current = services.library?.getConfig();
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === "string" && value.trim()) {
          current = await services.library?.updatePath(key as keyof AdminStorageConfig, value);
        }
      }
      res.json(ok(current));
    } catch (error) {
      res.status(400).json(routeError(error));
    }
  });
}
