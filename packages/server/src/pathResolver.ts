import path from "node:path";
import { splitAbstractPath, type ResolvedLocation } from "@webbox/shared";

const SPACE_BY_LABEL: Record<string, NonNullable<ResolvedLocation["space"]>> = {
  "个人空间": "personal",
  "我的相册": "photos",
  "我的文档": "documents",
  "我的音乐": "music",
  "我的视频": "videos",
  "私密保险箱": "safe"
};

export class PathResolver {
  resolve(input: string): ResolvedLocation {
    const parts = splitAbstractPath(input || "/");
    if (!parts.length) return { kind: "space", displayPath: "/", space: "personal", filePath: "/" };

    if (parts[0] === "位置") {
      if (parts.length === 1) return { kind: "virtual", displayPath: "/位置", virtualId: "locations" };
      if (parts[1] === "收藏夹") return { kind: "virtual", displayPath: "/位置/收藏夹", virtualId: "favorites" };
      if (parts[1] !== "个人空间") throw new Error("INVALID_PATH");
      if (parts.length === 2) return { kind: "space", displayPath: "/位置/个人空间", space: "personal", filePath: "/" };
      const space = SPACE_BY_LABEL[parts[2]];
      if (!space) throw new Error("INVALID_PATH");
      const rest = parts.slice(3).join("/");
      return {
        kind: "space",
        displayPath: `/${parts.join("/")}`,
        space,
        filePath: rest ? `/${rest}` : "/"
      };
    }

    if (parts[0] === "工具") {
      if (parts.length === 1) return { kind: "virtual", displayPath: "/工具", virtualId: "tools" };
      if (parts[1] === "最近文档") return { kind: "virtual", displayPath: "/工具/最近文档", virtualId: "recent" };
      if (parts[1] === "私密保险箱") {
        const rest = parts.slice(2).join("/");
        return { kind: "space", displayPath: `/${parts.join("/")}`, space: "safe", filePath: rest ? `/${rest}` : "/" };
      }
      if (parts[1] === "回收站") return { kind: "recycle", displayPath: "/工具/回收站" };
      throw new Error("INVALID_PATH");
    }

    if (parts[0] === "网络挂载") {
      if (parts.length === 1) return { kind: "virtual", displayPath: "/网络挂载", virtualId: "mounts" };
      if (parts[1] === "新增网络挂载") return { kind: "virtual", displayPath: "/网络挂载/新增网络挂载", virtualId: "mount-add" };
      return { kind: "mount", displayPath: `/${parts.join("/")}`, mountId: parts[1], filePath: `/${parts.slice(2).join("/")}` };
    }

    return { kind: "space", displayPath: input, space: "personal", filePath: path.posix.normalize(`/${parts.join("/")}`) };
  }
}
