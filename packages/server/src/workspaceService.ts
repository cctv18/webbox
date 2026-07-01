import type { AdminStorageConfig, MountDefinition, TreeNode } from "@webbox/shared";
import { zhCN } from "@webbox/shared";
import type { SafeBoxService } from "./safeBoxService.js";

export class WorkspaceService {
  constructor(private readonly storage: AdminStorageConfig, private readonly safeBox: SafeBoxService, private readonly mounts: MountDefinition[] = []) {}

  async tree(): Promise<TreeNode[]> {
    const safe = await this.safeBox.status();
    return [
      {
        id: "locations",
        label: zhCN.fileManager.locations,
        section: "locations",
        kind: "virtual",
        path: "/位置",
        icon: "folder",
        children: [
          { id: "favorites", label: zhCN.fileManager.favorites, section: "locations", kind: "virtual", path: "/位置/收藏夹", icon: "treeFav" },
          {
            id: "personal",
            label: zhCN.fileManager.personalSpace,
            section: "locations",
            kind: "directory",
            path: "/位置/个人空间",
            icon: "folder",
            children: [
              { id: "personal-safe", label: zhCN.fileManager.safeBox, section: "locations", kind: "directory", path: "/位置/个人空间/私密保险箱", icon: "safe", locked: safe.state !== "unlocked" },
              { id: "photos", label: zhCN.fileManager.photos, section: "locations", kind: "directory", path: "/位置/个人空间/我的相册", icon: "image" },
              { id: "documents", label: zhCN.fileManager.documents, section: "locations", kind: "directory", path: "/位置/个人空间/我的文档", icon: "folder" },
              { id: "music", label: zhCN.fileManager.music, section: "locations", kind: "directory", path: "/位置/个人空间/我的音乐", icon: "music" },
              { id: "videos", label: zhCN.fileManager.videos, section: "locations", kind: "directory", path: "/位置/个人空间/我的视频", icon: "video" }
            ]
          }
        ]
      },
      {
        id: "tools",
        label: zhCN.fileManager.tools,
        section: "tools",
        kind: "virtual",
        path: "/工具",
        icon: "setting",
        children: [
          { id: "recent", label: zhCN.fileManager.recentDocuments, section: "tools", kind: "virtual", path: "/工具/最近文档", icon: "search" },
          { id: "safe", label: zhCN.fileManager.safeBox, section: "tools", kind: "directory", path: "/工具/私密保险箱", icon: "safe", locked: safe.state !== "unlocked" },
          { id: "memos", label: "备忘录", section: "tools", kind: "virtual", path: "/工具/备忘录", icon: "memo" },
          { id: "recycle", label: zhCN.fileManager.recycleBin, section: "tools", kind: "virtual", path: "/工具/回收站", icon: "recycle" }
        ]
      },
      {
        id: "mounts",
        label: zhCN.fileManager.mounts,
        section: "mounts",
        kind: "virtual",
        path: "/网络挂载",
        icon: "computer",
        children: [
          ...this.mounts.map((mount) => ({
            id: `mount-${mount.id}`,
            label: mount.name,
            section: "mounts" as const,
            kind: "mount" as const,
            path: `/网络挂载/${mount.id}`,
            icon: mount.type === "local" ? "folder" : "computer"
          })),
          { id: "mount-add", label: "新增网络挂载", section: "mounts", kind: "virtual", path: "/网络挂载/新增网络挂载", icon: "computer" }
        ]
      }
    ];
  }

  rootsInfo(): { platform: NodeJS.Platform; hostname: string } {
    return { platform: process.platform, hostname: "" };
  }
}
