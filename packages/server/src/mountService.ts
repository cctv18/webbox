import { Client as FtpClient } from "basic-ftp";
import { createClient as createWebdavClient } from "webdav";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import type { FileItem, MountDefinition, MountInput } from "@webbox/shared";
import type { ServerConf } from "./configFile.js";

interface StoredMount extends MountDefinition {
  passwordToken?: string;
}

function sanitizeMountId(value: string): string {
  const id = value.trim().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
  if (!id) throw new Error("INVALID_INPUT");
  return id;
}

function labelFromId(id: string): string {
  return id.replace(/[-_]+/g, " ");
}

function idFromMount(input: MountInput): string {
  return sanitizeMountId(`${input.type}-${input.name || input.host}-${createHash("sha1").update(`${input.type}\0${input.host}\0${input.port ?? ""}`).digest("hex").slice(0, 6)}`);
}

function normalizeRemotePath(value: string): string {
  const normalized = `/${value || ""}`.replace(/\\/g, "/").replace(/\/+/g, "/");
  if (normalized.includes("/../") || normalized.endsWith("/..")) throw new Error("INVALID_PATH");
  return normalized;
}

function extension(name: string): string {
  return path.posix.extname(name).replace(/^\./, "").toLowerCase();
}

export class MountService {
  private mounts: StoredMount[] = [];
  private readonly configPath: string;

  constructor(private readonly conf: ServerConf, private readonly baseDir: string, dataRoot: string) {
    this.configPath = path.join(dataRoot, ".config", "mounts.json");
  }

  async load(): Promise<void> {
    const configured = await this.readStored();
    const local = Object.entries(this.conf)
      .filter(([key]) => {
        const parts = key.split(".");
        return parts.length === 3 && parts[0] === "mount";
      })
      .map(([key, value]) => {
        const [, type, rawId] = key.split(".");
        const id = sanitizeMountId(rawId ?? "");
        if (!["local", "ftp", "webdav"].includes(type)) throw new Error("INVALID_INPUT");
        return {
          id,
          type: type as MountDefinition["type"],
          name: this.conf[`mount.${type}.${id}.name`] || labelFromId(id),
          root: value,
          enabled: this.conf[`mount.${type}.${id}.enabled`] !== "false",
          username: this.conf[`mount.${type}.${id}.username`],
          host: this.conf[`mount.${type}.${id}.host`],
          port: Number(this.conf[`mount.${type}.${id}.port`] || 0) || undefined
        } satisfies StoredMount;
      });
    const byId = new Map<string, StoredMount>();
    for (const mount of [...local, ...configured]) {
      if (mount.enabled) byId.set(mount.id, mount);
    }
    this.mounts = Array.from(byId.values());
  }

  list(): MountDefinition[] {
    return this.mounts.map(({ passwordToken: _passwordToken, ...mount }) => ({ ...mount }));
  }

  get(id: string): MountDefinition | undefined {
    const mount = this.mounts.find((item) => item.id === id);
    if (!mount) return undefined;
    const { passwordToken: _passwordToken, ...safe } = mount;
    return { ...safe };
  }

  async add(input: MountInput): Promise<MountDefinition> {
    if (!["ftp", "webdav"].includes(input.type) || !input.host?.trim()) throw new Error("INVALID_INPUT");
    const id = idFromMount(input);
    const port = Number(input.port || (input.type === "ftp" ? 21 : input.https ? 443 : 80));
    const root = input.type === "ftp"
      ? `${input.host}:${port}`
      : `${input.https ? "https" : "http"}://${input.host}:${port}`;
    const mount: StoredMount = {
      id,
      type: input.type,
      name: input.name?.trim() || input.host,
      root,
      enabled: true,
      host: input.host.trim(),
      port,
      username: input.anonymous ? "anonymous" : input.username,
      mode: input.mode ?? "passive",
      anonymous: Boolean(input.anonymous),
      encoding: input.encoding || "utf8",
      https: Boolean(input.https),
      passwordToken: input.password ? createHash("sha256").update(input.password).digest("hex") : undefined
    };
    this.mounts = [mount, ...this.mounts.filter((item) => item.id !== id)];
    await this.writeStored();
    return this.get(id)!;
  }

