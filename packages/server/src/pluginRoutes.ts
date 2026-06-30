import express, { type Express } from "express";
import { createKodboxShimScript, discoverPlugins } from "@webbox/plugin-compat";
import { ok } from "@webbox/shared";
import type { MetadataStore } from "./metadataStore.js";
import type { WebboxLogger } from "./logger.js";

export function mountPluginRoutes(app: Express, pluginRoot: string, metadata: MetadataStore, logger: WebboxLogger): void {
  app.get("/api/plugins", async (_req, res) => {
    logger.info("plugin.list", { pluginRoot });
    const state = await metadata.load();
    res.json(ok(await discoverPlugins(pluginRoot, state.plugins)));
  });

  app.get("/api/plugins/kodbox-shim.js", (_req, res) => {
    logger.info("plugin.shim", { pluginRoot });
    res.type("application/javascript").send(createKodboxShimScript());
  });

  app.use("/plugins", express.static(pluginRoot, { fallthrough: true }));
}
