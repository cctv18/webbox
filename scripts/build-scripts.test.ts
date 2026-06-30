import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

async function readProjectFile(relativePath: string): Promise<string> {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

describe("webbox build and runtime scripts", () => {
  it("keeps tests behind an explicit build flag", async () => {
    const powershell = await readProjectFile("scripts/build.ps1");
    const shell = await readProjectFile("scripts/build.sh");

    expect(powershell).toContain("[switch]$Test");
    expect(powershell).not.toContain('Invoke-Step "Run tests" { corepack pnpm -C $Root test }');
    expect(shell).toContain("RUN_TESTS=0");
    expect(shell).toMatch(/--test\|-test\)/);
    expect(shell).not.toContain('run_step "Run tests" corepack pnpm -C "$ROOT" test');
  });

  it("does not depend on the old external source tree", async () => {
    const compiler = await readProjectFile("scripts/compile-webbox.mjs");

    expect(compiler).not.toMatch(/ko(?:dbox)_web/i);
    expect(compiler).toContain('path.join(projectRoot, "plugins")');
  });

  it("writes a complete front-end and back-end manifest into out", async () => {
    const compiler = await readProjectFile("scripts/compile-webbox.mjs");

    expect(compiler).toContain('"webbox-server.js"');
    expect(compiler).toContain('"package.json"');
    expect(compiler).toContain('"web"');
    expect(compiler).toContain("bundleServer");
    expect(compiler).toContain("vite");
  });

  it("launchers install runtime dependencies locally and keep the node process in the foreground", async () => {
    const compiler = await readProjectFile("scripts/compile-webbox.mjs");

    expect(compiler).toContain("ensure_runtime_dependencies");
    expect(compiler).toContain("npm install --omit=dev");
    expect(compiler).toContain("Starting Webbox on");
    expect(compiler).toContain("exec node");
    expect(compiler).not.toContain("Start-Process");
  });
});
