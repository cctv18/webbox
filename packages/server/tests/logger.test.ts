import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "../src/logger.js";

describe("createLogger", () => {
  let testRoot: string;

  beforeEach(async () => {
    const parent = path.join(process.cwd(), ".webbox-test-data");
    await fs.mkdir(parent, { recursive: true });
    testRoot = await fs.mkdtemp(path.join(parent, "logger-"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (testRoot) await fs.rm(testRoot, { recursive: true, force: true });
  });

  it("writes timestamped lines to terminal and log file", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const logFile = path.join(testRoot, "webbox.log");
    const logger = createLogger({ logFile });

    logger.info("file.list", { path: "/" });
    await logger.flush();

    const fileText = await fs.readFile(logFile, "utf8");
    expect(info).toHaveBeenCalledWith(expect.stringContaining("file.list"));
    expect(fileText).toContain("file.list");
    expect(fileText).toContain("\"path\":\"/\"");
    expect(fileText).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  });
});
