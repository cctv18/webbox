import archiver from "archiver";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import unzipper from "unzipper";
import { assertSafeFileName, type FileDetails, type FileItem, type RecycleRecord, resolveInsideRoot, toVirtualPath } from "@webbox/shared";

interface RecycleIndexRecord {
  recycleId: string;
  originalPath: string;
  recycledPath: string;
  deletedAt: string;
}

export class FileService {
  private readonly recycleRoot: string;
  private readonly recycleIndexPath: string;

  constructor(private readonly root: string, private readonly dataRoot = path.dirname(root)) {
    this.recycleRoot = path.join(dataRoot, "recycle");
    this.recycleIndexPath = path.join(this.recycleRoot, "index.json");
  }

  async ensureRoot(): Promise<void> {
    await fsp.mkdir(this.root, { recursive: true });
    await fsp.mkdir(this.recycleRoot, { recursive: true });
  }

  async list(virtualPath: string): Promise<FileItem[]> {
    await this.ensureRoot();
    const absolute = resolveInsideRoot(this.root, virtualPath);
    const entries = await fsp.readdir(absolute, { withFileTypes: true });
    const items = await Promise.all(entries.map((entry) => this.toFileItem(path.join(absolute, entry.name), entry.isDirectory())));
    return items.sort((a, b) => Number(b.kind === "directory") - Number(a.kind === "directory") || a.name.localeCompare(b.name));
  }

  async mkdir(virtualPath: string): Promise<void> {
    await this.ensureRoot();
    assertSafeFileName(path.posix.basename(virtualPath));
    await fsp.mkdir(resolveInsideRoot(this.root, virtualPath), { recursive: false });
  }

  async writeText(virtualPath: string, content: string): Promise<void> {
    await this.writeBuffer(virtualPath, Buffer.from(content, "utf8"));
  }

  async writeBuffer(virtualPath: string, content: Buffer): Promise<void> {
    assertSafeFileName(path.posix.basename(virtualPath));
    const absolute = resolveInsideRoot(this.root, virtualPath);
    await fsp.mkdir(path.dirname(absolute), { recursive: true });
    await fsp.writeFile(absolute, content);
  }

  async rename(virtualPath: string, nextName: string): Promise<void> {
    const safeName = assertSafeFileName(nextName);
    const source = resolveInsideRoot(this.root, virtualPath);
    await fsp.rename(source, path.join(path.dirname(source), safeName));
  }

  async copy(sourcePath: string, targetPath: string): Promise<void> {
    const source = resolveInsideRoot(this.root, sourcePath);
    const target = resolveInsideRoot(this.root, targetPath);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.cp(source, target, { recursive: true, errorOnExist: true, force: false });
  }

  async move(sourcePath: string, targetPath: string): Promise<void> {
    const target = resolveInsideRoot(this.root, targetPath);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.rename(resolveInsideRoot(this.root, sourcePath), target);
  }

  async remove(virtualPath: string): Promise<void> {
    await fsp.rm(resolveInsideRoot(this.root, virtualPath), { recursive: true, force: false });
  }

  async recycle(virtualPath: string): Promise<{ recycleId: string }> {
    await this.ensureRoot();
    const source = resolveInsideRoot(this.root, virtualPath);
    const recycleId = randomUUID();
    const recycledPath = path.join(this.recycleRoot, recycleId);
    await fsp.rename(source, recycledPath);
    const index = await this.readRecycleIndex();
    index[recycleId] = {
      recycleId,
      originalPath: toVirtualPath(this.root, source),
      recycledPath,
      deletedAt: new Date().toISOString()
    };
    await this.writeRecycleIndex(index);
    return { recycleId };
  }

  async listRecycle(): Promise<RecycleRecord[]> {
    const index = await this.readRecycleIndex();
    const records = await Promise.all(Object.values(index).map(async (record) => {
      let stat;
      try {
        stat = await fsp.stat(record.recycledPath);
      } catch {
        stat = undefined;
      }
      return {
        recycleId: record.recycleId,
        name: path.basename(record.originalPath),
        originalPath: record.originalPath,
        deletedAt: record.deletedAt,
        kind: stat?.isDirectory() ? "directory" : "file",
        size: stat && !stat.isDirectory() ? stat.size : 0
      } satisfies RecycleRecord;
    }));
    return records.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  }

  async restore(recycleId: string): Promise<{ path: string }> {
    const index = await this.readRecycleIndex();
    const record = index[recycleId];
    if (!record) throw new Error("PATH_NOT_FOUND");
    const target = resolveInsideRoot(this.root, record.originalPath);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.rename(record.recycledPath, target);
    delete index[recycleId];
    await this.writeRecycleIndex(index);
    return { path: record.originalPath };
  }

