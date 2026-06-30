import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const originalEnv = { ...process.env };

describe("loadConfig", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("loads host, port, public URL, and log file from runtime environment", () => {
    const cwd = process.cwd();
    process.env.WEBBOX_HOST = "0.0.0.0";
    process.env.WEBBOX_PORT = "8989";
    process.env.WEBBOX_PUBLIC_URL = "http://0.0.0.0:8989";
    process.env.WEBBOX_LOG_FILE = "logs/runtime.log";

    const config = loadConfig();

    expect(config.host).toBe("0.0.0.0");
    expect(config.port).toBe(8989);
    expect(config.publicUrl).toBe("http://0.0.0.0:8989");
    expect(config.logFile).toBe(path.join(cwd, "logs", "runtime.log"));
  });

  it("allows commented log-file config to disable file logging", () => {
    process.env.WEBBOX_LOG_FILE = "";

    const config = loadConfig();

    expect(config.logFile).toBeUndefined();
  });
});
