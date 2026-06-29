import path from "node:path";

export interface WebboxConfig {
  port: number;
  storageRoot: string;
  dataRoot: string;
  pluginRoot: string;
  webDist: string;
}

export function loadConfig(overrides: Partial<WebboxConfig> = {}): WebboxConfig {
  const projectRoot = path.resolve(process.cwd());
  const dataRoot = path.resolve(overrides.dataRoot ?? process.env.WEBBOX_DATA ?? path.join(projectRoot, "data"));
  return {
    port: Number(overrides.port ?? process.env.WEBBOX_PORT ?? 8787),
    storageRoot: path.resolve(overrides.storageRoot ?? process.env.WEBBOX_ROOT ?? path.join(dataRoot, "files")),
    dataRoot,
    pluginRoot: path.resolve(overrides.pluginRoot ?? process.env.WEBBOX_PLUGIN_ROOT ?? path.join(projectRoot, "plugins")),
    webDist: path.resolve(overrides.webDist ?? process.env.WEBBOX_WEB_DIST ?? path.join(projectRoot, "apps", "web", "dist"))
  };
}