  async removeRecycle(recycleId: string): Promise<void> {
    const index = await this.readRecycleIndex();
    const record = index[recycleId];
    if (!record) throw new Error("PATH_NOT_FOUND");
    await fsp.rm(record.recycledPath, { recursive: true, force: true });
    delete index[recycleId];
    await this.writeRecycleIndex(index);
  }

  async clearRecycle(): Promise<void> {
    const index = await this.readRecycleIndex();
    await Promise.all(Object.values(index).map((record) => fsp.rm(record.recycledPath, { recursive: true, force: true })));
    await this.writeRecycleIndex({});
  }

  async details(virtualPath: string): Promise<FileDetails> {
    const absolute = resolveInsideRoot(this.root, virtualPath);
    const item = await this.toFileItem(absolute);
    if (item.kind === "directory") item.size = await this.directorySize(absolute);
    return {
      ...item,
      tags: [],
      description: "",
      absolutePath: absolute
    };
  }

  async search(query: string, virtualPath = "/"): Promise<FileItem[]> {
    await this.ensureRoot();
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];
    const start = resolveInsideRoot(this.root, virtualPath);
    const matches: FileItem[] = [];
    await this.walk(start, async (absolute, isDirectory) => {
      if (path.basename(absolute).toLowerCase().includes(normalizedQuery)) {
        matches.push(await this.toFileItem(absolute, isDirectory));
      }
    });
    return matches.slice(0, 200);
  }

  async zip(paths: string[], targetPath: string): Promise<{ path: string }> {
    await this.ensureRoot();
    const target = resolveInsideRoot(this.root, targetPath);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(target);
      const archive = archiver("zip", { zlib: { level: 9 } });
      output.on("close", () => resolve());
      archive.on("error", reject);
      archive.pipe(output);
      for (const item of paths) {
        const absolute = resolveInsideRoot(this.root, item);
        const name = path.basename(absolute);
        const stat = fs.statSync(absolute);
        if (stat.isDirectory()) archive.directory(absolute, name);
        else archive.file(absolute, { name });
      }
      void archive.finalize();
    });
    return { path: toVirtualPath(this.root, target) };
  }

  async unzip(zipPath: string, targetDir: string): Promise<{ path: string }> {
    await this.ensureRoot();
    const source = resolveInsideRoot(this.root, zipPath);
    const target = resolveInsideRoot(this.root, targetDir);
    await fsp.mkdir(target, { recursive: true });
    const directory = await unzipper.Open.file(source);
    await Promise.all(directory.files.map(async (file) => {
      const destination = resolveInsideRoot(target, `/${file.path}`);
      if (file.type === "Directory") {
        await fsp.mkdir(destination, { recursive: true });
      } else {
        await fsp.mkdir(path.dirname(destination), { recursive: true });
        await new Promise<void>((resolve, reject) => {
          file.stream().pipe(fs.createWriteStream(destination)).on("finish", resolve).on("error", reject);
        });
      }
    }));
    return { path: toVirtualPath(this.root, target) };
  }

  getAbsolutePath(virtualPath: string): string {
    return resolveInsideRoot(this.root, virtualPath);
  }

  private async walk(absolute: string, visit: (absolute: string, isDirectory: boolean) => Promise<void>): Promise<void> {
    const entries = await fsp.readdir(absolute, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(absolute, entry.name);
      const isDirectory = entry.isDirectory();
      await visit(full, isDirectory);
      if (isDirectory) await this.walk(full, visit);
      if (entry.name === ".webbox-stop") break;
    }
  }

  private async directorySize(absolute: string): Promise<number> {
    let total = 0;
    await this.walk(absolute, async (entry, isDirectory) => {
      if (!isDirectory) total += (await fsp.stat(entry)).size;
    });
    return total;
  }

  private async toFileItem(absolute: string, isDirectoryHint?: boolean): Promise<FileItem> {
    const stat = await fsp.stat(absolute);
    const isDirectory = isDirectoryHint ?? stat.isDirectory();
    const name = path.basename(absolute);
    return {
      name,
      path: toVirtualPath(this.root, absolute),
      kind: isDirectory ? "directory" : "file",
      size: isDirectory ? 0 : stat.size,
      modifiedAt: stat.mtime.toISOString(),
      createdAt: stat.birthtime.toISOString(),
      accessedAt: stat.atime.toISOString(),
      extension: isDirectory ? "" : path.extname(name).slice(1).toLowerCase()
    };
  }

  private async readRecycleIndex(): Promise<Record<string, RecycleIndexRecord>> {
    try {
      const raw = await fsp.readFile(this.recycleIndexPath, "utf8");
      return JSON.parse(raw) as Record<string, RecycleIndexRecord>;
    } catch {
      return {};
    }
  }

  private async writeRecycleIndex(index: Record<string, RecycleIndexRecord>): Promise<void> {
    await fsp.mkdir(path.dirname(this.recycleIndexPath), { recursive: true });
    await fsp.writeFile(this.recycleIndexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  }
}
