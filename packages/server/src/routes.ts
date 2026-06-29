import type { Express } from "express";
import multer from "multer";
import path from "node:path";
import { fail, ok } from "@webbox/shared";
import { FileService } from "./fileService.js";

const upload = multer({ storage: multer.memoryStorage() });

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Operation failed";
  if (message === "PATH_OUTSIDE_ROOT") return fail("PATH_OUTSIDE_ROOT", "Path is outside storage root");
  if (message === "INVALID_INPUT") return fail("INVALID_INPUT", "Invalid input");
  if (message === "PATH_NOT_FOUND" || message.includes("ENOENT")) return fail("PATH_NOT_FOUND", "Path not found");
  if (message.includes("EEXIST")) return fail("DUPLICATE_NAME", "Target already exists");
  return fail("FILESYSTEM_DENIED", message);
}

export function mountFileRoutes(app: Express, files: FileService): void {
  app.get("/api/files", async (req, res) => {
    try {
      res.json(ok(await files.list(String(req.query.path ?? "/"))));
    } catch (error) {
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/folder", async (req, res) => {
    try {
      await files.mkdir(String(req.body.path));
      res.json(ok({ path: req.body.path }));
    } catch (error) {
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/text", async (req, res) => {
    try {
      await files.writeText(String(req.body.path), String(req.body.content ?? ""));
      res.json(ok({ path: req.body.path }));
    } catch (error) {
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/rename", async (req, res) => {
    try {
      await files.rename(String(req.body.path), String(req.body.name));
      res.json(ok({ path: req.body.path, name: req.body.name }));
    } catch (error) {
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/copy", async (req, res) => {
    try {
      await files.copy(String(req.body.source), String(req.body.target));
      res.json(ok({ target: req.body.target }));
    } catch (error) {
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/move", async (req, res) => {
    try {
      await files.move(String(req.body.source), String(req.body.target));
      res.json(ok({ target: req.body.target }));
    } catch (error) {
      res.status(400).json(routeError(error));
    }
  });

  app.delete("/api/files", async (req, res) => {
    try {
      await files.remove(String(req.body.path));
      res.json(ok({ path: req.body.path }));
    } catch (error) {
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/recycle", async (req, res) => {
    try {
      res.json(ok(await files.recycle(String(req.body.path))));
    } catch (error) {
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/restore", async (req, res) => {
    try {
      res.json(ok(await files.restore(String(req.body.recycleId))));
    } catch (error) {
      res.status(400).json(routeError(error));
    }
  });

  app.get("/api/files/search", async (req, res) => {
    try {
      res.json(ok(await files.search(String(req.query.q ?? ""), String(req.query.path ?? "/"))));
    } catch (error) {
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/zip", async (req, res) => {
    try {
      res.json(ok(await files.zip(req.body.paths ?? [], String(req.body.target))));
    } catch (error) {
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/unzip", async (req, res) => {
    try {
      res.json(ok(await files.unzip(String(req.body.path), String(req.body.targetDir))));
    } catch (error) {
      res.status(400).json(routeError(error));
    }
  });

  app.post("/api/files/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) throw new Error("INVALID_INPUT");
      const dir = String(req.query.path ?? "/");
      await files.writeBuffer(path.posix.join(dir.replace(/\\/g, "/"), req.file.originalname), req.file.buffer);
      res.json(ok({ name: req.file.originalname }));
    } catch (error) {
      res.status(400).json(routeError(error));
    }
  });

  app.get("/api/files/download", async (req, res) => {
    try {
      const absolute = files.getAbsolutePath(String(req.query.path ?? "/"));
      res.sendFile(absolute);
    } catch (error) {
      res.status(400).json(routeError(error));
    }
  });
}
