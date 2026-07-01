import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MetadataStore } from "../src/metadataStore.js";
import { SafeBoxService } from "../src/safeBoxService.js";

describe("SafeBoxService", () => {
  let root: string;
  let safeDir: string;
  let service: SafeBoxService;

  beforeEach(async () => {
    const testRoot = path.join(process.cwd(), ".webbox-test-data");
    await fs.mkdir(testRoot, { recursive: true });
    root = await fs.mkdtemp(path.join(testRoot, "safe-"));
    safeDir = path.join(root, "safe-box");
    service = new SafeBoxService(new MetadataStore(path.join(root, "metadata.json")), safeDir);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("opens, locks, logs in, logs out, and changes password", async () => {
    expect((await service.status()).state).toBe("notOpen");
    await service.open("secret");
    expect((await service.status()).state).toBe("unlocked");
    service.logout();
    expect((await service.status()).state).toBe("locked");
    await expect(service.login("bad")).rejects.toThrow("ERROR_USER_PASSWORD_ERROR");
    await service.login("secret");
    expect((await service.status()).state).toBe("unlocked");
    await service.changePassword("secret", "next-secret");
    service.logout();
    await expect(service.login("secret")).rejects.toThrow("ERROR_USER_PASSWORD_ERROR");
    await service.login("next-secret");
    expect((await service.status()).state).toBe("unlocked");
  });

  it("stores salted md5-sha256 hashes and cools down after five failed attempts", async () => {
    await service.open("secret");
    const state = await new MetadataStore(path.join(root, "metadata.json")).load();
    expect(state.safeBox?.passwordHash).toMatch(/^[a-f0-9]{64}$/);
    const salt = state.safeBox?.salt ?? "";
    const md5 = createHash("md5").update(`${salt}secret`).digest("hex");
    expect(state.safeBox?.passwordHash).toBe(createHash("sha256").update(`${salt}${md5}`).digest("hex"));
    expect(state.safeBox?.passwordHash).not.toContain("secret");
    service.logout();

    for (let i = 0; i < 5; i += 1) {
      await expect(service.login("bad")).rejects.toThrow(i === 4 ? "SAFE_BOX_COOLDOWN" : "ERROR_USER_PASSWORD_ERROR");
    }
    await expect(service.login("secret")).rejects.toThrow("SAFE_BOX_COOLDOWN");

    const cooldownState = await service.status();
    expect(cooldownState.cooldownSeconds).toBeGreaterThan(0);
  });
});
