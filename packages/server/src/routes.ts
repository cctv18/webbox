import type { Express } from "express";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import mime from "mime-types";
import { fail, ok, zhCN, type AdminStorageConfig, type FavoriteEntry, type FileItem, type MemoUpload, type PathMetadata, type RecentSearch, type TemplateFileType } from "@webbox/shared";
import type { ActivityStore } from "./activityStore.js";
import { FileService } from "./fileService.js";
import type { LibraryService } from "./libraryService.js";
import type { WebboxLogger } from "./logger.js";
import type { MetadataStore } from "./metadataStore.js";
import type { MountService } from "./mountService.js";
import type { NotificationService } from "./notificationService.js";
import type { PathResolver } from "./pathResolver.js";
import type { SafeBoxService } from "./safeBoxService.js";
import type { SettingsStore } from "./settingsStore.js";
import type { WatchService } from "./watchService.js";
import type { WorkspaceService } from "./workspaceService.js";

const upload = multer({ storage: multer.memoryStorage() });

export interface RouteServices {
  activity?: ActivityStore;
  dataRoot?: string;
  fileSpaces?: Record<string, FileService>;
  library?: LibraryService;
  metadata?: MetadataStore;
  mountFileSpaces?: Record<string, FileService>;
  mounts?: MountService;
  notifications?: NotificationService;
  resolver?: PathResolver;
  safeBox?: SafeBoxService;
  settings?: SettingsStore;
  watcher?: WatchService;
  workspace?: WorkspaceService;
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : zhCN.server.errors.operationFailed;
  if (message === "PATH_OUTSIDE_ROOT") return fail("PATH_OUTSIDE_ROOT", zhCN.server.errors.pathOutsideRoot);
  if (message === "INVALID_NAME") return fail("INVALID_INPUT", zhCN.server.errors.invalidName);
  if (message === "INVALID_INPUT" || message === "INVALID_PATH") return fail("INVALID_INPUT", zhCN.server.errors.invalidInput);
  if (message === "PATH_NOT_FOUND" || message.includes("ENOENT")) return fail("PATH_NOT_FOUND", zhCN.server.errors.pathNotFound);
  if (message.includes("EEXIST")) return fail("DUPLICATE_NAME", zhCN.server.errors.duplicateName);
  if (message.includes("EACCES") || message.includes("EPERM") || message.includes("EROFS")) return fail("FILESYSTEM_DENIED", zhCN.server.errors.createFailed);
  if (message === "SAFE_BOX_LOCKED") return fail("SAFE_BOX_LOCKED", zhCN.server.errors.safeBoxLocked);
  if (message === "SAFE_BOX_COOLDOWN") return fail("AUTH_COOLDOWN", zhCN.server.errors.safeBoxCooldown);
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

function isAbstractPath(value: string): boolean {
  return value.startsWith("/位置") || value.startsWith("/工具") || value.startsWith("/网络挂载");
}

interface FileTarget {
  service?: FileService;
  path: string;
  displayPath: string;
  isAbstract: boolean;
  virtual?: string;
  space?: string;
}

function resolvedPath(value: string, services: RouteServices): FileTarget {
  if (!isAbstractPath(value)) return { path: value, displayPath: value, isAbstract: false };
  const resolved = services.resolver?.resolve(value);
  if (!resolved) throw new Error("INVALID_PATH");
  if (resolved.kind === "virtual") return { path: resolved.displayPath, displayPath: resolved.displayPath, isAbstract: true, virtual: resolved.virtualId };
  if (resolved.kind === "recycle") return { path: resolved.displayPath, displayPath: resolved.displayPath, isAbstract: true, virtual: "recycle" };
  if (resolved.kind === "mount") {
    const service = services.mountFileSpaces?.[resolved.mountId ?? ""];
    if (!service) throw new Error("INVALID_PATH");
    return { path: resolved.filePath ?? "/", displayPath: resolved.displayPath, isAbstract: true, service };
  }
  const service = services.fileSpaces?.[resolved.space ?? "personal"];
  if (!service) throw new Error("INVALID_PATH");
  return { path: resolved.filePath ?? "/", displayPath: resolved.displayPath, isAbstract: true, service, space: resolved.space };
}

function fileServiceForPath(req: { query?: { space?: unknown }; body?: { space?: unknown } }, fallback: FileService, services: RouteServices, value: string): FileTarget {
  const resolved = resolvedPath(value, services);
  return { ...resolved, service: resolved.service ?? (resolved.virtual ? undefined : serviceFor(req, fallback, services)) };
}

function templateContent(type: TemplateFileType): Buffer {
  if (type === "md") return Buffer.from("# New Document\n", "utf8");
  if (type === "html") return Buffer.from("<!doctype html>\n<html>\n<head><meta charset=\"utf-8\"><title>New Document</title></head>\n<body></body>\n</html>\n", "utf8");
  if (type === "txt") return Buffer.from("", "utf8");
  return Buffer.from(`Webbox ${type.toUpperCase()} template placeholder\n`, "utf8");
}

function requireService(target: FileTarget): FileTarget & { service: FileService } {
  if (!target.service) throw new Error("INVALID_PATH");
  return target as FileTarget & { service: FileService };
}

async function requireConcreteTarget(req: { query?: { space?: unknown }; body?: { space?: unknown } }, fallback: FileService, services: RouteServices, value: string): Promise<FileTarget & { service: FileService }> {
  const target = requireService(fileServiceForPath(req, fallback, services, value));
  if (target.space === "safe") await services.safeBox?.assertUnlocked();
  return target;
}

function joinDisplayPath(base: string, suffix: string): string {
  const normalizedBase = base.replace(/\/$/, "") || "/";
  const normalizedSuffix = suffix.replace(/^\/+/, "");
  if (!normalizedSuffix) return normalizedBase;
  return `${normalizedBase}/${normalizedSuffix}`.replace(/\/+/g, "/");
}

function relativeVirtualPath(base: string, itemPath: string): string {
  const normalizedBase = base.replace(/\/$/, "") || "/";
  const normalizedItem = itemPath.replace(/\/$/, "") || "/";
  if (normalizedBase === "/") return normalizedItem;
  if (normalizedItem === normalizedBase) return "/";
  if (normalizedItem.startsWith(`${normalizedBase}/`)) return normalizedItem.slice(normalizedBase.length);
  return normalizedItem;
}

function displayPathForConcreteResult(target: FileTarget, concretePath: string): string {
  if (!target.isAbstract) return concretePath;
  const displayParent = path.posix.dirname(target.displayPath);
  const concreteParent = path.posix.dirname(target.path);
  return joinDisplayPath(displayParent, relativeVirtualPath(concreteParent, concretePath));
}

function safeUploadName(value: string): string {
  const base = path.basename(value || "attachment");
  return base.replace(/[<>:"\\|?*\x00-\x1f]/g, "_") || "attachment";
}

function rebaseItem<T extends FileItem>(item: T, target: FileTarget): T {
  if (!target.isAbstract) return item;
  return {
    ...item,
    path: joinDisplayPath(target.displayPath, relativeVirtualPath(target.path, item.path))
  } as T;
}

function rebaseItems(items: FileItem[], target: FileTarget): FileItem[] {
  return items.map((item) => rebaseItem(item, target));
}

function timestamp(): string {
  return new Date(0).toISOString();
}

function basenameFromDisplay(displayPath: string): string {
  return path.posix.basename(displayPath.replace(/\/$/, "")) || displayPath;
}

function extensionFromDisplay(displayPath: string): string {
  return path.posix.extname(displayPath).replace(/^\./, "").toLowerCase();
}

function virtualItem(name: string, displayPath: string, icon = "folder", kind: FileItem["kind"] = "directory"): FileItem {
  return {
    name,
    path: displayPath,
    kind,
    size: 0,
    modifiedAt: timestamp(),
    createdAt: timestamp(),
    accessedAt: timestamp(),
    extension: kind === "file" ? extensionFromDisplay(displayPath) : "",
    icon
  };
}

function personalShortcuts(): FileItem[] {
  return [
    virtualItem(zhCN.fileManager.safeBox, "/位置/个人空间/私密保险箱", "safe"),
    virtualItem(zhCN.fileManager.photos, "/位置/个人空间/我的相册", "image"),
    virtualItem(zhCN.fileManager.documents, "/位置/个人空间/我的文档", "folder"),
    virtualItem(zhCN.fileManager.music, "/位置/个人空间/我的音乐", "music"),
    virtualItem(zhCN.fileManager.videos, "/位置/个人空间/我的视频", "video")
  ];
}

function virtualChildren(virtual: string): FileItem[] {
  if (virtual === "locations") {
    return [
      virtualItem(zhCN.fileManager.favorites, "/位置/收藏夹", "treeFav"),
      virtualItem(zhCN.fileManager.personalSpace, "/位置/个人空间", "folder")
    ];
  }
  if (virtual === "tools") {
    return [
      virtualItem(zhCN.fileManager.recentDocuments, "/工具/最近文档", "search"),
      virtualItem(zhCN.fileManager.safeBox, "/工具/私密保险箱", "safe"),
      virtualItem("备忘录", "/工具/备忘录", "memo"),
      virtualItem(zhCN.fileManager.recycleBin, "/工具/回收站", "recycle")
    ];
  }
  if (virtual === "mounts") {
    return [virtualItem("新增网络挂载", "/网络挂载/新增网络挂载", "computer")];
  }
  return [];
}

function mountItems(services: RouteServices): FileItem[] {
  const configured = services.mounts?.list().map((mount) => (
    virtualItem(mount.name, `/网络挂载/${mount.id}`, mount.type === "local" ? "folder" : "computer")
  )) ?? [];
  return [...configured, ...virtualChildren("mounts")];
}

async function addFavoriteFlags(items: FileItem[], services: RouteServices): Promise<FileItem[]> {
  const state = await services.metadata?.load();
  const favorites = new Set(state?.favorites.map((item) => item.path) ?? []);
  return items.map((item) => ({ ...item, favorite: favorites.has(item.path) }));
}

async function itemFromDisplayPath(displayPath: string, services: RouteServices, fallback: FileService, label?: string): Promise<FileItem> {
  try {
    const target = fileServiceForPath({}, fallback, services, displayPath);
    if (target.virtual) return virtualItem(label ?? basenameFromDisplay(displayPath), displayPath, target.virtual === "recent" ? "search" : "folder");
    const concrete = requireService(target);
    const item = rebaseItem(await concrete.service.details(concrete.path), concrete);
    return { ...item, name: label ?? item.name, path: displayPath };
  } catch {
    const extension = extensionFromDisplay(displayPath);
    return virtualItem(label ?? basenameFromDisplay(displayPath), displayPath, extension ? "file" : "folder", extension ? "file" : "directory");
  }
}

async function listVirtual(virtual: string, files: FileService, services: RouteServices): Promise<FileItem[]> {
  if (virtual === "favorites") {
    const state = await services.metadata?.load();
    const items = await Promise.all((state?.favorites ?? []).map((favorite) => itemFromDisplayPath(favorite.path, services, files, favorite.label)));
    return addFavoriteFlags(items, services);
  }
  if (virtual === "recent") {
    const records = await services.activity?.query("/") ?? [];
    const paths = Array.from(new Set(records
      .filter((record) => record.action.startsWith("file."))
      .map((record) => record.path)
      .filter((recordPath) => !recordPath.includes("/回收站"))));
    const items = await Promise.all(paths.slice(0, 100).map((recordPath) => itemFromDisplayPath(recordPath, services, files)));
    return addFavoriteFlags(items, services);
  }
  if (virtual === "recycle") {
    return (await files.listRecycle()).map((item) => ({
      name: item.name,
      path: item.recycleId,
      kind: item.kind,
      size: item.size,
      modifiedAt: item.deletedAt,
      createdAt: item.deletedAt,
      accessedAt: item.deletedAt,
      extension: item.kind === "file" ? extensionFromDisplay(item.name) : ""
    }));
  }
  if (virtual === "memos") return [];
  if (virtual === "mounts") {
    return addFavoriteFlags(mountItems(services), services);
  }
  return addFavoriteFlags(virtualChildren(virtual), services);
}

async function listConcrete(target: FileTarget & { service: FileService }, services: RouteServices): Promise<FileItem[]> {
  const items = rebaseItems(await target.service.list(target.path), target);
  if (target.displayPath === "/位置/个人空间" && target.path === "/") {
    const existing = new Set(items.map((item) => item.path));
    for (const shortcut of personalShortcuts()) {
      if (!existing.has(shortcut.path)) items.unshift(shortcut);
    }
  }
  return addFavoriteFlags(items, services);
}

export function mountFileRoutes(app: Express, files: FileService, logger: WebboxLogger, services: RouteServices = {}): void {
  app.get("/api/files", async (req, res) => {
    const requestedPath = String(req.query.path ?? "/");
    logger.info("file.list", { path: requestedPath });
    try {
      const target = fileServiceForPath(req, files, services, requestedPath);
      if (target.virtual) {
        res.json(ok(await listVirtual(target.virtual, files, services)));
        return;
      }
      if (target.space === "safe") await services.safeBox?.assertUnlocked();
      res.json(ok(await listConcrete(requireService(target), services)));
    } catch (error) {
      logFailure(logger, "file.list", error, { path: requestedPath });
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/folder", async (req, res) => {
    const folderPath = String(req.body.path);
    logger.info("file.mkdir", { path: folderPath });
    try {
      const target = await requireConcreteTarget(req, files, services, folderPath);
      await target.service.mkdir(target.path);
      await record(services, "file.mkdir", folderPath, "新建文件夹");
      res.json(ok({ path: req.body.path }));
    } catch (error) {
      logFailure(logger, "file.mkdir", error, { path: folderPath });
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/text", async (req, res) => {
    const filePath = String(req.body.path);
    logger.info("file.writeText", { path: filePath });
    try {
      const target = await requireConcreteTarget(req, files, services, filePath);
      await target.service.writeText(target.path, String(req.body.content ?? ""));
      await record(services, "file.writeText", filePath, "写入文件");
      res.json(ok({ path: req.body.path }));
    } catch (error) {
      logFailure(logger, "file.writeText", error, { path: filePath });
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/template", async (req, res) => {
    const filePath = String(req.body.path);
    const type = String(req.body.type ?? "txt") as TemplateFileType;
    logger.info("file.template", { path: filePath, type });
    try {
      if (!["txt", "md", "html", "docx", "xlsx", "pptx"].includes(type)) throw new Error("INVALID_INPUT");
      const target = await requireConcreteTarget(req, files, services, filePath);
      await target.service.writeBuffer(target.path, templateContent(type));
      await record(services, "file.template", filePath, "新建模板文件");
      res.json(ok({ path: filePath, type }));
    } catch (error) {
      logFailure(logger, "file.template", error, { path: filePath, type });
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/rename", async (req, res) => {
    const filePath = String(req.body.path);
    const name = String(req.body.name);
    logger.info("file.rename", { path: filePath, name });
    try {
      const target = await requireConcreteTarget(req, files, services, filePath);
      await target.service.rename(target.path, name);
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
    logger.info("file.copy", { source, target });
    try {
      const sourceTarget = await requireConcreteTarget(req, files, services, source);
      const destinationTarget = await requireConcreteTarget(req, files, services, target);
      if (sourceTarget.service !== destinationTarget.service) throw new Error("INVALID_PATH");
      const result = await sourceTarget.service.copy(sourceTarget.path, destinationTarget.path);
      const displayTarget = displayPathForConcreteResult(destinationTarget, result.path);
      await record(services, "file.copy", displayTarget, "复制文件");
      res.json(ok({ target: displayTarget }));
    } catch (error) {
      logFailure(logger, "file.copy", error, { source, target });
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/move", async (req, res) => {
    const source = String(req.body.source);
    const target = String(req.body.target);
    logger.info("file.move", { source, target });
    try {
      const sourceTarget = await requireConcreteTarget(req, files, services, source);
      const destinationTarget = await requireConcreteTarget(req, files, services, target);
      if (sourceTarget.service !== destinationTarget.service) throw new Error("INVALID_PATH");
      const result = await sourceTarget.service.move(sourceTarget.path, destinationTarget.path);
      const displayTarget = displayPathForConcreteResult(destinationTarget, result.path);
      await record(services, "file.move", displayTarget, "移动文件");
      res.json(ok({ target: displayTarget }));
    } catch (error) {
      logFailure(logger, "file.move", error, { source, target });
      res.status(400).json(routeError(error));
    }
  });

  app.delete("/api/files", async (req, res) => {
    const filePath = String(req.body.path);
    logger.info("file.delete", { path: filePath });
    try {
      const target = await requireConcreteTarget(req, files, services, filePath);
      await target.service.remove(target.path);
      await record(services, "file.delete", filePath, "删除文件");
      res.json(ok({ path: req.body.path }));
    } catch (error) {
      logFailure(logger, "file.delete", error, { path: filePath });
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/recycle", async (req, res) => {
    const filePath = String(req.body.path);
    logger.info("file.recycle", { path: filePath });
    try {
      const target = await requireConcreteTarget(req, files, services, filePath);
      const result = await target.service.recycle(target.path);
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
      const target = await requireConcreteTarget(req, files, services, searchPath);
      res.json(ok(await addFavoriteFlags(rebaseItems(await target.service.search(query, target.path), target), services)));
    } catch (error) {
      logFailure(logger, "file.search", error, { path: searchPath, query });
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/zip", async (req, res) => {
    const target = String(req.body.target);
    const inputPaths = Array.isArray(req.body.paths) ? req.body.paths.map(String) : [];
    logger.info("file.zip", { target, count: inputPaths.length });
    try {
      const archiveTarget = await requireConcreteTarget(req, files, services, target);
      const sourceTargets = await Promise.all(inputPaths.map((inputPath) => requireConcreteTarget(req, files, services, inputPath)));
      if (sourceTargets.some((source) => source.service !== archiveTarget.service)) throw new Error("INVALID_PATH");
      const result = await archiveTarget.service.zip(sourceTargets.map((source) => source.path), archiveTarget.path);
      const displayTarget = displayPathForConcreteResult(archiveTarget, result.path);
      await record(services, "file.zip", displayTarget, "创建压缩包");
      res.json(ok({ path: displayTarget }));
    } catch (error) {
      logFailure(logger, "file.zip", error, { target });
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/unzip", async (req, res) => {
    const filePath = String(req.body.path);
    const targetDir = String(req.body.targetDir);
    logger.info("file.unzip", { path: filePath, targetDir });
    try {
      const sourceTarget = await requireConcreteTarget(req, files, services, filePath);
      const destinationTarget = await requireConcreteTarget(req, files, services, targetDir);
      if (sourceTarget.service !== destinationTarget.service) throw new Error("INVALID_PATH");
      const result = await sourceTarget.service.unzip(sourceTarget.path, destinationTarget.path);
      const displayTarget = displayPathForConcreteResult(destinationTarget, result.path);
      await record(services, "file.unzip", displayTarget, "解压文件");
      res.json(ok({ path: displayTarget }));
    } catch (error) {
      logFailure(logger, "file.unzip", error, { path: filePath, targetDir });
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/upload", upload.single("file"), async (req, res) => {
    const dir = String(req.query.path ?? "/");
    logger.info("file.upload", { path: dir, name: req.file?.originalname });
    try {
      if (!req.file) throw new Error("INVALID_INPUT");
      const target = await requireConcreteTarget(req, files, services, dir);
      await target.service.writeBuffer(path.posix.join(target.path, req.file.originalname), req.file.buffer);
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
    logger.info("file.download", { path: filePath });
    try {
      const target = await requireConcreteTarget(req, files, services, filePath);
      const absolute = target.service.getAbsolutePath(target.path);
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(absolute))}`);
      res.sendFile(absolute);
    } catch (error) {
      logFailure(logger, "file.download", error, { path: filePath });
      res.status(400).json(routeError(error));
    }
  });

  app.get("/api/files/open", async (req, res) => {
    const filePath = String(req.query.path ?? "/");
    logger.info("file.open", { path: filePath });
    try {
      const target = await requireConcreteTarget(req, files, services, filePath);
      const absolute = target.service.getAbsolutePath(target.path);
      const contentType = mime.lookup(absolute) || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(path.basename(absolute))}`);
      res.sendFile(absolute);
    } catch (error) {
      logFailure(logger, "file.open", error, { path: filePath });
      res.status(400).json(routeError(error));
    }
  });

  app.get("/api/files/details", async (req, res) => {
    const filePath = String(req.query.path ?? "/");
    logger.info("file.details", { path: filePath });
    try {
      const target = fileServiceForPath(req, files, services, filePath);
      if (target.virtual) {
        res.json(ok({ ...virtualItem(basenameFromDisplay(target.displayPath), target.displayPath), tags: [], description: "" }));
        return;
      }
      const concrete = requireService(target);
      if (target.space === "safe") await services.safeBox?.assertUnlocked();
      const details = rebaseItem(await concrete.service.details(concrete.path), concrete);
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

  app.get("/api/settings", async (_req, res) => {
    res.json(ok(await services.settings?.get()));
  });

  app.put("/api/settings", async (req, res) => {
    res.json(ok(await services.settings?.update(req.body)));
  });

  app.get("/api/favorites", async (_req, res) => {
    const state = await services.metadata?.load();
    res.json(ok(state?.favorites ?? []));
  });

  app.post("/api/favorites", async (req, res) => {
    const favoritePath = String(req.body.path ?? "/");
    const label = String((req.body.label ?? path.posix.basename(favoritePath)) || favoritePath);
    const id = createHash("sha1").update(`${favoritePath}\0${label}`).digest("hex").slice(0, 16);
    const item: FavoriteEntry = { id, path: favoritePath, label, kind: "virtual", createdAt: new Date().toISOString() };
    const state = await services.metadata?.update((next) => {
      next.favorites = [item, ...next.favorites.filter((favorite) => favorite.path !== favoritePath)];
      next.favoritePaths = next.favorites.map((favorite) => favorite.path);
    });
    res.json(ok(state?.favorites.find((favorite) => favorite.id === id) ?? item));
  });

  app.delete("/api/favorites/:id", async (req, res) => {
    await services.metadata?.update((next) => {
      next.favorites = next.favorites.filter((favorite) => favorite.id !== req.params.id);
      next.favoritePaths = next.favorites.map((favorite) => favorite.path);
    });
    res.json(ok({ id: req.params.id }));
  });

  app.get("/api/search/recent", async (_req, res) => {
    const state = await services.metadata?.load();
    res.json(ok(state?.recentSearches ?? []));
  });

  app.post("/api/search/recent", async (req, res) => {
    const text = String(req.body.text ?? "").trim();
    const scope = String(req.body.scope ?? "/");
    if (!text) return res.status(400).json(routeError(new Error("INVALID_INPUT")));
    const settings = await services.settings?.get();
    const limit = settings?.explorer.searchHistoryLimit ?? 10;
    const id = createHash("sha1").update(`${scope}\0${text}`).digest("hex").slice(0, 16);
    const item: RecentSearch = { id, text, scope, createdAt: new Date().toISOString() };
    const state = await services.metadata?.update((next) => {
      next.recentSearches = [item, ...next.recentSearches.filter((recent) => recent.id !== id)].slice(0, limit);
    });
    res.json(ok(state?.recentSearches[0] ?? item));
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
    const memos = state?.memos ?? [];
    if (String(req.query.all ?? "") === "1") {
      res.json(ok(memos));
      return;
    }
    res.json(ok(memos.filter((memo) => memo.path === filePath)));
  });

  app.post("/api/metadata/attachments", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) throw new Error("INVALID_INPUT");
      const dataRoot = services.dataRoot ?? path.dirname(files.getAbsolutePath("/"));
      const id = randomUUID();
      const name = safeUploadName(req.file.originalname);
      const dir = path.join(dataRoot, "memo-attachments", id);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, name), req.file.buffer);
      const url = `/api/metadata/attachments/${encodeURIComponent(id)}/${encodeURIComponent(name)}`;
      const isImage = req.file.mimetype.startsWith("image/");
      const uploadResult: MemoUpload = {
        id,
        name,
        url,
        downloadUrl: `${url}?download=1`,
        markdown: isImage ? `![${name}](${url})` : `[${name}](${url}?download=1)`,
        size: req.file.size
      };
      res.json(ok(uploadResult));
    } catch (error) {
      res.status(400).json(routeError(error));
    }
  });

  app.get("/api/metadata/attachments/:id/:name", async (req, res) => {
    try {
      const dataRoot = services.dataRoot ?? path.dirname(files.getAbsolutePath("/"));
      const id = req.params.id.replace(/[^a-f0-9-]/gi, "");
      const name = safeUploadName(req.params.name);
      const absolute = path.join(dataRoot, "memo-attachments", id, name);
      const contentType = mime.lookup(absolute) || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      if (String(req.query.download ?? "") === "1") {
        res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
      } else {
        res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(name)}`);
      }
      res.sendFile(absolute);
    } catch (error) {
      res.status(400).json(routeError(error));
    }
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

  app.get("/api/metadata/memos/:id/draft", async (req, res) => {
    const id = req.params.id;
    const state = await services.metadata?.load();
    res.json(ok(state?.memoDrafts[id] ?? null));
  });

  app.put("/api/metadata/memos/:id/draft", async (req, res) => {
    const id = req.params.id;
    const draft = {
      id,
      path: String(req.body.path ?? "/"),
      content: String(req.body.content ?? ""),
      updatedAt: new Date().toISOString()
    };
    await services.metadata?.update((state) => {
      state.memoDrafts[id] = draft;
    });
    res.json(ok(draft));
  });

  app.delete("/api/metadata/memos/:id/draft", async (req, res) => {
    const id = req.params.id;
    await services.metadata?.update((state) => {
      delete state.memoDrafts[id];
    });
    res.json(ok({ id }));
  });

  app.put("/api/metadata/memos/:id", async (req, res) => {
    const id = req.params.id;
    const content = String(req.body.content ?? "");
    const nextPath = typeof req.body.path === "string" ? String(req.body.path) : undefined;
    try {
      let updated;
      await services.metadata?.update((state) => {
        const memo = state.memos.find((item) => item.id === id);
        if (!memo) throw new Error("PATH_NOT_FOUND");
        memo.content = content;
        if (nextPath) memo.path = nextPath;
        memo.updatedAt = new Date().toISOString();
        delete state.memoDrafts[id];
        updated = memo;
      });
      res.json(ok(updated));
    } catch (error) {
      res.status(400).json(routeError(error));
    }
  });

  app.delete("/api/metadata/memos/:id", async (req, res) => {
    const id = req.params.id;
    await services.metadata?.update((state) => {
      state.memos = state.memos.filter((memo) => memo.id !== id);
    });
    res.json(ok({ id }));
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
