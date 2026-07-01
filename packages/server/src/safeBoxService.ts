import fs from "node:fs/promises";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { SafeBoxStatus } from "@webbox/shared";
import { zhCN } from "@webbox/shared";
import { MetadataStore } from "./metadataStore.js";

function hashPassword(password: string, salt: string): string {
  const md5 = createHash("md5").update(`${salt}${password}`).digest("hex");
  return createHash("sha256").update(`${salt}${md5}`).digest("hex");
}

function verifyPassword(password: string, salt: string, expected: string): boolean {
  const actual = Buffer.from(hashPassword(password, salt), "hex");
  const wanted = Buffer.from(expected, "hex");
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

export class SafeBoxService {
  private unlocked = false;
  private readonly maxAttempts = 5;
  private readonly cooldownMs = 5 * 60 * 1000;

  constructor(private readonly metadata: MetadataStore, private readonly safePath: string) {}

  async status(): Promise<SafeBoxStatus> {
    const state = await this.metadata.load();
    if (!state.safeBox) return { state: "notOpen", message: zhCN.safeBox.notOpen, path: this.safePath };
    const cooldownSeconds = this.remainingCooldownSeconds(state.safeBox.cooldownUntil);
    if (!this.unlocked) return { state: "locked", message: cooldownSeconds ? this.cooldownMessage(cooldownSeconds) : zhCN.safeBox.locked, path: this.safePath, cooldownSeconds };
    return { state: "unlocked", message: zhCN.safeBox.unlocked, path: this.safePath };
  }

  async open(password: string): Promise<SafeBoxStatus> {
    if (!password.trim()) throw new Error("INVALID_INPUT");
    const salt = randomBytes(16).toString("hex");
    await fs.mkdir(this.safePath, { recursive: true });
    await this.metadata.update((state) => {
      state.safeBox = { salt, passwordHash: hashPassword(password, salt), failedAttempts: 0 };
    });
    this.unlocked = true;
    return this.status();
  }

  async login(password: string): Promise<SafeBoxStatus> {
    const state = await this.metadata.load();
    if (!state.safeBox) throw new Error("SAFE_BOX_NOT_OPEN");
    const cooldownSeconds = this.remainingCooldownSeconds(state.safeBox.cooldownUntil);
    if (cooldownSeconds > 0) throw new Error("SAFE_BOX_COOLDOWN");
    if (!verifyPassword(password, state.safeBox.salt, state.safeBox.passwordHash)) {
      await this.metadata.update((next) => {
        if (!next.safeBox) return;
        const failedAttempts = (next.safeBox.failedAttempts ?? 0) + 1;
        next.safeBox.failedAttempts = failedAttempts;
        if (failedAttempts >= this.maxAttempts) next.safeBox.cooldownUntil = new Date(Date.now() + this.cooldownMs).toISOString();
      });
      if (failedAttemptsReached(state.safeBox.failedAttempts ?? 0, this.maxAttempts)) throw new Error("SAFE_BOX_COOLDOWN");
      throw new Error("ERROR_USER_PASSWORD_ERROR");
    }
    await this.metadata.update((next) => {
      if (!next.safeBox) return;
      next.safeBox.failedAttempts = 0;
      delete next.safeBox.cooldownUntil;
    });
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
      state.safeBox = { salt, passwordHash: hashPassword(nextPassword, salt), failedAttempts: 0 };
    });
    this.unlocked = true;
    return this.status();
  }

  async assertUnlocked(): Promise<void> {
    if ((await this.status()).state !== "unlocked") throw new Error("SAFE_BOX_LOCKED");
  }

  private remainingCooldownSeconds(cooldownUntil?: string): number {
    if (!cooldownUntil) return 0;
    const remainingMs = new Date(cooldownUntil).getTime() - Date.now();
    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
  }

  private cooldownMessage(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `密码冷却中，请在${minutes}分${rest.toString().padStart(2, "0")}秒后重试`;
  }
}

function failedAttemptsReached(previousAttempts: number, maxAttempts: number): boolean {
  return previousAttempts + 1 >= maxAttempts;
}
