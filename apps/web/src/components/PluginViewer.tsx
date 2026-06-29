import type { PluginManifest } from "@webbox/shared";

interface PluginViewerProps {
  fileName?: string;
  plugins: PluginManifest[];
}

export function PluginViewer({ fileName = "", plugins }: PluginViewerProps) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const plugin = plugins.find((item) => item.enabled && item.compatible && item.extensions.includes(extension));
  return (
    <section className="viewer">
      <h3>文件预览</h3>
      <p>{plugin ? `${plugin.name} · ${plugin.category}` : "内置预览"}</p>
    </section>
  );
}
