export type FileKind = "file" | "directory";
export type TreeSection = "locations" | "tools" | "mounts";
export type NotificationLevel = "info" | "success" | "warning" | "error";
export type SafeBoxState = "notOpen" | "locked" | "unlocked";
export type ViewMode = "list" | "grid";

export interface FileItem {
  name: string;
  path: string;
  kind: FileKind;
  size: number;
  modifiedAt: string;
  createdAt?: string;
  accessedAt?: string;
  extension: string;
  icon?: string;
  favorite?: boolean;
}

export interface FileDetails extends FileItem {
  description?: string;
  tags: string[];
  absolutePath?: string;
}

export interface RecycleRecord {
  recycleId: string;
  name: string;
  originalPath: string;
  deletedAt: string;
  kind: FileKind;
  size: number;
}

export interface TreeNode {
  id: string;
  label: string;
  section: TreeSection;
  kind: "directory" | "virtual" | "mount";
  path: string;
  icon: string;
  children?: TreeNode[];
  locked?: boolean;
}

export interface AdminStorageConfig {
  personal: string;
  photos: string;
  documents: string;
  music: string;
  videos: string;
  safeBox: string;
  recycle: string;
}

export interface SafeBoxStatus {
  state: SafeBoxState;
  message: string;
  path: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  level: NotificationLevel;
  targetPath?: string;
}

export interface ActivityRecord {
  id: string;
  action: string;
  path: string;
  message: string;
  createdAt: string;
  details?: Record<string, unknown>;
}

export interface MemoAttachment {
  id: string;
  name: string;
  path: string;
  size: number;
}

export interface MemoEntry {
  id: string;
  path: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  attachments: MemoAttachment[];
}

export interface PathMetadata {
  path: string;
  description: string;
  tags: string[];
}

export interface MountDefinition {
  id: string;
  type: "local" | "ftp" | "webdav";
  name: string;
  root: string;
  enabled: boolean;
  username?: string;
}

export interface ExplorerEvent {
  id: string;
  type: "file" | "metadata" | "notification" | "config" | "plugin";
  message: string;
  path?: string;
  createdAt: string;
}

export interface BootstrapData {
  user: {
    id: "local";
    name: "Local User";
    isAdmin: true;
    permissions: readonly ["*"];
  };
  features: Record<string, boolean>;
  theme: string;
  language: string;
  plugins: readonly PluginManifest[];
  tree?: readonly TreeNode[];
  storage?: AdminStorageConfig;
  notifications?: readonly NotificationItem[];
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
