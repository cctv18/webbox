import express, { type Express } from "express";
import { createKodboxShimScript, discoverPlugins } from "@webbox/plugin-compat";
import { ok } from "@webbox/shared";
import type { MetadataStore } from "./metadataStore.js";

export function mountPluginRoutes(app: Express, pluginRoot: string, metadata: MetadataStore): void {
  app.get("/api/plugins", async (_req, res) => {
    const state = await metadata.load();
    res.json(ok(await discoverPlugins(pluginRoot, state.plugins)));
  });

  app.get("/api/plugins/kodbox-shim.js", (_req, res) => {
    res.type("application/javascript").send(createKodboxShimScript());
  });

  app.use("/plugins", express.static(pluginRoot, { fallthrough: true }));
}