  async update(id: string, patch: Partial<MountInput & { enabled: boolean }>): Promise<MountDefinition> {
    const cleanId = sanitizeMountId(id);
    const index = this.mounts.findIndex((item) => item.id === cleanId);
    if (index === -1) throw new Error("PATH_NOT_FOUND");
    const current = this.mounts[index];
    if (current.type === "local") throw new Error("UNSUPPORTED_OPERATION");
    const next: StoredMount = {
      ...current,
      name: patch.name?.trim() || current.name,
      host: patch.host?.trim() || current.host,
      port: patch.port ? Number(patch.port) : current.port,
      username: patch.anonymous ? "anonymous" : (patch.username ?? current.username),
      mode: patch.mode ?? current.mode,
      anonymous: patch.anonymous ?? current.anonymous,
      encoding: patch.encoding ?? current.encoding,
      https: patch.https ?? current.https,
      enabled: patch.enabled ?? current.enabled,
      passwordToken: patch.password ? createHash("sha256").update(patch.password).digest("hex") : current.passwordToken
    };
    next.root = next.type === "ftp" ? `${next.host}:${next.port ?? 21}` : `${next.https ? "https" : "http"}://${next.host}:${next.port ?? (next.https ? 443 : 80)}`;
    this.mounts[index] = next;
    await this.writeStored();
    return this.get(cleanId)!;
  }

  async remove(id: string): Promise<{ id: string }> {
    const cleanId = sanitizeMountId(id);
    const current = this.mounts.find((item) => item.id === cleanId);
    if (!current) throw new Error("PATH_NOT_FOUND");
    if (current.type === "local") throw new Error("UNSUPPORTED_OPERATION");
    this.mounts = this.mounts.filter((item) => item.id !== cleanId);
    await this.writeStored();
    return { id: cleanId };
  }

  localRoots(): Record<string, string> {
    return Object.fromEntries(this.mounts
      .filter((mount) => mount.type === "local")
      .map((mount) => [mount.id, path.resolve(this.baseDir, mount.root)]));
  }

  async ensureLocalRoots(): Promise<void> {
    for (const root of Object.values(this.localRoots())) {
      await fs.mkdir(root, { recursive: true });
    }
  }

  isRemote(id: string): boolean {
    const mount = this.mounts.find((item) => item.id === id);
    return mount?.type === "ftp" || mount?.type === "webdav";
  }

  async listRemote(id: string, remotePath = "/"): Promise<FileItem[]> {
    const mount = this.mounts.find((item) => item.id === sanitizeMountId(id));
    if (!mount || mount.type === "local") throw new Error("PATH_NOT_FOUND");
    const cleanPath = normalizeRemotePath(remotePath);
    if (mount.type === "ftp") return this.listFtp(mount, cleanPath);
    return this.listWebdav(mount, cleanPath);
  }

  private async listFtp(mount: StoredMount, remotePath: string): Promise<FileItem[]> {
    const client = new FtpClient();
    try {
      await client.access({
        host: mount.host,
        port: mount.port ?? 21,
        user: mount.anonymous ? "anonymous" : mount.username,
        password: "",
        secure: false
      });
      const entries = await client.list(remotePath);
      return entries.map((entry) => ({
        name: entry.name,
        path: `/网络挂载/${mount.id}${path.posix.join(remotePath, entry.name)}`,
        kind: entry.isDirectory ? "directory" : "file",
        size: entry.size,
        modifiedAt: entry.modifiedAt?.toISOString() ?? new Date(0).toISOString(),
        extension: entry.isDirectory ? "" : extension(entry.name),
        icon: entry.isDirectory ? "folder" : undefined
      }));
    } finally {
      client.close();
    }
  }

  private async listWebdav(mount: StoredMount, remotePath: string): Promise<FileItem[]> {
    const client = createWebdavClient(mount.root, {
      username: mount.username,
      password: ""
    });
    const entries = await client.getDirectoryContents(remotePath);
    const list = Array.isArray(entries) ? entries : entries.data;
    return list.map((entry) => {
      const name = path.posix.basename(entry.filename);
      return {
        name,
        path: `/网络挂载/${mount.id}${entry.filename}`,
        kind: entry.type === "directory" ? "directory" : "file",
        size: Number(entry.size ?? 0),
        modifiedAt: entry.lastmod ? new Date(entry.lastmod).toISOString() : new Date(0).toISOString(),
        extension: entry.type === "directory" ? "" : extension(name),
        icon: entry.type === "directory" ? "folder" : undefined
      } satisfies FileItem;
    });
  }

  private async readStored(): Promise<StoredMount[]> {
    try {
      return JSON.parse(await fs.readFile(this.configPath, "utf8")) as StoredMount[];
    } catch {
      return [];
    }
  }

  private async writeStored(): Promise<void> {
    const writable = this.mounts.filter((mount) => mount.type !== "local");
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, `${JSON.stringify(writable, null, 2)}\n`, "utf8");
  }
}
