import fs from "node:fs";
import path from "node:path";
import type { Response } from "express";
import type { ExplorerEvent } from "@webbox/shared";
import type { WebboxLogger } from "./logger.js";

export class WatchService {
  private readonly clients = new Set<Response>();
  private readonly watchers: fs.FSWatcher[] = [];

  constructor(private readonly roots: string[], private readonly logger: WebboxLogger, private readonly onEvent?: (event: ExplorerEvent) => void | Promise<void>) {}

  start(): void {
    for (const root of this.roots) {
      fs.mkdirSync(root, { recursive: true });
      try {
        const watcher = fs.watch(root, { recursive: process.platform === "win32" }, (_event, fileName) => {
          const filePath = fileName ? path.join(root, String(fileName)) : root;
          void this.broadcast({ type: "file", path: filePath, message: "文件系统发生变化" });
        });
        watcher.on("error", (error) => this.logger.warn("watcher.failed", { root, error: error.message }));
        this.watchers.push(watcher);
        this.logger.info("watcher.start", { root });
      } catch (error) {
        this.logger.warn("watcher.failed", { root, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  addClient(response: Response): void {
    this.clients.add(response);
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });
    response.write("\n");
    response.on("close", () => this.clients.delete(response));
  }

  async broadcast(input: Omit<ExplorerEvent, "id" | "createdAt">): Promise<void> {
    const event: ExplorerEvent = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      ...input
    };
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.clients) client.write(payload);
    await this.onEvent?.(event);
  }

  stop(): void {
    for (const watcher of this.watchers) watcher.close();
    this.watchers.length = 0;
  }
}
