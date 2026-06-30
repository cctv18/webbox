import { describe, expect, it } from "vitest";
import type {
  ActivityRecord,
  AdminStorageConfig,
  MemoEntry,
  NotificationItem,
  SafeBoxStatus,
  TreeNode
} from "../src/types.js";

describe("shared api contracts", () => {
  it("describes explorer tree nodes", () => {
    const node: TreeNode = {
      id: "personal",
      label: "个人空间",
      section: "locations",
      kind: "directory",
      path: "/",
      icon: "folder"
    };

    expect(node.section).toBe("locations");
    expect(node.path).toBe("/");
  });

  it("describes safe box state", () => {
    const status: SafeBoxStatus = {
      state: "locked",
      message: "请先解锁私密保险箱",
      path: "/"
    };

    expect(status.state).toBe("locked");
  });

  it("describes metadata and admin payloads", () => {
    const notification: NotificationItem = {
      id: "n1",
      title: "文件已更新",
      message: "a.txt 已变化",
      createdAt: "2026-06-30T00:00:00.000Z",
      read: false,
      level: "info"
    };
    const activity: ActivityRecord = {
      id: "a1",
      action: "file.rename",
      path: "/docs/a.txt",
      message: "重命名文件",
      createdAt: notification.createdAt
    };
    const memo: MemoEntry = {
      id: "m1",
      path: "/docs",
      content: "hello **webbox**",
      createdAt: notification.createdAt,
      updatedAt: notification.createdAt,
      attachments: []
    };
    const config: AdminStorageConfig = {
      personal: "data/files",
      photos: "data/photos",
      documents: "data/documents",
      music: "data/music",
      videos: "data/videos",
      safeBox: "data/safe",
      recycle: "data/recycle"
    };

    expect(notification.read).toBe(false);
    expect(activity.path).toContain("/docs");
    expect(memo.attachments).toEqual([]);
    expect(config.safeBox).toContain("safe");
  });
});
