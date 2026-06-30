import fs from "node:fs/promises";
import path from "node:path";

export type ServerConf = Record<string, string>;

export async function readServerConf(filePath: string): Promise<ServerConf> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const result: ServerConf = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      result[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
    }
    return result;
  } catch {
    return {};
  }
}

export async function updateServerConfValue(filePath: string, key: string, value: string): Promise<void> {
  let lines: string[] = [];
  try {
    lines = (await fs.readFile(filePath, "utf8")).split(/\r?\n/);
  } catch {
    lines = [];
  }
  let updated = false;
  lines = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed.includes("=")) return line;
    const [candidate] = trimmed.split("=", 1);
    if (candidate.trim() !== key) return line;
    updated = true;
    return `${key}=${value}`;
  });
  if (!updated) lines.push(`${key}=${value}`);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${lines.join("\n").replace(/\n+$/, "")}\n`, "utf8");
}
