import { randomUUID } from "node:crypto";
import type { NotificationItem, NotificationLevel } from "@webbox/shared";
import { MetadataStore } from "./metadataStore.js";

export class NotificationService {
  constructor(private readonly metadata: MetadataStore) {}

  async add(input: { title: string; message: string; level?: NotificationLevel; targetPath?: string }): Promise<NotificationItem> {
    const item: NotificationItem = {
      id: randomUUID(),
      title: input.title,
      message: input.message,
      level: input.level ?? "info",
      targetPath: input.targetPath,
      read: false,
      createdAt: new Date().toISOString()
    };
    await this.metadata.update((state) => {
      state.notificationItems.unshift(item);
      state.notificationItems = state.notificationItems.slice(0, 200);
    });
    return item;
  }

  async list(): Promise<NotificationItem[]> {
    return (await this.metadata.load()).notificationItems;
  }

  async markRead(id: string): Promise<void> {
    await this.metadata.update((state) => {
      state.notificationItems = state.notificationItems.map((item) => item.id === id ? { ...item, read: true } : item);
    });
  }

  async markAllRead(): Promise<void> {
    await this.metadata.update((state) => {
      state.notificationItems = state.notificationItems.map((item) => ({ ...item, read: true }));
    });
  }

  async clear(): Promise<void> {
    await this.metadata.update((state) => {
      state.notificationItems = [];
    });
  }
}
