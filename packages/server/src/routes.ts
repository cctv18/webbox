import type { Express } from "express";
import multer from "multer";
import path from "node:path";
import { fail, ok, zhCN } from "@webbox/shared";
import { FileService } from "./fileService.js";
import type { WebboxLogger } from "./logger.js";

const upload = multer({ storage: multer.memoryStorage() });

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : zhCN.server.errors.operationFailed;
  if (message === "PATH_OUTSIDE_ROOT") return fail("PATH_OUTSIDE_ROOT", zhCN.server.errors.pathOutsideRoot);
  if (message === "INVALID_INPUT") return fail("INVALID_INPUT", zhCN.server.errors.invalidInput);
  if (message === "PATH_NOT_FOUND" || message.includes("ENOENT")) return fail("PATH_NOT_FOUND", zhCN.server.errors.pathNotFound);
  if (message.includes("EEXIST")) return fail("DUPLICATE_NAME", zhCN.server.errors.duplicateName);
  return fail("FILESYSTEM_DENIED", message);
}

function logFailure(logger: WebboxLogger, event: string, error: unknown, details: Record<string, unknown>) {
  logger.warn(`${event}.failed`, {
    message: zhCN.server.logs.fileOperationFailed,
    error: error instanceof Error ? error.message : String(error),
    ...details
  });
}

export function mountFileRoutes(app: Express, files: FileService, logger: WebboxLogger): void {
  app.get("/api/files", async (req, res) => {
    const requestedPath = String(req.query.path ?? "/");
    logger.info("file.list", { path: requestedPath });
    try {
      res.json(ok(await files.list(requestedPath)));
    } catch (error) {
      logFailure(logger, "file.list", error, { path: requestedPath });
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/folder", async (req, res) => {
    const folderPath = String(req.body.path);
    logger.info("file.mkdir", { path: folderPath });
    try {
      await files.mkdir(folderPath);
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
      await files.writeText(filePath, String(req.body.content ?? ""));
      res.json(ok({ path: req.body.path }));
    } catch (error) {
      logFailure(logger, "file.writeText", error, { path: filePath });
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/rename", async (req, res) => {
    const filePath = String(req.body.path);
    const name = String(req.body.name);
    logger.info("file.rename", { path: filePath, name });
    try {
      await files.rename(filePath, name);
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
      await files.copy(source, target);
      res.json(ok({ target: req.body.target }));
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
      await files.move(source, target);
      res.json(ok({ target: req.body.target }));
    } catch (error) {
      logFailure(logger, "file.move", error, { source, target });
      res.status(400).json(routeError(error));
    }
  });

  app.delete("/api/files", async (req, res) => {
    const filePath = String(req.body.path);
    logger.info("file.delete", { path: filePath });
    try {
      await files.remove(filePath);
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
      res.json(ok(await files.recycle(filePath)));
    } catch (error) {
      logFailure(logger, "file.recycle", error, { path: filePath });
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/restore", async (req, res) => {
    const recycleId = String(req.body.recycleId);
    logger.info("file.restore", { recycleId });
    try {
      res.json(ok(await files.restore(recycleId)));
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
      res.json(ok(await files.search(query, searchPath)));
    } catch (error) {
      logFailure(logger, "file.search", error, { path: searchPath, query });
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/zip", async (req, res) => {
    const target = String(req.body.target);
    logger.info("file.zip", { target, count: Array.isArray(req.body.paths) ? req.body.paths.length : 0 });
    try {
      res.json(ok(await files.zip(req.body.paths ?? [], target)));
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
      res.json(ok(await files.unzip(filePath, targetDir)));
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
      await files.writeBuffer(path.posix.join(dir.replace(/\\/g, "/"), req.file.originalname), req.file.buffer);
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
      const absolute = files.getAbsolutePath(filePath);
      res.sendFile(absolute);
    } catch (error) {
      logFailure(logger, "file.download", error, { path: filePath });
      res.status(400).json(routeError(error));
    }
  });
}
