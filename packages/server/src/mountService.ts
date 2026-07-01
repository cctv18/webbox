import fs from "node:fs/promises";
import path from "node:path";
import type { MountDefinition } from "@webbox/shared";
import type { ServerConf } from "./configFile.js";

function sanitizeMountId(value: string): string {
  const id = value.trim();
  if (!/^[\w.-]{1,64}$/.test(id)) throw new Error("INVALID_INPUT");
  return id;
}

function labelFromId(id: string): string {
  return id.replace(/[-_]+/g, " ");
}

export class MountService {
  private readonly mounts: MountDefinition[];

  constructor(conf: ServerConf, private readonly baseDir: string) {
    this.mounts = Object.entries(conf)
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
          name: conf[`mount.${type}.${id}.name`] || labelFromId(id),
          root: value,
          enabled: conf[`mount.${type}.${id}.enabled`] !== "false",
          username: conf[`mount.${type}.${id}.username`]
        };
      })
      .filter((mount) => mount.enabled);
  }

  list(): MountDefinition[] {
    return this.mounts.map((mount) => ({ ...mount }));
  }

  get(id: string): MountDefinition | undefined {
    return this.mounts.find((mount) => mount.id === id);
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
}
