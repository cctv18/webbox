import os from "node:os";
import fs from "node:fs";
import type { AdminStorageConfig, TreeNode } from "@webbox/shared";
import { zhCN } from "@webbox/shared";
import type { SafeBoxService } from "./safeBoxService.js";

function localRoots(): TreeNode[] {
  if (process.platform === "win32") {
    const roots: TreeNode[] = [];
    for (let code = 65; code <= 90; code += 1) {
      const drive = `${String.fromCharCode(code)}:\\`;
      if (fs.existsSync(drive)) {
        roots.push({ id: `local-${String.fromCharCode(code)}`, label: drive, section: "mounts", kind: "mount", path: drive, icon: "computer" });
      }
    }
    return roots;
  }
  return [{ id: "local-root", label: "/", section: "mounts", kind: "mount", path: "/", icon: "computer" }];
}

export class WorkspaceService {
  constructor(private readonly storage: AdminStorageConfig, private readonly safeBox: SafeBoxService) {}

  async tree(): Promise<TreeNode[]> {
    const safe = await this.safeBox.status();
    return [
      {
        id: "locations",
        label: zhCN.fileManager.locations,
        section: "locations",
        kind: "virtual",
        path: "webbox://locations",
        icon: "folder",
        children: [
          { id: "favorites", label: zhCN.fileManager.favorites, section: "locations", kind: "virtual", path: "webbox://favorites", icon: "treeFav" },
          { id: "personal", label: zhCN.fileManager.personalSpace, section: "locations", kind: "directory", path: "/", icon: "folder" }
        ]
      },
      {
        id: "tools",
        label: zhCN.fileManager.tools,
        section: "tools",
        kind: "virtual",
        path: "webbox://tools",
        icon: "setting",
        children: [
          { id: "recent", label: zhCN.fileManager.recentDocuments, section: "tools", kind: "virtual", path: "webbox://recent", icon: "search" },
          { id: "photos", label: zhCN.fileManager.photos, section: "tools", kind: "directory", path: this.storage.photos, icon: "folder" },
          { id: "documents", label: zhCN.fileManager.documents, section: "tools", kind: "directory", path: this.storage.documents, icon: "folder" },
          { id: "music", label: zhCN.fileManager.music, section: "tools", kind: "directory", path: this.storage.music, icon: "folder" },
          { id: "videos", label: zhCN.fileManager.videos, section: "tools", kind: "directory", path: this.storage.videos, icon: "folder" },
          { id: "safe", label: zhCN.fileManager.safeBox, section: "tools", kind: "directory", path: this.storage.safeBox, icon: "safe", locked: safe.state !== "unlocked" },
          { id: "recycle", label: zhCN.fileManager.recycleBin, section: "tools", kind: "virtual", path: "webbox://recycle", icon: "recycle" }
        ]
      },
      {
        id: "mounts",
        label: zhCN.fileManager.mounts,
        section: "mounts",
        kind: "virtual",
        path: "webbox://mounts",
        icon: "computer",
        children: localRoots()
      }
    ];
  }

  rootsInfo(): { platform: NodeJS.Platform; hostname: string } {
    return { platform: process.platform, hostname: os.hostname() };
  }
}
