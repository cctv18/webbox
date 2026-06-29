export type FileKind = "file" | "directory";

export interface FileItem {
  name: string;
  path: string;
  kind: FileKind;
  size: number;
  modifiedAt: string;
  extension: string;
}

export interface BootstrapData {
  user: {
    id: "local";
    name: "Local User";
    isAdmin: true;
    permissions: ["*"];
  };
  features: Record<string, boolean>;
  theme: string;
  language: string;
  plugins: PluginManifest[];
}

export interface PluginManifest {
  id: string;
  name: string;
  enabled: boolean;
  compatible: boolean;
  reason?: string;
  staticBaseUrl?: string;
  extensions: string[];
  category: "viewer" | "editor" | "media" | "thumbnail" | "unsupported";
}
