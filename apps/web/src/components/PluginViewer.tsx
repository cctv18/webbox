import type { PluginManifest } from "@webbox/shared";
import { text } from "../i18n";

interface PluginViewerProps {
  fileName?: string;
  plugins: PluginManifest[];
}

export function PluginViewer({ fileName = "", plugins }: PluginViewerProps) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const plugin = plugins.find((item) => item.enabled && item.compatible && item.extensions.includes(extension));
  return (
    <section className="viewer">
      <h3>{text.pluginViewer.title}</h3>
      <p>{plugin ? `${plugin.name} · ${plugin.category}` : text.pluginViewer.builtinPreview}</p>
    </section>
  );
}
