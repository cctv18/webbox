import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createKodboxShimScript, discoverPlugins } from "../src/index.js";

describe("plugin registry", () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "webbox-plugins-"));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("marks core viewer plugins compatible and adminer/client incompatible", async () => {
    await fs.mkdir(path.join(root, "pdfjs"), { recursive: true });
    await fs.writeFile(path.join(root, "pdfjs", "package.json"), JSON.stringify({ name: "pdfjs", displayName: "PDF.js" }));
    await fs.mkdir(path.join(root, "adminer"), { recursive: true });
    await fs.writeFile(path.join(root, "adminer", "package.json"), JSON.stringify({ name: "adminer" }));
    await fs.mkdir(path.join(root, "client"), { recursive: true });
    await fs.writeFile(path.join(root, "client", "package.json"), JSON.stringify({ name: "client" }));

    const plugins = await discoverPlugins(root, { pdfjs: true, adminer: true, client: true });
    expect(plugins.find((plugin) => plugin.id === "pdfjs")?.compatible).toBe(true);
    expect(plugins.find((plugin) => plugin.id === "pdfjs")?.enabled).toBe(true);
    expect(plugins.find((plugin) => plugin.id === "adminer")?.compatible).toBe(false);
    expect(plugins.find((plugin) => plugin.id === "client")?.compatible).toBe(false);
  });

  it("provides a browser shim for Kodbox-style core plugin globals", () => {
    const shim = createKodboxShimScript();
    expect(shim).toContain("window.G");
    expect(shim).toContain("window.kodReady");
    expect(shim).toContain("registerViewer");
  });
});
