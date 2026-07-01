import { enUS, zhCN, type WebboxLanguage } from "../../../packages/shared/src/language";

export const text: WebboxLanguage = structuredClone(zhCN);

export function setLanguage(language: "zh-CN" | "en-US"): void {
  const next = language === "en-US" ? enUS : zhCN;
  const mutable = text as unknown as Record<string, unknown>;
  for (const key of Object.keys(mutable)) {
    delete mutable[key];
  }
  Object.assign(mutable, structuredClone(next));
  document.documentElement.lang = language;
}

export function applyTheme(theme: "light" | "dark" | "system"): void {
  document.documentElement.dataset.theme = theme;
}
