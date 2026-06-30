import path from "node:path";

export interface WebboxConfig {
  host: string;
  port: number;
  publicUrl: string;
  storageRoot: string;
  dataRoot: string;
  pluginRoot: string;
  webDist: string;
  logFile?: string;
}

function resolveOptionalPath(value: string | undefined, baseDir: string): string | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  return path.resolve(baseDir, value);
}

export function loadConfig(overrides: Partial<WebboxConfig> = {}): WebboxConfig {
  const projectRoot = path.resolve(process.cwd());
  const host = String(overrides.host ?? process.env.WEBBOX_HOST ?? "127.0.0.1");
  const port = Number(overrides.port ?? process.env.WEBBOX_PORT ?? 8787);
  const dataRoot = path.resolve(overrides.dataRoot ?? process.env.WEBBOX_DATA ?? path.join(projectRoot, "data"));
  return {
    host,
    port,
    publicUrl: String(overrides.publicUrl ?? process.env.WEBBOX_PUBLIC_URL ?? `http://${host}:${port}`),
    storageRoot: path.resolve(overrides.storageRoot ?? process.env.WEBBOX_ROOT ?? path.join(dataRoot, "files")),
    dataRoot,
    pluginRoot: path.resolve(overrides.pluginRoot ?? process.env.WEBBOX_PLUGIN_ROOT ?? path.join(projectRoot, "plugins")),
    webDist: path.resolve(overrides.webDist ?? process.env.WEBBOX_WEB_DIST ?? path.join(projectRoot, "apps", "web", "dist")),
    logFile: overrides.logFile ?? resolveOptionalPath(process.env.WEBBOX_LOG_FILE, projectRoot)
  };
}
