import fs from "node:fs/promises";
import path from "node:path";
import type { PluginManifest } from "@webbox/shared";

const corePlugins: Record<string, Pick<PluginManifest, "category" | "extensions">> = {
  pdfjs: { category: "viewer", extensions: ["pdf"] },
  htmlEditor: { category: "editor", extensions: ["html", "htm", "txt", "md", "json", "js", "css", "ts", "tsx"] },
  webodf: { category: "viewer", extensions: ["odt", "ods", "odp"] },
  yzOffice: { category: "editor", extensions: ["doc", "docx", "xls", "xlsx", "ppt", "pptx"] },
  picasa: { category: "viewer", extensions: ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"] },
  photoSwipe: { category: "viewer", extensions: ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"] },
  jPlayer: { category: "media", extensions: ["mp3", "wav", "ogg", "flac"] },
  DPlayer: { category: "media", extensions: ["mp4", "webm", "mkv", "mov", "avi"] },
  fileThumb: { category: "thumbnail", extensions: ["jpg", "jpeg", "png", "gif", "webp", "mp4", "pdf"] }
};

const blocked = new Set(["adminer", "client"]);

function displayNameFromPackage(id: string, value: unknown): string {
  if (!value || typeof value !== "object") return id;
  const record = value as Record<string, unknown>;
  return String(record.displayName ?? record.name ?? record.title ?? id);
}

export async function discoverPlugins(pluginRoot: string, enabled: Record<string, boolean>): Promise<PluginManifest[]> {
  try {
    const entries = await fs.readdir(pluginRoot, { withFileTypes: true });
    const manifests = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
      const id = entry.name;
      const known = corePlugins[id];
      let displayName = id;
      try {
        const raw = await fs.readFile(path.join(pluginRoot, id, "package.json"), "utf8");
        displayName = displayNameFromPackage(id, JSON.parse(raw));
      } catch {
        displayName = id;
      }
      const compatible = Boolean(known) && !blocked.has(id);
      return {
        id,
        name: displayName,
        enabled: compatible ? Boolean(enabled[id]) : false,
        compatible,
        reason: compatible ? undefined : blocked.has(id) ? "Removed from Webbox scope" : "Not a first-phase core viewer/editor/media plugin",
        staticBaseUrl: `/plugins/${id}/`,
        extensions: known?.extensions ?? [],
        category: known?.category ?? "unsupported"
      } satisfies PluginManifest;
    }));
    return manifests.sort((a, b) => a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}
