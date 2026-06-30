import fs from "node:fs/promises";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { SafeBoxStatus } from "@webbox/shared";
import { zhCN } from "@webbox/shared";
import { MetadataStore } from "./metadataStore.js";

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 32).toString("hex");
}

function verifyPassword(password: string, salt: string, expected: string): boolean {
  const actual = Buffer.from(hashPassword(password, salt), "hex");
  const wanted = Buffer.from(expected, "hex");
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

export class SafeBoxService {
  private unlocked = false;

  constructor(private readonly metadata: MetadataStore, private readonly safePath: string) {}

  async status(): Promise<SafeBoxStatus> {
    const state = await this.metadata.load();
    if (!state.safeBox) return { state: "notOpen", message: zhCN.safeBox.notOpen, path: this.safePath };
    if (!this.unlocked) return { state: "locked", message: zhCN.safeBox.locked, path: this.safePath };
    return { state: "unlocked", message: zhCN.safeBox.unlocked, path: this.safePath };
  }

  async open(password: string): Promise<SafeBoxStatus> {
    if (!password.trim()) throw new Error("INVALID_INPUT");
    const salt = randomBytes(16).toString("hex");
    await fs.mkdir(this.safePath, { recursive: true });
    await this.metadata.update((state) => {
      state.safeBox = { salt, passwordHash: hashPassword(password, salt) };
    });
    this.unlocked = true;
    return this.status();
  }

  async login(password: string): Promise<SafeBoxStatus> {
    const state = await this.metadata.load();
    if (!state.safeBox) throw new Error("SAFE_BOX_NOT_OPEN");
    if (!verifyPassword(password, state.safeBox.salt, state.safeBox.passwordHash)) {
      throw new Error("ERROR_USER_PASSWORD_ERROR");
    }
    this.unlocked = true;
    return this.status();
  }

  logout(): void {
    this.unlocked = false;
  }

  async changePassword(oldPassword: string, nextPassword: string): Promise<SafeBoxStatus> {
    await this.login(oldPassword);
    if (!nextPassword.trim()) throw new Error("INVALID_INPUT");
    const salt = randomBytes(16).toString("hex");
    await this.metadata.update((state) => {
      state.safeBox = { salt, passwordHash: hashPassword(nextPassword, salt) };
    });
    this.unlocked = true;
    return this.status();
  }

  async assertUnlocked(): Promise<void> {
    if ((await this.status()).state !== "unlocked") throw new Error("SAFE_BOX_LOCKED");
  }
}
